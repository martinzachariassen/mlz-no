(() => {
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  // theme-init.js sets the theme before first paint, but it runs in <head>
  // where this button does not exist yet — so the label is synced here
  // instead. It names the action rather than the state, which is what a
  // screen reader user needs from a control with no visible text.
  const label = () => {
    const dark = root.getAttribute("data-theme") === "dark";
    toggle.setAttribute(
      "aria-label",
      dark ? "Switch to light theme" : "Switch to dark theme",
    );
  };

  label();

  toggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    label();
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode / quota — theme still applies for this load */
    }
  });
})();
