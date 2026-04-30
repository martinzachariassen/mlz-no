# mlz.no

Personal homepage for [Martin Zachariassen](https://mlz.no) — senior software engineer.

## Stack

- Single-file HTML/CSS, no build step, no dependencies
- [Catppuccin Frappé](https://github.com/catppuccin/catppuccin) color theme
- [Umami](https://umami.is) for privacy-first analytics
- nginx on [Railway](https://railway.app) for hosting

## Local development

Just open `index.html` in a browser — no server needed.

## Deployment

The site deploys automatically to Railway on every push to `main`. Railway detects the `Dockerfile`, builds an nginx:alpine image, and serves the static files.

### Custom domain

Set under **Settings → Networking** in the Railway dashboard. SSL is handled automatically.

### OG image

`og.svg` is the source for the social preview image. Before deploying a new version, convert it to `og.png` (required — most platforms don't support SVG for `og:image`):

```bash
inkscape og.svg --export-filename=og.png --export-width=1200
# or
magick og.svg og.png
```

### Apple touch icon

Same deal — `apple-touch-icon.svg` is the source, iOS requires a PNG:

```bash
inkscape apple-touch-icon.svg --export-filename=apple-touch-icon.png --export-width=180
# or
magick apple-touch-icon.svg apple-touch-icon.png
```

## Adding a project

Replace one of the `card-soon` placeholder blocks in `index.html` with a real card:

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
