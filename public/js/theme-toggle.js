(() => {
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  const theme = window.mlzTheme;
  if (!toggle || !theme) return;

  const current = () =>
    root.getAttribute("data-theme") === "dark" ? "dark" : "light";

  // theme-init.js sets the theme before first paint, but it runs in <head>
  // where this button does not exist yet — so the label is synced here
  // instead. It names the action rather than the state, which is what a
  // screen reader user needs from a control with no visible text.
  const label = () => {
    toggle.setAttribute(
      "aria-label",
      current() === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
  };

  const set = (next) => {
    theme.apply(next);
    label();
  };

  // Picking the theme the OS already wants clears the stored choice rather
  // than pinning it, so the site goes back to following the system. Two
  // states on the button, but "system" is never more than one click away.
  const remember = (next) => {
    try {
      if (next === theme.system()) localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      /* private mode / quota — theme still applies for this load */
    }
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // The new theme grows out of the button as a circle. Without View
  // Transitions (or with reduced motion) it falls back to the plain swap,
  // where body's colour transition in base.css still softens it.
  const switchTo = (next) => {
    if (!document.startViewTransition || reducedMotion.matches) {
      set(next);
      return;
    }

    const box = toggle.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    root.classList.add("theme-switching");
    const transition = document.startViewTransition(() => set(next));

    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", // --ease
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        /* transition skipped — the theme is already applied */
      });

    transition.finished.finally(() => {
      root.classList.remove("theme-switching");
    });
  };

  label();

  toggle.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    remember(next);
    switchTo(next);
  });

  // Follow the OS live (e.g. automatic dark mode at sunset) as long as the
  // reader hasn't pinned a theme of their own.
  theme.query.addEventListener("change", () => {
    if (!theme.stored()) set(theme.system());
  });
})();
