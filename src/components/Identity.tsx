import { GlitchText } from "@martinzachariassen/design";
import { profile } from "../data/profile";
import { ContactLinks } from "./ContactLinks";

// Slower than the design system's [900, 3600] default so the flicker stays a
// rare accent rather than constant noise. Glitch lives only on the identity —
// the chrome (header, links, footer) is plain, to keep the effect sparse.
const GLITCH_INTERVAL = [1600, 5200] as const;

// The centrepiece: the name in the hand typeface, the role/location line, and
// the contact links. Each block rises in on a staggered delay. GlitchText keeps
// the per-character cyberpunk flicker while exposing clean text to screen readers.
export function Identity() {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[clamp(20px,3.4vh,30px)] px-[clamp(20px,5vw,48px)] pb-[clamp(32px,7vh,70px)] pt-2.5 text-center">
      <h1
        className="m-0 animate-rise font-hand text-[min(8vw,112px)] font-normal uppercase leading-[0.9] text-foreground sm:text-[clamp(54px,9vw,112px)]"
        style={{ animationDelay: "0.15s" }}
      >
        <GlitchText
          text={profile.firstName}
          interval={GLITCH_INTERVAL}
          className="block"
        />
        <GlitchText
          text={profile.lastName}
          interval={GLITCH_INTERVAL}
          className="block"
        />
      </h1>

      <div
        className="flex animate-rise flex-wrap items-center justify-center font-mono text-[clamp(11px,1.4vw,13px)] uppercase tracking-[0.32em] text-secondary-foreground"
        style={{ animationDelay: "0.45s" }}
      >
        <GlitchText text={profile.role} interval={GLITCH_INTERVAL} />
        <span aria-hidden className="mx-3 text-accent-deep">
          /
        </span>
        <GlitchText text={profile.location} interval={GLITCH_INTERVAL} />
      </div>

      <ContactLinks />
    </main>
  );
}
