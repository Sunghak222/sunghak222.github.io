import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateContent } from './render.mjs';

export const contentDirectory = fileURLToPath(new URL('../content/', import.meta.url));
export const emptyTranslation = () => ({ profile: {}, projects: [], experience: [], education: [], caseStudies: [] });
export function contentFile(lang, directory = contentDirectory) {
  if (!['en', 'ko'].includes(lang)) throw new Error('지원하지 않는 언어입니다.');
  return path.join(directory, `${lang}.json`);
}
export async function readContent(lang = 'en', directory = contentDirectory) {
  try { return JSON.parse(await readFile(contentFile(lang, directory), 'utf8')); }
  catch (error) { if (lang === 'ko' && error.code === 'ENOENT') return emptyTranslation(); throw error; }
}
const mergeText = (base, translation = {}) => ({ ...base, ...Object.fromEntries(Object.entries(translation).filter(([, value]) => typeof value === 'string' && value.trim())) });

// Korean contains only supplied translations. Shared images, links and untranslated
// entries continue to come from English, so editing them never creates stale copies.
export function localizeContent(base, translation) {
  return {
    profile: mergeText(base.profile, translation.profile),
    projects: base.projects.map(project => mergeText(project, translation.projects?.find(row => row.caseStudy === project.caseStudy))),
    experience: translation.experience?.length ? translation.experience : base.experience,
    education: translation.education?.length ? translation.education : base.education,
    caseStudies: (base.caseStudies || []).map(study => translation.caseStudies?.find(row => row.slug === study.slug) || study)
  };
}

export function validateTranslation(base, translation) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const fail = () => { throw new Error('한국어 번역의 항목과 연결할 영문 프로젝트를 확인해 주세요.'); };
  if (!object(translation) || !object(translation.profile) || Object.values(translation.profile).some(value => typeof value !== 'string')) fail();
  for (const group of ['projects', 'experience', 'education', 'caseStudies']) {
    if (!Array.isArray(translation[group]) || translation[group].length > 100) fail();
  }
  const projects = new Set(base.projects.map(row => row.caseStudy).filter(Boolean));
  const slugs = new Set((base.caseStudies || []).map(study => study.slug));
  for (const [group, key, available] of [['projects', 'caseStudy', projects], ['caseStudies', 'slug', slugs]]) {
    const seen = new Set();
    for (const row of translation[group]) {
      if (!object(row) || !available.has(row[key]) || seen.has(row[key])) fail();
      seen.add(row[key]);
      if (group === 'projects' && Object.values(row).some(value => typeof value !== 'string')) fail();
    }
  }
  validateContent(localizeContent(base, translation));
  return translation;
}
