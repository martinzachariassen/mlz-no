# mlz.no

Personal homepage for [Martin Zachariassen](https://mlz.no) — senior software engineer.

## Stack

- Static HTML/CSS/JS, no build step, no dependencies
- Inline design system: Space Grotesk + Space Mono + Barlow Condensed, electric-blue accent, light/dark theme with localStorage persistence
- Ambient flow-field background (canvas, respects `prefers-reduced-motion`)
- [Umami](https://umami.is) for privacy-first analytics
- nginx on [Railway](https://railway.app) for hosting

## Local development

Use devbox to start a local static preview:

```bash
devbox run dev
```

Then open <http://127.0.0.1:4173>. You can also open `public/index.html`
directly in a browser when you don't need a local server.

Run the local static checks with:

```bash
devbox run check
```

## Deployment

The site deploys automatically to Railway on every push to `main`. Railway detects the `Dockerfile`, builds an nginx:alpine image, and serves the static files.

### Custom domain

Set under **Settings → Networking** in the Railway dashboard. SSL is handled automatically.

## Assets

Final assets served by the site live in `public/`. Authoring sources live in `assets/`.

### `public/` (served by nginx)

- `favicon.svg`, `favicon.ico`, `favicon-{16,32,48,64,96,128,192,256,512}.png` — full browser favicon set, also referenced as PWA icons from `site.webmanifest`
- `apple-touch-icon.png` — 180×180 iOS home-screen icon
- `site.webmanifest` — PWA manifest (name, theme colour, icons)
- `og.png` — 1200×630 Open Graph card with tagline
- `twitter-card.png` — 1200×675 Twitter / X card
- `project-one-mock.svg` — placeholder thumbnail for the ip-speil work row

### `assets/` (authoring sources, not served)

- `mlz-glyph.svg` — the fused MLZ glyph used as favicon
- `mlz-lockup.svg` — glyph + wordmark, for reuse in other surfaces
- `mlz-wordmark.svg` — wordmark only
- `social/` — promotional images for off-site profiles:
  - `github-social-1280x640.png` — GitHub repo social preview (Settings → General → Social preview)
  - `linkedin-1200x627.png` — LinkedIn banner / share image
  - `og-image-1200x630.png` — plain OG card (alternative to the tagline version)
  - `og-image-tagline-1200x630.png` — same as `public/og.png`, kept for re-export
  - `twitter-card-1200x675.png` — same as `public/twitter-card.png`, kept for re-export

After re-exporting any of these from your design tool, drop the new PNG/SVG into `public/` (and update the source in `assets/`) and run `devbox run check` to confirm nothing is missing.

## Adding a project

Projects live as `<a class="row">` entries inside the `.work-list` in `public/index.html`. Copy an existing row and update the index, thumbnail, title, year, description, and tags:

```html
<a class="row" href="https://your-project-url" target="_blank" rel="noopener noreferrer" data-umami-event="project-your-name">
  <span class="idx">02</span>
  <div class="thumb">
    <img src="your-mock.svg" alt="" loading="lazy" decoding="async" />
  </div>
  <div class="body">
    <div class="title-line">
      <span class="title">Your Project</span>
      <span class="year">2026</span>
    </div>
    <p class="desc">Short description of what it does.</p>
    <div class="tags">
      <span class="tag">Tag</span>
    </div>
  </div>
  <span class="go">Visit<span class="a" aria-hidden="true"></span></span>
</a>
```

Drop the mock image into `public/` and reference it from the `<img src>`. A blue duotone SVG filter is applied at rest; hovering the row drops the filter and reveals the original colours.
