import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const port = Number(process.env.PORT || 8019);
const mime = { '.html':'text/html', '.css':'text/css', '.mjs':'text/javascript', '.js':'text/javascript', '.webmanifest':'application/manifest+json', '.png':'image/png' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = resolve(join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '')));
    if (path !== root && !path.startsWith(root + sep)) throw new Error('outside root');
    const file = await stat(path).then(s => s.isDirectory() ? join(path,'index.html') : path);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control':'no-store' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => process.stdout.write(`Sol preview: http://127.0.0.1:${port}/\n`));
