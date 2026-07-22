import { profile } from "../data/profile";
import { ContactLinks } from "./ContactLinks";

export function Identity() {
  return (
    <main className="center">
      <h1 className="name">
        <span className="gl" data-glitch>
          {profile.firstName}
          <br />
          {profile.lastName}
        </span>
      </h1>

      <div className="role">
        <span data-glitch>{profile.role}</span>
        <span className="sep" aria-hidden="true">
          /
        </span>
        <span data-glitch>{profile.location}</span>
      </div>

      <ContactLinks />
    </main>
  );
}
