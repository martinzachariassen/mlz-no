import { contactLinks } from "../data/profile";
import { contactIcons } from "./icons";

export function ContactLinks() {
  return (
    <nav className="links" aria-label="Contact links">
      {contactLinks.map((link) => {
        const Icon = contactIcons[link.icon];
        return (
          <a
            key={link.label}
            className="lk"
            href={link.href}
            data-umami-event={link.event}
            {...(link.external && {
              target: "_blank",
              rel: "noopener noreferrer me",
            })}
          >
            <span className="ic">
              <Icon />
            </span>
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}
