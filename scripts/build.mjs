import { readFile, mkdir, cp, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderPage } from './render.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function build(data) {
  data ??= JSON.parse(await readFile(path.join(root, 'content/en.json'), 'utf8'));
  const html = renderPage(data);
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await cp(path.join(root, 'public'), path.join(root, 'dist'), { recursive: true });
  await writeFile(path.join(root, 'dist/index.html.tmp'), html);
  await rename(path.join(root, 'dist/index.html.tmp'), path.join(root, 'dist/index.html'));
  return html;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
  console.log('Built dist/ — ready to publish.');
}
