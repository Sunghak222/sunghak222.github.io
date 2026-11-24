import { escapeHTML as escape, safeURL, external } from './html.mjs';
import { labels } from './locales.mjs';

export const lineSpacings = ['1', '1.15', '1.3', '1.5', '1.7', '2'];
export const validFontSize = value => typeof value === 'string' && /^\d+(?:\.\d+)?px$/.test(value) && parseFloat(value) >= 12 && parseFloat(value) <= 48;
const text = (value, marks = []) => value ? [{ type: 'text', text: value, ...(marks.length ? { marks } : {}) }] : [];
const inline = value => String(value || '').split('\n').flatMap((line, i) => [...(i ? [{ type: 'hardBreak' }] : []), ...text(line)]);
const p = (value, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: Array.isArray(value) ? value : inline(value) });
const paragraphs = value => String(value || '').split(/\n\s*\n/).filter(s => s.trim()).map(s => p(s));
const heading = (value, level, id = null) => ({ type: 'heading', attrs: { level, id }, content: inline(value) });
const bold = value => text(value, [{ type: 'bold' }]);
const link = (value, href) => text(value, [{ type: 'link', attrs: { href } }]);
const figure = item => ({ type: 'figure', attrs: { image: item.image, alt: item.alt || '', link: item.link || '', label: item.label || '' }, content: [p(item.caption || '')] });

// Existing plain-text content is converted only when the user edits the document.
export function legacyToDocument(study) {
  if (study.document) return structuredClone(study.document);
  const ex = study.example;
  const nodes = [heading(study.title, 1), p(study.subtitle, { role: 'subtitle' }), ...paragraphs(study.introduction)];
  for (const [index, section] of study.sections.entries()) {
    nodes.push(heading(section.title, 2, section.id));
    if (index === 0) {
      nodes.push(p(bold(ex.question)), ...paragraphs(ex.answer));
      nodes.push(p([...(ex.timestamp ? [...bold(ex.timestamp), ...text(' · ')] : []), ...text(ex.evidence), ...(ex.source ? [...text(' '), ...link(ex.sourceLabel, ex.source)] : [])], { role: 'note' }));
      if (ex.note) nodes.push(p(ex.note, { role: 'note' }));
      if (ex.image) nodes.push(figure(ex));
    }
    for (const block of section.blocks) {
      if (block.type === 'text') nodes.push(...paragraphs(block.text));
      if (block.type === 'heading') nodes.push(heading(block.text, 3));
      if (block.type === 'figure') nodes.push(figure(block));
      if (block.type === 'comparison') {
        nodes.push(...paragraphs(block.intro), {
          type: 'comparison', content: block.cases.map(item => ({ type: 'comparisonColumn', content: [
            p(bold(item.question)),
            ...[['Reference page', item.source], ['Answer model input', item.input], ['Final response', item.response], ['Diagnosed stage', item.diagnosis]].flatMap(([label, value]) => [p(bold(label), { role: 'label' }), p(value)])
          ] }))
        });
        if (block.caption) nodes.push(p(block.caption, { role: 'note' }));
      }
    }
  }
  return { type: 'doc', content: nodes };
}

export function nodeText(node) { return node.type === 'text' ? node.text : node.type === 'hardBreak' ? '\n' : (node.content || []).map(nodeText).join(''); }
export function documentTitle(doc, fallback) { return nodeText(doc.content.find(node => node.type === 'heading' && node.attrs?.level === 1) || {}).trim() || fallback; }
export function documentSections(doc) {
  const used = new Set(['main', 'top']);
  return doc.content.filter(node => node.type === 'heading' && node.attrs?.level === 2).map((node, i) => {
    const base = node.attrs?.id || `section-${i + 1}`;
    let id = base; let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return { id, title: nodeText(node), node };
  });
}

export function validateRichDocument(doc) {
  let count = 0; let characters = 0;
  const fail = () => { throw new Error('상세 문서의 서식을 확인해 주세요. 글자 크기는 12–48px, 제목은 1–3단계를 사용할 수 있습니다.'); };
  const visit = (node, parent, depth = 0) => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || ++count > 10000 || depth > 10) fail();
    const allowed = { root: ['doc'], doc: ['paragraph', 'heading', 'figure', 'comparison', 'table'], paragraph: ['text', 'hardBreak'], heading: ['text', 'hardBreak'], figure: ['paragraph'], comparison: ['comparisonColumn'], comparisonColumn: ['paragraph', 'figure'], table: ['tableRow'], tableRow: ['tableHeader', 'tableCell'], tableHeader: ['paragraph'], tableCell: ['paragraph'] };
    if (!allowed[parent]?.includes(node.type)) fail();
    const attrs = node.attrs || {};
    if (typeof attrs !== 'object' || Array.isArray(attrs)) fail();
    if (attrs.lineSpacing != null && !lineSpacings.includes(attrs.lineSpacing)) fail();
    if (attrs.role != null && !['subtitle', 'note', 'label'].includes(attrs.role)) fail();
    if (attrs.id != null && (typeof attrs.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(attrs.id))) fail();
    if (node.type === 'heading' && ![1, 2, 3].includes(attrs.level)) fail();
    if (node.type === 'figure' && (!safeURL(attrs.image) || typeof attrs.alt !== 'string' || typeof attrs.link !== 'string' || typeof attrs.label !== 'string' || (attrs.link && !safeURL(attrs.link)))) fail();
    if (node.type === 'figure' && attrs.layout != null && !['', 'portrait', 'landscape'].includes(attrs.layout)) fail();
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text || (characters += node.text.length) > 500000) fail();
      if (node.marks !== undefined && !Array.isArray(node.marks)) fail();
      for (const mark of node.marks || []) {
        if (!['bold', 'underline', 'textStyle', 'link'].includes(mark?.type)) fail();
        if (mark.type === 'textStyle' && mark.attrs?.fontSize != null && !validFontSize(mark.attrs.fontSize)) fail();
        if (mark.type === 'link' && !safeURL(mark.attrs?.href)) fail();
      }
    } else if (node.marks?.length) fail();
    if (node.content !== undefined && !Array.isArray(node.content)) fail();
    if (['text', 'hardBreak'].includes(node.type) && node.content) fail();
    if (node.type === 'doc' && !node.content?.length) fail();
    if (node.type === 'figure' && node.content?.length !== 1) fail();
    if (node.type === 'comparison' && node.content?.length !== 2) fail();
    if (node.type === 'comparisonColumn' && !node.content?.length) fail();
    if (['table', 'tableRow', 'tableHeader', 'tableCell'].includes(node.type) && !node.content?.length) fail();
    if (node.type === 'table' && (node.content.length > 100 || node.content.some(row => row.content?.length !== node.content[0].content?.length))) fail();
    if (node.type === 'tableRow' && node.content.length > 10) fail();
    for (const child of node.content || []) visit(child, node.type, depth + 1);
  };
  visit(doc, 'root');
  return doc;
}

export function renderRichDocument(doc, author = '', { assetPrefix = '../../', lang = 'en' } = {}) {
  validateRichDocument(doc);
  const sections = documentSections(doc);
  const asset = value => value.startsWith('assets/') ? `${assetPrefix}${value}` : value;
  const render = node => {
    const attrs = node.attrs || {};
    if (node.type === 'text') {
      let html = escape(node.text);
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') html = `<strong>${html}</strong>`;
        if (mark.type === 'underline') html = `<u>${html}</u>`;
        if (mark.type === 'textStyle' && mark.attrs?.fontSize) html = `<span style="--text-size:${parseFloat(mark.attrs.fontSize)};font-size:calc(var(--text-size) * var(--document-size-unit, 1px))">${html}</span>`;
        if (mark.type === 'link') html = `<a href="${escape(asset(mark.attrs.href))}"${external(mark.attrs.href)}>${html}</a>`;
      }
      return html;
    }
    if (node.type === 'hardBreak') return '<br>';
    const inside = (node.content || []).map(render).join('');
    const spacing = attrs.lineSpacing ? ` style="line-height:${attrs.lineSpacing}"` : '';
    if (node.type === 'paragraph') return `<p${attrs.role ? ` class="document-${attrs.role}"` : ''}${spacing}>${attrs.role === 'subtitle' && author ? `<span class="print-author">${escape(author)} · </span>` : ''}${inside || '<br>'}</p>`;
    if (node.type === 'heading') {
      const section = sections.find(item => item.node === node);
      return `<h${attrs.level}${section ? ` id="${section.id}"` : ''}${spacing}>${inside}</h${attrs.level}>`;
    }
    if (node.type === 'figure') return `<figure class="case-figure${attrs.layout ? ` is-${attrs.layout}` : ''}"><a href="${escape(asset(attrs.image))}" target="_blank" rel="noopener noreferrer" aria-label="${labels[lang].fullImage}"><img src="${escape(asset(attrs.image))}" alt="${escape(attrs.alt)}"></a><figcaption>${inside}${attrs.link ? `<a href="${escape(asset(attrs.link))}"${external(attrs.link)}>${escape(attrs.label)}</a>` : ''}</figcaption></figure>`;
    if (node.type === 'comparison') return `<div class="document-comparison">${inside}</div>`;
    if (node.type === 'comparisonColumn') return `<div class="document-comparison-column">${inside}</div>`;
    if (node.type === 'table') {
      const hasHeader = node.content[0].content.every(cell => cell.type === 'tableHeader');
      const rows = hasHeader ? `<thead>${render(node.content[0])}</thead><tbody>${node.content.slice(1).map(render).join('')}</tbody>` : `<tbody>${inside}</tbody>`;
      return `<div class="document-table-wrap" tabindex="0" role="region" aria-label="Comparison table"><table class="document-table">${rows}</table></div>`;
    }
    if (node.type === 'tableRow') return `<tr>${inside}</tr>`;
    if (node.type === 'tableHeader') return `<th scope="col">${inside}</th>`;
    if (node.type === 'tableCell') return `<td>${inside}</td>`;
    return inside;
  };
  return `<div class="rich-document">${render(doc)}</div>`;
}
