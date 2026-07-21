import type { ReactElement } from "react";
import type { ContactLink } from "../../data/profile";
import { EmailIcon } from "./EmailIcon";
import { GitHubIcon } from "./GitHubIcon";
import { LinkedInIcon } from "./LinkedInIcon";

export const contactIcons: Record<ContactLink["icon"], () => ReactElement> = {
  github: GitHubIcon,
  linkedin: LinkedInIcon,
  email: EmailIcon,
};
