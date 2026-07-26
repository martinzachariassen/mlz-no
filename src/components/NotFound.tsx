import { buttonVariants, cn, GlitchText } from "@martinzachariassen/design";
import { ArrowLeftIcon } from "./icons/ArrowLeftIcon";
import { PageShell } from "./PageShell";

// Slower glitch cadence, matching the identity on the home page, so the flicker
// stays a rare accent rather than constant noise.
const GLITCH_INTERVAL = [1600, 5200] as const;

// The 404 page. Cloudflare serves dist/404.html with a real 404 status for any
// unknown path (wrangler.jsonc -> assets.not_found_handling: "404-page"). It
// mirrors the home page's identity block so a wrong turn still feels on-brand,
// echoes the attempted path, and offers a single route back home.
export function NotFound() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <PageShell>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[clamp(16px,2.6vh,24px)] px-[clamp(20px,5vw,48px)] pb-[clamp(32px,7vh,70px)] pt-2.5 text-center">
        <h1
          className="m-0 animate-rise font-hand text-[clamp(72px,22vw,140px)] font-normal uppercase leading-[0.9] text-foreground"
          style={{ animationDelay: "0.15s" }}
        >
          <GlitchText text="4" interval={GLITCH_INTERVAL} />
          <GlitchText
            text="0"
            interval={GLITCH_INTERVAL}
            className="text-accent-deep"
          />
          <GlitchText text="4" interval={GLITCH_INTERVAL} />
        </h1>

        <div
          className="flex animate-rise flex-col items-center gap-1.5 font-mono text-[clamp(12px,1.4vw,13px)] uppercase tracking-[0.32em] text-secondary-foreground"
          style={{ animationDelay: "0.45s" }}
        >
          <GlitchText text="Page not found" interval={GLITCH_INTERVAL} />
          {path && (
            <span className="block max-w-[280px] truncate font-normal normal-case tracking-[0.12em] text-muted-foreground text-[clamp(11px,1.3vw,12px)]">
              {path}
            </span>
          )}
        </div>

        <nav
          className="mt-1.5 flex w-full max-w-[320px] animate-rise flex-col sm:w-auto"
          style={{ animationDelay: "0.6s" }}
        >
          <a
            href="/"
            data-umami-event="notfound-home"
            className={cn(
              buttonVariants(),
              "h-10 w-full px-4 text-[13px] no-underline sm:h-11 sm:w-auto sm:px-[22px] sm:text-xs",
            )}
          >
            <ArrowLeftIcon />
            Back home
          </a>
        </nav>
      </main>
    </PageShell>
  );
}
