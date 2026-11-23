import { escapeHTML as text, safeURL, paragraphs, link } from './html.mjs';
import { validateCaseStudies, caseStudyPath } from './case-studies.mjs';
export { escapeHTML, safeURL } from './html.mjs';

// All interface copy lives here. Add another language file and label set later.
export const labels = {
  en: {
    portfolio: 'Personal portfolio', about: 'About', work: 'Selected Work',
    experience: 'Experience', education: 'Education',
    project: 'Read more', code: 'Code', paper: 'PDF', resume: 'Résumé',
    read: 'Read more', problem: 'The question', approach: 'The approach',
    outcome: 'The outcome', role: 'Role', tools: 'Tools & methods',
    top: 'Back to top', skip: 'Skip to content'
  }
};

export function validateContent(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('내용은 JSON 객체여야 합니다.');
  if (!data.profile || typeof data.profile.name !== 'string' || !data.profile.name.trim()) throw new Error('이름을 입력해 주세요.');
  for (const key of ['projects', 'experience', 'education']) {
    if (!Array.isArray(data[key])) throw new Error(`${key}: 목록 형식이 올바르지 않습니다.`);
    if (data[key].length > 100) throw new Error('한 목록에는 최대 100개까지 입력할 수 있습니다.');
    for (const row of data[key]) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.values(row).some(v => typeof v !== 'string')) throw new Error(`${key}: 모든 항목은 텍스트여야 합니다.`);
    }
  }
  for (const object of [data.profile]) {
    if (!object || typeof object !== 'object' || Array.isArray(object) || Object.values(object).some(v => typeof v !== 'string')) throw new Error('프로필에는 텍스트만 입력해 주세요.');
  }
  for (const row of [data.profile, ...data.projects, ...data.experience, ...data.education]) {
    for (const key of ['photo', 'github', 'linkedin', 'scholar', 'resume', 'image', 'url', 'code', 'paper']) {
      if (row[key]?.trim() && !safeURL(row[key])) throw new Error(`${key}: https:// 주소 또는 assets/로 시작하는 파일 경로를 입력해 주세요.`);
    }
  }
  if (data.profile.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.profile.email)) throw new Error('이메일 주소를 확인해 주세요.');
  validateCaseStudies(data);
  if (data.projects.some(project => project.imageFit && !['contain', 'cover'].includes(project.imageFit))) throw new Error('프로젝트 이미지 표시 방식을 확인해 주세요.');
  return data;
}

export function renderPage(data, { year = new Date().getFullYear(), lang = 'en' } = {}) {
  validateContent(data);
  const t = labels[lang];
  const p = data.profile;
  const projects = data.projects.filter(x => x.title.trim());
  const experiences = data.experience.filter(x => x.title.trim());
  const education = data.education.filter(x => x.title.trim());
  const email = p.email ? `<div class="email-control"><button type="button" class="email-copy" data-email="${text(p.email)}" title="Copy email address" aria-label="Copy email address: ${text(p.email)}"><span class="email-address">${text(p.email)}</span><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="5" y="5" width="8" height="9" rx="1"/><path d="M10 5V2H2v9h3"/></svg></button><span class="copy-status" role="status" aria-live="polite"></span></div>` : '';
  const social = [link(p.github, 'GitHub'), link(p.linkedin, 'LinkedIn'), link(p.scholar, 'Google Scholar'), link(p.resume, `${t.resume} (PDF)`, '', { newTab: true })].filter(Boolean).join('');
  const sections = [['about', t.about], ...(projects.length ? [['work', t.work]] : []), ...(experiences.length ? [['experience', t.experience]] : []), ...(education.length ? [['education', t.education]] : [])];
  const nav = sections.map(([id, label], i) => `<a href="#${id}"${i === 0 ? ' aria-current="location"' : ''}><span class="nav-index">${String(i + 1).padStart(2, '0')}</span>${text(label)}</a>`).join('');
  const sectionHeader = (id, title) => `<header class="section-heading"><span class="section-index">${String(sections.findIndex(s => s[0] === id) + 1).padStart(2, '0')}</span><h2>${text(title)}</h2></header>`;
  const history = rows => rows.map(row => `<article class="history-row"><p class="period">${text(row.period)}</p><div><h3>${text(row.title)}</h3><p class="organization">${safeURL(row.url) ? link(row.url, row.organization) : text(row.organization)}</p>${row.description ? `<div class="description">${paragraphs(row.description)}</div>` : ''}${row.caseStudy ? `<div class="text-links project-links"><a href="${caseStudyPath(row.caseStudy)}">Read case study <span aria-hidden="true">↗</span></a></div>` : ''}</div></article>`).join('');
  const educationHTML = education.map(row => {
    const scores = [['CGPA', row.gpa], ['Major GPA', row.majorGpa]].filter(([, value]) => value?.trim());
    return `<article class="history-row education-row"><p class="period">${text(row.period)}</p><div><h3>${row.organization ? (safeURL(row.url) ? link(row.url, row.organization) : text(row.organization)) : text(row.title)}</h3>${row.organization ? `<p class="degree">${text(row.title)}</p>` : ''}${scores.length ? `<dl class="education-scores">${scores.map(([label, value]) => `<div><dt>${label}</dt><dd>${text(value)}</dd></div>`).join('')}</dl>` : ''}${row.description ? `<div class="description">${paragraphs(row.description)}</div>` : ''}</div></article>`;
  }).join('');
  const projectHTML = projects.map((project, i) => {
    const casePath = project.caseStudy ? caseStudyPath(project.caseStudy) : '';
    const details = [['problem', t.problem], ['approach', t.approach], ['outcome', t.outcome]].filter(([key]) => project[key]?.trim());
    const metadata = [[t.role, project.role], [t.tools, project.tools]].filter(([, v]) => v?.trim());
    const readMore = casePath ? `<a href="${casePath}">${t.read} <span aria-hidden="true">↗</span></a>` : link(project.url, t.read);
    const links = [readMore, link(project.code, t.code), link(project.paper, t.paper)].filter(Boolean).join('');
    const hasImage = Boolean(safeURL(project.image));
    const figure = hasImage ? `<figure class="project-figure"><a class="project-image-link" href="${text(project.image)}" target="_blank" rel="noopener noreferrer" aria-label="View full-size image for ${text(project.title)}"><img class="project-image${project.imageFit === 'contain' ? ' is-contained' : ''}" src="${text(project.image)}" alt="${text(project.imageAlt || project.title)}" loading="lazy" width="180" height="180"></a></figure>` : '';
    return `<article class="project${hasImage ? ' has-image' : ''}"><span class="project-index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${figure}<div class="project-body"><div class="project-meta">${[project.category, project.year].filter(Boolean).map(text).join('<span aria-hidden="true"> / </span>')}</div><h3>${casePath ? `<a href="${casePath}">${text(project.title)}</a>` : text(project.title)}</h3><div class="description">${paragraphs(project.summary)}</div>${links ? `<div class="text-links project-links">${links}</div>` : ''}${!readMore && (details.length || metadata.length) ? `<details><summary>${t.read}<span class="detail-sign" aria-hidden="true"></span></summary><div class="project-details">${metadata.length ? `<dl>${metadata.map(([k, v]) => `<div><dt>${text(k)}</dt><dd>${text(v)}</dd></div>`).join('')}</dl>` : ''}${details.map(([k, v]) => `<section><h4>${text(v)}</h4>${paragraphs(project[k])}</section>`).join('')}</div></details>` : ''}</div></article>`;
  }).join('');
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${text(p.name)} — ${text(t.portfolio)}</title>
  <meta name="description" content="${text(p.intro || `${p.name} — ${p.role}`)}">
  <meta property="og:title" content="${text(p.name)} — ${text(t.portfolio)}">
  <meta property="og:description" content="${text(p.intro)}">
  <meta property="og:type" content="website">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="fonts.css">
  <link rel="stylesheet" href="styles.css">
  <script src="site.js" defer></script>
</head>
<body id="top">
  <a class="skip-link" href="#main">${t.skip}</a>
  <div class="page-shell">
    <div class="layout">
      <aside class="sidebar">
        <a class="identity" href="#about">Home</a>
        <nav aria-label="Main navigation">${nav}</nav>
      </aside>
      <main id="main" tabindex="-1">
        <section id="about" class="about-section" aria-labelledby="intro-heading">
          <div class="intro-layout${p.photo ? ' has-photo' : ''}">
            ${p.photo ? `<img class="portrait" src="${text(p.photo)}" alt="${text(p.photoAlt || `Portrait of ${p.name}`)}" width="160" height="200">` : ''}
            <div><h1 id="intro-heading">${text(p.name)}</h1><div class="intro">${paragraphs(p.intro)}</div>${email || social ? `<div class="text-links intro-links">${email}${social}</div>` : ''}</div>
          </div>
        </section>
        ${projects.length ? `<section id="work" class="content-section">${sectionHeader('work', t.work)}<div class="project-list">${projectHTML}</div></section>` : ''}
        ${experiences.length ? `<section id="experience" class="content-section">${sectionHeader('experience', t.experience)}${history(experiences)}</section>` : ''}
        ${education.length ? `<section id="education" class="content-section">${sectionHeader('education', t.education)}${educationHTML}</section>` : ''}
        <footer><span>© ${year} ${text(p.name)}</span><a href="#top">${t.top} <span aria-hidden="true">↑</span></a></footer>
      </main>
    </div>
  </div>
</body>
</html>\n`;
}
