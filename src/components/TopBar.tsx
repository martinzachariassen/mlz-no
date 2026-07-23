import { GlitchText } from "@martinzachariassen/design";
import { profile } from "../data/profile";

export function TopBar() {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="MLZ home">
        {/* The bespoke accent square (kept over the DS Block-M to match today's
            look); it rotates/breathes via .brand .m in layout.css. */}
        <span className="m" aria-hidden="true" />{" "}
        <GlitchText text={profile.brand} />
      </a>
      <span className="since">
        <span className="tick" aria-hidden="true">
          ▮
        </span>
        <GlitchText text={profile.since} />
      </span>
    </header>
  );
}
