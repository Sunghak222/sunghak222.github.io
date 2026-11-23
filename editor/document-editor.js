import { Editor, Extension, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { legacyToDocument, lineSpacings, validFontSize } from '../scripts/rich-document.mjs';
import { safeURL } from '../scripts/html.mjs';

const asset = url => url.startsWith('assets/') ? `/${url}` : url;
const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: {
      lineSpacing: { default: null, parseHTML: el => lineSpacings.includes(el.style.lineHeight) ? el.style.lineHeight : null, renderHTML: attrs => attrs.lineSpacing ? { style: `line-height:${attrs.lineSpacing}` } : {} },
      id: { default: null, parseHTML: el => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(el.id) ? el.id : null, renderHTML: () => ({}) }
    } }, { types: ['paragraph'], attributes: {
      role: { default: null, parseHTML: el => ['subtitle', 'note', 'label'].find(role => el.classList.contains(`document-${role}`)) || null, renderHTML: attrs => attrs.role ? { class: `document-${attrs.role}` } : {} }
    } }];
  }
});
const SizedText = TextStyle.extend({
  addAttributes() { return { ...this.parent?.(), fontSize: {
    default: null,
    parseHTML: element => {
      const raw = element.style.fontSize;
      const px = /^(\d+(?:\.\d+)?)(px|pt)$/.exec(raw);
      const size = px ? `${Math.round(Number(px[1]) * (px[2] === 'pt' ? 4 / 3 : 1))}px` : null;
      return validFontSize(size) ? size : null;
    },
    renderHTML: attrs => validFontSize(attrs.fontSize) ? { style: `font-size:${attrs.fontSize}` } : {}
  } }; }
});
const Figure = Node.create({
  name: 'figure', group: 'block', content: 'paragraph', defining: true, isolating: true,
  addAttributes() { return Object.fromEntries(['id', 'image', 'alt', 'link', 'label'].map(key => [key, { default: '' }])); },
  parseHTML() { return [{ tag: 'figure[data-document-figure]', getAttrs: el => ({ id: el.dataset.figureId || '', image: el.querySelector('img')?.getAttribute('src') || '', alt: el.querySelector('img')?.alt || '', link: el.dataset.link || '', label: el.dataset.label || '' }), contentElement: '.figure-caption-content' }]; },
  renderHTML({ node }) {
    const a = node.attrs;
    return ['figure', { 'data-document-figure': '', 'data-figure-id': a.id, 'data-link': a.link, 'data-label': a.label },
      ['div', { contenteditable: 'false' }, ['img', { src: asset(a.image), alt: a.alt }]],
      ['figcaption', {}, ['div', { class: 'figure-caption-content' }, 0], ...(a.link ? [['a', { href: asset(a.link), contenteditable: 'false', tabindex: '-1' }, a.label]] : [])]
    ];
  }
});
const Comparison = Node.create({ name: 'comparison', group: 'block', content: 'comparisonColumn{2}', defining: true, isolating: true,
  parseHTML() { return [{ tag: 'div.document-comparison' }]; }, renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { class: 'document-comparison' }), 0]; }
});
const ComparisonColumn = Node.create({ name: 'comparisonColumn', content: 'paragraph+', defining: true, isolating: true,
  parseHTML() { return [{ tag: 'div.document-comparison-column' }]; }, renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { class: 'document-comparison-column' }), 0]; }
});

export function createDocumentEditor(container, study, { onChange, onError, upload }) {
  const toolbar = container.querySelector('.document-toolbar');
  const style = toolbar.querySelector('[data-format="heading"]');
  const size = toolbar.querySelector('[data-format="size"]');
  const spacing = toolbar.querySelector('[data-format="spacing"]');
  const media = container.querySelector('.document-media');
  const doc = legacyToDocument(study);
  let figureIndex = 0;
  for (const node of doc.content) if (node.type === 'figure') node.attrs.id ||= `figure-${++figureIndex}`;
  const syncToolbar = editor => {
    const currentHeading = editor.getAttributes('heading').level;
    style.value = editor.isActive('heading') ? String(currentHeading) : '0';
    style.disabled = !editor.isActive('heading') && !editor.can().setHeading({ level: 3 });
    const explicit = editor.getAttributes('textStyle').fontSize;
    if (document.activeElement !== size) size.value = explicit ? parseFloat(explicit) : '';
    size.placeholder = editor.isActive('heading') ? ({ 1: '34', 2: '28', 3: '22' }[currentHeading]) : editor.getAttributes('paragraph').role ? '18' : '20';
    const attrs = editor.isActive('heading') ? editor.getAttributes('heading') : editor.getAttributes('paragraph');
    spacing.value = attrs.lineSpacing || '';
    for (const mark of ['bold', 'underline']) toolbar.querySelector(`[data-format="${mark}"]`).setAttribute('aria-pressed', String(editor.isActive(mark)));
  };
  const editor = new Editor({
    element: container.querySelector('.document-canvas'),
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, blockquote: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, code: false, codeBlock: false, horizontalRule: false, italic: false, strike: false, trailingNode: false, link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: url => !!safeURL(url) } }), SizedText, ParagraphStyle, Figure, Comparison, ComparisonColumn],
    content: doc,
    editorProps: { attributes: { class: 'rich-document', role: 'textbox', 'aria-label': `${study.title} 상세 문서`, 'aria-multiline': 'true', spellcheck: 'false' } },
    onCreate: ({ editor }) => syncToolbar(editor),
    onSelectionUpdate: ({ editor }) => syncToolbar(editor),
    onUpdate: ({ editor }) => { onChange(editor.getJSON()); syncToolbar(editor); }
  });
  toolbar.addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
  toolbar.addEventListener('click', event => {
    const type = event.target.closest('button')?.dataset.format;
    if (type === 'bold') editor.chain().focus().toggleBold().run();
    if (type === 'underline') editor.chain().focus().toggleUnderline().run();
    syncToolbar(editor);
  });
  style.addEventListener('change', () => {
    const chain = editor.chain().focus();
    if (style.value === '0') chain.setParagraph().run();
    else chain.setHeading({ level: Number(style.value) }).run();
    syncToolbar(editor);
  });
  const changeSize = () => {
    if (!size.checkValidity()) { size.reportValidity(); return; }
    const fontSize = size.value ? `${size.value}px` : null;
    editor.chain().focus().setMark('textStyle', { fontSize }).removeEmptyTextStyle().run();
    syncToolbar(editor);
  };
  size.addEventListener('change', changeSize);
  size.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); changeSize(); } });
  spacing.addEventListener('change', () => {
    editor.chain().focus().updateAttributes('paragraph', { lineSpacing: spacing.value || null }).updateAttributes('heading', { lineSpacing: spacing.value || null }).run();
    syncToolbar(editor);
  });
  const updateFigure = (id, values) => {
    let found;
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'figure' && node.attrs.id === id) found = { node, pos }; });
    if (!found) throw new Error('이 그림이 문서에서 삭제되었습니다. 그림 목록을 다시 열어 주세요.');
    editor.view.dispatch(editor.state.tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, ...values }));
  };
  media.addEventListener('toggle', () => {
    if (!media.open) return;
    const body = media.querySelector('.document-media-fields'); body.replaceChildren();
    editor.state.doc.descendants(node => {
      if (node.type.name !== 'figure') return;
      const group = document.createElement('fieldset');
      const legend = document.createElement('legend'); legend.textContent = `그림 ${body.children.length + 1}`; group.append(legend);
      for (const [key, name] of [['image', '이미지 주소'], ['alt', '이미지 설명'], ['link', '자료 링크'], ['label', '자료 링크 문구']]) {
        const label = document.createElement('label'); label.textContent = name;
        const input = document.createElement('input'); input.type = 'text'; input.value = node.attrs[key];
        input.addEventListener('change', () => { try { updateFigure(node.attrs.id, { [key]: input.value }); } catch (error) { onError(error.message); } });
        label.append(input); group.append(label);
      }
      const label = document.createElement('label'); label.textContent = '이미지 교체';
      const file = document.createElement('input'); file.type = 'file'; file.accept = '.png,.jpg,.jpeg,.webp,.gif';
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        try { const path = await upload(file.files[0]); updateFigure(node.attrs.id, { image: path }); group.querySelector('input').value = path; }
        catch (error) { onError(error.message); }
        finally { file.value = ''; }
      });
      label.append(file); group.append(label); body.append(group);
    });
    if (!body.children.length) body.textContent = '문서에 등록된 그림이 없습니다.';
  });
  return editor;
}

export const documentEditorHTML = () => `<div class="document-editor">
  <div class="document-toolbar" role="toolbar" aria-label="문서 서식">
    <label>문단<select data-format="heading" aria-label="제목 단계"><option value="0">본문</option><option value="1">제목 1</option><option value="2">제목 2</option><option value="3">제목 3</option></select></label>
    <button type="button" data-format="bold" aria-label="굵게" aria-pressed="false" title="굵게 (⌘B / Ctrl+B)"><strong>B</strong></button>
    <button type="button" data-format="underline" aria-label="밑줄" aria-pressed="false" title="밑줄 (⌘U / Ctrl+U)"><u>U</u></button>
    <label>글자 크기 <span class="unit">px</span><input data-format="size" aria-label="글자 크기" type="number" min="12" max="48" step="1" placeholder="20"></label>
    <label>줄 간격<select data-format="spacing" aria-label="줄 간격"><option value="">기본</option>${lineSpacings.map(value => `<option value="${value}">${value}</option>`).join('')}</select></label>
  </div>
  <p class="document-hint">글을 선택해 서식을 바꾸세요. 제목 단계와 줄 간격은 현재 문단에 적용됩니다. 실행 취소: ⌘Z / Ctrl+Z</p>
  <div class="document-canvas"></div>
  <details class="document-media"><summary>그림과 자료 링크</summary><div class="document-media-fields"></div></details>
</div>`;
