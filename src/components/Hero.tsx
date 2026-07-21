import { FloatingMarks } from "./FloatingMarks";
import { Footer } from "./Footer";
import { Identity } from "./Identity";
import { TopBar } from "./TopBar";

export function Hero() {
  return (
    <div className="hero">
      <FloatingMarks />
      <TopBar />
      <Identity />
      <Footer />
    </div>
  );
}
