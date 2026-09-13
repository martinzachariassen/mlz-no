import { describe, expect, test } from "bun:test";
import { dedent, esc, html, raw, render, unraw } from "./html.js";

/**
 * html.js decides how every generated file is indented and which optional
 * lines survive, and it does it with two private sentinel characters and a
 * regex that measures trailing whitespace. None of that announces itself when
 * it breaks: the build still succeeds, the page still renders, and the damage
 * shows up as a committed file with drifting indentation — or, for a code
 * block, as leading whitespace a reader copies out along with the snippet.
 *
 * So the rules are pinned here rather than inferred from whatever the current
 * pages happen to look like. Each test states one rule, so a failure names the
 * rule that changed instead of handing over a page-sized diff.
 */

describe("esc", () => {
  test("escapes the characters that can break out of text or an attribute", () => {
    expect(esc(`<a href="x">&</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;",
    );
  });

  test("leaves ordinary prose, including apostrophes, alone", () => {
    expect(esc("Martin's résumé — 59°N")).toBe("Martin's résumé — 59°N");
  });

  test("stringifies non-strings rather than throwing", () => {
    expect(esc(42)).toBe("42");
  });
});

describe("dedent", () => {
  test("strips the common indent from every line but the first", () => {
    expect(dedent("\n    <a>\n      <b />\n    </a>")).toBe(
      "\n<a>\n  <b />\n</a>",
    );
  });

  test("ignores blank lines when measuring the common indent", () => {
    expect(dedent("\n    <a>\n\n    </a>")).toBe("\n<a>\n\n</a>");
  });

  test("leaves text that has no common indent unchanged", () => {
    expect(dedent("<a>\n<b />")).toBe("<a>\n<b />");
  });
});

describe("render", () => {
  test("joins an array with newlines so a .map() can go straight in a hole", () => {
    expect(render(["<li>a</li>", "<li>b</li>"])).toBe("<li>a</li>\n<li>b</li>");
  });

  test("flattens nested arrays", () => {
    expect(render([["a"], [["b"]]])).toBe("a\nb");
  });

  test("drops the values that mean 'nothing here'", () => {
    expect(render(["a", "", null, undefined, false, "b"])).toBe("a\nb");
    expect(render("")).toBe("");
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
    expect(render(false)).toBe("");
  });

  test("keeps 0, which is a value and not an absence", () => {
    expect(render(0)).toBe("0");
  });
});

describe("html", () => {
  test("dedents the template and trims the leading and trailing newline", () => {
    expect(html`
      <a>
        <b />
      </a>`).toBe("<a>\n  <b />\n</a>");
  });

  test("shifts an embedded block to the column of the hole it sits in", () => {
    const child = html`
      <li>a</li>
      <li>b</li>`;
    expect(html`
      <ul>
        ${child}
      </ul>`).toBe("<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>");
  });

  test("indents correctly through three levels of composition", () => {
    const inner = html`<b />`;
    const middle = html`
      <div>
        ${inner}
      </div>`;
    expect(html`
      <section>
        ${middle}
      </section>`).toBe("<section>\n  <div>\n    <b />\n  </div>\n</section>");
  });

  test("drops the whole line when a hole alone on it renders to nothing", () => {
    const caption = "";
    expect(html`
      <figure>
        ${caption}
        <img />
      </figure>`).toBe("<figure>\n  <img />\n</figure>");
  });

  test("drops a trailing hole's line rather than leaving a blank one", () => {
    expect(html`
      <figure>
        <img />
        ${""}
      </figure>`).toBe("<figure>\n  <img />\n</figure>");
  });

  test("keeps the line when an empty hole shares it with markup", () => {
    expect(html`<a class="x${""}">y</a>`).toBe(`<a class="x">y</a>`);
  });

  test("keeps blank lines that are inside a value, not a hole of their own", () => {
    expect(html`
      <pre>${"a\n\nb"}</pre>`).toBe("<pre>a\n\nb</pre>");
  });
});

describe("raw", () => {
  /**
   * The regression this whole mechanism exists for. A <pre><code> block's line
   * breaks are content: if the re-indenting pass treats them as layout, the
   * snippet gains a level of leading whitespace for every level of composition
   * between it and the page, and that whitespace is visible on the rendered
   * page and comes along when a reader copies the code.
   */
  test("keeps marked line breaks flush after nesting, where plain ones indent", () => {
    const marked = html`<pre><code>${raw("one\ntwo")}</code></pre>`;
    const plain = html`<pre><code>${"one\ntwo"}</code></pre>`;

    const nest = (child) => html`
      <section>
        <figure>
          ${child}
        </figure>
      </section>`;

    expect(unraw(nest(marked))).toContain("<pre><code>one\ntwo</code></pre>");
    expect(nest(plain)).toContain("<pre><code>one\n    two</code></pre>");
  });

  test("round-trips through unraw", () => {
    expect(unraw(raw("a\nb\n\nc"))).toBe("a\nb\n\nc");
  });

  test("leaves text without line breaks untouched", () => {
    expect(unraw(raw("abc"))).toBe("abc");
  });
});
