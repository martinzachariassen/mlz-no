// Blocking, same-origin, loaded synchronously in <head> — must run before
// first paint so a returning dark-mode reader never sees a light flash.
//
// It also owns the theme logic that js/theme-toggle.js reuses via
// window.mlzTheme, so the two scripts can't drift apart.
(() => {
  const root = document.documentElement;
  const query = window.matchMedia("(prefers-color-scheme: dark)");

  // The browser-chrome colour (Safari's tab bar, Android's status bar). Both
  // <meta name="theme-color"> tags sit above this script and keep their
  // media attributes as the no-JS fallback; here they are both pointed at the
  // active theme, so a manual override is reflected too. Same values as --bg.
  const chrome = { light: "#ebeff2", dark: "#151619" };

  const system = () => (query.matches ? "dark" : "light");

  const stored = () => {
    try {
      const value = localStorage.getItem("theme");
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null; // localStorage can throw in private mode
    }
  };

  const apply = (theme) => {
    root.setAttribute("data-theme", theme);
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute("content", chrome[theme]);
    }
  };

  apply(stored() ?? system());

  window.mlzTheme = { apply, query, stored, system };
})();
