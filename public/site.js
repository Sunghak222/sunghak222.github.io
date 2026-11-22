// Page content stays readable without JavaScript.
const navigation = [...document.querySelectorAll('nav a')];
const sections = navigation.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
let scheduled = false;
function updateNavigation() {
  const current = [...sections].reverse().find(section => section.getBoundingClientRect().top <= 160) || sections[0];
  for (const anchor of navigation) {
    if (anchor.hash === `#${current?.id}`) anchor.setAttribute('aria-current', 'location');
    else anchor.removeAttribute('aria-current');
  }
  scheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateNavigation); }
}, { passive: true });
updateNavigation();

// Copy the address with visible feedback; keep it selectable if access is denied.
for (const button of document.querySelectorAll('.email-copy')) {
  const status = button.parentElement.querySelector('.copy-status');
  let reset;
  button.addEventListener('click', async () => {
    clearTimeout(reset);
    let copied = false;
    try {
      await navigator.clipboard.writeText(button.dataset.email);
      copied = true;
    } catch {
      const input = document.createElement('textarea');
      input.value = button.dataset.email;
      input.setAttribute('readonly', '');
      input.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(input);
      input.select();
      try { copied = document.execCommand('copy'); } catch { /* Offer manual selection below. */ }
      input.remove();
      button.focus({ preventScroll: true });
    }
    status.textContent = copied ? 'Email copied' : 'Select the address to copy';
    if (!copied) {
      const range = document.createRange();
      range.selectNodeContents(button.querySelector('.email-address'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    reset = setTimeout(() => { status.textContent = ''; }, 3500);
  });
}
