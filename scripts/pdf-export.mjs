import { escapeHTML as text, safeURL, paragraphs } from './html.mjs';
import { renderCaseStudyBody } from './case-studies.mjs';
import { documentTitle } from './rich-document.mjs';
import { languageSwitcher } from './locales.mjs';

const copy = {
  en: {
    title: 'Export portfolio', back: 'Back to portfolio', profile: 'Profile',
    photo: 'Photo', email: 'Email', linkedin: 'LinkedIn', github: 'GitHub', scholar: 'Google Scholar', phone: 'Phone number',
    phoneHint: 'Used only in this PDF; not saved to the website.', phonePlaceholder: 'Enter a phone number',
    hidePersonal: 'Exclude all contact details and photo', projects: 'Projects', all: 'Select all', none: 'Clear selection',
    projectHint: 'Full project details follow your profile, in the order shown here.',
    save: 'Save as PDF', saving: 'Preparing…', ready: 'Choose “Save as PDF” in the print dialog and use A4 paper.',
    error: 'An image could not be loaded. Refresh the page and try again.',
    preview: 'Preview', previewHint: 'Pages break naturally to fit A4. Headings stay with the following content.',
    count: '{count} projects selected', profileOnly: 'Profile only', noScript: 'Enable JavaScript to choose what to include and save your PDF.'
  },
  ko: {
    title: '포트폴리오 PDF', back: '포트폴리오로 돌아가기', profile: '프로필',
    photo: '사진', email: '이메일', linkedin: 'LinkedIn', github: 'GitHub', scholar: 'Google Scholar', phone: '전화번호',
    phoneHint: '이번 PDF에만 사용되며 웹사이트에 저장되지 않습니다.', phonePlaceholder: '전화번호 입력',
    hidePersonal: '연락처·사진 모두 제외', projects: '프로젝트', all: '전체 선택', none: '선택 해제',
    projectHint: '프로필 다음에 선택한 프로젝트 상세가 아래 순서대로 이어집니다.',
    save: 'PDF로 저장', saving: '준비 중…', ready: '인쇄 창에서 “PDF로 저장”을 선택하고 용지는 A4로 설정하세요.',
    error: '이미지를 불러오지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.',
    preview: '미리보기', previewHint: 'A4에 맞춰 페이지가 자연스럽게 나뉩니다. 제목은 다음 내용과 함께 배치됩니다.',
    count: '프로젝트 {count}개 선택', profileOnly: '프로필만 포함', noScript: '포함할 항목을 선택하고 PDF로 저장하려면 JavaScript를 켜 주세요.'
  }
};

// Follow the home page order, then include any detail document not listed there.
export function orderedStudies(data) {
  const bySlug = new Map((data.caseStudies || []).map(study => [study.slug, study]));
  const slugs = new Set([...data.projects.map(project => project.caseStudy).filter(Boolean), ...bySlug.keys()]);
  return [...slugs].map(slug => bySlug.get(slug)).filter(Boolean);
}

export function renderPDFExport(data, { lang = 'en', translatedSlugs = null, introTranslated = true } = {}) {
  const t = copy[lang];
  const p = data.profile;
  const prefix = lang === 'ko' ? '../../' : '../';
  const asset = value => safeURL(value).startsWith('assets/') ? `${prefix}${safeURL(value)}` : safeURL(value);
  const fields = ['photo', 'email', 'linkedin', 'github', 'scholar'].filter(key => key === 'email' ? p.email : safeURL(p[key]));
  const studies = orderedStudies(data);
  const title = study => study.document ? documentTitle(study.document, study.title) : study.title;
  const contacts = fields.filter(key => key !== 'photo').map(key => `<a data-profile-field="${key}" href="${text(key === 'email' ? `mailto:${p.email}` : asset(p[key]))}">${text(key === 'email' ? p.email : t[key])}</a>`).join('');
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="color-scheme" content="light">
  <title>${text(p.name)} — ${lang === 'ko' ? '포트폴리오' : 'Portfolio'}</title>
  <link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${prefix}fonts.css">
  <link rel="stylesheet" href="${prefix}styles.css">
  <link rel="stylesheet" href="${prefix}case-study.css">
  <link rel="stylesheet" href="${prefix}rich-document.css">
  <link rel="stylesheet" href="${prefix}pdf-export.css">
  <script src="${prefix}pdf-export.js" defer></script>
</head>
<body class="export-page case-page">
  <div class="export-layout">
    <aside class="export-controls" aria-labelledby="export-title">
      <a class="export-back" href="../">← ${t.back}</a>
      <h1 id="export-title">${t.title}</h1>
      ${languageSwitcher(lang, lang === 'ko' ? '../../export/' : './', lang === 'ko' ? './' : '../ko/export/')}
      <noscript><p>${t.noScript}</p></noscript>
      <form id="export-options">
        <fieldset><legend>${t.profile}</legend>
          <div class="export-profile-options">${fields.map(key => `<label><input type="checkbox" name="field" value="${key}" checked> ${t[key]}</label>`).join('')}
            <label><input type="checkbox" name="field" value="phone"> ${t.phone}</label>
          </div>
          <input id="export-phone" type="tel" aria-label="${t.phone}" aria-describedby="phone-hint" placeholder="${t.phonePlaceholder}" maxlength="60" autocomplete="off" disabled>
          <p class="export-help" id="phone-hint">${t.phoneHint}</p>
          <button type="button" class="export-text-button" data-exclude-personal>${t.hidePersonal}</button>
        </fieldset>
        <fieldset><legend>${t.projects}</legend>
          <p class="export-help">${t.projectHint}</p>
          <div class="export-select-actions"><button type="button" class="export-text-button" data-projects="all">${t.all}</button><button type="button" class="export-text-button" data-projects="none">${t.none}</button></div>
          <div class="export-project-options">${studies.map(study => `<label><input type="checkbox" name="project" value="${text(study.slug)}" checked><span>${text(title(study))}${lang === 'ko' && translatedSlugs && !translatedSlugs.has(study.slug) ? ' (EN)' : ''}</span></label>`).join('')}</div>
        </fieldset>
        <button type="button" class="export-save" data-save-pdf data-saving="${t.saving}">${t.save}</button>
        <p class="export-help">${t.ready}</p>
        <p class="export-status" role="status" data-error="${t.error}"></p>
      </form>
    </aside>
    <main class="export-preview">
      <div class="export-preview-heading"><h2>${t.preview}</h2><p data-selection-count data-count="${t.count}" data-empty="${t.profileOnly}" aria-live="polite"></p><p class="export-help">${t.previewHint}</p></div>
      <div class="export-document" id="pdf-document">
        <header class="export-profile${fields.includes('photo') ? ' has-photo' : ''}">
          ${fields.includes('photo') ? `<img data-profile-field="photo" class="export-portrait" src="${text(asset(p.photo))}" alt="${text(p.photoAlt || p.name)}" width="120" height="150">` : ''}
          <div class="export-profile-text"><h1>${text(p.name)}</h1><div class="export-intro"${lang === 'ko' && !introTranslated ? ' lang="en"' : ''}>${paragraphs(p.intro)}</div><div class="export-contacts">${contacts}<span data-profile-field="phone" hidden></span></div></div>
        </header>
        ${studies.map(study => {
          const studyLang = lang === 'ko' && translatedSlugs && !translatedSlugs.has(study.slug) ? 'en' : lang;
          return `<article class="case-document export-project" data-project="${text(study.slug)}" lang="${studyLang}" aria-label="${text(title(study))}">${renderCaseStudyBody(study, {}, { assetPrefix: prefix, lang: studyLang, idPrefix: `${study.slug}-` })}</article>`;
        }).join('\n')}
      </div>
    </main>
  </div>
</body>
</html>\n`;
}
