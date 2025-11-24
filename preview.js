const urlParams = new URLSearchParams(window.location.search);
const fileUrl = urlParams.get('url');
const fileType = urlParams.get('type') || 'unknown';

document.getElementById('fileName').textContent = fileUrl ? fileUrl.split('/').pop().split('?')[0] : 'Unknown';
document.getElementById('fileType').textContent = fileType.replace('.', '');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1E1E24);

// Grid
const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
scene.add(gridHelper);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
camera.position.y = 2;

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
backLight.position.set(-5, 5, -5);
scene.add(backLight);

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Load Model
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorText = document.getElementById('errorText');

function loadModel() {
    if (!fileUrl) {
        showError('No file URL provided');
        return;
    }

    let loader;
    const ext = fileType.toLowerCase();

    if (ext.includes('gltf') || ext.includes('glb')) {
        loader = new THREE.GLTFLoader();
        loader.load(fileUrl, (gltf) => {
            const model = gltf.scene;
            centerAndScale(model);
            scene.add(model);
            loadingDiv.style.display = 'none';
        }, undefined, onError);
    } else if (ext.includes('stl')) {
        loader = new THREE.STLLoader();
        loader.load(fileUrl, (geometry) => {
            const material = new THREE.MeshStandardMaterial({ color: 0x8B5CF6, roughness: 0.5, metalness: 0.1 });
            const mesh = new THREE.Mesh(geometry, material);
            centerAndScale(mesh);
            scene.add(mesh);
            loadingDiv.style.display = 'none';
        }, undefined, onError);
    } else if (ext.includes('obj')) {
        loader = new THREE.OBJLoader();
        loader.load(fileUrl, (object) => {
            centerAndScale(object);
            scene.add(object);
            loadingDiv.style.display = 'none';
        }, undefined, onError);
    } else {
        showError('Unsupported file type: ' + fileType);
    }
}

function centerAndScale(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Center
    object.position.x += (object.position.x - center.x);
    object.position.y += (object.position.y - center.y);
    object.position.z += (object.position.z - center.z);

    // Scale to fit in view (approx size 3-4 units)
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    object.scale.setScalar(scale);

    // Lift up to sit on grid
    object.position.y += (size.y * scale) / 2;
}

function onError(err) {
    console.error(err);
    showError('Failed to load model');
}

function showError(msg) {
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
    errorText.textContent = msg;
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

loadModel();
animate();
