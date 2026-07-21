// Single source of truth for everything the page says about Martin. Edit here,
// not in the components — the markup reads from these values.

export type ContactLink = {
  /** Icon key resolved by ContactLinks — see components/icons. */
  icon: "github" | "linkedin" | "email";
  label: string;
  href: string;
  /** Umami custom-event name fired on click. */
  event: string;
  external?: boolean;
};

export const profile = {
  firstName: "Martin",
  lastName: "Zachariassen",
  role: "Senior Software Developer",
  location: "Oslo, Norway",
  since: "Building since 2017",
  brand: "MLZ",
  // Rendered as "59°N · 10°E"; the ° is styled separately in the footer.
  coordinates: { lat: "59", latDir: "N", lon: "10", lonDir: "E" },
  copyrightYear: 2026,
} as const;

export const contactLinks: ContactLink[] = [
  {
    icon: "github",
    label: "GitHub",
    href: "https://github.com/martinzachariassen",
    event: "contact-github",
    external: true,
  },
  {
    icon: "linkedin",
    label: "LinkedIn",
    href: "https://linkedin.com/in/martinzachariassen",
    event: "contact-linkedin",
    external: true,
  },
  {
    icon: "email",
    label: "Email",
    href: "mailto:hi@mlz.no",
    event: "contact-email",
  },
];
