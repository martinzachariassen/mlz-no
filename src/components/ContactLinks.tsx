import { buttonVariants, cn } from "@martinzachariassen/design";
import { contactLinks } from "../data/profile";
import { contactIcons } from "./icons";

// Contact links styled as the signature MLZ ghost button. Rendered as anchors —
// buttonVariants gives an <a> the exact button look (lift + offset accent shadow
// on hover, icon nudge) without needing the <button> element.
export function ContactLinks() {
  return (
    <nav
      aria-label="Contact links"
      className="mt-1.5 flex animate-rise flex-wrap justify-center gap-[clamp(12px,2vw,18px)]"
      style={{ animationDelay: "0.6s" }}
    >
      {contactLinks.map((link) => {
        const Icon = contactIcons[link.icon];
        return (
          <a
            key={link.label}
            href={link.href}
            data-umami-event={link.event}
            className={cn(buttonVariants(), "no-underline")}
            {...(link.external && {
              target: "_blank",
              rel: "noopener noreferrer me",
            })}
          >
            <Icon />
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}
