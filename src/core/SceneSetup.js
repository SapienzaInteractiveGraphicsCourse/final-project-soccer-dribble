import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

let directionalLight;
let ambientLight;
let rainSystem = null;
let snowSystem = null;

export function setupScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(50, 80, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048; // Aumentata risoluzione per ombre più definite
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -60;
    directionalLight.shadow.camera.right = 60;
    directionalLight.shadow.camera.top = 60;
    directionalLight.shadow.camera.bottom = -60;
    directionalLight.shadow.bias = -0.0005; // Evita artefatti visivi delle ombre
    scene.add(directionalLight);

    // Caricamento del cielo predefinito (Giorno, Sereno)
    updateSceneEnvironment(scene, 'day', 'clear');

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

export function updateSceneEnvironment(scene, timeOfDay, weather) {
    const rgbeLoader = new RGBELoader();
    const exrLoader = new EXRLoader();
    
    // --- 1. GESTIONE ORARIO (LUCI E SKYBOX) ---
    if (timeOfDay === 'night') {
        // Colore di fallback scuro immediato
        scene.background = new THREE.Color(0x020205);
        
        // Carichiamo il file .exr che hai scaricato
        exrLoader.load('/textures/skybox/night_sky.exr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        }, undefined, (err) => {
            console.error("Errore nel caricamento dell'EXR notturno:", err);
        });
        
        // Setup luci notturne
        directionalLight.intensity = 0.2; // Il "sole" quasi scompare
        directionalLight.color.setHex(0x444477);
        ambientLight.intensity = 0.1;
        ambientLight.color.setHex(0x222233);
        
        createStadiumLights(scene);
    } else {
        // Giorno: Colore di fallback azzurro
        scene.background = new THREE.Color(0x87CEEB);
        
        // Carichiamo il file .hdr per il giorno
        rgbeLoader.load('/textures/skybox/sky.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        }, undefined, (err) => {
            console.error("Errore nel caricamento dell'HDR diurno:", err);
        });
        
        // Setup luci diurne (Sole pieno)
        directionalLight.intensity = 1.2;
        directionalLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.5;
        ambientLight.color.setHex(0xffffff);
        
        removeStadiumLights(scene);
    }

    // --- 2. GESTIONE METEO (NEBBIA E PARTICELLE) ---
    // Reset preventivo
    scene.fog = null;
    if (rainSystem) { scene.remove(rainSystem); rainSystem = null; }
    if (snowSystem) { scene.remove(snowSystem); snowSystem = null; }

    // Logica nebbia e parametri luce basati sul meteo
    switch (weather) {
        case 'fog':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x0a0a12 : 0xcccccc, 0.015);
            ambientLight.intensity *= 0.8;
            directionalLight.intensity *= 0.5;
            break;
            
        case 'rain':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x050508 : 0x888899, 0.01);
            ambientLight.intensity *= 0.6;
            directionalLight.intensity *= 0.4;
            createRain(scene);
            break;
            
        case 'snow':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x222233 : 0xeeeeff, 0.012);
            ambientLight.intensity *= 1.1; // La neve schiarisce l'ambiente
            directionalLight.intensity *= 0.7;
            createSnow(scene);
            break;
            
        default: // 'clear'
            // Nessuna nebbia o particelle aggiuntive
            break;
    }
}

let stadiumLights = [];
function createStadiumLights(scene) {
    if (stadiumLights.length > 0) return;
    const positions = [
        new THREE.Vector3(-55, 40, -35),
        new THREE.Vector3(55, 40, -35),
        new THREE.Vector3(-55, 40, 35),
        new THREE.Vector3(55, 40, 35)
    ];

    positions.forEach(pos => {
        const spotLight = new THREE.SpotLight(0xffffff, 2.0);
        spotLight.position.copy(pos);
        spotLight.target.position.set(0, 0, 0);
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.5;
        spotLight.decay = 1.5;
        spotLight.distance = 150;
        spotLight.castShadow = true;
        scene.add(spotLight);
        scene.add(spotLight.target);
        stadiumLights.push({ light: spotLight, target: spotLight.target });
    });
}

function removeStadiumLights(scene) {
    stadiumLights.forEach(sl => {
        scene.remove(sl.light);
        scene.remove(sl.target);
    });
    stadiumLights = [];
}

function createRain(scene) {
    const rainCount = 15000;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    const rainVel = [];

    for (let i = 0; i < rainCount; i++) {
        rainPos[i * 3] = (Math.random() - 0.5) * 150;
        rainPos[i * 3 + 1] = Math.random() * 60;
        rainPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
        rainVel.push(new THREE.Vector3(0, -10 - Math.random() * 10, 0)); // Velocità caduta
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    
    const rainMat = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.1,
        transparent: true,
        opacity: 0.6
    });

    rainSystem = new THREE.Points(rainGeo, rainMat);
    rainSystem.userData.velocities = rainVel;
    scene.add(rainSystem);
}

function createSnow(scene) {
    const snowCount = 10000;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    const snowVel = [];

    for (let i = 0; i < snowCount; i++) {
        snowPos[i * 3] = (Math.random() - 0.5) * 150;
        snowPos[i * 3 + 1] = Math.random() * 60;
        snowPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
        snowVel.push(new THREE.Vector3((Math.random() - 0.5) * 2, -2 - Math.random() * 3, (Math.random() - 0.5) * 2));
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    
    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3,
        transparent: true,
        opacity: 0.8
    });

    snowSystem = new THREE.Points(snowGeo, snowMat);
    snowSystem.userData.velocities = snowVel;
    scene.add(snowSystem);
}

export function updateWeatherParticles(deltaTime, playerPosition) {
    if (rainSystem) {
        const positions = rainSystem.geometry.attributes.position.array;
        const velocities = rainSystem.userData.velocities;
        for (let i = 0; i < velocities.length; i++) {
            positions[i * 3 + 1] += velocities[i].y * deltaTime;
            // Se la goccia tocca terra, riposizionala sopra il giocatore per continuità
            if (positions[i * 3 + 1] < 0) {
                positions[i * 3 + 1] = 60 + Math.random() * 10;
                positions[i * 3] = playerPosition.x + (Math.random() - 0.5) * 150;
                positions[i * 3 + 2] = playerPosition.z + (Math.random() - 0.5) * 100;
            }
        }
        rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    if (snowSystem) {
        const positions = snowSystem.geometry.attributes.position.array;
        const velocities = snowSystem.userData.velocities;
        for (let i = 0; i < velocities.length; i++) {
            positions[i * 3] += velocities[i].x * deltaTime;
            positions[i * 3 + 1] += velocities[i].y * deltaTime;
            positions[i * 3 + 2] += velocities[i].z * deltaTime;
            
            // Oscillazione laterale casuale per la neve
            velocities[i].x += (Math.random() - 0.5) * 0.1;
            velocities[i].z += (Math.random() - 0.5) * 0.1;
            
            if (positions[i * 3 + 1] < 0) {
                positions[i * 3 + 1] = 60 + Math.random() * 10;
                positions[i * 3] = playerPosition.x + (Math.random() - 0.5) * 150;
                positions[i * 3 + 2] = playerPosition.z + (Math.random() - 0.5) * 100;
            }
        }
        snowSystem.geometry.attributes.position.needsUpdate = true;
    }
}