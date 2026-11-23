import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyToDocument, validateRichDocument, renderRichDocument, documentSections, documentTitle, nodeText } from '../scripts/rich-document.mjs';
import { renderCaseStudy } from '../scripts/case-studies.mjs';
import { validateContent } from '../scripts/render.mjs';

const legacy = () => ({
  slug: 'example', title: 'Study title', subtitle: 'Lab · Intern', description: 'Description', introduction: 'First paragraph.\n\nSecond paragraph.',
  example: { question: 'Question?', answer: 'Answer.', evidence: 'One video.', timestamp: '00:44–00:58', note: '', image: '', alt: '', caption: '', source: 'https://example.com/video', sourceLabel: 'Watch video' },
  sections: [
    { id: 'vector-search', title: 'Vector Search', blocks: [{ type: 'heading', text: 'Preprocessing' }, { type: 'text', text: '17.6 → 5.0 s' }, { type: 'figure', image: 'assets/chart.png', alt: 'Chart', caption: 'Measured once.', link: 'assets/timing.csv', label: 'Timing data' }] },
    { id: 'benchmark', title: 'Benchmark', blocks: [{ type: 'comparison', intro: 'Two cases', cases: [
      { question: 'Height?', source: '120 m', input: 'Name only', response: 'Unknown', diagnosis: 'Extraction' },
      { question: 'Nickname?', source: 'Machu Picchu', input: 'Nickname', response: 'Unknown', diagnosis: 'Generation' }
    ], caption: 'Translated summaries.' }] }
  ]
});
const migrated = doc => ({ slug: 'example', title: 'Study title', description: 'Description', document: doc });
const content = study => ({ profile: { name: 'Name' }, projects: [{ title: 'Project', caseStudy: 'example' }], experience: [], education: [], caseStudies: [study] });

test('converts existing content without dropping paragraphs, evidence, images, links or comparison columns', () => {
  const original = legacy(); const before = structuredClone(original);
  const doc = legacyToDocument(original);
  assert.deepEqual(original, before);
  validateRichDocument(doc);
  const html = renderRichDocument(doc, 'Name');
  for (const value of ['First paragraph.', 'Second paragraph.', '00:44–00:58', 'One video.', '120 m', 'Machu Picchu', 'Measured once.', 'Translated summaries.']) assert.ok(html.includes(value));
  assert.match(html, /src="\.\.\/\.\.\/assets\/chart.png"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/timing.csv"/);
  assert.match(html, /href="https:\/\/example.com\/video"/);
  assert.equal(doc.content.find(n => n.type === 'comparison').content.length, 2);
  assert.deepEqual(documentSections(doc).map(({ id }) => id), ['vector-search', 'benchmark']);
  assert.equal(documentTitle(doc, 'fallback'), 'Study title');
});

test('all five requested formatting choices survive a JSON save and render with safe static HTML', () => {
  const doc = legacyToDocument(legacy());
  doc.content.push({ type: 'heading', attrs: { level: 3, lineSpacing: '1.5' }, content: [{ type: 'text', text: 'My new heading' }] });
  doc.content.push({ type: 'paragraph', attrs: { lineSpacing: '2' }, content: [
    { type: 'text', text: 'Selected <text>', marks: [{ type: 'bold' }, { type: 'underline' }, { type: 'textStyle', attrs: { fontSize: '24px' } }] },
    { type: 'text', text: ' unchanged' }
  ] });
  const data = validateContent(JSON.parse(JSON.stringify(content(migrated(doc)))));
  const html = renderCaseStudy(data.caseStudies[0], data.profile);
  assert.match(html, /<h3 style="line-height:1.5">My new heading<\/h3>/);
  assert.match(html, /<p style="line-height:2"><span style="--text-size:24;/);
  assert.match(html, /<u><strong>Selected &lt;text&gt;<\/strong><\/u><\/span> unchanged/);
  assert.match(html, /href="#vector-search"/);
  assert.match(html, /rich-document.css/);
  assert.doesNotMatch(html, /editor.bundle|contenteditable/);
  assert.deepEqual(legacyToDocument(data.caseStudies[0]), doc);
});

test('new and renamed section headings produce unique working navigation IDs', () => {
  const doc = legacyToDocument(legacy());
  doc.content.push({ type: 'heading', attrs: { level: 2, id: 'benchmark' }, content: [{ type: 'text', text: 'Another section' }] });
  doc.content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New section' }] });
  const sections = documentSections(doc);
  assert.equal(new Set(sections.map(s => s.id)).size, 4);
  const html = renderCaseStudy(migrated(doc), { name: 'Name' });
  for (const { id, title } of sections) { assert.ok(html.includes(`href="#${id}"`)); assert.ok(html.includes(`id="${id}">${title}</h2>`)); }
});

test('rejects executable URLs, injected styles, unsupported nodes and malformed document nesting', () => {
  const mutations = [
    doc => { doc.content[0].attrs.level = 6; },
    doc => { doc.content[0].attrs.id = '\" onclick=\"alert(1)'; },
    doc => { doc.content[0].attrs.lineSpacing = '1; color:red'; },
    doc => { doc.content[0].content[0].marks = [{ type: 'textStyle', attrs: { fontSize: '20px;background:url(x)' } }]; },
    doc => { doc.content[0].content[0].marks = [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]; },
    doc => { doc.content.find(n => n.type === 'figure').attrs.image = 'assets/../private'; },
    doc => { doc.content.find(n => n.type === 'figure').attrs.link = 'data:text/html,hello'; },
    doc => { doc.content.push({ type: 'html', text: '<script>' }); },
    doc => { doc.content[0].content = [{ type: 'paragraph' }]; },
    doc => { doc.content.find(n => n.type === 'comparison').content.pop(); }
  ];
  for (const mutate of mutations) { const doc = legacyToDocument(legacy()); mutate(doc); assert.throws(() => validateContent(content(migrated(doc)))); }
  const doc = legacyToDocument(legacy()); doc.content[0].content[0].text = '<script>alert(1)</script>';
  const html = renderRichDocument(doc);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
});

test('plain text extracted from a saved document remains available for its page title', () => {
  const doc = legacyToDocument(legacy());
  doc.content[0].content = [{ type: 'text', text: 'New ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'title' }];
  assert.equal(documentTitle(doc, 'Old title'), 'New title');
  assert.match(renderCaseStudy(migrated(doc), { name: 'Name' }), /<title>New title \| Name<\/title>/);
  assert.ok(nodeText(doc).includes('17.6 → 5.0 s'));
});
