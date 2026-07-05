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
    texture.repeat.set(40, 40);
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
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -60;
    directionalLight.shadow.camera.right = 60;
    directionalLight.shadow.camera.top = 60;
    directionalLight.shadow.camera.bottom = -60;
    directionalLight.shadow.bias = -0.0005;
    scene.add(directionalLight);


    updateSceneEnvironment(scene, 'day', 'clear');


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


    const snowMat = new THREE.MeshStandardMaterial({ map: createSnowPatchTexture(), transparent: true, opacity: 0.0, roughness: 0.9, depthWrite: false });
    snowOverlay = new THREE.Mesh(pitchGeo, snowMat);
    snowOverlay.rotation.x = -Math.PI / 2;
    snowOverlay.position.y = 0.01;
    snowOverlay.receiveShadow = true;
    scene.add(snowOverlay);


    const scoreboard = new Scoreboard(scene);

    return { scene, camera, renderer, scoreboard };
}

export function updateSceneEnvironment(scene, timeOfDay, weather) {
    const rgbeLoader = new HDRLoader();
    const exrLoader = new EXRLoader();


    if (timeOfDay === 'night') {

        scene.background = new THREE.Color(0x020205);


        exrLoader.load(`${import.meta.env.BASE_URL}textures/skybox/night_sky.exr`, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        }, undefined, (err) => {
            console.error("Errore nel caricamento dell'EXR notturno:", err);
        });


        directionalLight.intensity = 0.6;
        directionalLight.color.setHex(0x7777aa);
        ambientLight.intensity = 0.5;
        ambientLight.color.setHex(0x606070);

        createStadiumLights(scene);
    } else {

        scene.background = new THREE.Color(0x87CEEB);


        rgbeLoader.load(`${import.meta.env.BASE_URL}textures/skybox/sky.hdr`, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        }, undefined, (err) => {
            console.error("Errore nel caricamento dell'HDR diurno:", err);
        });


        directionalLight.intensity = 1.2;
        directionalLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.5;
        ambientLight.color.setHex(0xffffff);

        removeStadiumLights(scene);
    }



    scene.fog = null;
    if (rainSystem) { scene.remove(rainSystem); rainSystem = null; }
    if (snowSystem) { scene.remove(snowSystem); snowSystem = null; }

    if (snowOverlay) snowOverlay.material.opacity = 0.0;


    switch (weather) {
        case 'fog':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x444455 : 0xcccccc, 0.015);
            ambientLight.intensity *= 0.8;
            directionalLight.intensity *= 0.5;
            break;

        case 'rain':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x333344 : 0x888899, 0.01);
            ambientLight.intensity *= 0.6;
            directionalLight.intensity *= 0.4;
            createRain(scene);
            break;

        case 'snow':
            scene.fog = new THREE.FogExp2(timeOfDay === 'night' ? 0x555566 : 0xeeeeff, 0.012);
            ambientLight.intensity *= 1.1;
            directionalLight.intensity *= 0.7;
            if (snowOverlay) snowOverlay.material.opacity = 0.9;
            createSnow(scene);
            break;

        default:

            break;
    }
}

let stadiumLights = [];
function createStadiumLights(scene) {
    if (stadiumLights.length > 0) return;



    const positions = [
        new THREE.Vector3(-80, 60, -60),
        new THREE.Vector3(80, 60, -60),
        new THREE.Vector3(-80, 60, 60),
        new THREE.Vector3(80, 60, 60)
    ];

    positions.forEach(pos => {

        const spotLight = new THREE.SpotLight(0xffffff, 10.0); 
        spotLight.position.copy(pos);
        


        spotLight.target.position.set(0, 0, 0); 
        

        spotLight.angle = Math.PI / 2; 
        

        spotLight.penumbra = 0.5;
        

        spotLight.decay = 0.5; 
        spotLight.distance = 400; 
        


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
        rainVel.push(new THREE.Vector3(0, -10 - Math.random() * 10, 0));
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
    const snowCount = 3000;
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


            velocities[i].x += (Math.random() - 0.5) * 0.1;
            velocities[i].z += (Math.random() - 0.5) * 0.1;
            

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


export function setGraphicsQuality(quality, renderer) {
    if (!renderer || !directionalLight) return;

    if (quality === 0) {

        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1);
        directionalLight.castShadow = false;
    } else if (quality === 1) {

        renderer.shadowMap.enabled = true;
        renderer.setPixelRatio(1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
    } else {

        renderer.shadowMap.enabled = true;
        renderer.setPixelRatio(window.devicePixelRatio);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
    }
}