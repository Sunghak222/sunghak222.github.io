import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { contentFile, emptyTranslation, localizeContent, validateTranslation } from '../scripts/localization.mjs';
import { renderPage } from '../scripts/render.mjs';
import { renderCaseStudy } from '../scripts/case-studies.mjs';

const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const study = (slug, title) => ({ slug, title, description: title, document: { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
  { type: 'heading', attrs: { level: 2, id: 'example' }, content: [{ type: 'text', text: 'Example' }] },
  paragraph(title),
  { type: 'figure', attrs: { image: 'assets/example.jpg', alt: title, link: '', label: '', layout: 'portrait' }, content: [paragraph('Caption')] }
] } });
const fixture = () => ({
  profile: { name: 'Name', intro: 'English introduction', photo: 'assets/photo.jpg', resume: 'assets/resume.pdf' },
  projects: [
    { title: 'Pet', caseStudy: 'pet', summary: 'English summary', image: 'assets/example.jpg', code: 'https://example.com/code' },
    { title: 'Research', caseStudy: 'research', summary: 'Untranslated research' }
  ], experience: [], education: [], caseStudies: [study('pet', 'Pet'), study('research', 'Research')]
});
const korean = () => ({ ...emptyTranslation(), projects: [{ caseStudy: 'pet', summary: '한국어 소개' }], caseStudies: [study('pet', '반려동물 프로젝트')] });

test('partial translations inherit later image and link edits without duplicating English content', () => {
  const base = fixture(); const translation = korean();
  validateTranslation(base, translation);
  base.projects[0].image = 'assets/new.jpg';
  base.profile.resume = 'assets/new-resume.pdf';
  const localized = localizeContent(base, translation);
  assert.equal(localized.projects[0].summary, '한국어 소개');
  assert.equal(localized.projects[0].image, 'assets/new.jpg');
  assert.equal(localized.profile.resume, 'assets/new-resume.pdf');
  assert.deepEqual(localized.projects[1], base.projects[1]);
  assert.equal(translation.projects[0].image, undefined);
  assert.deepEqual(localizeContent(base, emptyTranslation()), base);
});

test('Korean routes use shared assets and translated details, with explicit English fallback links', () => {
  const base = fixture(); const translation = korean();
  const html = renderPage(localizeContent(base, translation), { lang: 'ko', translation });
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /src="\.\.\/assets\/photo.jpg"/);
  assert.match(html, /href="\.\.\/assets\/resume.pdf" target="_blank"/);
  assert.match(html, /href="projects\/pet\/">상세 보기/);
  assert.match(html, /href="\.\.\/projects\/research\/">상세 보기 \(EN\)/);
  assert.doesNotMatch(html, /translation-notice|아직 번역되지 않은 내용은 영어로 표시됩니다/);
  const detail = renderCaseStudy(translation.caseStudies[0], base.profile, { lang: 'ko', hasKorean: true });
  assert.match(detail, /src="\.\.\/\.\.\/\.\.\/assets\/example.jpg"/);
  assert.match(detail, /href="\.\.\/\.\.\/\.\.\/projects\/pet\/" lang="en"/);
  assert.match(detail, /href="\.\.\/\.\.\/#work"/);
  assert.match(detail, /포트폴리오 \(PDF\)/);
  assert.match(detail, /class="case-figure is-portrait"/);
  const unavailable = renderCaseStudy(base.caseStudies[1], base.profile);
  assert.match(unavailable, /aria-disabled="true" title="Korean translation in preparation"/);
  assert.doesNotMatch(unavailable, /href="[^\"]*ko\/projects/);
});

test('rejects unsupported languages, orphan translations, unsafe links and invalid documents', () => {
  assert.throws(() => contentFile('../../secret'));
  for (const change of [
    t => { t.projects[0].caseStudy = 'missing'; },
    t => { t.caseStudies[0].slug = '../escape'; },
    t => { t.projects.push({ ...t.projects[0] }); },
    t => { t.projects[0].code = 'javascript:alert(1)'; },
    t => { t.caseStudies[0].document.content[3].attrs.layout = 'injected-class'; },
    t => { t.caseStudies[0].document.content[3].attrs.image = 'assets/../secret'; }
  ]) {
    const translation = korean(); change(translation);
    assert.throws(() => validateTranslation(fixture(), translation));
  }
});

test('build publishes only available Korean details and preserves both languages after invalid edits', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'portfolio-languages-'));
  const outputDir = path.join(dir, 'dist');
  try {
    const base = fixture(); const translation = korean();
    await build(base, { outputDir, translation });
    await access(path.join(outputDir, 'ko/projects/pet/index.html'));
    await assert.rejects(access(path.join(outputDir, 'ko/projects/research/index.html')));
    const english = await readFile(path.join(outputDir, 'index.html'), 'utf8');
    const before = await readFile(path.join(outputDir, 'ko/projects/pet/index.html'), 'utf8');
    const invalid = korean(); invalid.caseStudies[0].document.content = [];
    await assert.rejects(build(base, { outputDir, translation: invalid }));
    assert.equal(await readFile(path.join(outputDir, 'index.html'), 'utf8'), english);
    assert.equal(await readFile(path.join(outputDir, 'ko/projects/pet/index.html'), 'utf8'), before);
    await build(base, { outputDir, translation: emptyTranslation() });
    await assert.rejects(access(path.join(outputDir, 'ko/projects/pet/index.html')));
    await access(path.join(outputDir, 'projects/pet/index.html'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
