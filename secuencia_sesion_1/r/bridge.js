(() => {
  'use strict';

  /*
   * Puente de dimensiones para recursos UFPS incrustados en eXeLearning.
   * Criterio:
   *   - el ancho del iframe permanece siempre al 100 %;
   *   - el alto se ajusta al contenido REAL de la lámina visible;
   *   - no se usa documentElement.scrollHeight para evitar que la altura
   *     inicial del iframe se retroalimente y deje zonas grises vacías;
   *   - no se modifica ninguna dimensión interna de los visores 3D.
   */
  const SOURCE = 'UFPS-EXE-RESIZE';
  const resourceId = document.documentElement.dataset.resourceId || location.pathname;
  const MIN_HEIGHT = 180;
  const SAFETY_GAP = 4;

  let lastHeight = 0;
  let pending = false;
  let parentStyle = null;
  let frameSelector = '';

  function px(value) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  function getContentHeight() {
    const body = document.body;
    if (!body) return 0;

    /* .app-shell contiene únicamente el recurso real. Su tamaño no depende
       de la altura que eXe haya escrito inicialmente en el iframe. */
    const root = document.querySelector('.app-shell') || body.firstElementChild || body;
    const rootRect = root.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const rootStyle = getComputedStyle(root);
    const bodyStyle = getComputedStyle(body);

    const visualBottom = rootRect.bottom - bodyRect.top;
    const naturalRootHeight = Math.max(rootRect.height, root.scrollHeight || 0);
    const naturalBottom = (rootRect.top - bodyRect.top) + naturalRootHeight;

    return Math.max(
      MIN_HEIGHT,
      Math.ceil(
        Math.max(visualBottom, naturalBottom) +
        px(rootStyle.marginBottom) +
        px(bodyStyle.paddingBottom) +
        SAFETY_GAP
      )
    );
  }

  function getFrame() {
    try {
      return window.frameElement || null;
    } catch (_) {
      return null;
    }
  }

  function ensureParentRule(frame) {
    try {
      const parentDoc = frame.ownerDocument;
      if (!parentDoc) return;

      if (!frame.dataset.ufpsDynamicFrame) {
        frame.dataset.ufpsDynamicFrame = `${resourceId.replace(/[^a-z0-9_-]+/gi, '-')}-${Math.random().toString(36).slice(2, 8)}`;
      }
      frameSelector = `iframe[data-ufps-dynamic-frame="${frame.dataset.ufpsDynamicFrame}"]`;

      if (!parentStyle || !parentStyle.isConnected) {
        parentStyle = parentDoc.createElement('style');
        parentStyle.dataset.ufpsDynamicStyle = frame.dataset.ufpsDynamicFrame;
        (parentDoc.head || parentDoc.documentElement).appendChild(parentStyle);
      }
    } catch (_) {
      parentStyle = null;
      frameSelector = '';
    }
  }

  function applyFrameSize(height) {
    const frame = getFrame();
    if (!frame || !height) return false;

    try {
      /* La configuración 100 % de eXe sigue siendo la referencia. Se refuerza
         aquí para impedir que estilos del editor/tema estrechen el recurso. */
      frame.style.setProperty('width', '100%', 'important');
      frame.style.setProperty('max-width', '100%', 'important');
      frame.style.setProperty('display', 'block', 'important');
      frame.style.setProperty('border', '0', 'important');
      frame.style.setProperty('height', `${height}px`, 'important');
      frame.style.setProperty('min-height', '0px', 'important');
      frame.style.setProperty('overflow', 'hidden', 'important');
      frame.setAttribute('width', '100%');
      frame.setAttribute('height', String(height));
      frame.setAttribute('scrolling', 'no');

      /* Regla adicional en la página padre. Es una segunda defensa frente a
         estilos de eXe que puedan volver a escribir las dimensiones inline. */
      ensureParentRule(frame);
      if (parentStyle && frameSelector) {
        parentStyle.textContent = `${frameSelector}{width:100%!important;max-width:100%!important;height:${height}px!important;min-height:0!important;overflow:hidden!important;display:block!important;border:0!important;}`;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function report() {
    pending = false;
    const height = getContentHeight();
    if (!height) return;

    /* Aunque la diferencia sea mínima, durante el arranque se vuelve a aplicar
       la geometría para neutralizar posibles reescrituras de eXe. */
    if (Math.abs(height - lastHeight) >= 2 || lastHeight === 0) {
      lastHeight = height;
    }
    applyFrameSize(lastHeight || height);

    /* Respaldo para cualquier página contenedora que escuche el canal. */
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: SOURCE, id: resourceId, height: lastHeight || height }, '*');
      }
    } catch (_) {}
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => requestAnimationFrame(report));
  }

  function scheduleBurst() {
    schedule();
    setTimeout(schedule, 50);
    setTimeout(schedule, 140);
    setTimeout(schedule, 300);
    setTimeout(schedule, 650);
  }

  window.addEventListener('load', scheduleBurst, { once: true });
  window.addEventListener('resize', scheduleBurst, { passive: true });
  document.addEventListener('click', scheduleBurst, true);
  document.addEventListener('change', scheduleBurst, true);
  document.addEventListener('transitionend', scheduleBurst, true);
  document.addEventListener('animationend', scheduleBurst, true);

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleBurst).catch(() => {});
  }

  if ('ResizeObserver' in window && document.body) {
    const root = document.querySelector('.app-shell') || document.body;
    new ResizeObserver(scheduleBurst).observe(root);
  }

  if ('MutationObserver' in window && document.body) {
    new MutationObserver(scheduleBurst).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    });
  }

  /* Reaplica la altura durante los primeros segundos: eXe/TinyMCE puede
     restaurar el alto configurado justo después de cargar el recurso. */
  [90, 250, 600, 1200, 2200].forEach((delay) => setTimeout(scheduleBurst, delay));
})();
