(() => {
  'use strict';
  const SOURCE = 'UFPS-EXE-RESIZE';
  const resourceId = document.documentElement.dataset.resourceId || location.pathname;
  let lastHeight = 0;
  let pending = false;

  function number(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getContentHeight() {
    const body = document.body;
    if (!body) return 0;
    const bodyTop = body.getBoundingClientRect().top;
    let bottom = 0;

    Array.from(body.children).forEach((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.position === 'fixed') return;
      const rect = element.getBoundingClientRect();
      bottom = Math.max(bottom, rect.bottom - bodyTop + number(style.marginBottom));
    });

    const bodyStyle = getComputedStyle(body);
    return Math.ceil(bottom + number(bodyStyle.paddingBottom));
  }

  function report() {
    pending = false;
    const height = getContentHeight();
    if (!height || Math.abs(height - lastHeight) < 2) return;
    lastHeight = height;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: SOURCE, id: resourceId, height }, '*');
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(report);
  }

  window.addEventListener('load', schedule, { once: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('click', () => setTimeout(schedule, 50), true);
  document.addEventListener('change', () => setTimeout(schedule, 50), true);

  if ('ResizeObserver' in window && document.body) {
    const observer = new ResizeObserver(schedule);
    Array.from(document.body.children).forEach((element) => observer.observe(element));
  }
  if ('MutationObserver' in window && document.body) {
    new MutationObserver(schedule).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    });
  }

  setTimeout(schedule, 100);
  setTimeout(schedule, 700);
})();
