import { escapeHTML } from './html.mjs';

export const labels = {
  en: {
    portfolio: 'Personal portfolio', home: 'Home', about: 'About', work: 'Selected Work',
    experience: 'Experience', education: 'Education', project: 'Read more', code: 'Code',
    paper: 'PDF', resume: 'Résumé', read: 'Read more', problem: 'The question',
    approach: 'The approach', outcome: 'The outcome', role: 'Role', tools: 'Tools & methods',
    top: 'Back to top', skip: 'Skip to content', navigation: 'Main navigation',
    copyEmail: 'Copy email address', copied: 'Email copied', copyFallback: 'Select the address to copy',
    readCase: 'Read case study', allWork: 'All work', contents: 'Case study contents',
    portfolioPDF: 'Portfolio (PDF)', savePDFLabel: 'Save case study as PDF', back: 'Back to portfolio',
    fullImage: 'Open full-size figure', language: 'Language', pending: 'Korean translation in preparation'
  },
  ko: {
    portfolio: '포트폴리오', home: 'Home', about: '소개', work: '프로젝트',
    experience: '경력', education: '학력', project: '상세 보기', code: 'Code',
    paper: 'PDF', resume: '이력서', read: '상세 보기', problem: '문제',
    approach: '접근 방법', outcome: '결과', role: '역할', tools: '사용 기술',
    top: '맨 위로', skip: '본문으로 이동', navigation: '주요 메뉴',
    copyEmail: '이메일 주소 복사', copied: '이메일을 복사했습니다', copyFallback: '주소를 선택해 복사해 주세요',
    readCase: '상세 보기', allWork: '모든 프로젝트', contents: '프로젝트 목차',
    portfolioPDF: '포트폴리오 (PDF)', savePDFLabel: '프로젝트 상세를 PDF로 저장', back: '포트폴리오로 돌아가기',
    fullImage: '원본 이미지 보기', language: '언어', pending: '한국어 번역 준비 중'
  }
};

export function languageSwitcher(lang, enHref, koHref) {
  const t = labels[lang];
  const item = (code, label, href) => href
    ? `<a href="${escapeHTML(href)}" lang="${code}" hreflang="${code}"${lang === code ? ' aria-current="page"' : ''}>${label}</a>`
    : `<span lang="${code}" aria-disabled="true" title="${t.pending}">${label}</span>`;
  return `<div class="language-switch" role="group" aria-label="${t.language}">${item('en', 'EN', enHref)}${item('ko', '한국어', koHref)}</div>`;
}

export function alternateLanguages(enHref, koHref) {
  return `<link rel="alternate" hreflang="en" href="${escapeHTML(enHref)}">${koHref ? `\n  <link rel="alternate" hreflang="ko" href="${escapeHTML(koHref)}">` : ''}`;
}
