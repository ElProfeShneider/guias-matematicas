const LOCAL_THREE = '../../lib/three.module.min.js';

async function loadThree() {
  const module = await import(LOCAL_THREE);
  return module;
}

function showFallback(viewer, message) {
  const loading = viewer.querySelector('.loading');
  const fallback = viewer.querySelector('.fallback');
  if (loading) loading.hidden = true;
  if (fallback) fallback.hidden = false;
  viewer.setAttribute('aria-busy', 'false');
  viewer.dataset.failed = 'true';
  console.error(message);
}

function makeMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0x4a96b3,
    roughness: 0.84,
    metalness: 0,
    flatShading: false
  });
}

function addEdges(THREE, group, geometry, threshold = 40) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, threshold),
    new THREE.LineBasicMaterial({ color: 0x154760, transparent: true, opacity: 0.98 })
  );
  group.add(edges);
}

function createStaticViewer(THREE, config) {
  const viewer = document.getElementById(config.id);
  if (!viewer) throw new Error(`No se encontró ${config.id}`);
  if (!window.WebGLRenderingContext) throw new Error('Este navegador no ofrece WebGL.');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef4f7);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(5.4, 3.7, 6.6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  viewer.appendChild(renderer.domElement);

  const group = new THREE.Group();
  const geometry = new THREE.ConeGeometry(1.35, 3.15, 64, 1, false);
  const mesh = new THREE.Mesh(geometry, makeMaterial(THREE));
  group.add(mesh);
  addEdges(THREE, group, geometry, 40);
  group.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
  if (config.scale) group.scale.setScalar(config.scale);
  if (config.position) group.position.set(config.position.x, config.position.y, config.position.z);
  scene.add(group);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c7d1, 1.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(5, 7, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcdfff, 0.42);
  fill.position.set(-5, 1, -4);
  scene.add(fill);

  function render() {
    renderer.render(scene, camera);
  }

  function resize() {
    const width = Math.max(viewer.clientWidth, 1);
    const height = Math.max(viewer.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(viewer);
  else window.addEventListener('resize', resize);

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showFallback(viewer, 'El visor perdió el contexto gráfico.');
  });

  resize();
  const loading = viewer.querySelector('.loading');
  if (loading) loading.hidden = true;
  viewer.setAttribute('aria-busy', 'false');
}

async function init() {
  try {
    const THREE = await loadThree();
    const configs = [
      {
        id: 'view-a-3d',
        rotation: { x: -0.15, y: 0.25, z: -0.20 },
        scale: 1.00,
        position: { x: 0.00, y: 0.00, z: 0.00 }
      },
      {
        id: 'view-b-3d',
        // Misma geometría, escala y cámara que la Vista A.
        // Orientación obtenida mediante una rotación rígida 3D controlada:
        // cambia claramente la vista sin ocultar el vértice ni deformar el cuerpo.
        rotation: { x: -0.17064, y: 0.97808, z: 1.43897 },
        scale: 1.00,
        position: { x: 0.00, y: 0.00, z: 0.00 }
      }
    ];
    configs.forEach((config) => {
      try { createStaticViewer(THREE, config); }
      catch (error) {
        const viewer = document.getElementById(config.id);
        if (viewer) showFallback(viewer, error.message);
      }
    });
  } catch (error) {
    console.error(error);
    document.querySelectorAll('.viewer').forEach((viewer) => showFallback(viewer, 'No se pudo cargar la biblioteca gráfica local.'));
  }
}

init();
