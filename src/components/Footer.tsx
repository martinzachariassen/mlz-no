import {
  AccentPicker,
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
          // Reversed on mobile so the picker sits above the credit; AccentPicker
          // puts className on its inner control rather than its root, so the
          // ordering has to come from the parent.
          "flex flex-col-reverse items-center justify-between gap-3 pt-5 sm:flex-row",
          "pb-[max(20px,env(safe-area-inset-bottom))]",
        )}
      >
        <Text
          variant="eyebrow"
          className="text-[10px] tracking-[0.2em] sm:text-[11px]"
        >
          {credit}
        </Text>
        <AccentPicker />
        <Text
          variant="eyebrow"
          className="hidden text-[10px] tracking-[0.2em] sm:inline sm:text-[11px]"
        >
          {coords}
        </Text>
      </div>
    </footer>
  );
}
