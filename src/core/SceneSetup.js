import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

export function setupScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(renderer.domElement);

    const hdrLoader = new HDRLoader();
    hdrLoader.load('/textures/skybox/sky.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;
    });

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(50, 80, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.left = -60;
    directionalLight.shadow.camera.right = 60;
    directionalLight.shadow.camera.top = 60;
    directionalLight.shadow.camera.bottom = -60;
    scene.add(directionalLight);

    // Setup Erba
    const textureLoader = new THREE.TextureLoader();
    const grassRepeat = new THREE.Vector2(250, 250);
    function loadG(url) {
        const t = textureLoader.load(url);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.copy(grassRepeat);
        return t;
    }
    const pitchGeo = new THREE.PlaneGeometry(1000, 1000);
    const pitchMat = new THREE.MeshStandardMaterial({
        map: loadG('/textures/grass/color.jpg'),
        normalMap: loadG('/textures/grass/normal.jpg'),
        roughnessMap: loadG('/textures/grass/roughness.jpg'),
        aoMap: loadG('/textures/grass/ao.jpg'),
        normalScale: new THREE.Vector2(0.5, 0.5)
    });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    return { scene, camera, renderer };
}