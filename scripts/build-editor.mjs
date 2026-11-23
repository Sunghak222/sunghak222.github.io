import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildEditor() {
  await build({ entryPoints: [path.join(root, 'editor/editor.js')], outfile: path.join(root, 'editor/editor.bundle.js'), bundle: true, format: 'iife', target: 'es2022', minify: true, legalComments: 'eof' });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildEditor();
