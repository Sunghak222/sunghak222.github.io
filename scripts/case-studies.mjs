import { escapeHTML as text, safeURL, paragraphs, external } from './html.mjs';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function caseStudyPath(slug) {
  if (!slugPattern.test(slug)) throw new Error('상세 페이지 식별자를 확인해 주세요.');
  return `projects/${slug}/`;
}

export function validateCaseStudies(data) {
  const studies = data.caseStudies ?? [];
  if (!Array.isArray(studies) || studies.length > 100) throw new Error('상세 페이지 목록을 확인해 주세요.');
  const slugs = new Set();
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const strings = (value, fields) => {
    if (!object(value) || fields.some(key => typeof value[key] !== 'string')) throw new Error('상세 페이지의 텍스트 입력을 확인해 주세요.');
  };
  const url = (value, required = false) => {
    if (typeof value !== 'string' || (required || value.trim()) && !safeURL(value)) throw new Error('상세 페이지 링크는 https:// 또는 assets/ 경로를 사용해 주세요.');
  };
  for (const study of studies) {
    strings(study, ['slug', 'title', 'subtitle', 'description', 'introduction']);
    caseStudyPath(study.slug);
    if (!study.title.trim() || slugs.has(study.slug)) throw new Error('상세 페이지 제목과 중복 식별자를 확인해 주세요.');
    slugs.add(study.slug);
    strings(study.example, ['question', 'answer', 'evidence', 'note', 'image', 'alt', 'caption', 'source', 'sourceLabel']);
    url(study.example.image, true); url(study.example.source);
    if (!Array.isArray(study.sections) || !study.sections.length || study.sections.length > 20) throw new Error('상세 페이지 섹션을 확인해 주세요.');
    const ids = new Set();
    for (const section of study.sections) {
      strings(section, ['id', 'title']);
      if (!slugPattern.test(section.id) || ids.has(section.id) || !section.title.trim()) throw new Error('상세 페이지 섹션 제목과 식별자를 확인해 주세요.');
      ids.add(section.id);
      if (!Array.isArray(section.blocks) || section.blocks.length > 100) throw new Error('상세 페이지 본문을 확인해 주세요.');
      for (const block of section.blocks) {
        if (['text', 'heading'].includes(block?.type)) strings(block, ['text']);
        else if (block?.type === 'figure') {
          strings(block, ['image', 'alt', 'caption', 'link', 'label']);
          url(block.image, true); url(block.link);
        } else if (block?.type === 'comparison') {
          strings(block, ['intro', 'printImage', 'alt', 'caption']); url(block.printImage, true);
          if (!Array.isArray(block.cases) || block.cases.length !== 2) throw new Error('비교 사례 두 개를 입력해 주세요.');
          for (const item of block.cases) strings(item, ['question', 'source', 'input', 'response', 'diagnosis']);
        } else throw new Error('지원하지 않는 상세 페이지 본문 형식입니다.');
      }
    }
  }
  for (const row of [...data.projects, ...data.experience]) {
    if (row.caseStudy && !slugs.has(row.caseStudy)) throw new Error('연결할 상세 페이지가 없습니다. 편집기에서 상세 페이지를 다시 선택해 주세요.');
  }
}

const assetURL = value => {
  const url = safeURL(value);
  return url.startsWith('assets/') ? `../../${url}` : url;
};
const sourceLink = (url, label) => url ? `<a href="${text(assetURL(url))}"${external(url)}>${text(label)}</a>` : '';
const figure = ({ image, alt, caption, link = '', label = '' }, className = '') => `<figure class="case-figure ${className}"><a href="${text(assetURL(image))}" target="_blank" rel="noopener noreferrer" aria-label="Open full-size figure"><img src="${text(assetURL(image))}" alt="${text(alt)}"></a><figcaption>${text(caption)}${link ? ` ${sourceLink(link, label)}` : ''}</figcaption></figure>`;

export function renderCaseStudyBody(study) {
  const ex = study.example;
  const blockHTML = block => {
    if (block.type === 'text') return paragraphs(block.text);
    if (block.type === 'heading') return `<h3>${text(block.text)}</h3>`;
    if (block.type === 'figure') return figure(block);
    if (block.type === 'comparison') return `<div class="case-comparison"><p class="comparison-intro">${text(block.intro)}</p><div class="trace-comparison">${block.cases.map(item => `<article class="trace-case"><h3>${text(item.question)}</h3><dl>${[['Reference page', item.source], ['Answer model input', item.input], ['Final response', item.response], ['Diagnosed stage', item.diagnosis]].map(([label, value]) => `<div><dt>${text(label)}</dt><dd>${text(value)}</dd></div>`).join('')}</dl></article>`).join('')}</div><p class="comparison-caption">${text(block.caption)}</p>${figure({ image: block.printImage, alt: block.alt, caption: block.caption }, 'print-comparison')}</div>`;
    return '';
  };
  return `<header class="case-header"><p class="case-subtitle">${text(study.subtitle)}</p><h1>${text(study.title)}</h1></header>
    <div class="case-example"><h2 class="example-question">${text(ex.question)}</h2><p class="example-answer">${text(ex.answer)}</p><p class="example-evidence">${text(ex.evidence)}</p><p class="case-note">${text(ex.note)}</p>${figure({ image: ex.image, alt: ex.alt, caption: ex.caption, link: ex.source, label: ex.sourceLabel })}</div>
    <div class="case-introduction">${paragraphs(study.introduction)}</div>
    ${study.sections.map(section => `<section class="case-section" aria-labelledby="${text(section.id)}"><h2 id="${text(section.id)}">${text(section.title)}</h2>${section.blocks.map(blockHTML).join('\n')}</section>`).join('\n')}`;
}

export function renderCaseStudy(study, profile) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${text(study.title)} | ${text(profile.name)}</title>
  <meta name="description" content="${text(study.description)}">
  <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../../styles.css">
  <link rel="stylesheet" href="../../case-study.css">
  <script src="../../case-study.js" defer></script>
</head>
<body id="top" class="case-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="page-shell"><div class="layout">
    <aside class="sidebar">
      <a class="identity" href="../../">${text(profile.name)}</a>
      <a class="back-link" href="../../#work">← All work</a>
      <nav aria-label="Case study contents">${study.sections.map((section, index) => `<a href="#${text(section.id)}"><span class="nav-index">${String(index + 1).padStart(2, '0')}</span>${text(section.title)}</a>`).join('')}</nav>
      <button class="print-case" type="button">Save case study as PDF</button>
    </aside>
    <main id="main" class="case-document" tabindex="-1">
      ${renderCaseStudyBody(study)}
      <footer><span>${text(profile.name)} · ${text(study.title)}</span><a href="../../#work">Back to portfolio ↑</a></footer>
    </main>
  </div></div>
</body>
</html>\n`;
}
