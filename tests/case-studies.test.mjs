import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderPage, validateContent } from '../scripts/render.mjs';
import { renderCaseStudy } from '../scripts/case-studies.mjs';
import { build } from '../scripts/build.mjs';

const fixture = () => ({
  profile: { name: 'Test Person', intro: 'Intro' },
  projects: [{ title: 'Research project', caseStudy: 'research-project' }],
  experience: [{ title: 'Intern', organization: 'Lab', url: 'https://example.com', caseStudy: 'research-project' }],
  education: [],
  caseStudies: [{
    slug: 'research-project', title: 'Evidence study', subtitle: 'Internship', description: 'Description', introduction: 'My contribution',
    example: { question: 'A question?', answer: 'An answer', evidence: '00:44–00:58', note: 'Translation', image: 'assets/favicon.svg', alt: 'Timeline', caption: 'Caption', source: 'https://example.com/video', sourceLabel: 'Source' },
    sections: [{ id: 'vector-search', title: 'Vector Search', blocks: [{ type: 'text', text: '<script>unsafe</script>' }] }, { id: 'benchmark', title: 'Benchmark', blocks: [{ type: 'text', text: 'Evaluation conditions.' }] }]
  }]
});

test('project title, case link and experience share a same-tab detail URL', () => {
  const html = renderPage(fixture());
  const links = [...html.matchAll(/<a\b[^>]*href="projects\/research-project\/"[^>]*>/g)];
  assert.equal(links.length, 3);
  for (const [tag] of links) assert.doesNotMatch(tag, /target=/);
  assert.match(html, /href="https:\/\/example.com" target="_blank"/);
  assert.doesNotMatch(html, /<details>/);
});

test('detail page includes the whole article, safe text and nested-page assets', () => {
  const data = fixture(); const html = renderCaseStudy(data.caseStudies[0], data.profile);
  assert.match(html, /id="vector-search"/); assert.match(html, /id="benchmark"/);
  assert.ok(html.indexOf('id="vector-search"') < html.indexOf('id="benchmark"'));
  assert.match(html, /src="\.\.\/\.\.\/assets\/favicon.svg"/);
  assert.match(html, /href="\.\.\/\.\.\/#work"/);
  assert.match(html, /Save case study as PDF/);
  assert.match(html, /&lt;script&gt;unsafe/);
  assert.doesNotMatch(html, /<script>unsafe/);
});

test('rejects unknown references, unsafe paths, duplicate IDs and executable figure links', () => {
  const mutations = [
    d => { d.projects[0].caseStudy = 'missing'; },
    d => { d.caseStudies[0].slug = '../../escape'; },
    d => { d.caseStudies[0].sections[1].id = 'vector-search'; },
    d => { d.caseStudies[0].example.source = 'javascript:alert(1)'; },
    d => { d.caseStudies[0].sections[0].blocks.push({ type: 'raw-html', text: '<script>' }); }
  ];
  for (const mutate of mutations) { const data = fixture(); mutate(data); assert.throws(() => validateContent(data)); }
  assert.deepEqual(validateContent(JSON.parse(JSON.stringify(fixture()))), fixture());
});

test('build emits detail pages, preserves the previous build on bad content, and removes stale routes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'portfolio-case-test-'));
  const outputDir = path.join(dir, 'dist');
  try {
    const data = fixture();
    await build(data, { outputDir });
    await access(path.join(outputDir, 'projects/research-project/index.html'));
    const before = await readFile(path.join(outputDir, 'index.html'), 'utf8');
    const invalid = fixture(); invalid.caseStudies[0].example.image = 'assets/../secret';
    await assert.rejects(build(invalid, { outputDir }));
    assert.equal(await readFile(path.join(outputDir, 'index.html'), 'utf8'), before);
    data.caseStudies = []; data.projects = []; data.experience = [];
    await build(data, { outputDir });
    await assert.rejects(access(path.join(outputDir, 'projects/research-project/index.html')));
    await assert.rejects(access(path.join(outputDir, 'editor')));
    await assert.rejects(access(path.join(outputDir, 'content')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
