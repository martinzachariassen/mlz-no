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

  // ---- ambient glitch on the headline + eyebrow ----
  if (!reduceMotion) {
    const glitchEls = document.querySelectorAll("[data-glitch]");
    glitchEls.forEach((el) => {
      const burst = () => {
        el.classList.remove("is-glitching");
        void el.offsetWidth; // restart the CSS animation
        el.classList.add("is-glitching");
      };
      const schedule = () => {
        const delay = 1600 + Math.random() * 3600;
        setTimeout(() => {
          if (!document.hidden) burst();
          schedule();
        }, delay);
      };
      schedule();
    });
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
