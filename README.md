# mlz.no

Personal homepage for [Martin Zachariassen](https://mlz.no) — senior software engineer.

## Stack

- Static HTML/CSS/JS, no build step, no dependencies
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

Add the card markup in `public/index.html` and the modal content in `public/main.js`:

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
