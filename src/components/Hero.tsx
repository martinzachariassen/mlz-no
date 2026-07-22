import { useRef } from "react";
import { useHeroFx } from "../hooks/useHeroFx";
import { FloatingMarks } from "./FloatingMarks";
import { Footer } from "./Footer";
import { Identity } from "./Identity";
import { TopBar } from "./TopBar";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  useHeroFx(ref);

  return (
    <div className="hero" ref={ref}>
      <FloatingMarks />
      <TopBar />
      <Identity />
      <Footer />
    </div>
  );
}
