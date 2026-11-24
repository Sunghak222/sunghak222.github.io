const form = document.querySelector('#export-options');
const fields = [...form.querySelectorAll('[name="field"]')];
const projects = [...form.querySelectorAll('[name="project"]')];
const profile = document.querySelector('.export-profile');
const phoneInput = document.querySelector('#export-phone');
const phoneOutput = document.querySelector('[data-profile-field="phone"]');
const count = document.querySelector('[data-selection-count]');
const save = document.querySelector('[data-save-pdf]');
const status = document.querySelector('.export-status');
const params = new URLSearchParams(location.search);

// URLs contain choices only. The optional phone number stays in memory.
if (params.has('projects')) {
  const selected = new Set(params.get('projects').split(','));
  projects.forEach(input => { input.checked = selected.has(input.value); });
}
if (params.has('fields')) {
  const selected = new Set(params.get('fields').split(','));
  fields.forEach(input => { input.checked = selected.has(input.value); });
}

function updatePreview() {
  const selectedFields = new Set(fields.filter(input => input.checked).map(input => input.value));
  for (const element of document.querySelectorAll('[data-profile-field]')) {
    element.hidden = !selectedFields.has(element.dataset.profileField);
  }
  const hasPhone = selectedFields.has('phone');
  phoneInput.disabled = !hasPhone;
  phoneOutput.textContent = hasPhone ? phoneInput.value.trim() : '';
  phoneOutput.hidden = !phoneOutput.textContent;
  profile.classList.toggle('has-photo', selectedFields.has('photo'));
  const selectedProjects = projects.filter(input => input.checked).map(input => input.value);
  for (const article of document.querySelectorAll('[data-project]')) {
    article.hidden = !selectedProjects.includes(article.dataset.project);
  }
  count.textContent = selectedProjects.length ? count.dataset.count.replace('{count}', selectedProjects.length) : count.dataset.empty;
  for (const link of document.querySelectorAll('.language-switch a')) {
    const url = new URL(link.href);
    url.search = new URLSearchParams({ projects: selectedProjects.join(','), fields: [...selectedFields].filter(field => field !== 'phone').join(',') });
    link.href = url.href;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', updatePreview);
form.addEventListener('change', updatePreview);
form.querySelector('[data-exclude-personal]').addEventListener('click', () => {
  fields.forEach(input => { input.checked = false; });
  phoneInput.value = '';
  updatePreview();
});
for (const button of form.querySelectorAll('[data-projects]')) {
  button.addEventListener('click', () => {
    projects.forEach(input => { input.checked = button.dataset.projects === 'all'; });
    updatePreview();
  });
}

save.addEventListener('click', async () => {
  const label = save.textContent;
  save.disabled = true;
  save.textContent = save.dataset.saving;
  status.textContent = '';
  try {
    await document.fonts.ready;
    const images = [...document.querySelectorAll('#pdf-document img')].filter(img => !img.closest('[hidden]'));
    await Promise.all(images.map(img => img.decode()));
    updatePreview();
    window.print();
  } catch {
    status.textContent = status.dataset.error;
  } finally {
    save.disabled = false;
    save.textContent = label;
  }
});
window.addEventListener('beforeprint', updatePreview);
window.addEventListener('pageshow', updatePreview);
updatePreview();
