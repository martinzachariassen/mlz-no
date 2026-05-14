# mlz.no

Personal homepage for [Martin Zachariassen](https://mlz.no) — senior software engineer.

## Stack

- Single-file HTML/CSS, no build step, no dependencies
- [Catppuccin Frappé](https://github.com/catppuccin/catppuccin) color theme
- [Umami](https://umami.is) for privacy-first analytics
- nginx on [Railway](https://railway.app) for hosting

## Local development

Use devbox to start a local static preview:

```bash
devbox run dev
```

Then open <http://127.0.0.1:4173>. You can also still open `public/index.html`
directly in a browser when you do not need a local server.

## Deployment

The site deploys automatically to Railway on every push to `main`. Railway detects the `Dockerfile`, builds an nginx:alpine image, and serves the static files.

### Custom domain

Set under **Settings → Networking** in the Railway dashboard. SSL is handled automatically.

### OG image

`public/og.svg` is the source for the social preview image. Before deploying a new version, convert it to `public/og.png` (required — most platforms don't support SVG for `og:image`):

```bash
inkscape public/og.svg --export-filename=public/og.png --export-width=1200
# or
magick public/og.svg public/og.png
# or, on macOS with Chrome installed
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --disable-gpu --screenshot=public/og.png --window-size=1200,630 file://$(pwd)/public/og.svg
```

### Apple touch icon

Same deal — `public/apple-touch-icon.svg` is the source, iOS requires a PNG:

```bash
inkscape public/apple-touch-icon.svg --export-filename=public/apple-touch-icon.png --export-width=180
# or
magick public/apple-touch-icon.svg public/apple-touch-icon.png
# or, on macOS with Chrome installed
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --disable-gpu --screenshot=public/apple-touch-icon.png --window-size=180,180 file://$(pwd)/public/apple-touch-icon.svg
```

## Adding a project

Replace one of the `card-soon` placeholder blocks in `public/index.html` with a real card:

```html
<a class="card" href="https://your-project-url" target="_blank" rel="noopener noreferrer" data-umami-event="project-your-name">
  <div class="card-top">
    <span class="tag tag-blue">Web</span>
    <span class="card-link-icon">...</span>
  </div>
  <p class="card-title">Your Project</p>
  <p class="card-desc">Short description of what it does.</p>
</a>
```

Available tag colours: `tag-blue` `tag-green` `tag-mauve` `tag-peach` `tag-teal` `tag-yellow` `tag-sapphire`
