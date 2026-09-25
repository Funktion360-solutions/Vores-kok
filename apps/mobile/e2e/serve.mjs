// Minimal static server with SPA fallback for the exported web build.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = process.argv[2];
const port = Number(process.argv[3] ?? 8081);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const p of [join(root, path), join(root, 'index.html')]) {
    try { const body = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); return res.end(body); } catch { /* next */ }
  }
  res.writeHead(404); res.end();
}).listen(port, '127.0.0.1');
