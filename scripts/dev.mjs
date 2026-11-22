import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { build, root } from './build.mjs';
import { validateContent } from './render.mjs';

const port = Number(process.env.PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const contentPath = path.join(root, 'content/en.json');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.csv': 'text/csv; charset=utf-8' };
let saving = false;
function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}
async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 17 * 1024 * 1024) throw new Error('파일은 10 MB 이하로 올려 주세요.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
await build();
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return json(res, 403, { error: 'Local access only.' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    if (req.method === 'POST') {
      if (![origin, `http://localhost:${port}`].includes(req.headers.origin) || req.headers['x-portfolio-editor'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) return json(res, 403, { error: '편집 화면에서 다시 시도해 주세요.' });
      if (pathname === '/api/content') {
        if (saving) return json(res, 409, { error: '저장 중입니다. 잠시 후 다시 시도해 주세요.' });
        saving = true;
        try {
          const data = validateContent(await body(req));
          await mkdir(path.join(root, '.local/backups'), { recursive: true });
          await writeFile(path.join(root, '.local/backups', `${Date.now()}.json`), await readFile(contentPath));
          await writeFile(`${contentPath}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
          await build(data);
          await rename(`${contentPath}.tmp`, contentPath);
          return json(res, 200, { ok: true });
        } finally { saving = false; }
      }
      if (pathname === '/api/upload') {
        const data = await body(req);
        const ext = path.extname(String(data.name)).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'].includes(ext)) throw new Error('PNG, JPG, WebP, GIF 또는 PDF 파일만 사용할 수 있습니다.');
        if (typeof data.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64)) throw new Error('파일을 읽지 못했습니다.');
        const buffer = Buffer.from(data.base64, 'base64');
        if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('파일은 10 MB 이하로 올려 주세요.');
        const file = `assets/${randomUUID()}${ext}`;
        await writeFile(path.join(root, 'public', file), buffer);
        return json(res, 200, { path: file });
      }
      return json(res, 404, { error: 'Not found.' });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
    if (pathname === '/api/content') return json(res, 200, JSON.parse(await readFile(contentPath, 'utf8')));
    const isEditor = pathname === '/editor' || pathname.startsWith('/editor/');
    const base = path.join(root, isEditor ? 'editor' : 'dist');
    const relative = isEditor ? pathname.replace(/^\/editor\/?/, '') || 'index.html' : pathname === '/' ? 'index.html' : pathname.slice(1);
    let file = path.resolve(base, relative);
    if (!file.startsWith(`${base}${path.sep}`)) return json(res, 403, { error: 'Forbidden.' });
    try {
      if ((await stat(file)).isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(301, { Location: `${pathname}/${new URL(req.url, origin).search}` });
          return res.end();
        }
        file = path.join(file, 'index.html');
      }
      if (!(await stat(file)).isFile()) return json(res, 404, { error: 'Not found.' });
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) {
      if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found.' });
      throw error;
    }
  } catch (error) { if (!res.headersSent) json(res, 400, { error: error.message }); else res.end(); }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Portfolio: ${origin}\nContent editor: ${origin}/editor/\nPress Ctrl+C to stop.`);
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Try PORT=4174 npm run dev.` : error.message);
  process.exit(1);
});
