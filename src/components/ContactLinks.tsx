import { buttonVariants, GlitchText } from "@martinzachariassen/design";
import { contactLinks } from "../data/profile";
import { contactIcons } from "./icons";

// The links are anchors (they navigate), so they borrow the design system's
// button styling via buttonVariants rather than the <button> element: the
// `default` variant is the signature technical ghost outline that lifts with an
// offset accent shadow and tilts its icon — the exact contact-link interaction.
export function ContactLinks() {
  return (
    <nav className="links" aria-label="Contact links">
      {contactLinks.map((link) => {
        const Icon = contactIcons[link.icon];
        return (
          <a
            key={link.label}
            className={buttonVariants({ variant: "default" })}
            href={link.href}
            data-umami-event={link.event}
            {...(link.external && {
              target: "_blank",
              rel: "noopener noreferrer me",
            })}
          >
            <Icon />
            <GlitchText text={link.label} />
          </a>
        );
      })}
    </nav>
  );
}
