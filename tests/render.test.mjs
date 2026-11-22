import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, safeURL, validateContent } from '../scripts/render.mjs';

// Test data is independent of the owner's editable portfolio.
const template = {
  profile: { name: 'Test Name', role: 'Researcher', intro: 'A short introduction.', email: '', photo: '', resume: '' },
  projects: [{ title: 'Test project', summary: 'A project.', problem: 'A question.' }],
  education: [{ title: 'A degree', organization: 'A university', period: '2022 — 2026' }],
  experience: [{ title: 'A position', organization: 'A company', period: '2026' }]
};
test('renders actual page content without a client-side fetch', () => {
  const html = renderPage(template, { year: 2026 });
  assert.match(html, /<html lang="en">/);
  assert.match(html, /Test project/);
  assert.match(html, /<details>/);
  assert.doesNotMatch(html, /href="(?:#|)"/);
  assert.doesNotMatch(html, /\/editor/);
  assert.ok(html.indexOf('id="education"') < html.indexOf('id="work"'));
  assert.ok(html.indexOf('id="work"') < html.indexOf('id="experience"'));
  assert.match(html, /section-index">02<\/span><h2>Education/);
  assert.match(html, /section-index">03<\/span><h2>Selected projects/);
  assert.doesNotMatch(html, /A little about me|class="bio"|id="contact"/);
});
test('omits empty sections, links, and images', () => {
  const data = structuredClone(template);
  data.projects = [{ title: '' }];
  data.experience = [];
  data.education = [];
  const html = renderPage(data);
  for (const id of ['education', 'work', 'experience', 'contact']) {
    assert.doesNotMatch(html, new RegExp(`(?:id="${id}"|href="#${id}")`));
  }
  assert.doesNotMatch(html, /<img|mailto:|Résumé|Google Scholar/);
});
test('treats content as text and rejects executable links', () => {
  const data = structuredClone(template);
  data.profile.name = '<script>alert("x")</script>';
  const html = renderPage(data);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', '//evil.example', 'assets/../secret']) assert.equal(safeURL(url), '');
  data.projects[0].url = 'javascript:alert(1)';
  assert.throws(() => validateContent(data), /https/);
});
test('supports relative assets on a subpath and optional contact links', () => {
  const data = structuredClone(template);
  data.profile.photo = 'assets/photo.jpg';
  data.profile.resume = 'assets/cv.pdf';
  data.profile.email = 'hello@example.com';
  data.projects[0].url = 'https://example.com/?a=1&b=2';
  const html = renderPage(data);
  assert.match(html, /src="assets\/photo.jpg"/);
  assert.match(html, /href="assets\/cv.pdf"/);
  assert.match(html, /data-email="hello@example.com"/);
  assert.doesNotMatch(html, /mailto:/);
  assert.ok(html.indexOf('class="portrait"') < html.indexOf('<h1'));
  assert.match(html, /a=1&amp;b=2/);
  assert.doesNotMatch(html, /(?:href|src)="\/assets/);
});
test('rejects malformed content before replacing files', () => {
  assert.throws(() => validateContent({}), /이름/);
  const data = structuredClone(template);
  data.projects = 'not an array';
  assert.throws(() => validateContent(data), /목록/);
  data.projects = [null];
  assert.throws(() => validateContent(data), /텍스트/);
});
