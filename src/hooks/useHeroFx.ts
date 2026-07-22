import { type RefObject, useEffect } from "react";

// Progressive enhancement for the hero, ported from the original static-site
// hero.js: (1) pointer parallax + a soft grid spotlight that follows the cursor,
// and (2) occasional glitch bursts on random characters. Everything is gated —
// reduced-motion and data-motion="off" get nothing, and the parallax/spotlight
// additionally require a fine pointer. The page is fully functional without it.
//
// All dynamic styling is written through the CSSOM (setProperty / classList),
// which CSP style-src does not govern, so no inline styles are ever introduced
// and the server's tight style-src (no 'unsafe-inline') keeps holding.
export function useHeroFx(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = rootRef.current;
    if (!host) return;

    const root = document.documentElement;
    if (root.getAttribute("data-motion") === "off") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cleanups: Array<() => void> = [];

    // --- Pointer parallax + cursor spotlight (fine pointers only) -----------
    const bg = host.querySelector<HTMLElement>(".bg");
    if (bg && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      let tx = 0;
      let ty = 0;
      let cx = 0;
      let cy = 0;
      let mx = 0;
      let my = 0;
      let lit = false;
      let raf = 0;

      const tick = () => {
        cx += (tx - cx) * 0.09;
        cy += (ty - cy) * 0.09;
        root.style.setProperty("--px", cx.toFixed(3));
        root.style.setProperty("--py", cy.toFixed(3));
        bg.style.setProperty("--mx", `${mx.toFixed(0)}px`);
        bg.style.setProperty("--my", `${my.toFixed(0)}px`);
        raf =
          Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001
            ? requestAnimationFrame(tick)
            : 0;
      };

      const onMove = (e: MouseEvent) => {
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        mx = e.clientX;
        my = e.clientY;
        tx = (mx / w - 0.5) * 2;
        ty = (my / h - 0.5) * 2;
        if (!lit) {
          lit = true;
          bg.classList.add("lit");
        }
        if (!raf) raf = requestAnimationFrame(tick);
      };

      const settle = () => {
        lit = false;
        bg.classList.remove("lit");
        tx = 0;
        ty = 0;
        if (!raf) raf = requestAnimationFrame(tick);
      };

      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("mouseleave", settle, { passive: true });
      window.addEventListener("blur", settle);
      cleanups.push(() => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseleave", settle);
        window.removeEventListener("blur", settle);
        if (raf) cancelAnimationFrame(raf);
        bg.classList.remove("lit");
      });
    }

    // --- Per-character glitch bursts ---------------------------------------
    // Split each tagged element's direct text into .ch spans (whitespace and any
    // child elements like <br> or the footer's .deg are left untouched, so the
    // layout and wrapping hold). Re-running is a no-op: once split, the direct
    // children are element nodes, so there is nothing left to wrap.
    const wrapChars = (el: Element) => {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const frag = document.createDocumentFragment();
        for (const chr of node.nodeValue ?? "") {
          if (/\s/.test(chr)) {
            frag.appendChild(document.createTextNode(chr));
          } else {
            const s = document.createElement("span");
            s.className = "ch";
            s.textContent = chr;
            frag.appendChild(s);
          }
        }
        el.replaceChild(frag, node);
      }
    };

    for (const el of host.querySelectorAll("[data-glitch]")) wrapChars(el);
    const chars = Array.from(host.querySelectorAll<HTMLElement>(".ch"));

    if (chars.length) {
      const onAnimEnd = (e: AnimationEvent) => {
        if (e.animationName === "fx-glitch-char") {
          (e.target as HTMLElement).classList.remove("fx-glitch");
        }
      };
      document.addEventListener("animationend", onAnimEnd);

      // 1–4 characters flicker per burst, chosen independently across the page.
      const burst = () => {
        const n = 1 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) {
          const c = chars[(Math.random() * chars.length) | 0];
          if (c && !c.classList.contains("fx-glitch")) {
            c.classList.add("fx-glitch");
          }
        }
      };

      // 0.9–3.6s between bursts — frequent enough to feel alive, sparse enough
      // that any given character rarely glitches.
      let timer = 0;
      const loop = () => {
        timer = window.setTimeout(
          () => {
            if (!document.hidden) burst();
            loop();
          },
          900 + Math.random() * 2700,
        );
      };
      loop();

      cleanups.push(() => {
        document.removeEventListener("animationend", onAnimEnd);
        if (timer) clearTimeout(timer);
        for (const c of chars) c.classList.remove("fx-glitch");
      });
    }

    return () => {
      for (const c of cleanups) c();
    };
  }, [rootRef]);
}
