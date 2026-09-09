const startedAt = performance.now();
const LOCAL_THREE = '../../lib/three.module.min.js';
const diagnosticMode = new URLSearchParams(location.search).get('diagnostico') === '1';
const diagnostics = document.getElementById('diagnostics');
if (diagnosticMode && diagnostics) diagnostics.hidden = false;

const models = [
  {
    code: 'M1', kind: 'prism', initial: { x: 0.04, y: -0.10, z: 0.02 }, correct: 1,
    options: [
      { kind: 'cube', rotation: { x: 0.05, y: -0.20, z: 0.08 } },
      { kind: 'prism', rotation: { x: -0.39, y: -0.14, z: 1.08 } },
      { kind: 'cylinder', rotation: { x: 0.18, y: 0.55, z: 1.18 } }
    ]
  },
  {
    code: 'M2', kind: 'cone', initial: { x: -0.12, y: 0.52, z: -0.92 }, correct: 2,
    options: [
      { kind: 'pyramid5', rotation: { x: 0.20, y: -0.45, z: -0.98 } },
      { kind: 'cylinder', rotation: { x: -0.12, y: 0.24, z: 0.06 } },
      { kind: 'cone', rotation: { x: 0.38, y: -0.64, z: 0.44 } }
    ]
  },
  {
    code: 'M3', kind: 'cube', initial: { x: 0.06, y: -0.14, z: 0.03 }, correct: 0,
    options: [
      { kind: 'cube', rotation: { x: -0.42, y: 0.09, z: 1.04 } },
      { kind: 'prism', rotation: { x: 0.10, y: -0.20, z: 0.25 } },
      { kind: 'sphere', rotation: { x: 0, y: 0, z: 0 } }
    ]
  },
  {
    code: 'M4', kind: 'cylinder', initial: { x: -0.18, y: 0.48, z: 0.08 }, correct: 2,
    options: [
      { kind: 'cone', rotation: { x: 0.16, y: -0.52, z: 1.04 } },
      { kind: 'prism', rotation: { x: 0.12, y: -0.22, z: 0.28 } },
      { kind: 'cylinder', rotation: { x: 0.05, y: -0.48, z: 1.54 } }
    ]
  },
  {
    code: 'M5', kind: 'pyramid5', initial: { x: 0.12, y: 0.48, z: -0.96 }, correct: 1,
    options: [
      { kind: 'cone', rotation: { x: -0.10, y: 0.52, z: -1.02 } },
      { kind: 'pyramid5', rotation: { x: 0.341, y: -3.024, z: 1.829 } },
      { kind: 'cube', rotation: { x: 0.12, y: -0.25, z: 0.10 } }
    ]
  },
  {
    code: 'M6', kind: 'sphere', initial: { x: 0, y: 0, z: 0 }, correct: 0,
    options: [
      { kind: 'sphere', rotation: { x: 0, y: 0, z: 0 } },
      { kind: 'cylinder', rotation: { x: 0.10, y: -0.54, z: 1.34 } },
      { kind: 'cone', rotation: { x: -0.22, y: 0.62, z: 0.78 } }
    ]
  }
];

const state = models.map(() => ({ attempts: 0, completed: false, selected: [] }));
let currentIndex = 0;
let THREE;
let mainInstance = null;
let optionInstances = [];
let analyzeInstances = [];

const galleryView = document.getElementById('gallery-view');
const analyzeView = document.getElementById('analyze-view');
const oralView = document.getElementById('oral-view');
const optionsGrid = document.getElementById('options-grid');
const feedback = document.getElementById('feedback');
const previousButton = document.getElementById('previous-button');
const nextButton = document.getElementById('next-button');
const resetModelButton = document.getElementById('reset-model');
const resetStatus = document.getElementById('reset-status');
let resetStatusTimer = 0;
const phaseInstructionF2 = document.getElementById('phase-instruction-f2');

function setPhaseInstructionF2(text) {
  if (phaseInstructionF2 && phaseInstructionF2.textContent !== text) phaseInstructionF2.textContent = text;
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
  if (kind === 'cone' || kind === 'cylinder' || kind === 'sphere') return 42;
  return 15;
}

function createMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x55b7d7, roughness: 0.72, metalness: 0 });
}

function createScene(container, kind, rotation, interactive = false) {
  if (!window.WebGLRenderingContext) throw new Error('Este navegador no ofrece WebGL.');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef4f7);
  const camera = new THREE.PerspectiveCamera(interactive ? 36 : 34, 1, 0.1, 100);
  camera.position.set(5.4, 3.7, 6.6);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  const geometry = geometryFor(kind);
  group.add(new THREE.Mesh(geometry, createMaterial()));
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, edgeThreshold(kind)),
    new THREE.LineBasicMaterial({ color: 0x18384d, transparent: true, opacity: 0.86 })
  );
  group.add(edges);
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c7d1, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 7, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcdfff, 1.1); fill.position.set(-5, 1, -4); scene.add(fill);

  const initial = { ...rotation };
  let rx = initial.x, ry = initial.y, rz = initial.z;
  let dragging = false, px = 0, py = 0, queued = false;
  let resetAnimation = 0;

  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { renderer.render(scene, camera); queued = false; });
  }
  function apply() { group.rotation.set(rx, ry, rz); render(); }
  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  function reset() {
    // Restablecimiento directo y verificable de la orientación del modelo.
    // No borra intentos, respuestas ni retroalimentaciones.
    if (resetAnimation) cancelAnimationFrame(resetAnimation);
    resetAnimation = 0;
    dragging = false;

    rx = initial.x;
    ry = initial.y;
    rz = initial.z;
    group.rotation.set(rx, ry, rz);

    // Render inmediato para evitar que una actualización pendiente oculte el cambio.
    queued = false;
    renderer.render(scene, camera);

    // Señal visual breve; en la esfera la rotación no es perceptible por su simetría.
    container.classList.remove('is-restored');
    void container.offsetWidth;
    container.classList.add('is-restored');
    window.setTimeout(() => container.classList.remove('is-restored'), 650);

    return Promise.resolve();
  }
  function pointerDown(e) { if (!interactive) return; dragging = true; px = e.clientX; py = e.clientY; container.setPointerCapture?.(e.pointerId); }
  function pointerMove(e) {
    if (!interactive || !dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    ry += dx * 0.011; rx = Math.max(-1.35, Math.min(1.35, rx + dy * 0.011)); apply();
  }
  function pointerUp(e) { if (!dragging) return; dragging = false; container.releasePointerCapture?.(e.pointerId); }
  function keyDown(e) {
    if (!interactive) return;
    const step = e.shiftKey ? 0.18 : 0.10;
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); reset(); return; }
    let handled = true;
    if (e.key === 'ArrowLeft') ry -= step;
    else if (e.key === 'ArrowRight') ry += step;
    else if (e.key === 'ArrowUp') rx = Math.max(-1.35, rx - step);
    else if (e.key === 'ArrowDown') rx = Math.min(1.35, rx + step);
    else handled = false;
    if (handled) { e.preventDefault(); apply(); }
  }
  if (interactive) {
    container.addEventListener('pointerdown', pointerDown);
    container.addEventListener('pointermove', pointerMove);
    container.addEventListener('pointerup', pointerUp);
    container.addEventListener('pointercancel', pointerUp);
    container.addEventListener('keydown', keyDown);
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(container); else window.addEventListener('resize', resize);
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showFallback(container, kind); });
  apply(); resize();

  return {
    renderer, reset,
    dispose() {
      if (resetAnimation) cancelAnimationFrame(resetAnimation);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      if (interactive) {
        container.removeEventListener('pointerdown', pointerDown);
        container.removeEventListener('pointermove', pointerMove);
        container.removeEventListener('pointerup', pointerUp);
        container.removeEventListener('pointercancel', pointerUp);
        container.removeEventListener('keydown', keyDown);
      }
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

function fallbackSVG(kind) {
  const edge = 'fill:none;stroke:#18384d;stroke-width:3;stroke-linejoin:round';
  const fill = '#74dbe3';
  if (kind === 'sphere') return `<svg viewBox="0 0 300 220" role="img" aria-label="Representación estática de un cuerpo geométrico"><circle cx="150" cy="110" r="72" fill="${fill}" stroke="#18384d" stroke-width="3"/><ellipse cx="130" cy="82" rx="26" ry="13" fill="#c8fbfb" opacity=".55"/></svg>`;
  if (kind === 'cylinder') return `<svg viewBox="0 0 300 220" role="img" aria-label="Representación estática de un cuerpo geométrico"><path d="M72 64 L226 64 L226 158 L72 158 Z" fill="${fill}"/><ellipse cx="72" cy="111" rx="25" ry="47" fill="#8ce9ee" stroke="#18384d" stroke-width="3"/><path d="M72 64 L226 64 M72 158 L226 158" style="${edge}"/><path d="M226 64 C255 70 255 152 226 158" style="${edge}"/></svg>`;
  if (kind === 'cone') return `<svg viewBox="0 0 300 220" role="img" aria-label="Representación estática de un cuerpo geométrico"><path d="M62 65 L247 111 L62 157 Z" fill="${fill}"/><ellipse cx="62" cy="111" rx="25" ry="46" fill="#8ce9ee" stroke="#18384d" stroke-width="3"/><path d="M62 65 L247 111 L62 157" style="${edge}"/></svg>`;
  if (kind === 'pyramid5') return `<svg viewBox="0 0 300 220" role="img" aria-label="Representación estática de un cuerpo geométrico"><polygon points="55,110 88,62 145,68 174,118 104,163" fill="${fill}" stroke="#18384d" stroke-width="3"/><g style="${edge}"><line x1="252" y1="108" x2="55" y2="110"/><line x1="252" y1="108" x2="88" y2="62"/><line x1="252" y1="108" x2="145" y2="68"/><line x1="252" y1="108" x2="174" y2="118"/><line x1="252" y1="108" x2="104" y2="163"/></g></svg>`;
  const cube = kind === 'cube';
  const x2 = cube ? 215 : 240;
  return `<svg viewBox="0 0 300 220" role="img" aria-label="Representación estática de un cuerpo geométrico"><polygon points="55,70 ${x2-55},45 ${x2},80 105,105" fill="#9af1f1"/><polygon points="55,70 105,105 105,177 55,142" fill="#68d6e1"/><polygon points="105,105 ${x2},80 ${x2},152 105,177" fill="${fill}"/><polyline points="55,70 ${x2-55},45 ${x2},80 ${x2},152 105,177 55,142 55,70 105,105 ${x2},80" style="${edge}"/><line x1="105" y1="105" x2="105" y2="177" style="${edge}"/></svg>`;
}

function showFallback(container, kind) {
  container.querySelectorAll('canvas').forEach((node) => node.remove());
  const fallback = container.id === 'main-viewer' ? document.getElementById('main-fallback') : container;
  if (fallback) { fallback.innerHTML = `${fallbackSVG(kind)}<p>Si el modelo no gira, avísenle al docente y sigan la alternativa de contingencia que les indique.</p>`; fallback.hidden = false; }
  container.setAttribute?.('aria-busy', 'false');
}

function disposeCurrent() {
  mainInstance?.dispose(); mainInstance = null;
  optionInstances.forEach((item) => item?.dispose()); optionInstances = [];
  optionsGrid.innerHTML = '';
}

function createOptionCard(option, index, selectedState) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'option-card';
  button.dataset.index = String(index);
  button.setAttribute('aria-label', `Seleccionar opción ${String.fromCharCode(65 + index)}`);
  const image = document.createElement('span'); image.className = 'option-image';
  const label = document.createElement('span'); label.className = 'option-label'; label.textContent = `Opción ${String.fromCharCode(65 + index)}`;
  button.append(image, label);
  if (selectedState.selected.includes(index)) button.classList.add(index === models[currentIndex].correct ? 'is-correct' : 'is-wrong');
  if (selectedState.completed || selectedState.selected.includes(index)) button.disabled = true;
  button.addEventListener('click', () => selectOption(index));
  optionsGrid.appendChild(button);
  try { optionInstances[index] = createScene(image, option.kind, option.rotation, false); }
  catch (error) { console.error(error); image.innerHTML = fallbackSVG(option.kind); }
}

function renderModel() {
  disposeCurrent();
  const model = models[currentIndex];
  const modelState = state[currentIndex];
  setPhaseInstructionF2('Giren el modelo y elijan cuál opción muestra el mismo cuerpo. Después, escriban en la tabla de la guía qué observaron.');
  document.getElementById('progress-label').textContent = `Parte A · ${model.code}`;
  document.getElementById('attempt-label').textContent = modelState.completed
    ? 'Completado'
    : `Intento ${Math.min(modelState.attempts + 1, 2)} de 2`;
  document.getElementById('progress-bar').style.width = `${((currentIndex + 1) / 8) * 100}%`;
  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = !modelState.completed;
  nextButton.textContent = currentIndex === 5 ? 'Ir a Parte B →' : 'Siguiente →';
  feedback.className = 'feedback'; feedback.textContent = '';
  clearTimeout(resetStatusTimer);
  if (resetStatus) resetStatus.textContent = '';

  const viewer = document.getElementById('main-viewer');
  viewer.setAttribute('aria-label', `Visor tridimensional del modelo ${model.code}`);
  viewer.querySelectorAll('canvas').forEach((node) => node.remove());
  document.getElementById('main-fallback').hidden = true;
  const loading = viewer.querySelector('.loading'); loading.hidden = false;
  try {
    mainInstance = createScene(viewer, model.kind, model.initial, true);
    loading.hidden = true;
    viewer.setAttribute('aria-busy', 'false');
  } catch (error) {
    console.error(error); loading.hidden = true; showFallback(viewer, model.kind);
  }

  model.options.forEach((option, index) => createOptionCard(option, index, modelState));
  if (modelState.completed) {
    const correctButton = optionsGrid.querySelector(`[data-index="${model.correct}"]`);
    correctButton?.classList.add('is-correct');
    const solvedCorrectly = modelState.selected.includes(model.correct);
    feedback.classList.add(solvedCorrectly ? 'is-success' : 'is-warning');
    feedback.textContent = solvedCorrectly
      ? `Correcto. Completen ${model.code} en la tabla de la guía.`
      : `La opción correcta quedó marcada. Compárenla con el modelo y completen ${model.code} en la tabla de la guía.`;
  }
  updateDiagnostics();
}

function selectOption(index) {
  const model = models[currentIndex];
  const modelState = state[currentIndex];
  if (modelState.completed || modelState.selected.includes(index)) return;
  modelState.attempts += 1;
  modelState.selected.push(index);
  const button = optionsGrid.querySelector(`[data-index="${index}"]`);
  button.disabled = true;

  if (index === model.correct) {
    modelState.completed = true;
    button.classList.add('is-correct');
    optionsGrid.querySelectorAll('.option-card').forEach((node) => { node.disabled = true; });
    feedback.className = 'feedback is-success';
    feedback.textContent = `Correcto. Completen ${model.code} en la tabla de la guía.`;
  } else {
    button.classList.add('is-wrong');
    if (modelState.attempts >= 2) {
      modelState.completed = true;
      const correctButton = optionsGrid.querySelector(`[data-index="${model.correct}"]`);
      correctButton.classList.add('is-correct');
      optionsGrid.querySelectorAll('.option-card').forEach((node) => { node.disabled = true; });
      feedback.className = 'feedback is-warning';
      feedback.textContent = `La opción correcta quedó marcada. Compárenla con el modelo y completen ${model.code} en la tabla de la guía.`;
    } else {
      feedback.className = 'feedback is-warning';
      feedback.textContent = 'Esa opción no muestra el mismo cuerpo. Giren el modelo y prueben otra opción.';
    }
  }
  document.getElementById('attempt-label').textContent = modelState.completed ? 'Completado' : `Intento ${modelState.attempts + 1} de 2`;
  nextButton.disabled = !modelState.completed;
  updateDiagnostics();
}

function createAnalyzeView(containerId, rotation) {
  const container = document.getElementById(containerId);
  try {
    analyzeInstances.push(createScene(container, 'cylinder', rotation, false));
  } catch (error) {
    console.error(error);
    container.innerHTML = fallbackSVG('cylinder');
  }
}

function showAnalyze() {
  disposeCurrent();
  galleryView.hidden = true;
  analyzeView.hidden = false;
  setPhaseInstructionF2('Comparen las dos vistas. En la guía, marquen a Laura, Diego o Sara y escriban por qué. Después, pulsen «Comprobar».');
  document.getElementById('progress-label').textContent = 'Parte B · M4';
  document.getElementById('attempt-label').textContent = '';
  document.getElementById('progress-bar').style.width = '87.5%';
  createAnalyzeView('analyze-a', { x: -0.18, y: 0.48, z: 0.08 });
  createAnalyzeView('analyze-b', { x: 0.05, y: -0.48, z: 1.54 });
  analyzeView.scrollIntoView({ block: 'start' });
}

function goToModel(index) {
  currentIndex = index;
  renderModel();
  requestAnimationFrame(() => {
    document.querySelector('.progress-panel')?.scrollIntoView({ block: 'start' });
  });
}

previousButton.addEventListener('click', () => { if (currentIndex > 0) goToModel(currentIndex - 1); });
nextButton.addEventListener('click', () => {
  if (!state[currentIndex].completed) return;
  if (currentIndex < 5) goToModel(currentIndex + 1);
  else showAnalyze();
});
resetModelButton.addEventListener('click', async () => {
  const instance = mainInstance;
  if (!instance) return;
  resetModelButton.disabled = true;
  clearTimeout(resetStatusTimer);
  if (resetStatus) resetStatus.textContent = '';
  try {
    await instance.reset();
    if (instance !== mainInstance) return;
    if (resetStatus) resetStatus.textContent = '✓ Posición restablecida';
    resetStatusTimer = window.setTimeout(() => {
      if (resetStatus) resetStatus.textContent = '';
    }, 2200);
  } finally {
    if (instance === mainInstance) resetModelButton.disabled = false;
  }
});

document.getElementById('analyze-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = new FormData(event.currentTarget).get('statement');
  const analyzeFeedback = document.getElementById('analyze-feedback');
  if (!value) { analyzeFeedback.className = 'feedback is-warning'; analyzeFeedback.textContent = 'Elijan a Laura, Diego o Sara antes de comprobar.'; return; }
  if (value === 'sara') {
    analyzeFeedback.className = 'feedback is-success';
    analyzeFeedback.textContent = 'Correcto: Sara explica mejor lo que ocurre.';
    document.getElementById('to-oral').disabled = false;
    event.currentTarget.querySelectorAll('input, button').forEach((node) => { node.disabled = true; });
  } else {
    analyzeFeedback.className = 'feedback is-warning';
    analyzeFeedback.textContent = 'Vuelvan a comparar las dos vistas. No cambien lo escrito en la guía.';
  }
});

document.getElementById('to-oral').addEventListener('click', () => {
  analyzeInstances.forEach((item) => item?.dispose()); analyzeInstances = [];
  analyzeView.hidden = true; oralView.hidden = false;
  setPhaseInstructionF2('Respondan oralmente cuando el docente lo indique. No escriban en la guía.');
  document.getElementById('progress-label').textContent = 'Comparación oral · M2 y M5';
  document.getElementById('attempt-label').textContent = '';
  document.getElementById('progress-bar').style.width = '100%';
  oralView.scrollIntoView({ block: 'start' });
});

function updateDiagnostics() {
  if (!diagnosticMode) return;
  document.getElementById('diag-model').textContent = models[currentIndex]?.code || 'Parte B';
  document.getElementById('diag-attempts').textContent = state.map((item) => item.attempts).join(', ');
}

async function initialize() {
  const module = await import(LOCAL_THREE); THREE = module;
  if (diagnosticMode) {
    document.getElementById('diag-source').textContent = 'Three.js local incluida';
    document.getElementById('diag-load').textContent = `${(performance.now() - startedAt).toFixed(0)} ms`;
    document.getElementById('diag-webgl').textContent = window.WebGL2RenderingContext ? 'WebGL disponible' : 'WebGL 1 o no determinado';
  }
  renderModel();
}

document.getElementById('stress-button')?.addEventListener('click', async () => {
  const t0 = performance.now();
  for (let i = 0; i < 10; i += 1) { if (mainInstance) await mainInstance.reset(); }
  document.getElementById('stress-result').textContent = `10 ciclos completados en ${(performance.now() - t0).toFixed(0)} ms, sin error visible.`;
});

if (location.protocol !== 'file:') initialize().catch((error) => {
  console.error(error);
  const viewer = document.getElementById('main-viewer');
  viewer.querySelector('.loading').hidden = true;
  showFallback(viewer, models[0].kind);
});
