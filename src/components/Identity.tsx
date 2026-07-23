import { GlitchText } from "@martinzachariassen/design";
import { profile } from "../data/profile";
import { ContactLinks } from "./ContactLinks";

export function Identity() {
  return (
    <main className="center">
      {/* The name keeps its bespoke handwritten display styling (.name reads the
          DS --font-hand + tokens); GlitchText supplies the per-character ambient
          glitch and an sr-only clean copy for assistive tech. */}
      <h1 className="name">
        <GlitchText text={profile.firstName} className="block" />
        <GlitchText text={profile.lastName} className="block" />
      </h1>

      <div className="role">
        <GlitchText text={profile.role} />
        <span className="sep" aria-hidden="true">
          /
        </span>
        <GlitchText text={profile.location} />
      </div>

      <ContactLinks />
    </main>
  );
}
