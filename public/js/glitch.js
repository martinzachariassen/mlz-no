// Ambient glitch: bursts of scrambled characters on random letters within
// [data-glitch] zones (header, eyebrow, nav, footer). Bursts are small and
// rare so it reads as occasional flicker, not a wide simultaneous effect.
(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const zones = document.querySelectorAll("[data-glitch]");
  const chars = [];

  // split every text node in a zone into one <span class="glitch"> per
  // letter, so bursts can land on any single character, not the whole box.
  // Only text nodes are replaced: existing elements stay where they are, since
  // moving them would restart their CSS animations (e.g. the logo intro).
  const splitTextNode = (node, zoneChars) => {
    const frag = document.createDocumentFragment();
    for (const ch of node.textContent) {
      if (ch.trim() === "") {
        frag.appendChild(document.createTextNode(ch));
        continue;
      }
      const span = document.createElement("span");
      span.className = "glitch";
      // One span per letter can make screen readers spell words out
      // ("G-i-t-H-u-b"), so the split letters are hidden from assistive tech
      // and an intact, visually hidden copy of the text stands in for them.
      span.setAttribute("aria-hidden", "true");
      span.textContent = ch;
      frag.appendChild(span);
      zoneChars.push(span);
    }
    node.replaceWith(frag);
  };

  zones.forEach((zone) => {
    const text = zone.textContent.replace(/\s+/g, " ").trim();
    if (!text) return;

    const walker = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      textNodes.push(node);
    }
    const zoneChars = [];
    for (const node of textNodes) splitTextNode(node, zoneChars);

    const spoken = document.createElement("span");
    spoken.className = "sr-only";
    spoken.textContent = text;
    zone.append(spoken);

    // Letters in a zone that is still animating in (the logo intro) only join
    // the pool once that animation is done, so bursts don't scramble it.
    const running =
      typeof zone.getAnimations === "function"
        ? zone.getAnimations({ subtree: true })
        : [];
    if (running.length) {
      Promise.allSettled(running.map((a) => a.finished)).then(() =>
        chars.push(...zoneChars),
      );
    } else {
      chars.push(...zoneChars);
    }
  });

  if (!zones.length) return;

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
      MIN_BURST_DELAY_MS +
      Math.random() * (MAX_BURST_DELAY_MS - MIN_BURST_DELAY_MS);
    setTimeout(() => {
      if (!document.hidden) burst();
      scheduleBurst();
    }, delay);
  };
  scheduleBurst();
})();
