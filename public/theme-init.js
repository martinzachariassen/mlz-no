// Blocking, same-origin, loaded synchronously in <head> — must run before
// first paint so a returning dark-mode reader never sees a light flash.
(() => {
  try {
    const stored = localStorage.getItem("theme");
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    /* localStorage can throw in private mode; default light stays */
  }
})();
