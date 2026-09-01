const startedAt = performance.now();
const LOCAL_THREE = '../../lib/three.module.min.js';
const diagnosticMode = new URLSearchParams(location.search).get('diagnostico') === '1';
const diagnostics = document.getElementById('diagnostics');
const stressButton = document.getElementById('stress-button');
const stressResult = document.getElementById('stress-result');

if (diagnosticMode && diagnostics) diagnostics.hidden = false;

async function loadThree() {
  const module = await import(LOCAL_THREE);
  return { THREE: module, source: 'local incluida' };
}

function showFallback(viewer, message) {
  const loading = viewer.querySelector('.loading');
  const fallback = viewer.querySelector('.fallback');
  if (loading) {
    loading.hidden = true;
    loading.style.display = 'none';
  }
  if (fallback) fallback.hidden = false;
  viewer.setAttribute('aria-busy', 'false');
  viewer.setAttribute('aria-disabled', 'true');
  viewer.dataset.failed = 'true';
  console.error(message);
}

function makeMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0x4f9ac6,
    roughness: 0.72,
    metalness: 0,
    flatShading: false
  });
}

function addEdges(THREE, group, geometry, threshold = 15) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, threshold),
    new THREE.LineBasicMaterial({ color: 0x18384d, transparent: true, opacity: 0.86 })
  );
  group.add(edges);
}

function createGeometry(THREE, kind) {
  if (kind === 'prism') return new THREE.BoxGeometry(3.6, 2.25, 1.8);
  if (kind === 'pyramid5') return new THREE.CylinderGeometry(0, 1.38, 3.15, 5, 1, false);
  if (kind === 'cone') return new THREE.ConeGeometry(1.35, 3.15, 48, 1, false);
  throw new Error(`Geometría no reconocida: ${kind}`);
}

function createViewer(THREE, config) {
  const viewer = document.getElementById(config.id);
  if (!viewer) throw new Error(`No se encontró ${config.id}`);
  if (!window.WebGLRenderingContext) throw new Error('Este navegador no ofrece WebGL.');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef4f7);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(5.4, 3.7, 6.6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  viewer.appendChild(renderer.domElement);

  const group = new THREE.Group();
  const geometry = createGeometry(THREE, config.kind);
  const mesh = new THREE.Mesh(geometry, makeMaterial(THREE));
  group.add(mesh);
  addEdges(THREE, group, geometry, config.kind === 'cone' ? 42 : 15);
  scene.add(group);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c7d1, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 7, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcdfff, 1.1);
  fill.position.set(-5, 1, -4);
  scene.add(fill);

  const initial = { ...config.initial };
  let rotationX = initial.x;
  let rotationY = initial.y;
  let rotationZ = initial.z;
  let unlocked = false;
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let renderQueued = false;

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderer.render(scene, camera);
      renderQueued = false;
      updateDiagnostics();
    });
  }

  function applyRotation() {
    group.rotation.set(rotationX, rotationY, rotationZ);
    requestRender();
  }

  function resize() {
    const width = Math.max(viewer.clientWidth, 1);
    const height = Math.max(viewer.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function reset() {
    rotationX = initial.x;
    rotationY = initial.y;
    rotationZ = initial.z;
    applyRotation();
  }

  function unlock() {
    unlocked = true;
    viewer.classList.add('is-unlocked');
    viewer.setAttribute('aria-disabled', 'false');
    const layer = viewer.querySelector('.locked-layer');
    if (layer) layer.hidden = true;
  }

  function pointerDown(event) {
    if (!unlocked) return;
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    viewer.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (!unlocked || !dragging) return;
    const dx = event.clientX - previousX;
    const dy = event.clientY - previousY;
    previousX = event.clientX;
    previousY = event.clientY;
    rotationY += dx * 0.011;
    rotationX += dy * 0.011;
    rotationX = Math.max(-1.35, Math.min(1.35, rotationX));
    applyRotation();
  }

  function pointerUp(event) {
    if (!dragging) return;
    dragging = false;
    viewer.releasePointerCapture?.(event.pointerId);
  }

  function keyDown(event) {
    if (!unlocked) return;
    const step = event.shiftKey ? 0.18 : 0.10;
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      reset();
      return;
    }
    let handled = true;
    if (event.key === 'ArrowLeft') rotationY -= step;
    else if (event.key === 'ArrowRight') rotationY += step;
    else if (event.key === 'ArrowUp') rotationX = Math.max(-1.35, rotationX - step);
    else if (event.key === 'ArrowDown') rotationX = Math.min(1.35, rotationX + step);
    else handled = false;
    if (handled) {
      event.preventDefault();
      applyRotation();
    }
  }

  function updateDiagnostics() {
    if (!diagnosticMode) return;
    const callsNode = document.getElementById('diag-calls');
    const trianglesNode = document.getElementById('diag-triangles');
    const calls = Number(callsNode.dataset.total || 0) + renderer.info.render.calls;
    const triangles = Number(trianglesNode.dataset.total || 0) + renderer.info.render.triangles;
    callsNode.dataset.total = String(calls);
    trianglesNode.dataset.total = String(triangles);
    callsNode.textContent = `${calls} acumuladas`;
    trianglesNode.textContent = `${triangles} acumulados`;
  }

  viewer.addEventListener('pointerdown', pointerDown);
  viewer.addEventListener('pointermove', pointerMove);
  viewer.addEventListener('pointerup', pointerUp);
  viewer.addEventListener('pointercancel', pointerUp);
  viewer.addEventListener('keydown', keyDown);

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(viewer);
  else window.addEventListener('resize', resize);

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showFallback(viewer, 'El visor perdió el contexto gráfico.');
  });

  applyRotation();
  resize();
  const loading = viewer.querySelector('.loading');
  if (loading) {
    loading.hidden = true;
    loading.style.display = 'none';
  }
  viewer.setAttribute('aria-busy', 'false');

  return { id: config.id, viewer, renderer, unlock, reset, applyRotation, get unlocked() { return unlocked; } };
}

function setupCase(caseElement, viewers) {
  const unlockButton = caseElement.querySelector('.unlock-button');
  const resetButton = caseElement.querySelector('.reset-button');
  const status = caseElement.querySelector('.case-status');

  unlockButton.addEventListener('click', () => {
    viewers.forEach((item) => item.unlock());
    caseElement.querySelectorAll('.locked-layer').forEach((layer) => { layer.hidden = true; });
    resetButton.disabled = viewers.length === 0;
    unlockButton.hidden = true;
    const rotationHelp = caseElement.querySelector('.rotation-help');
    if (rotationHelp && viewers.length > 0) rotationHelp.hidden = false;
    status.textContent = viewers.length > 0
      ? 'Giro habilitado. Observen cada modelo desde, por lo menos, dos posiciones.'
      : 'No fue posible habilitar los visores. Avísenle al docente.';
    viewers[0]?.viewer.focus();
  });

  resetButton.addEventListener('click', () => {
    viewers.forEach((item) => item.reset());
    status.textContent = 'Posiciones iniciales restauradas.';
  });
}

function initialize(THREE, source) {
  const configs = [
    { id: 'c1-a', kind: 'prism', initial: { x: -0.18, y: 0.42, z: 0.02 } },
    { id: 'c1-b', kind: 'prism', initial: { x: 0.25, y: -0.52, z: 1.52 } },
    { id: 'c2-a', kind: 'pyramid5', initial: { x: 0.12, y: 0.42, z: -1.02 } },
    { id: 'c2-b', kind: 'cone', initial: { x: -0.08, y: -0.48, z: -1.02 } }
  ];

  const instanceById = new Map();
  configs.forEach((config) => {
    try {
      instanceById.set(config.id, createViewer(THREE, config));
    } catch (error) {
      console.error(error);
      const viewer = document.getElementById(config.id);
      if (viewer) showFallback(viewer, error.message);
    }
  });

  const instances = [...instanceById.values()];
  const case1Instances = ['c1-a', 'c1-b'].map((id) => instanceById.get(id)).filter(Boolean);
  const case2Instances = ['c2-a', 'c2-b'].map((id) => instanceById.get(id)).filter(Boolean);
  setupCase(document.getElementById('caso-1'), case1Instances);
  setupCase(document.getElementById('caso-2'), case2Instances);

  if (diagnosticMode) {
    const renderer = instances[0]?.renderer;
    const callsNode = document.getElementById('diag-calls');
    const trianglesNode = document.getElementById('diag-triangles');
    document.getElementById('diag-source').textContent = source;
    document.getElementById('diag-webgl').textContent = renderer
      ? (renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1')
      : 'No disponible';
    document.getElementById('diag-viewers').textContent = String(instances.length);
    document.getElementById('diag-load').textContent = `${(performance.now() - startedAt).toFixed(0)} ms`;
    callsNode.dataset.total = '0';
    trianglesNode.dataset.total = '0';
    callsNode.textContent = '0 acumuladas';
    trianglesNode.textContent = '0 acumulados';
  }

  stressButton?.addEventListener('click', async () => {
    const t0 = performance.now();
    instances.forEach((item) => item.unlock());
    for (let i = 0; i < 10; i += 1) {
      instances.forEach((item) => item.reset());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    stressResult.textContent = `10 ciclos de reinicio completados en ${(performance.now() - t0).toFixed(0)} ms, sin error visible.`;
  });
}

if (location.protocol !== 'file:') {
  loadThree()
    .then(({ THREE, source }) => initialize(THREE, source))
    .catch((error) => {
      console.error(error);
      document.querySelectorAll('.viewer').forEach((viewer) => showFallback(viewer, error.message));
    });
}
