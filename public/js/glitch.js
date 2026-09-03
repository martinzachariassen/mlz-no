// Ambient glitch: bursts of scrambled characters on random letters within
// [data-glitch] zones (header, eyebrow, nav, footer). Bursts are small and
// rare so it reads as occasional flicker, not a wide simultaneous effect.
(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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

  if (!chars.length) return;

  const MIN_BURST_CHARS = 2;
  const MAX_BURST_CHARS = 6;
  const MIN_BURST_DELAY_MS = 1400;
  const MAX_BURST_DELAY_MS = 5200;

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
      MIN_BURST_DELAY_MS + Math.random() * (MAX_BURST_DELAY_MS - MIN_BURST_DELAY_MS);
    setTimeout(() => {
      if (!document.hidden) burst();
      scheduleBurst();
    }, delay);
  };
  scheduleBurst();
})();
