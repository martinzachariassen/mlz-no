import { profile } from "../data/profile";

export function TopBar() {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="MLZ home">
        <span className="m" aria-hidden="true" /> {profile.brand}
      </a>
      <span className="since">
        <span className="tick" aria-hidden="true">
          ▮
        </span>
        <span>{profile.since}</span>
      </span>
    </header>
  );
}
