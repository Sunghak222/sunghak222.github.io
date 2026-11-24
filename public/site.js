// Page content stays readable without JavaScript.
// Retire the former Chirpy blog's root worker after a hard refresh.
// Leave workers belonging to other GitHub Pages projects untouched.
if (location.hostname === 'sunghak222.github.io' && 'serviceWorker' in navigator) {
  const legacyWorker = new URL('/sw.min.js', location.origin).href;
  navigator.serviceWorker.getRegistration('/').then(async registration => {
    if (registration?.scope !== `${location.origin}/`) return;
    const worker = registration.active || registration.waiting || registration.installing;
    if (worker?.scriptURL !== legacyWorker) return;
    const controlled = navigator.serviceWorker.controller?.scriptURL === legacyWorker;
    if (await registration.unregister() && controlled) location.reload();
  }).catch(() => { /* The portfolio also works when worker access is blocked. */ });
}

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
    status.textContent = copied ? button.dataset.copied : button.dataset.copyFallback;
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
