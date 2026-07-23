import { GlitchText } from "@martinzachariassen/design";
import { profile } from "../data/profile";

export function Footer() {
  const { copyrightYear, firstName, lastName, coordinates } = profile;
  return (
    <footer className="foot">
      <GlitchText text={`© ${copyrightYear} · ${firstName} ${lastName}`} />
      <GlitchText
        text={`${coordinates.lat}°${coordinates.latDir} · ${coordinates.lon}°${coordinates.lonDir}`}
      />
    </footer>
  );
}
