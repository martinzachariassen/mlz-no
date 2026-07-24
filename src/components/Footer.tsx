import { profile } from "../data/profile";

// The footer: copyright on the left, coordinates on the right, hairline rule
// above (border-border). Plain text — the glitch effect is reserved for the
// identity so it stays a sparse accent.
export function Footer() {
  const { copyrightYear, firstName, lastName, coordinates } = profile;
  const credit = `© ${copyrightYear} · ${firstName} ${lastName}`;
  const coords = `${coordinates.lat}°${coordinates.latDir} · ${coordinates.lon}°${coordinates.lonDir}`;

  return (
    <footer
      className="relative z-10 flex animate-rise items-center justify-between gap-3 border-border border-t px-[clamp(20px,5vw,48px)] pt-5 pb-[max(20px,env(safe-area-inset-bottom))] font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      style={{ animationDelay: "0.75s" }}
    >
      <span>{credit}</span>
      <span>{coords}</span>
    </footer>
  );
}
