// iOS Safari only applies :active to an element when a touch listener is
// registered somewhere above it. Without one, the pressed states in
// buttons.css and topbar.css never show on an iPhone.
document.addEventListener("touchstart", () => {}, { passive: true });
