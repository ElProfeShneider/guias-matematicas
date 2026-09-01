const LOCAL_THREE = '../../lib/three.module.min.js';
const diagnosticMode = new URLSearchParams(location.search).get('diagnostico') === '1';
const diagnostics = document.getElementById('diagnostics');
if (diagnosticMode && diagnostics) diagnostics.hidden = false;

let THREE;
let currentIndex = 0;
let activeViewers = [];
let quickComplete = false;
let quickState = { q1: null, q2: null, q3: null, checked: false };
const auditState = [null, null, null];
const verifyState = [null, null];

const screens = [
  { id: 'concept', phase: 3, label: 'Vista y cuerpo' },
  { id: 'names', phase: 3, label: 'Nombres' },
  { id: 'families', phase: 3, label: 'Familias' },
  { id: 'quick', phase: 3, label: 'Verificación rápida' },
  { id: 'audit-intro', phase: 4, label: 'Auditores del museo' },
  { id: 'audit', phase: 4, caseIndex: 0, label: 'Caso 1 de 3' },
  { id: 'audit', phase: 4, caseIndex: 1, label: 'Caso 2 de 3' },
  { id: 'audit', phase: 4, caseIndex: 2, label: 'Caso 3 de 3' },
  { id: 'verify', phase: 4, verifyIndex: 0, label: 'Verificación 1 de 2' },
  { id: 'verify', phase: 4, verifyIndex: 1, label: 'Verificación 2 de 2' },
  { id: 'finish', phase: 4, label: 'Revisión final' }
];

const auditCases = [
  {
    title: 'Caso 1', kind: 'sphere', rotation: { x: 0, y: 0, z: 0 },
    proposed: 'Cilindro — CR', correctDecision: 'C', final: 'Esfera — CR',
    correction: 'Cambian solamente el nombre.'
  },
  {
    title: 'Caso 2', kind: 'pyramid5', rotation: { x: 0.20, y: 0.50, z: -0.80 },
    proposed: 'Cono — CR', correctDecision: 'C', final: 'Pirámide pentagonal — P',
    correction: 'Cambian el nombre y la familia.'
  },
  {
    title: 'Caso 3', kind: 'prism', rotation: { x: 0.12, y: -0.34, z: 1.34 },
    proposed: 'Prisma rectangular — P', correctDecision: 'M', final: 'Prisma rectangular — P',
    correction: 'La etiqueta se mantiene completa.'
  }
];

const verifyCases = [
  {
    title: 'Verificación 1', kind: 'cube', rotation: { x: 0.55, y: 0.65, z: 0.45 },
    proposed: 'Cubo — P', decision: 'M', final: 'Cubo — P'
  },
  {
    title: 'Verificación 2', kind: 'cone', rotation: { x: 0.90, y: 0.15, z: 1.45 },
    proposed: 'Pirámide pentagonal — P', decision: 'C', final: 'Cono — CR'
  }
];

const content = document.getElementById('content');
const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const phaseInstructionF34 = document.getElementById('phase-instruction-f34');

function setPhaseInstructionF34(text) {
  if (phaseInstructionF34 && phaseInstructionF34.textContent !== text) phaseInstructionF34.textContent = text;
}

function geometryFor(kind) {
  if (kind === 'prism') return new THREE.BoxGeometry(3.6, 2.25, 1.8);
  if (kind === 'cube') return new THREE.BoxGeometry(2.55, 2.55, 2.55);
  if (kind === 'cone') return new THREE.ConeGeometry(1.35, 3.15, 48, 1, false);
  if (kind === 'cylinder') return new THREE.CylinderGeometry(1.28, 1.28, 3.15, 48, 1, false);
  if (kind === 'pyramid5') return new THREE.CylinderGeometry(0, 1.38, 3.15, 5, 1, false);
  if (kind === 'sphere') return new THREE.SphereGeometry(1.52, 40, 24);
  throw new Error(`Geometría no reconocida: ${kind}`);
}

function edgeThreshold(kind) {
  return ['cone', 'cylinder', 'sphere'].includes(kind) ? 42 : 15;
}

function createScene(container, kind, rotation, interactive = false) {
  if (!window.WebGLRenderingContext) throw new Error('Este navegador no ofrece WebGL.');
  container.classList.toggle('is-interactive', interactive);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef4f7);
  const camera = new THREE.PerspectiveCamera(interactive ? 36 : 34, 1, 0.1, 100);
  camera.position.set(5.4, 3.7, 6.6);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xeef4f7, 1);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7890a0, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(5, 7, 7); scene.add(key);
  const fill = new THREE.DirectionalLight(0x99ddff, 0.8); fill.position.set(-5, 2, 4); scene.add(fill);

  const group = new THREE.Group();
  const geometry = geometryFor(kind);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x55b7d7, roughness: 0.72, metalness: 0 }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, edgeThreshold(kind)), new THREE.LineBasicMaterial({ color: 0x1d526b, transparent: true, opacity: 0.86 }));
  group.add(mesh, edges);
  group.rotation.set(rotation.x, rotation.y, rotation.z);
  scene.add(group);

  let width = 0; let height = 0; let disposed = false;
  const draw = () => {
    if (disposed) return;
    const w = Math.max(1, container.clientWidth); const h = Math.max(1, container.clientHeight);
    if (w !== width || h !== height) {
      width = w; height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  };
  draw();

  let resizeObserver = null;
  let resizeFrame = 0;
  const scheduleDraw = () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; draw(); });
  };
  const onResize = () => scheduleDraw();
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(container);
  } else window.addEventListener('resize', onResize);

  let dragging = false; let lastX = 0; let lastY = 0;
  const pointerDown = (event) => {
    if (!interactive) return;
    dragging = true; lastX = event.clientX; lastY = event.clientY;
    container.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event) => {
    if (!interactive || !dragging) return;
    const dx = event.clientX - lastX; const dy = event.clientY - lastY;
    lastX = event.clientX; lastY = event.clientY;
    group.rotation.y += dx * 0.012;
    group.rotation.x = Math.max(-1.35, Math.min(1.35, group.rotation.x + dy * 0.012));
    draw();
  };
  const pointerUp = () => { dragging = false; };
  const keyDown = (event) => {
    if (!interactive) return;
    const step = 0.13;
    if (event.key === 'ArrowLeft') group.rotation.y -= step;
    else if (event.key === 'ArrowRight') group.rotation.y += step;
    else if (event.key === 'ArrowUp') group.rotation.x = Math.max(-1.35, group.rotation.x - step);
    else if (event.key === 'ArrowDown') group.rotation.x = Math.min(1.35, group.rotation.x + step);
    else if (event.key.toLowerCase() === 'r') group.rotation.set(rotation.x, rotation.y, rotation.z);
    else return;
    event.preventDefault(); draw();
  };
  if (interactive) {
    container.addEventListener('pointerdown', pointerDown);
    container.addEventListener('pointermove', pointerMove);
    container.addEventListener('pointerup', pointerUp);
    container.addEventListener('pointercancel', pointerUp);
    container.addEventListener('keydown', keyDown);
  }

  const lost = (event) => { event.preventDefault(); container.innerHTML = fallbackSVG(kind); };
  renderer.domElement.addEventListener('webglcontextlost', lost, false);

  return {
    reset() { group.rotation.set(rotation.x, rotation.y, rotation.z); draw(); },
    dispose() {
      disposed = true;
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect(); window.removeEventListener('resize', onResize);
      container.removeEventListener('pointerdown', pointerDown);
      container.removeEventListener('pointermove', pointerMove);
      container.removeEventListener('pointerup', pointerUp);
      container.removeEventListener('pointercancel', pointerUp);
      container.removeEventListener('keydown', keyDown);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      geometry.dispose(); mesh.material.dispose(); edges.geometry.dispose(); edges.material.dispose(); renderer.dispose();
      renderer.domElement.remove();
      container.classList.remove('is-interactive');
    }
  };
}

function fallbackSVG(kind) {
  const commonStart = '<div class="fallback"><svg viewBox="0 0 360 240" role="img" aria-label="Representación alternativa del cuerpo geométrico">';
  const commonEnd = '</svg><p>Representación alternativa del cuerpo geométrico.</p></div>';
  const shapes = {
    prism: '<path d="M62 74l58-34h174l-58 34z" fill="#9ae9ee" stroke="#1d526b" stroke-width="3"/><path d="M62 74h174v106H62z" fill="#77dce4" stroke="#1d526b" stroke-width="3"/><path d="M236 74l58-34v106l-58 34z" fill="#63c9dd" stroke="#1d526b" stroke-width="3"/>',
    cube: '<path d="M92 70l62-36 112 34-62 38z" fill="#9ae9ee" stroke="#1d526b" stroke-width="3"/><path d="M92 70l112 36v105L92 174z" fill="#77dce4" stroke="#1d526b" stroke-width="3"/><path d="M204 106l62-38v105l-62 38z" fill="#63c9dd" stroke="#1d526b" stroke-width="3"/>',
    cone: '<ellipse cx="180" cy="186" rx="72" ry="25" fill="#77dce4" stroke="#1d526b" stroke-width="3"/><path d="M108 186L180 42l72 144" fill="#8fe5ea" stroke="#1d526b" stroke-width="3"/>',
    cylinder: '<ellipse cx="180" cy="58" rx="70" ry="24" fill="#9ae9ee" stroke="#1d526b" stroke-width="3"/><path d="M110 58v122c0 14 31 25 70 25s70-11 70-25V58" fill="#77dce4" stroke="#1d526b" stroke-width="3"/><ellipse cx="180" cy="180" rx="70" ry="25" fill="#63c9dd" stroke="#1d526b" stroke-width="3"/>',
    pyramid5: '<polygon points="88,154 132,194 214,198 278,158 188,132" fill="#63c9dd" stroke="#1d526b" stroke-width="3"/><polygon points="184,38 88,154 132,194" fill="#8fe5ea" stroke="#1d526b" stroke-width="3"/><polygon points="184,38 132,194 214,198" fill="#77dce4" stroke="#1d526b" stroke-width="3"/><polygon points="184,38 214,198 278,158" fill="#63c9dd" stroke="#1d526b" stroke-width="3"/><polygon points="184,38 278,158 188,132" fill="#9ae9ee" stroke="#1d526b" stroke-width="3"/><polygon points="184,38 188,132 88,154" fill="#72d7e2" stroke="#1d526b" stroke-width="3"/>',
    sphere: '<circle cx="180" cy="120" r="78" fill="#77dce4" stroke="#1d526b" stroke-width="3"/><ellipse cx="155" cy="92" rx="28" ry="20" fill="#b9f1f4" opacity=".75"/>'
  };
  return commonStart + (shapes[kind] || shapes.prism) + commonEnd;
}

function addViewer(container, kind, rotation, interactive = false) {
  try { activeViewers.push(createScene(container, kind, rotation, interactive)); }
  catch (error) { console.error(error); container.innerHTML = fallbackSVG(kind); }
}

function disposeViewers() {
  activeViewers.forEach((viewer) => viewer?.dispose()); activeViewers = [];
}

function staticModelCard(kind, code, name, rotation) {
  const card = document.createElement('article'); card.className = 'model-card';
  const visual = document.createElement('div'); visual.className = 'model-visual viewer';
  visual.setAttribute('role', 'img'); visual.setAttribute('aria-label', `Modelo ${code}: ${name}`);
  const label = document.createElement('div'); label.className = 'model-name'; label.textContent = `${code} · ${name}`;
  card.append(visual, label); addViewer(visual, kind, rotation, false); return card;
}

function renderConcept() {
  content.innerHTML = `
    <section class="concept-card">
      <h2>Una figura plana y un cuerpo no son lo mismo</h2>
      <div class="compare-grid">
        <article class="compare-card">
          <div class="compare-visual">
            <svg class="flat-svg" viewBox="0 0 360 240" role="img" aria-label="Rectángulo como figura plana">
              <rect x="65" y="55" width="230" height="130" rx="3" fill="#8fe5ea" stroke="#1d526b" stroke-width="4"/>
            </svg>
          </div>
          <div class="compare-copy"><h3>Figura plana</h3><p>Tiene dos dimensiones.</p></div>
        </article>
        <article class="compare-card">
          <div id="concept-body" class="compare-visual viewer" tabindex="0" role="region" aria-label="Cuerpo geométrico tridimensional que puede girarse" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown R"></div>
          <div class="compare-copy"><h3>Cuerpo geométrico</h3><p>Tiene tres dimensiones y ocupa espacio.</p></div>
        </article>
      </div>
      <p class="hero-rule">Girar un cuerpo cambia la vista, pero no cambia el cuerpo.</p>
      <p class="viewer-help">Arrastren el cuerpo para observarlo desde otras posiciones.</p>
    </section>`;
  addViewer(document.getElementById('concept-body'), 'prism', { x: 0.06, y: -0.16, z: 0.04 }, true);
}

function renderNames() {
  content.innerHTML = `<section class="concept-card"><h2>Nombres de los modelos</h2><div id="names-grid" class="model-grid"></div></section>`;
  const grid = document.getElementById('names-grid');
  [
    ['prism', 'M1', 'Prisma rectangular', { x: 0.05, y: -0.16, z: 0.03 }],
    ['cone', 'M2', 'Cono', { x: -0.12, y: 0.52, z: -0.92 }],
    ['cube', 'M3', 'Cubo', { x: 0.05, y: -0.15, z: 0.03 }],
    ['cylinder', 'M4', 'Cilindro', { x: -0.18, y: 0.48, z: 0.08 }],
    ['pyramid5', 'M5', 'Pirámide pentagonal', { x: -1.00, y: 0.35, z: 0.50 }],
    ['sphere', 'M6', 'Esfera', { x: 0, y: 0, z: 0 }]
  ].forEach(([kind, code, name, rotation]) => grid.appendChild(staticModelCard(kind, code, name, rotation)));
}

function renderFamilies() {
  content.innerHTML = `
    <section class="concept-card">
      <h2>Dos familias</h2>
      <div class="family-grid">
        <article class="family-column">
          <h3>P — Poliedro</h3>
          <p>Cuerpo formado solo por partes planas.</p>
          <ul class="family-list"><li><strong>M1</strong> · Prisma rectangular</li><li><strong>M3</strong> · Cubo</li><li><strong>M5</strong> · Pirámide pentagonal</li></ul>
        </article>
        <article class="family-column">
          <h3>CR — Cuerpo redondo</h3>
          <p>Cuerpo que tiene al menos una parte curva.</p>
          <ul class="family-list"><li><strong>M2</strong> · Cono</li><li><strong>M4</strong> · Cilindro</li><li><strong>M6</strong> · Esfera</li></ul>
        </article>
      </div>
    </section>`;
}

function renderQuick() {
  content.innerHTML = `
    <section class="quick-card">
      <h2>Verificación rápida</h2>
      <form id="quick-form" class="quick-form">
        <div class="question-block question-block--visual">
          <div class="quick-reference-card">
            <div id="quick-m4" class="viewer quick-reference-viewer" role="img" aria-label="Modelo M4"></div>
            <strong>M4</strong>
          </div>
          <fieldset><legend>1. ¿Cómo se llama M4?</legend><div class="option-list">
            <label><input type="radio" name="q1" value="cono"> Cono</label>
            <label><input type="radio" name="q1" value="cilindro"> Cilindro</label>
            <label><input type="radio" name="q1" value="esfera"> Esfera</label>
          </div></fieldset>
        </div>
        <div class="question-block question-block--visual">
          <div class="quick-reference-card">
            <div id="quick-m5" class="viewer quick-reference-viewer" role="img" aria-label="Modelo M5"></div>
            <strong>M5</strong>
          </div>
          <fieldset><legend>2. ¿A qué familia pertenece M5?</legend><div class="option-list">
            <label><input type="radio" name="q2" value="P"> P — Poliedro</label>
            <label><input type="radio" name="q2" value="CR"> CR — Cuerpo redondo</label>
          </div></fieldset>
        </div>
        <div class="question-block question-block--visual">
          <div class="quick-reference-card">
            <div class="quick-circle-view" role="img" aria-label="Vista circular de M4">
              <svg viewBox="0 0 180 180" aria-hidden="true">
                <circle cx="90" cy="90" r="58" fill="#8fe5ea" stroke="#1d526b" stroke-width="4"/>
              </svg>
            </div>
            <strong>Vista circular de M4</strong>
          </div>
          <fieldset><legend>3. ¿Esta vista significa que M4 dejó de ser el mismo cuerpo?</legend><div class="option-list">
            <label><input type="radio" name="q3" value="si"> Sí</label>
            <label><input type="radio" name="q3" value="no"> No</label>
          </div></fieldset>
        </div>
        <button id="quick-submit" class="button" type="submit" disabled>Comprobar</button>
      </form>
      <div id="quick-feedback" class="feedback" role="status" aria-live="polite"></div>
    </section>`;

  addViewer(document.getElementById('quick-m4'), 'cylinder', { x: -0.18, y: 0.48, z: 0.08 }, false);
  addViewer(document.getElementById('quick-m5'), 'pyramid5', { x: -1.00, y: 0.35, z: 0.50 }, false);

  const form = document.getElementById('quick-form');
  const submit = document.getElementById('quick-submit');
  const feedback = document.getElementById('quick-feedback');

  ['q1', 'q2', 'q3'].forEach((name) => {
    if (quickState[name]) {
      const input = form.querySelector(`input[name="${name}"][value="${quickState[name]}"]`);
      if (input) input.checked = true;
    }
  });

  const syncState = () => {
    const data = new FormData(form);
    quickState.q1 = data.get('q1');
    quickState.q2 = data.get('q2');
    quickState.q3 = data.get('q3');
    submit.disabled = !(quickState.q1 && quickState.q2 && quickState.q3) || quickComplete;
  };

  form.addEventListener('change', () => {
    quickState.checked = false;
    quickComplete = false;
    feedback.className = 'feedback';
    feedback.textContent = '';
    nextButton.disabled = true;
    syncState();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    syncState();
    if (!quickState.q1 || !quickState.q2 || !quickState.q3) {
      feedback.className = 'feedback is-warning';
      feedback.textContent = 'Respondan las tres preguntas antes de comprobar.';
      return;
    }
    quickState.checked = true;
    const correct = quickState.q1 === 'cilindro' && quickState.q2 === 'P' && quickState.q3 === 'no';
    if (correct) {
      quickComplete = true;
      feedback.className = 'feedback is-success';
      feedback.textContent = 'Correcto. Cambiar la vista no cambia el cuerpo, su nombre ni su familia.';
      form.querySelectorAll('input').forEach((input) => { input.disabled = true; });
      submit.disabled = true;
      nextButton.disabled = false;
    } else {
      quickComplete = false;
      feedback.className = 'feedback is-error';
      feedback.textContent = 'Revisen M4, M5 y el cambio de vista. Corrijan lo necesario y vuelvan a comprobar.';
      nextButton.disabled = true;
      submit.disabled = false;
    }
  });

  syncState();
  if (quickComplete && quickState.checked) {
    form.querySelectorAll('input').forEach((input) => { input.disabled = true; });
    submit.disabled = true;
    feedback.className = 'feedback is-success';
    feedback.textContent = 'Correcto. Cambiar la vista no cambia el cuerpo, su nombre ni su familia.';
  }
}
function renderAuditIntro() {
  content.innerHTML = `
    <section class="message-card">
      <h2>Auditores del museo</h2>
      <p><strong>M · Mantener:</strong> dejar la etiqueta como está. <strong>C · Corregir:</strong> cambiar el nombre, la familia o ambos.</p>
      <div class="role-banner"><strong>En cada caso:</strong> completen la guía → marquen aquí M o C → pulsen <strong>«Comprobar»</strong> → indiquen en la guía si mantuvieron o cambiaron su decisión.</div>
      <p class="prompt-note">No borren lo escrito antes de comprobar.</p>
    </section>`;
}

function renderAudit(index) {
  const item = auditCases[index];
  const saved = auditState[index];
  content.innerHTML = `
    <section class="audit-card">
      <h2>${item.title} · Revisen la etiqueta</h2>
      <div class="audit-layout">
        <div>
          <div id="audit-viewer" class="viewer audit-viewer" tabindex="0" role="region" aria-label="Modelo tridimensional del ${item.title}" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown R"></div>
          <p class="viewer-help">Arrastren para girar o usen las flechas del teclado.</p>
        </div>
        <div>
          <div class="label-card"><span>Etiqueta propuesta</span><p class="proposed-label">${item.proposed}</p></div>
          <p><strong>¿La etiqueta se mantiene o debe corregirse?</strong></p>
          <div class="choice-row">
            <button class="button button--choice" type="button" data-decision="M" aria-pressed="${saved?.decision === 'M'}">M · Mantener</button>
            <button class="button button--choice" type="button" data-decision="C" aria-pressed="${saved?.decision === 'C'}">C · Corregir</button>
          </div>
          <button id="check-audit" class="button" type="button" disabled>Comprobar</button>
          <div id="audit-feedback" class="feedback" role="status" aria-live="polite"></div>
          <div id="final-label" class="final-label" ${saved?.checked ? '' : 'hidden'}><span>Resultado correcto</span><strong>${item.final}</strong><small>${item.correction}</small></div>
        </div>
      </div>
    </section>`;
  addViewer(document.getElementById('audit-viewer'), item.kind, item.rotation, true);
  const choices = [...content.querySelectorAll('[data-decision]')];
  const check = document.getElementById('check-audit');
  const feedback = document.getElementById('audit-feedback');
  const finalLabel = document.getElementById('final-label');
  let selected = saved?.decision || null;

  const applyDecisionStyles = (decision, isChecked) => {
    choices.forEach((button) => {
      const buttonDecision = button.dataset.decision;
      button.setAttribute('aria-pressed', buttonDecision === decision ? 'true' : 'false');
      button.classList.remove('is-correct', 'is-wrong');
      if (isChecked && buttonDecision === item.correctDecision) button.classList.add('is-correct');
      else if (isChecked && buttonDecision === decision) button.classList.add('is-wrong');
      button.disabled = isChecked;
    });
  };

  const setSelected = (decision) => {
    if (auditState[index]?.checked) return;
    selected = decision;
    applyDecisionStyles(selected, false);
    check.disabled = false;
    feedback.className = 'feedback';
    feedback.textContent = '';
  };

  choices.forEach((button) => button.addEventListener('click', () => setSelected(button.dataset.decision)));
  check.addEventListener('click', () => {
    if (!selected) return;
    const correct = selected === item.correctDecision;
    auditState[index] = { decision: selected, checked: true, correct };
    applyDecisionStyles(selected, true);
    check.disabled = true;
    feedback.className = `feedback ${correct ? 'is-success' : 'is-warning'}`;
    feedback.textContent = correct
      ? 'La decisión coincide. Comparen el resultado con lo escrito en la guía y marquen «Mantuvimos M/C». No borren lo escrito antes de comprobar.'
      : 'La decisión no coincide. Comparen el resultado con lo escrito en la guía y marquen «Cambiamos M/C». No borren lo escrito antes de comprobar.';
    finalLabel.hidden = false;
    nextButton.disabled = false;
  });

  if (saved?.checked) {
    applyDecisionStyles(saved.decision, true);
    check.disabled = true;
    finalLabel.hidden = false;
    feedback.className = `feedback ${saved.correct ? 'is-success' : 'is-warning'}`;
    feedback.textContent = saved.correct
      ? 'La decisión coincide. Comparen el resultado con lo escrito en la guía y marquen «Mantuvimos M/C». No borren lo escrito antes de comprobar.'
      : 'La decisión no coincide. Comparen el resultado con lo escrito en la guía y marquen «Cambiamos M/C». No borren lo escrito antes de comprobar.';
  } else if (selected) {
    applyDecisionStyles(selected, false);
    check.disabled = false;
  }
}

function renderVerify(index) {
  const item = verifyCases[index];
  const saved = verifyState[index];
  content.innerHTML = `
    <section class="verify-card">
      <h2>${item.title} · Revisen la etiqueta</h2>
      <div id="verify-viewer" class="viewer verify-model" role="img" aria-label="Modelo de la ${item.title}"></div>
      <div class="label-card"><span>Etiqueta propuesta</span><p class="proposed-label">${item.proposed}</p></div>
      <p><strong>¿La etiqueta se mantiene o debe corregirse?</strong></p>
      <div class="choice-row">
        <button class="button button--choice" type="button" data-verify-decision="M" aria-pressed="${saved?.decision === 'M'}">M · Mantener</button>
        <button class="button button--choice" type="button" data-verify-decision="C" aria-pressed="${saved?.decision === 'C'}">C · Corregir</button>
      </div>
      <div class="verify-actions">
        <button id="check-verify" class="button" type="button" ${saved?.checked ? 'disabled' : 'disabled'}>Comprobar</button>
      </div>
      <div id="verify-feedback" class="feedback" role="status" aria-live="polite"></div>
      <div id="verify-final" class="final-label" ${saved?.checked ? '' : 'hidden'}><span>Respuesta</span><strong>${item.decision} · ${item.decision === 'M' ? 'Mantener' : 'Corregir'}</strong><small>Etiqueta final: ${item.final}</small></div>
    </section>`;

  addViewer(document.getElementById('verify-viewer'), item.kind, item.rotation, false);

  const choices = [...content.querySelectorAll('[data-verify-decision]')];
  const check = document.getElementById('check-verify');
  const feedback = document.getElementById('verify-feedback');
  const finalLabel = document.getElementById('verify-final');
  let selected = saved?.decision || null;

  const applyDecisionStyles = (decision, isChecked) => {
    choices.forEach((button) => {
      const buttonDecision = button.dataset.verifyDecision;
      button.setAttribute('aria-pressed', buttonDecision === decision ? 'true' : 'false');
      button.classList.remove('is-correct', 'is-wrong');
      if (isChecked && buttonDecision === item.decision) button.classList.add('is-correct');
      else if (isChecked && buttonDecision === decision) button.classList.add('is-wrong');
      button.disabled = isChecked;
    });
  };

  const setSelected = (decision) => {
    if (verifyState[index]?.checked) return;
    selected = decision;
    applyDecisionStyles(selected, false);
    check.disabled = false;
    feedback.className = 'feedback';
    feedback.textContent = '';
  };

  choices.forEach((button) => button.addEventListener('click', () => setSelected(button.dataset.verifyDecision)));

  check.addEventListener('click', () => {
    if (!selected) return;
    const correct = selected === item.decision;
    verifyState[index] = { decision: selected, checked: true, correct };
    applyDecisionStyles(selected, true);
    check.disabled = true;
    finalLabel.hidden = false;
    feedback.className = `feedback ${correct ? 'is-success' : 'is-warning'}`;
    feedback.textContent = correct
      ? 'Su decisión coincide.'
      : 'Su decisión no coincide. Comparen la etiqueta con la respuesta correcta.';
    nextButton.disabled = false;
  });

  if (saved?.checked) {
    applyDecisionStyles(saved.decision, true);
    check.disabled = true;
    finalLabel.hidden = false;
    feedback.className = `feedback ${saved.correct ? 'is-success' : 'is-warning'}`;
    feedback.textContent = saved.correct
      ? 'Su decisión coincide.'
      : 'Su decisión no coincide. Comparen la etiqueta con la respuesta correcta.';
  } else if (selected) {
    applyDecisionStyles(selected, false);
    check.disabled = false;
  }
}

function renderFinish() {
  content.innerHTML = `
    <section class="finish-card">
      <h2>Revisión final</h2>
      <p>Entréguenla al docente y esperen la indicación para iniciar la Fase 5.</p>
    </section>`;
}

function setHeader(screen) {
  const instructionByScreen = {
    concept: 'Observen y comparen. No escriban en la guía.',
    names: 'Completen «Nombre» en la guía. No cambien lo escrito en la Fase 2.',
    families: 'Completen «Familia» en la guía.',
    quick: 'Respondan las tres preguntas y pulsen «Comprobar». No escriban en la guía.',
    'audit-intro': 'Tengan abierta «F4. AUDITORÍA — REVISIÓN DE ETIQUETAS» en la guía.',
    audit: 'Completen este caso en la guía antes de comprobar.',
    verify: 'Elijan M o C aquí. No escriban en la guía.',
    finish: 'Revisen los tres casos de la Fase 4 en la guía.'
  };
  setPhaseInstructionF34(instructionByScreen[screen.id] || 'Sigan las indicaciones de esta pantalla.');
  const phaseScreens = screens.filter((item) => item.phase === screen.phase);
  const phasePosition = phaseScreens.indexOf(screen) + 1;
  document.getElementById('progress-label').textContent = `Fase ${screen.phase}`;
  document.getElementById('progress-state').textContent = `${phasePosition} de ${phaseScreens.length}`;
  document.getElementById('progress-bar').style.width =
    `${(phasePosition / phaseScreens.length) * 100}%`;
}

function canContinue(screen) {
  if (screen.id === 'quick') return quickComplete;
  if (screen.id === 'audit') return Boolean(auditState[screen.caseIndex]?.checked);
  if (screen.id === 'verify') return Boolean(verifyState[screen.verifyIndex]?.checked);
  return true;
}

function render() {
  disposeViewers();
  const screen = screens[currentIndex];
  setHeader(screen);
  if (screen.id === 'concept') renderConcept();
  else if (screen.id === 'names') renderNames();
  else if (screen.id === 'families') renderFamilies();
  else if (screen.id === 'quick') renderQuick();
  else if (screen.id === 'audit-intro') renderAuditIntro();
  else if (screen.id === 'audit') renderAudit(screen.caseIndex);
  else if (screen.id === 'verify') renderVerify(screen.verifyIndex);
  else renderFinish();
  prevButton.disabled = currentIndex === 0;
  const isLast = currentIndex === screens.length - 1;
  nextButton.hidden = isLast;
  nextButton.disabled = isLast || !canContinue(screen);
  nextButton.textContent = 'Siguiente →';
  window.scrollTo({ top: 0, behavior: 'auto' });
  updateDiagnostics();
}

prevButton.addEventListener('click', () => { if (currentIndex > 0) { currentIndex -= 1; render(); } });
nextButton.addEventListener('click', () => { if (currentIndex < screens.length - 1 && canContinue(screens[currentIndex])) { currentIndex += 1; render(); } });

function updateDiagnostics() {
  if (!diagnosticMode) return;
  document.getElementById('diag-source').textContent = THREE?.REVISION ? `local r${THREE.REVISION}` : '—';
  document.getElementById('diag-webgl').textContent = window.WebGLRenderingContext ? 'Disponible' : 'No disponible';
  document.getElementById('diag-screen').textContent = screens[currentIndex].label;
  document.getElementById('diag-viewers').textContent = String(activeViewers.length);
}

async function boot() {
  if (location.protocol === 'file:') return;
  try {
    THREE = await import(LOCAL_THREE);
    render();
  } catch (error) {
    console.error(error);
    content.innerHTML = '<section class="message-card"><h2>No fue posible cargar el recurso</h2><p>Avísenle al docente.</p></section>';
    nextButton.disabled = true;
  }
}
boot();
