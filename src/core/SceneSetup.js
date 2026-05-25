import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { Scoreboard } from '../environment/Scoreboard.js';

let directionalLight;
let ambientLight;
let rainSystem = null;
let snowSystem = null;
let snowOverlay = null;

// Funzione per creare dinamicamente una texture a chiazze di neve
function createSnowPatchTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 512, 512);

    for (let i = 0; i < 150; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 30 + 10;
        const grad = context.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = grad;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40); // Ripetizioni sul campo
    return texture;
}

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
        map: loadG(`${import.meta.env.BASE_URL}textures/grass/color.jpg`),
        normalMap: loadG(`${import.meta.env.BASE_URL}textures/grass/normal.jpg`),
        roughnessMap: loadG(`${import.meta.env.BASE_URL}textures/grass/roughness.jpg`),
        aoMap: loadG(`${import.meta.env.BASE_URL}textures/grass/ao.jpg`),
        normalScale: new THREE.Vector2(0.5, 0.5)
    });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Livello "Neve" a chiazze invisibile di default, posizionato appena sopra l'erba
    const snowMat = new THREE.MeshStandardMaterial({ map: createSnowPatchTexture(), transparent: true, opacity: 0.0, roughness: 0.9, depthWrite: false });
    snowOverlay = new THREE.Mesh(pitchGeo, snowMat);
    snowOverlay.rotation.x = -Math.PI / 2;
    snowOverlay.position.y = 0.01; // Si incastra tra il prato (y=0) e le linee (y=0.02)
    snowOverlay.receiveShadow = true;
    scene.add(snowOverlay);

    // Aggiungi il Tabellone Segnapunti
    const scoreboard = new Scoreboard(scene);

    return { scene, camera, renderer, scoreboard };
}

export function updateSceneEnvironment(scene, timeOfDay, weather) {
    const rgbeLoader = new RGBELoader();
    const exrLoader = new EXRLoader();

    // --- 1. GESTIONE ORARIO (LUCI E SKYBOX) ---
    if (timeOfDay === 'night') {
        // Colore di fallback scuro immediato
        scene.background = new THREE.Color(0x020205);

        // Carichiamo il file .exr che hai scaricato
        exrLoader.load(`${import.meta.env.BASE_URL}textures/skybox/night_sky.exr`, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        }, undefined, (err) => {
            console.error("Errore nel caricamento dell'EXR notturno:", err);
        });

        // Setup luci notturne
        directionalLight.intensity = 0.6; // Luna più forte per far risaltare i giocatori
        directionalLight.color.setHex(0x7777aa); // Tonalità bluastra più chiara
        ambientLight.intensity = 0.5; // Luce di base alzata per illuminare i modelli 3D da ogni lato
        ambientLight.color.setHex(0x606070); // Grigio/blu neutro

        createStadiumLights(scene);
    } else {
        // Giorno: Colore di fallback azzurro
        scene.background = new THREE.Color(0x87CEEB);

        // Carichiamo il file .hdr per il giorno
        rgbeLoader.load(`${import.meta.env.BASE_URL}textures/skybox/sky.hdr`, (texture) => {
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

    if (snowOverlay) snowOverlay.material.opacity = 0.0; // Reset della neve sul terreno

    // Logica nebbia e parametri luce basati sul meteo
    switch (weather) {
        case 'fog':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x444455 : 0xcccccc, 0.015); // Grigio invece che nero di notte
            ambientLight.intensity *= 0.8;
            directionalLight.intensity *= 0.5;
            break;

        case 'rain':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x333344 : 0x888899, 0.01); // Grigio scuro invece che nero
            ambientLight.intensity *= 0.6;
            directionalLight.intensity *= 0.4;
            createRain(scene);
            break;

        case 'snow':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x555566 : 0xeeeeff, 0.012); // Grigio chiaro bluastro
            ambientLight.intensity *= 1.1; // La neve schiarisce l'ambiente
            directionalLight.intensity *= 0.7;
            if (snowOverlay) snowOverlay.material.opacity = 0.9; // Mostra le chiazze sul prato!
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

    // Posizioni basate sulle dimensioni del tuo Pitch.js (100x60)
    // Le mettiamo leggermente esterne ai quattro angoli
    const positions = [
        new THREE.Vector3(-80, 60, -60), // Angolo Nord-Ovest
        new THREE.Vector3(80, 60, -60),  // Angolo Nord-Est
        new THREE.Vector3(-80, 60, 60),  // Angolo Sud-Ovest
        new THREE.Vector3(80, 60, 60)    // Angolo Sud-Est
    ];

    positions.forEach(pos => {
        // Abbassiamo l'intensità per evitare di sovraesporre e far brillare troppo il campo
        const spotLight = new THREE.SpotLight(0xffffff, 10.0); 
        spotLight.position.copy(pos);
        
        // PUNTAMENTO: Invece di puntare tutto a (0,0,0), 
        // lasciamo che ogni luce punti verso il centro del campo per incrociarsi
        spotLight.target.position.set(0, 0, 0); 
        
        // AMPIEZZA: Angolo molto largo (circa 90 gradi)
        spotLight.angle = Math.PI / 2; 
        
        // SFUMATURA: Penumbra per bordi molto morbidi che si fondono tra loro
        spotLight.penumbra = 0.5;
        
        // DECADIMENTO: 1.0 rende la luce meno soggetta a spegnersi subito
        spotLight.decay = 0.5; 
        spotLight.distance = 400; 
        
        // OTTIMIZZAZIONE PRESTAZIONI: Disabilitiamo le ombre dei 4 fari angolari.
        // Renderizzare 4 ombre sovrapposte ad alta risoluzione causa un calo massiccio di FPS.
        spotLight.castShadow = false;

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
    const snowCount = 3000; // Ridotta la neve che cade per maggiore visibilità
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

            // Oscillazione laterale casuale per la neve con attrito
            velocities[i].x += (Math.random() - 0.5) * 0.1;
            velocities[i].z += (Math.random() - 0.5) * 0.1;
            
            // Smorzamento (Friction) per evitare che i fiocchi accelerino all'infinito e sembrino linee orizzontali
            velocities[i].x *= 0.98; 
            velocities[i].z *= 0.98;

            if (positions[i * 3 + 1] < 0) {
                positions[i * 3 + 1] = 60 + Math.random() * 10;
                positions[i * 3] = playerPosition.x + (Math.random() - 0.5) * 150;
                positions[i * 3 + 2] = playerPosition.z + (Math.random() - 0.5) * 100;
            }
        }
        snowSystem.geometry.attributes.position.needsUpdate = true;
    }
}