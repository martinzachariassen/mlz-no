import { marks } from "../data/marks";

// Purely decorative drift layer. The animation, position, and per-mark timing
// live in marks.css (kept out of inline styles so the CSP style-src stays tight).
export function FloatingMarks() {
  return (
    <div className="bg" aria-hidden="true">
      {marks.map((shape, i) => (
        // Static list rendered once; index is a stable key here.
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed, order-driven list
        <span key={i} className={`mk ${shape}`} />
      ))}
    </div>
  );
}
