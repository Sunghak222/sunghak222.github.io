import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPDFExport } from '../scripts/pdf-export.mjs';
import { renderPage } from '../scripts/render.mjs';
import { renderCaseStudy } from '../scripts/case-studies.mjs';

const study = (slug, title) => ({ slug, title, description: title, document: { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Full project details.' }] },
  { type: 'heading', attrs: { level: 2, id: 'results' }, content: [{ type: 'text', text: 'Results' }] },
  { type: 'figure', attrs: { image: 'assets/result.png', alt: 'Result', link: '', label: '' }, content: [{ type: 'paragraph', content: [] }] }
] } });
const fixture = () => ({
  profile: { name: 'Name <Test>', intro: 'Profile introduction', email: 'test@example.com', photo: 'assets/portrait.jpg', linkedin: 'https://linkedin.com/in/test', resume: 'assets/private-resume.pdf' },
  projects: [{ title: 'Second', caseStudy: 'second' }, { title: 'First', caseStudy: 'first' }],
  experience: [], education: [], caseStudies: [study('first', 'First'), study('second', 'Second')]
});

test('PDF combines a single profile and full details in home order, with distinct heading IDs', () => {
  const html = renderPDFExport(fixture());
  assert.ok(html.indexOf('class="export-profile has-photo"') < html.indexOf('data-project="second"'));
  assert.ok(html.indexOf('data-project="second"') < html.indexOf('data-project="first"'));
  assert.equal((html.match(/Full project details\./g) || []).length, 2);
  assert.match(html, /id="first-results"/);
  assert.match(html, /id="second-results"/);
  assert.match(html, /Name &lt;Test&gt;/);
  assert.doesNotMatch(html, /private-resume|print-author|case-study\.js/);
  assert.match(html, /data-profile-field="email" href="mailto:test@example.com"/);
  assert.match(html, /name="field" value="phone"/);
  assert.match(html, /type="tel"[^>]*disabled/);
});

test('Korean export retains untranslated detail language and shared assets', () => {
  const html = renderPDFExport(fixture(), { lang: 'ko', translatedSlugs: new Set(['second']), introTranslated: false });
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /data-project="first" lang="en"/);
  assert.match(html, /data-project="second" lang="ko"/);
  assert.match(html, /class="export-intro" lang="en"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/result.png"/);
  assert.match(html, /First \(EN\)/);
  assert.match(html, /연락처·사진 모두 제외/);
});

test('home and detail entry points open the same export flow, with the current project preselected', () => {
  const data = fixture();
  for (const lang of ['en', 'ko']) {
    const home = renderPage(data, { lang });
    assert.match(home, /class="export-link" href="export\/"/);
    assert.doesNotMatch(home.split('</aside>')[0], /class="export-link"/);
    assert.match(home, /href="(?:\.\.\/)?assets\/private-resume.pdf"[^>]*>[^<]*<span[^>]*>↗<\/span><\/a><a class="export-link"/);
    assert.ok(home.includes(lang === 'ko' ? '포트폴리오 (PDF)' : 'Portfolio (PDF)'));
    assert.match(renderCaseStudy(data.caseStudies[0], data.profile, { lang }), /href="\.\.\/\.\.\/export\/\?projects=first"/);
  }
});
