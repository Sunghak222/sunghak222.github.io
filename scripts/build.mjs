import { readFile, mkdir, cp, writeFile, rename, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderPage } from './render.mjs';
import { renderCaseStudy, caseStudyPath } from './case-studies.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function build(data, { outputDir = path.join(root, 'dist') } = {}) {
  data ??= JSON.parse(await readFile(path.join(root, 'content/en.json'), 'utf8'));
  const html = renderPage(data);
  const pages = [['index.html', html], ...(data.caseStudies ?? []).map(study => [
    `${caseStudyPath(study.slug)}index.html`, renderCaseStudy(study, data.profile)
  ])];
  await mkdir(path.dirname(outputDir), { recursive: true });
  const staging = await mkdtemp(`${outputDir}.building-`);
  const previous = `${staging}.previous`;
  let movedPrevious = false;
  try {
    await cp(path.join(root, 'public'), staging, { recursive: true });
    for (const [file, content] of pages) {
      const target = path.join(staging, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    try { await rename(outputDir, previous); movedPrevious = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(staging, outputDir); }
    catch (error) { if (movedPrevious) await rename(previous, outputDir); throw error; }
    if (movedPrevious) await rm(previous, { recursive: true });
  } finally { await rm(staging, { recursive: true, force: true }); }
  return html;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
  console.log('Built dist/ — ready to publish.');
}
