// Builds the logo described by the query string; see logo.html.
const params = new URLSearchParams(location.search);
const kind = params.get("kind") ?? "mark";
const variant = params.get("variant") === "light" ? "light" : "dark";
const size = Number(params.get("size") ?? 256);

// The dark logo uses the light theme's --fg and vice versa.
document.documentElement.dataset.theme = variant === "dark" ? "light" : "dark";

const mark = document.createElement("img");
mark.className = "mark";
mark.alt = "";
mark.src = `/public/brand/logo/mark-${variant}.svg`;

if (kind === "icon") {
  // App icon for site.webmanifest: the mark on a full-bleed --bg square, so
  // the M's cut-out isn't transparent. inset < 1 shrinks the mark into the
  // maskable safe zone (a circle 80% of the icon wide).
  const inset = Number(params.get("inset") ?? 1);
  const icon = document.createElement("div");
  icon.className = "icon";
  icon.style.width = icon.style.height = `${size}px`;
  mark.width = mark.height = Math.round(size * inset);
  icon.append(mark);
  document.body.append(icon);
} else if (kind === "lockup") {
  const lockup = document.createElement("div");
  lockup.className = "lockup";
  const word = document.createElement("span");
  word.className = "word";
  word.append("mlz");
  const period = document.createElement("span");
  period.textContent = ".";
  word.append(period);
  lockup.append(mark, word);
  document.body.append(lockup);
} else {
  mark.width = size;
  mark.height = size;
  document.body.append(mark);
}

// The renderer reads the logo's box from the title (via --dump-dom) to crop.
document.fonts.ready.then(() => {
  const box = document.body.lastElementChild;
  const { width, height } = box.getBoundingClientRect();
  document.title = `${width}x${height}`;
});
