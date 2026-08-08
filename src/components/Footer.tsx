import {
  cn,
  containerVariants,
  Separator,
  Text,
} from "@martinzachariassen/design";
import { profile } from "../data/profile";

export function Footer() {
  const { copyrightYear, firstName, lastName, coordinates } = profile;
  const credit = `© ${copyrightYear} · ${firstName} ${lastName}`;
  const coords = `${coordinates.lat}°${coordinates.latDir} · ${coordinates.lon}°${coordinates.lonDir}`;

  return (
    <footer
      className="relative z-10 animate-rise"
      style={{ animationDelay: "0.75s" }}
    >
      <Separator />
      <div
        className={cn(
          containerVariants({ size: "full", gutter: "lg" }),
          "flex items-center justify-between gap-3 pt-5",
          "pb-[max(20px,env(safe-area-inset-bottom))]",
        )}
      >
        <Text
          variant="eyebrow"
          className="text-[10px] tracking-[0.2em] sm:text-[11px]"
        >
          {credit}
        </Text>
        <Text
          variant="eyebrow"
          className="text-[10px] tracking-[0.2em] sm:text-[11px]"
        >
          {coords}
        </Text>
      </div>
    </footer>
  );
}
