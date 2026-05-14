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
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function resolvePath(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
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
  const notFoundPath = join(root, '404.html');
  const resolvedPath = filePath && existsSync(filePath) ? filePath : notFoundPath;
  const status = resolvedPath === filePath ? 200 : 404;
  const contentType = contentTypes[extname(resolvedPath)] || 'application/octet-stream';

  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });

  createReadStream(resolvedPath).pipe(response);
}).listen(port, host, () => {
  console.log(`Serving ${fileURLToPath(new URL('public/', `file://${__dirname}/`))}`);
  console.log(`http://${host}:${port}`);
});
