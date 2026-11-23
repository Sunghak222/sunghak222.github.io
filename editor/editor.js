import { createDocumentEditor, documentEditorHTML } from './document-editor.js';
import { documentTitle } from '../scripts/rich-document.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let content;
let documentEditors = [];
let dirty = false;
let version = 0;
let pendingUploads = 0;
const fieldsets = {
  profile: [
    ['name', '이름', 'text', '영문 이름'], ['role', '직함 / 관심 분야', 'text', '예: AI Engineer'],
    ['location', '위치 (선택)', 'text', '예: Seoul, South Korea'], ['email', '이메일 (선택)', 'email', 'you@example.com'],
    ['intro', '자기소개', 'textarea', '배경, 관심사, 현재 하는 일을 적어 주세요. 빈 줄로 문단을 나눌 수 있습니다.'],
    ['photo', '프로필 사진 (선택)', 'image', '사진이 없으면 텍스트만 깔끔하게 표시됩니다.'],
    ['photoAlt', '사진 설명 (선택)', 'text', '사진을 볼 수 없는 방문자를 위한 설명'],
    ['github', 'GitHub (선택)', 'url', 'https://github.com/username'],
    ['linkedin', 'LinkedIn (선택)', 'url', 'https://www.linkedin.com/in/username'],
    ['scholar', 'Google Scholar (선택)', 'url', 'https://scholar.google.com/...'],
    ['resume', '이력서 PDF (선택)', 'pdf', 'PDF를 선택하면 Résumé 링크가 표시됩니다.']
  ],
  projects: [
    ['caseStudy', 'Read more · 상세 페이지 (선택)', 'case-study', '프로젝트 제목과 Read more가 이 페이지로 연결됩니다. 본문은 아래 프로젝트 상세 문서에서 수정하세요.'],
    ['title', '프로젝트 이름', 'text', '제목을 비우면 사이트에서 숨겨집니다.'], ['year', '연도', 'text', '2026'],
    ['category', '분류', 'text', '예: Research / Engineering'], ['role', '내 역할 (선택)', 'text', '예: Developer'],
    ['summary', '짧은 소개', 'textarea', '문제와 기여를 1–2문장으로 설명해 주세요.'],
    ['tools', '사용 기술 / 방법 (선택)', 'text', '예: Python, PyTorch'],
    ['image', '프로젝트 이미지 (선택)', 'image', '프로젝트 왼쪽에 같은 크기의 미리보기로 표시됩니다. 이미지가 없어도 본문 정렬은 유지됩니다. 모바일에서는 글 위에 표시됩니다.'],
    ['imageFit', '이미지 표시 방식', 'image-fit', '칸 채우기는 이미지를 확대해 빈 공간 없이 표시하며 가장자리가 잘릴 수 있습니다.'],
    ['imageAlt', '이미지 설명 (선택)', 'text', '이미지에 무엇이 보이는지 설명해 주세요.'],
    ['url', 'Read more · 외부 상세 주소 (선택)', 'url', '위에서 상세 페이지를 선택하지 않은 경우 이 주소로 연결됩니다.'], ['code', 'Code · GitHub 주소 (선택)', 'url', 'GitHub 저장소 주소를 넣으면 메인 페이지에 Code가 표시됩니다. 비우면 숨겨집니다.'],
    ['paper', '프로젝트 PDF (선택)', 'pdf', 'PDF 파일을 올리거나 https:// 주소를 입력하세요. 설명 아래 PDF 링크가 표시됩니다.'],
    ['problem', '자세히 보기 · 문제 / 질문 (선택)', 'textarea', '어떤 문제를 해결하려고 했나요?'],
    ['approach', '자세히 보기 · 접근 방법 (선택)', 'textarea', '어떻게 진행했고, 무엇을 담당했나요?'],
    ['outcome', '자세히 보기 · 결과 (선택)', 'textarea', '결과나 배운 점을 적어 주세요.']
  ],
  experience: [['caseStudy', '연결할 상세 페이지 (선택)', 'case-study', '경력 소개 아래에 상세 페이지 링크를 표시합니다.'], ['period', '기간', 'text', '2025 — Present'], ['title', '직책', 'text', '직책을 비우면 숨겨집니다.'], ['organization', '회사 / 연구실', 'text', '기관 이름'], ['url', '기관 링크 (선택)', 'url', 'https://...'], ['description', '설명 (선택)', 'textarea', '맡았던 일과 주요 기여']],
  education: [['period', '기간', 'text', '2022 — 2026'], ['organization', '학교', 'text', '학교명이 학력 항목의 제목으로 표시됩니다.'], ['title', '전공 / 학위', 'text', '학교 아래 표시됩니다. 비우면 학력 항목이 숨겨집니다.'], ['url', '학교 링크 (선택)', 'url', 'https://...'], ['gpa', 'CGPA (선택)', 'text', '예: 3.4 / 4.3'], ['majorGpa', '전공 GPA (선택)', 'text', '예: 3.6 / 4.3'], ['description', '추가 설명 (선택)', 'textarea', '성적 외에 추가로 소개할 내용']]
};
const names = { profile: '소개', projects: '프로젝트', experience: '경력', education: '학력' };
function markDirty() { dirty = true; version++; $('#status').textContent = '저장하지 않은 변경사항'; }
function fieldHTML(group, index, field, object) {
  const [key, label, type, help] = field;
  const id = `${group}-${index ?? 'single'}-${key}`;
  const attrs = `id="${id}" data-group="${group}" data-index="${index ?? ''}" data-key="${key}"`;
  const value = escape(object[key]);
  const upload = ['image', 'pdf'].includes(type);
  return `<div class="field ${type === 'textarea' || upload ? 'wide' : ''}"><label for="${id}">${label}</label>${type === 'image-fit' ? `<select ${attrs}><option value="contain"${object[key] !== 'cover' ? ' selected' : ''}>전체 보기</option><option value="cover"${object[key] === 'cover' ? ' selected' : ''}>칸 채우기 (확대)</option></select>` : type === 'case-study' ? `<select ${attrs}><option value="">연결 안 함</option>${(content.caseStudies || []).map(study => `<option value="${escape(study.slug)}"${study.slug === object[key] ? ' selected' : ''}>${escape(study.title)}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea ${attrs} rows="3" aria-describedby="${id}-help">${value}</textarea>` : `<input ${attrs} type="${type === 'email' ? 'email' : 'text'}" value="${value}" ${key === 'name' ? 'required' : ''} aria-describedby="${id}-help">`}<p class="help" id="${id}-help">${help}</p>${upload ? `<div class="upload"><input type="file" aria-label="${label} 파일 선택" data-upload-for="${id}" accept="${type === 'pdf' ? '.pdf' : '.png,.jpg,.jpeg,.webp,.gif'}"><span class="help">최대 10 MB · 주소를 직접 붙여넣어도 됩니다.</span></div>` : ''}</div>`;
}
function render() {
  documentEditors.forEach(editor => editor.destroy());
  documentEditors = [];
  $('#fields').innerHTML = ['profile', 'projects', 'experience', 'education'].map(group => {
    const collection = Array.isArray(content[group]);
    const fields = (object, index) => `<div class="field-grid">${fieldsets[group].filter(field => !(group === 'projects' && object.caseStudy && ['problem', 'approach', 'outcome', 'role', 'tools'].includes(field[0]))).map(field => fieldHTML(group, index, field, object)).join('')}</div>`;
    return `<section class="editor-section" id="${group}"><div class="section-title"><h2>${names[group]}</h2>${collection ? `<button type="button" data-action="add" data-group="${group}">+ ${names[group]} 추가</button>` : ''}</div>${collection ? content[group].length ? content[group].map((item, index) => `<details class="entry" data-entry="${group}-${index}"><summary>${String(index + 1).padStart(2, '0')} · ${escape(item.title || `새 ${names[group]}`)}</summary><div class="entry-inner">${fields(item, index)}<div class="entry-tools"><button type="button" data-action="up" data-group="${group}" data-index="${index}" ${index === 0 ? 'disabled' : ''}>위로 ↑</button><button type="button" data-action="down" data-group="${group}" data-index="${index}" ${index === content[group].length - 1 ? 'disabled' : ''}>아래로 ↓</button><button type="button" class="delete" data-action="remove" data-group="${group}" data-index="${index}">삭제</button></div></div></details>`).join('') : `<p class="empty">등록된 항목이 없습니다. 추가 버튼으로 시작하세요.</p>` : fields(content[group])}</section>`;
  }).join('') + renderCaseStudies();
  document.querySelectorAll('[data-document-study]').forEach(entry => {
    let initialized = false;
    entry.addEventListener('toggle', () => {
      if (!entry.open || initialized) return;
      initialized = true;
      const study = content.caseStudies[Number(entry.dataset.documentStudy)];
      const editor = createDocumentEditor(entry.querySelector('.document-editor'), study, {
        onChange: doc => {
          study.document = doc;
          study.title = documentTitle(doc, study.title);
          for (const key of ['subtitle', 'introduction', 'example', 'sections']) delete study[key];
          entry.querySelector('summary').textContent = study.title;
          markDirty();
        },
        onError: error,
        upload: uploadDocumentImage
      });
      documentEditors.push(editor);
    });
  });
}
function getObject(input) { return input.dataset.index === '' ? content[input.dataset.group] : content[input.dataset.group][Number(input.dataset.index)]; }
function setCaseValue(path, value) {
  const keys = path.split('.');
  const key = keys.pop();
  let object = content.caseStudies;
  for (const part of keys) object = object[part];
  object[key] = value;
}
function caseField(path, label, value, kind = 'textarea') {
  const id = `case-${path.replaceAll('.', '-')}`;
  const attrs = `id="${id}" data-case-path="${path}"`;
  return `<div class="field wide"><label for="${id}">${escape(label)}</label>${kind === 'textarea' ? `<textarea ${attrs} rows="3">${escape(value)}</textarea>` : `<input ${attrs} type="text" value="${escape(value)}">`}${kind === 'image' ? `<div class="upload"><input type="file" aria-label="${escape(label)} 파일 선택" data-upload-for="${id}" accept=".png,.jpg,.jpeg,.webp,.gif"><span class="help">이미지를 교체하면 웹과 PDF에 함께 반영됩니다.</span></div>` : ''}</div>`;
}
function renderCaseStudies() {
  const studies = content.caseStudies || [];
  if (!studies.length) return '';
  return `<section class="editor-section" id="case-studies"><div class="section-title"><h2>프로젝트 상세 문서</h2></div><p class="case-editor-help">문서를 열고 글을 직접 수정하세요. 제목 1은 프로젝트 제목, 제목 2는 Vector Search 같은 섹션, 제목 3은 소제목입니다. 저장하면 상세 페이지와 PDF에 같은 서식이 적용됩니다.</p>${studies.map((study, index) => `<details class="entry document-entry" data-document-study="${index}"><summary>${escape(study.title)}</summary><div class="entry-inner"><a href="/projects/${escape(study.slug)}/" target="_blank" rel="noopener">상세 페이지 미리보기 ↗</a>${documentEditorHTML()}<details class="document-settings"><summary>검색 결과 소개</summary>${caseField(`${index}.description`, '검색 결과에 표시할 소개', study.description)}</details></div></details>`).join('')}</section>`;
}
async function uploadDocumentImage(file) {
  pendingUploads++;
  $('#save').disabled = true;
  $('#status').textContent = '파일을 추가하는 중…';
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('파일은 10 MB 이하로 올려 주세요.');
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    return (await api('/api/upload', { name: file.name, base64 })).path;
  } finally { pendingUploads--; $('#save').disabled = pendingUploads > 0; $('#status').textContent = dirty ? '저장하지 않은 변경사항' : '모든 변경사항이 저장되어 있습니다'; }
}
function error(message) { $('#error').textContent = message; $('#error').hidden = false; $('#error').scrollIntoView({ block: 'center' }); }
async function api(url, data) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Portfolio-Editor': '1' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '저장하지 못했습니다.');
  return result;
}
$('#fields').addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.casePath) { setCaseValue(input.dataset.casePath, input.value); markDirty(); return; }
  if (!input.dataset.key) return;
  getObject(input)[input.dataset.key] = input.value;
  if (input.dataset.key === 'title') input.closest('details').querySelector('summary').textContent = `${String(Number(input.dataset.index) + 1).padStart(2, '0')} · ${input.value || `새 ${names[input.dataset.group]}`}`;
  markDirty();
});
$('#fields').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, group } = button.dataset;
  const index = Number(button.dataset.index);
  const rows = content[group];
  if (action === 'remove' && button.dataset.confirm !== 'true') {
    button.dataset.confirm = 'true';
    button.textContent = '한 번 더 눌러 삭제';
    return;
  }
  if (action === 'add') rows.push(Object.fromEntries(fieldsets[group].map(([key]) => [key, ''])));
  if (action === 'remove') rows.splice(index, 1);
  if (action === 'up' && index > 0) [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
  if (action === 'down' && index < rows.length - 1) [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]];
  markDirty();
  render();
  const nextIndex = action === 'add' ? rows.length - 1 : action === 'up' ? index - 1 : action === 'down' ? index + 1 : Math.min(index, rows.length - 1);
  const next = document.querySelector(`[data-entry="${group}-${nextIndex}"]`);
  if (next) { next.open = true; next.querySelector('summary').focus(); }
  else document.querySelector(`button[data-action="add"][data-group="${group}"]`).focus();
});
$('#fields').addEventListener('change', async event => {
  const input = event.target;
  if (!input.dataset.uploadFor || !input.files[0]) return;
  const file = input.files[0];
  pendingUploads++;
  $('#save').disabled = true;
  $('#status').textContent = '파일을 추가하는 중…';
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('파일은 10 MB 이하로 올려 주세요.');
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await api('/api/upload', { name: file.name, base64 });
    const target = document.getElementById(input.dataset.uploadFor);
    if (!target) throw new Error('파일을 추가하는 동안 항목이 변경되었습니다. 다시 선택해 주세요.');
    target.value = result.path;
    if (target.dataset.casePath) setCaseValue(target.dataset.casePath, result.path);
    else getObject(target)[target.dataset.key] = result.path;
    markDirty();
  } catch (err) { error(err.message || '파일을 불러오지 못했습니다.'); $('#status').textContent = '파일 추가 실패'; }
  finally { pendingUploads--; $('#save').disabled = pendingUploads > 0; input.value = ''; }
});
$('#content-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (pendingUploads) return;
  $('#save').disabled = true;
  $('#status').textContent = '저장 중…';
  $('#error').hidden = true;
  const savingVersion = version;
  try {
    await api('/api/content', content);
    dirty = version !== savingVersion;
    $('#status').textContent = dirty ? '저장 후 새 변경사항이 있습니다' : '저장 완료 · 미리보기를 새로고침하세요';
  } catch (err) { error(err.message); $('#status').textContent = '저장하지 못했습니다'; }
  finally { $('#save').disabled = pendingUploads > 0; }
});
window.addEventListener('beforeunload', event => { if (dirty || pendingUploads) { event.preventDefault(); event.returnValue = ''; } });
async function initialize() {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) throw new Error('내용을 불러오지 못했습니다.');
    content = await response.json();
    render();
    $('#save').disabled = false;
    $('#status').textContent = '모든 변경사항이 저장되어 있습니다';
  } catch (err) { error(`${err.message} 로컬 서버가 실행 중인지 확인해 주세요.`); }
}
new ResizeObserver(([entry]) => document.documentElement.style.setProperty('--editor-header-height', `${entry.target.offsetHeight}px`)).observe($('.toolbar'));
initialize();
