const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let content;
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
    ['caseStudy', '연결할 상세 페이지 (선택)', 'case-study', '이 페이지로 프로젝트 제목과 Read case study 링크가 연결됩니다.'],
    ['title', '프로젝트 이름', 'text', '제목을 비우면 사이트에서 숨겨집니다.'], ['year', '연도', 'text', '2026'],
    ['category', '분류', 'text', '예: Research / Engineering'], ['role', '내 역할 (선택)', 'text', '예: Developer'],
    ['summary', '짧은 소개', 'textarea', '문제와 기여를 1–2문장으로 설명해 주세요.'],
    ['tools', '사용 기술 / 방법 (선택)', 'text', '예: Python, PyTorch'],
    ['image', '프로젝트 이미지 (선택)', 'image', '프로젝트 왼쪽에 같은 크기의 미리보기로 표시됩니다. 이미지가 없어도 본문 정렬은 유지됩니다. 모바일에서는 글 위에 표시됩니다.'],
    ['imageAlt', '이미지 설명 (선택)', 'text', '이미지에 무엇이 보이는지 설명해 주세요.'],
    ['url', '프로젝트 링크 (선택)', 'url', 'https://...'], ['code', '코드 링크 (선택)', 'url', 'https://github.com/...'],
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
  return `<div class="field ${type === 'textarea' || upload ? 'wide' : ''}"><label for="${id}">${label}</label>${type === 'case-study' ? `<select ${attrs}><option value="">연결 안 함</option>${(content.caseStudies || []).map(study => `<option value="${escape(study.slug)}"${study.slug === object[key] ? ' selected' : ''}>${escape(study.title)}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea ${attrs} rows="3" aria-describedby="${id}-help">${value}</textarea>` : `<input ${attrs} type="${type === 'email' ? 'email' : 'text'}" value="${value}" ${key === 'name' ? 'required' : ''} aria-describedby="${id}-help">`}<p class="help" id="${id}-help">${help}</p>${upload ? `<div class="upload"><input type="file" aria-label="${label} 파일 선택" data-upload-for="${id}" accept="${type === 'pdf' ? '.pdf' : '.png,.jpg,.jpeg,.webp,.gif'}"><span class="help">최대 10 MB · 주소를 직접 붙여넣어도 됩니다.</span></div>` : ''}</div>`;
}
function render() {
  $('#fields').innerHTML = ['profile', 'projects', 'experience', 'education'].map(group => {
    const collection = Array.isArray(content[group]);
    const fields = (object, index) => `<div class="field-grid">${fieldsets[group].map(field => fieldHTML(group, index, field, object)).join('')}</div>`;
    return `<section class="editor-section" id="${group}"><div class="section-title"><h2>${names[group]}</h2>${collection ? `<button type="button" data-action="add" data-group="${group}">+ ${names[group]} 추가</button>` : ''}</div>${collection ? content[group].length ? content[group].map((item, index) => `<details class="entry" data-entry="${group}-${index}"><summary>${String(index + 1).padStart(2, '0')} · ${escape(item.title || `새 ${names[group]}`)}</summary><div class="entry-inner">${fields(item, index)}<div class="entry-tools"><button type="button" data-action="up" data-group="${group}" data-index="${index}" ${index === 0 ? 'disabled' : ''}>위로 ↑</button><button type="button" data-action="down" data-group="${group}" data-index="${index}" ${index === content[group].length - 1 ? 'disabled' : ''}>아래로 ↓</button><button type="button" class="delete" data-action="remove" data-group="${group}" data-index="${index}">삭제</button></div></div></details>`).join('') : `<p class="empty">등록된 항목이 없습니다. 추가 버튼으로 시작하세요.</p>` : fields(content[group])}</section>`;
  }).join('') + renderCaseStudies();
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
  const fields = (object, path, schema) => schema.map(([key, label, kind]) => caseField(`${path}.${key}`, label, object[key], kind)).join('');
  const figureFields = [['image', '그림', 'image'], ['alt', '그림 대체 설명'], ['caption', '그림 아래 설명'], ['link', '자료 링크 (선택)', 'text'], ['label', '자료 링크에 표시할 글자', 'text']];
  const blocks = (section, path) => section.blocks.map((block, index) => {
    const at = `${path}.blocks.${index}`;
    let body = '';
    const names = { text: '문단', heading: '소제목', figure: '그림', comparison: '사례 비교' };
    if (block.type === 'text' || block.type === 'heading') body = caseField(`${at}.text`, names[block.type], block.text, block.type === 'heading' ? 'text' : 'textarea');
    if (block.type === 'figure') body = fields(block, at, figureFields);
    if (block.type === 'comparison') body = fields(block, at, [['intro', '비교 도입'], ['caption', '비교 설명']]) + block.cases.map((item, i) => `<fieldset><legend>사례 ${i + 1}</legend>${fields(item, `${at}.cases.${i}`, [['question', '질문'], ['source', '원본 페이지'], ['input', '답변 모델 입력'], ['response', '최종 응답 요약'], ['diagnosis', '진단 단계', 'text']])}</fieldset>`).join('');
    return `<div class="case-editor-block"><p class="help">${index + 1} · ${names[block.type]}</p>${body}</div>`;
  }).join('');
  return `<section class="editor-section" id="case-studies"><div class="section-title"><h2>상세 페이지 본문</h2></div><p class="help case-editor-help">여기서 수정한 내용은 상세 페이지와 해당 페이지의 PDF에 함께 반영됩니다. 주소는 고정되므로 홈과 경력 링크가 유지됩니다. 새 상세 페이지나 섹션 추가는 Codex에 요청하세요.</p>${studies.map((study, index) => `<details class="entry"><summary>${escape(study.title)}</summary><div class="entry-inner"><a href="/projects/${escape(study.slug)}/" target="_blank" rel="noopener">상세 페이지 미리보기 ↗</a><div class="field-grid">${fields(study, `${index}`, [['title', '상세 제목', 'text'], ['subtitle', '소속 · 역할 · 기간', 'text'], ['description', '검색 결과에 표시할 소개'], ['introduction', '팀과 내 역할 소개']])}</div><fieldset><legend>첫 화면의 질문과 근거</legend>${fields(study.example, `${index}.example`, [['question', '질문', 'text'], ['answer', '답변 요약'], ['timestamp', '검색 구간 (선택)', 'text'], ['evidence', '검색 순위 · 범위', 'text'], ['note', '번역 · 요약 안내'], ['image', '대표 그림 (선택 · 비우면 숨김)', 'image'], ['alt', '대표 그림 대체 설명'], ['caption', '그림 아래 설명'], ['source', '원본 영상 링크', 'text'], ['sourceLabel', '원본 링크에 표시할 글자', 'text']])}</fieldset>${study.sections.map((section, i) => `<details class="entry case-section-editor"><summary>${escape(section.title)}</summary><div class="entry-inner">${caseField(`${index}.sections.${i}.title`, '섹션 제목', section.title, 'text')}${blocks(section, `${index}.sections.${i}`)}</div></details>`).join('')}</div></details>`).join('')}</section>`;
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
initialize();
