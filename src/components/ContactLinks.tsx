import { Button, cn, stackVariants } from "@martinzachariassen/design";
import { contactLinks } from "../data/profile";
import { contactIcons } from "./icons";

export function ContactLinks() {
  return (
    <nav
      aria-label="Contact links"
      className={cn(
        stackVariants({
          direction: "responsive",
          gap: "md",
          justify: "center",
          wrap: true,
        }),
        "mx-auto mt-1.5 w-full max-w-xs animate-rise sm:max-w-none",
      )}
      style={{ animationDelay: "0.6s" }}
    >
      {contactLinks.map((link) => {
        const Icon = contactIcons[link.icon];
        return (
          // asChild renders a real anchor wearing the button's styles, so
          // middle-click, copy-link and open-in-new-tab all still work — and the
          // size variant handles every breakpoint, so no height or padding
          // overrides are needed.
          <Button key={link.label} asChild className="w-full sm:w-auto">
            <a
              href={link.href}
              data-umami-event={link.event}
              {...(link.external && {
                target: "_blank",
                rel: "noopener noreferrer me",
              })}
            >
              <Icon />
              {link.label}
            </a>
          </Button>
        );
      })}
    </nav>
  );
}
