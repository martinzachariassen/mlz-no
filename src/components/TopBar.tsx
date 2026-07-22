import { profile } from "../data/profile";

export function TopBar() {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="MLZ home">
        <span className="m" aria-hidden="true" />{" "}
        <span data-glitch>{profile.brand}</span>
      </a>
      <span className="since">
        <span className="tick" aria-hidden="true">
          ▮
        </span>
        <span data-glitch>{profile.since}</span>
      </span>
    </header>
  );
}
