const { createReadStream, existsSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize, relative } = require('node:path');
const { fileURLToPath } = require('node:url');

const root = join(__dirname, 'public');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function resolvePath(url) {
  const pathname = new URL(url, 'http://localhost').pathname;
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const requested = join(root, normalized);
  const candidate = existsSync(requested) && statSync(requested).isDirectory()
    ? join(requested, 'index.html')
    : requested;

  return relative(root, candidate).startsWith('..') ? null : candidate;
}

createServer((request, response) => {
  const filePath = resolvePath(request.url);

  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const contentType = contentTypes[extname(filePath)] || 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Serving ${fileURLToPath(new URL('public/', `file://${__dirname}/`))} on port ${port}`);
});
