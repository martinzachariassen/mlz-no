import { profile } from "../data/profile";

const Degree = () => (
  <span className="deg" aria-hidden="true">
    °
  </span>
);

export function Footer() {
  const { copyrightYear, firstName, lastName, coordinates } = profile;
  return (
    <footer className="foot">
      <span>
        © {copyrightYear} · {firstName} {lastName}
      </span>
      <span>
        {coordinates.lat}
        <Degree />
        {coordinates.latDir} · {coordinates.lon}
        <Degree />
        {coordinates.lonDir}
      </span>
    </footer>
  );
}
