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
      className="mt-1.5 flex w-full max-w-[320px] animate-rise flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-[clamp(12px,2vw,18px)]"
      style={{ animationDelay: "0.6s" }}
    >
      {contactLinks.map((link) => {
        const Icon = contactIcons[link.icon];
        return (
          <a
            key={link.label}
            href={link.href}
            data-umami-event={link.event}
            className={cn(
              buttonVariants(),
              "h-10 w-full px-4 text-[13px] no-underline sm:h-11 sm:w-auto sm:px-[22px] sm:text-xs",
            )}
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
