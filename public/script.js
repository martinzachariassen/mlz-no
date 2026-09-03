(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // ---- theme toggle ----
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next =
        root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* private mode / quota — theme still applies for this load */
      }
    });
  }

  // ---- ambient glitch on random letters within [data-glitch] zones ----
  if (!reduceMotion) {
    const zones = document.querySelectorAll("[data-glitch]");
    const chars = [];

    // split every text node in a zone into one <span class="glitch"> per
    // letter, so bursts can land on any single character, not the whole box
    const splitTextNode = (node) => {
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent) {
        if (ch.trim() === "") {
          frag.appendChild(document.createTextNode(ch));
          continue;
        }
        const span = document.createElement("span");
        span.className = "glitch";
        span.textContent = ch;
        frag.appendChild(span);
        chars.push(span);
      }
      node.replaceWith(frag);
    };

    zones.forEach((zone) => {
      const walker = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        textNodes.push(node);
      }
      textNodes.forEach(splitTextNode);
    });

    if (chars.length) {
      const MIN_BURST_CHARS = 3;
      const MAX_BURST_CHARS = 9;
      const MIN_BURST_DELAY_MS = 1200;
      const MAX_BURST_DELAY_MS = 4200;

      const burst = () => {
        const count =
          MIN_BURST_CHARS +
          Math.floor(Math.random() * (MAX_BURST_CHARS - MIN_BURST_CHARS + 1));
        const picked = new Set();
        while (picked.size < count && picked.size < chars.length) {
          picked.add(chars[Math.floor(Math.random() * chars.length)]);
        }
        picked.forEach((el) => {
          el.classList.remove("is-glitching");
          void el.offsetWidth; // restart the CSS animation
          el.classList.add("is-glitching");
        });
      };

      const scheduleBurst = () => {
        const delay =
          MIN_BURST_DELAY_MS +
          Math.random() * (MAX_BURST_DELAY_MS - MIN_BURST_DELAY_MS);
        setTimeout(() => {
          if (!document.hidden) burst();
          scheduleBurst();
        }, delay);
      };
      scheduleBurst();
    }
  }

  // ---- 404 terminal ----
  const pathEl = document.querySelector("[data-notfound-path]");
  if (pathEl) {
    pathEl.textContent = window.location.pathname || "/";
  }
  const quipEl = document.querySelector("[data-notfound-quip]");
  if (quipEl) {
    const quips = [
      "you wandered off the map",
      "that page pulled a vanishing act",
      "here be dragons",
      "just stray semicolons here",
      "this link had one job",
      "404 bytes of nothing",
      "the void says hi",
      "not the page you're looking for",
    ];
    quipEl.textContent = `# ${quips[Math.floor(Math.random() * quips.length)]}`;
  }
})();
