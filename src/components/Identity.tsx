import { profile } from "../data/profile";
import { ContactLinks } from "./ContactLinks";

export function Identity() {
  return (
    <main className="center">
      <h1 className="name">
        {profile.firstName}
        <br />
        {profile.lastName}
      </h1>

      <div className="role">
        <span>{profile.role}</span>
        <span className="sep" aria-hidden="true">
          /
        </span>
        <span>{profile.location}</span>
      </div>

      <ContactLinks />
    </main>
  );
}
