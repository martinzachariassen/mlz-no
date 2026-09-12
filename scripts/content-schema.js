/**
 * The spec for everything under content/.
 *
 * scripts/build-content.js renders whatever it is handed, so without this file
 * a typo is invisible: a misspelled key is silently ignored, a block type the
 * renderer has never heard of throws halfway through a page, and a field the
 * generator stopped reading lives on in the JSON looking meaningful. This
 * module is the contract instead — every key that content/ may contain is
 * listed here, anything else is an error, and the error names the JSON path.
 *
 * Adding a field to the site is therefore two edits, in this order: describe
 * it here, then render it in build-content.js. The spec is prose in
 * content/README.md; this file is the enforced version of it.
 */

/* ----------------------------------------------------------- combinators */

/** A schema is `(value, path, errors) => void`, appending failures to errors. */

const report = (errors, path, message) =>
  errors.push(`${path || "(root)"}: ${message}`);

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const typeName = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  if (typeof value === "string") return "a string";
  return `${value}`;
};

/** Mark a key as allowed to be absent. */
const opt = (schema) => Object.assign(schema.bind(null), { optional: true });

const quote = (value) => JSON.stringify(value);

/** Edit distance, used only to guess which key someone meant. */
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const swap = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = swap;
    }
  }
  return row[b.length];
}

function nearest(word, candidates) {
  const typed = word.toLowerCase();
  let best = null;
  let score = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const other = candidate.toLowerCase();
    // An abbreviation ("lang" for "language") is far away by edit distance but
    // is the likeliest thing someone meant, so treat a shared prefix as close.
    const d =
      typed.startsWith(other) || other.startsWith(typed)
        ? 1
        : distance(typed, other);
    if (d < score) {
      score = d;
      best = candidate;
    }
  }
  return score <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}

const didYouMean = (key, candidates) => {
  const guess = nearest(key, candidates);
  return guess ? ` (did you mean ${quote(guess)}?)` : "";
};

function str({ pattern, hint, allowEmpty = false } = {}) {
  return (value, path, errors) => {
    if (typeof value !== "string") {
      return report(errors, path, `expected a string, got ${typeName(value)}`);
    }
    if (!allowEmpty && value.trim() === "") {
      return report(errors, path, "expected a non-empty string");
    }
    if (pattern && !pattern.test(value)) {
      report(errors, path, hint ?? `${quote(value)} does not match ${pattern}`);
    }
  };
}

const oneOf =
  (...allowed) =>
  (value, path, errors) => {
    if (allowed.includes(value)) return;
    const suffix = typeof value === "string" ? didYouMean(value, allowed) : "";
    report(
      errors,
      path,
      `expected one of ${allowed.map(quote).join(", ")}, got ${quote(value)}${suffix}`,
    );
  };

const int =
  ({ min = Number.MIN_SAFE_INTEGER } = {}) =>
  (value, path, errors) => {
    if (!Number.isInteger(value)) {
      return report(
        errors,
        path,
        `expected an integer, got ${typeName(value)}`,
      );
    }
    if (value < min)
      report(errors, path, `expected at least ${min}, got ${value}`);
  };

const arr =
  (item, { min = 1 } = {}) =>
  (value, path, errors) => {
    if (!Array.isArray(value)) {
      return report(errors, path, `expected an array, got ${typeName(value)}`);
    }
    if (value.length < min) {
      return report(
        errors,
        path,
        `expected at least ${min} item${min === 1 ? "" : "s"}, got ${value.length}`,
      );
    }
    value.forEach((entry, i) => {
      item(entry, `${path}[${i}]`, errors);
    });
  };

/** Strict: a key that isn't listed is a failure, not something to ignore. */
const obj = (fields) => (value, path, errors) => {
  if (!isObject(value)) {
    return report(errors, path, `expected an object, got ${typeName(value)}`);
  }
  const known = Object.keys(fields);
  for (const [key, schema] of Object.entries(fields)) {
    const child = path ? `${path}.${key}` : key;
    if (key in value) {
      schema(value[key], child, errors);
    } else if (!schema.optional) {
      report(errors, child, "missing required key");
    }
  }
  for (const key of Object.keys(value)) {
    if (known.includes(key)) continue;
    report(
      errors,
      path,
      `unexpected key ${quote(key)}${didYouMean(key, known)}`,
    );
  }
};

/** An object whose keys are open but whose values all share one shape. */
const record =
  (valueSchema, { keyPattern }) =>
  (value, path, errors) => {
    if (!isObject(value)) {
      return report(errors, path, `expected an object, got ${typeName(value)}`);
    }
    for (const [key, entry] of Object.entries(value)) {
      const child = path ? `${path}.${key}` : key;
      if (!keyPattern.test(key)) {
        report(errors, child, `key ${quote(key)} does not match ${keyPattern}`);
      }
      valueSchema(entry, child, errors);
    }
  };

/** Pick a shape by the value of a discriminating key, e.g. a block's `type`. */
const variant = (key, shapes) => (value, path, errors) => {
  if (!isObject(value)) {
    return report(errors, path, `expected an object, got ${typeName(value)}`);
  }
  const tag = value[key];
  const shape = shapes[tag];
  if (shape) return shape(value, path, errors);
  const known = Object.keys(shapes);
  const suffix = typeof tag === "string" ? didYouMean(tag, known) : "";
  report(
    errors,
    path,
    `unknown ${key} ${quote(tag)}${suffix} — expected one of ${known.map(quote).join(", ")}`,
  );
};

/* --------------------------------------------------------------- formats */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-f]{6}$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const ORIGIN = /^https:\/\/[a-z0-9.-]+$/;
const LOCALE = /^[a-z]{2}_[A-Z]{2}$/;
const PRIORITY = /^(?:0\.\d|1\.0)$/;
/** Root-relative, no trailing slash — these are concatenated, not joined. */
const SITE_PATH = /^\/[a-z0-9][a-z0-9./-]*[a-z0-9]$/;
/** Tile and link targets: off-site or a mail link, never a bare path. */
const EXTERNAL_HREF = /^(?:https?:\/\/|mailto:)\S+$/;

const slug = str({
  pattern: SLUG,
  hint: 'expected a lowercase kebab-case slug, e.g. "event-pipeline"',
});

const date = str({
  pattern: DATE,
  hint: "expected a date as YYYY-MM-DD",
});

const sitePath = str({
  pattern: SITE_PATH,
  hint: 'expected a root-relative path with no trailing slash, e.g. "/projects"',
});

const externalHref = str({
  pattern: EXTERNAL_HREF,
  hint: "expected an http(s):// or mailto: link",
});

/**
 * Tile widths are the `.b-*` classes bento.css actually defines. A size the
 * stylesheet has no rule for renders as a full-width tile with no warning.
 */
const TILE_SIZES = ["flagship", "wide", "normal"];

/* ------------------------------------------------------------ site.json */

const palette = record(
  str({ pattern: HEX, hint: 'expected a six-digit hex colour like "#101214"' }),
  { keyPattern: /^[a-z][a-zA-Z]*$/ },
);

const changefreq = oneOf(
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
);

const priority = str({
  pattern: PRIORITY,
  hint: 'expected a priority from "0.0" to "1.0", one decimal',
});

const asideTile = obj({
  size: oneOf(...TILE_SIZES),
  label: str(),
  title: str(),
  text: str(),
  cta: str(),
  href: externalHref,
  umamiEvent: slug,
});

export const siteSchema = obj({
  origin: str({
    pattern: ORIGIN,
    hint: 'expected an origin like "https://mlz.no", with no trailing slash',
  }),
  author: str(),
  locale: str({ pattern: LOCALE, hint: 'expected a locale like "en_GB"' }),
  umamiWebsiteId: str({ pattern: UUID, hint: "expected a UUID" }),
  ogImage: sitePath,
  basePath: sitePath,
  figureDir: sitePath,
  palette: obj({ light: palette, dark: palette }),
  // lastmod is content, not a clock reading: the sitemap is committed, so a
  // build-time `new Date()` would make every day's output differ from the
  // checked-in copy and fail check:content. Projects carry their own.
  sitemap: obj({
    home: obj({ lastmod: date, changefreq, priority }),
    index: obj({ lastmod: date, changefreq, priority }),
    project: obj({ changefreq, priority }),
  }),
  index: obj({
    title: str(),
    description: str(),
    eyebrow: str(),
    heading: str(),
    intro: str(),
    asideTiles: arr(asideTile, { min: 0 }),
  }),
});

/* --------------------------------------------------- content/projects/*.json */

const block = variant("type", {
  text: obj({
    type: oneOf("text"),
    value: str(),
  }),

  list: obj({
    type: oneOf("list"),
    title: opt(str()),
    kind: opt(oneOf("bulleted", "numbered")),
    items: arr(str()),
  }),

  figure: obj({
    type: oneOf("figure"),
    figure: slug,
    alt: str(),
    caption: opt(str()),
  }),

  code: obj({
    type: oneOf("code"),
    language: str(),
    caption: opt(str()),
    // Blank lines are meaningful inside a snippet, so "" is allowed here.
    lines: arr(str({ allowEmpty: true })),
  }),

  metrics: obj({
    type: oneOf("metrics"),
    items: arr(obj({ value: str(), label: str() })),
  }),

  quote: obj({
    type: oneOf("quote"),
    value: str(),
    attribution: opt(str()),
  }),

  note: obj({
    type: oneOf("note"),
    title: opt(str()),
    value: str(),
  }),
});

export const projectSchema = obj({
  slug,
  order: int({ min: 1 }),
  size: oneOf(...TILE_SIZES),
  name: str(),
  tagline: str(),
  period: str(),
  role: opt(str()),
  team: opt(str()),
  stack: arr(str()),
  tags: arr(str()),
  status: str(),
  lastmod: date,
  seo: obj({ title: str(), description: str() }),
  cover: obj({ figure: slug, alt: str(), caption: opt(str()) }),
  summary: str(),
  sections: arr(
    obj({
      label: str(),
      heading: str(),
      blocks: arr(block),
    }),
  ),
});

/* ---------------------------------------------------------- cross-checks */

/** Collect every figure name a project points at. */
function figureRefs(project) {
  const refs = [[project.cover?.figure, "cover.figure"]];
  project.sections?.forEach((section, s) => {
    section.blocks?.forEach((entry, b) => {
      if (entry?.type === "figure") {
        refs.push([entry.figure, `sections[${s}].blocks[${b}].figure`]);
      }
    });
  });
  return refs.filter(([name]) => typeof name === "string");
}

/**
 * Checks that span files: references that must resolve, values that must be
 * unique, and output that would be generated but never used.
 */
function crossCheck({ site, projects, figures }, problems) {
  const add = (file, message) => problems.push({ file, message });

  // A palette token missing from one theme renders that figure with a literal
  // {{token}} in place of a colour, in one theme only.
  if (isObject(site.palette?.light) && isObject(site.palette?.dark)) {
    const light = Object.keys(site.palette.light);
    const dark = Object.keys(site.palette.dark);
    for (const token of light.filter((t) => !dark.includes(t))) {
      add("content/site.json", `palette.dark: missing token ${quote(token)}`);
    }
    for (const token of dark.filter((t) => !light.includes(t))) {
      add("content/site.json", `palette.light: missing token ${quote(token)}`);
    }
  }

  const tokens = new Set(Object.keys(site.palette?.light ?? {}));
  const referenced = new Set();

  for (const [name, source] of figures) {
    const file = `content/figures/${name}.svg`;
    if (!/viewBox="0 0 \d+ \d+"/.test(source)) {
      add(
        file,
        'needs a viewBox="0 0 W H" to size the <img> it is loaded into',
      );
    }
    const used = new Set(
      [...source.matchAll(/\{\{(\w+)\}\}/g)].map(([, token]) => token),
    );
    for (const token of used) {
      if (!tokens.has(token)) {
        add(
          file,
          `unknown palette token {{${token}}}${didYouMean(token, [...tokens])}`,
        );
      }
    }
  }

  const seen = { slug: new Map(), order: new Map() };
  for (const { file, data } of projects) {
    const expected = file.replace(/^.*\//, "").replace(/\.json$/, "");
    if (typeof data.slug === "string" && data.slug !== expected) {
      add(
        file,
        `slug: ${quote(data.slug)} does not match the filename — the page is written to /projects/${expected}`,
      );
    }

    for (const key of ["slug", "order"]) {
      const value = data[key];
      if (value === undefined) continue;
      const owner = seen[key].get(value);
      if (owner) {
        add(file, `${key}: ${quote(value)} is already used by ${owner}`);
      } else {
        seen[key].set(value, file);
      }
    }

    for (const [name, path] of figureRefs(data)) {
      referenced.add(name);
      if (!figures.has(name)) {
        add(file, `${path}: no content/figures/${name}.svg`);
      }
    }
  }

  // Every figure is rendered to a -light and a -dark file under public/, so an
  // unreferenced one is two committed files nothing links to.
  for (const name of figures.keys()) {
    if (!referenced.has(name)) {
      add(`content/figures/${name}.svg`, "not referenced by any project");
    }
  }
}

/* ------------------------------------------------------------- entry point */

export class ContentError extends Error {}

/**
 * Validates everything in one pass and throws once, so a broken file reports
 * all of its problems instead of one per run.
 *
 * @param {object} input
 * @param {object} input.site         parsed content/site.json
 * @param {{file: string, data: object}[]} input.projects
 * @param {Map<string, string>} input.figures  name -> raw SVG source
 */
export function validateContent({ site, projects, figures }) {
  const problems = [];
  const collect = (file, schema, value) => {
    const errors = [];
    schema(value, "", errors);
    for (const message of errors) problems.push({ file, message });
  };

  collect("content/site.json", siteSchema, site);
  for (const { file, data } of projects) {
    collect(file, projectSchema, data);
  }
  crossCheck({ site, projects, figures }, problems);

  if (!problems.length) return;

  const byFile = new Map();
  for (const { file, message } of problems) {
    byFile.set(file, [...(byFile.get(file) ?? []), message]);
  }
  const detail = [...byFile]
    .map(([file, messages]) =>
      [file, ...messages.map((message) => `  ${message}`)].join("\n"),
    )
    .join("\n\n");

  throw new ContentError(
    `${problems.length} problem${problems.length === 1 ? "" : "s"} in content/ — see content/README.md for the spec\n\n${detail}`,
  );
}
