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

### OG image

`assets/og.svg` is the source for the social preview image. Before deploying a new version, convert it to `public/og.png` (required — most platforms don't support SVG for `og:image`):

```bash
devbox run render-og
# or
inkscape assets/og.svg --export-filename=public/og.png --export-width=1200
# or
magick assets/og.svg public/og.png
```

### Apple touch icon

Same deal — `assets/apple-touch-icon.svg` is the source, iOS requires a PNG:

```bash
devbox run render-icons
# or
inkscape assets/apple-touch-icon.svg --export-filename=public/apple-touch-icon.png --export-width=180
# or
magick assets/apple-touch-icon.svg public/apple-touch-icon.png
```

To regenerate both committed PNG assets:

```bash
devbox run render-assets
```

## Adding a project

Projects live as `<a class="row">` entries inside the `.work-list` in `public/index.html`. Copy an existing row and update the index, thumbnail, title, year, description, and tags:

```html
<a class="row" href="https://your-project-url" target="_blank" rel="noopener noreferrer" data-umami-event="project-your-name">
  <span class="idx">02</span>
  <div class="thumb">
    <image-slot id="proj-your-name" shape="rect" src="your-mock.svg" fit="cover"></image-slot>
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

The thumbnail uses the bundled `<image-slot>` web component (`public/image-slot.js`); point its `src=` at any image in `public/`. Hovering the row drops the duotone filter and reveals the original colours.
