import './suppress-warnings.js';
import './style.css';
import './customization-menu.css';

import * as THREE from 'three';


window.gameSettings = {
    graphicsQuality: 2, 
    sensitivityX: 1.0,
    sensitivityY: 1.0
};


import { setupScene, updateSceneEnvironment, updateWeatherParticles, setGraphicsQuality } from './core/SceneSetup.js';
import { UIManager } from './ui/UIManager.js';
import { setupEffects, updateEffects } from './effects/GameEffects.js';
import { MatchManager } from './game/MatchManager.js';


import { createEnvironment } from './environment/Pitch.js';
import { Player } from './entities/Player.js';
import { Ball } from './entities/Ball.js';
import { Teammate } from './entities/Teammate.js';
import { Referee } from './entities/Referee.js';
import { Opponent } from './entities/Opponent.js';
import { GoalKeeper } from './entities/GoalKeeper.js';
import { BonusManager } from './game/BonusManager.js';
import { FireTrailEffect } from './effects/FireTrailEffect.js'
import { BoostPadManager } from './game/BoostPadManager.js';
import { ReplaySystem } from './core/ReplaySystem.js';
import { BenchPlayer } from './entities/BenchPlayer.js';
import { PossessionManager, MatchState } from './game/PossessionManager.js';
import { PlayerCustomizer } from './effects/PlayerCustomizer.js';
import { FaceSculptor } from './effects/FaceSculptor.js';


const { scene, camera, renderer, scoreboard } = setupScene();
createEnvironment(scene);

window.applyGraphicsQuality = (quality) => {
    setGraphicsQuality(quality, renderer);
};

window.applyGraphicsQuality(window.gameSettings.graphicsQuality);
const effects = setupEffects(scene);
const clock = new THREE.Timer();


const ball = new Ball(scene);
const startYaw = Math.PI / 2;
const player = new Player(camera, renderer.domElement, scene, ball, new THREE.Vector3(0, -100, 0), startYaw);
const playerCustomizer = new PlayerCustomizer(player);

let customizationAnimState = 'run';
let customizationAnimTimer = 3;
let customizationHeaderProgress = 0;

let isCustomizing = false;
let customizationRotation = Math.PI;
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;
let customizationDistance = 3.5;
let customizationHeightOffset = 1.2;


let faceSculptor = null;       
let isFaceTabActive = false;   
let faceZoomDistance = 0.55;   
let faceZoomTarget = 3.5;      



let faceSculptorInited = false;

document.addEventListener('customizePlayerStart', () => {
    isCustomizing = true;
    customizationRotation = 0;
    customizationDistance = 3.5;
    customizationHeightOffset = 1.2;
    faceZoomTarget = 3.5;     
    isFaceTabActive = false;
    if (player.model) {
        player.model.position.set(0, 0, 0);
    }
    if (ball && ball.mesh) {
        ball.mesh.visible = false;
    }
    
    if (!faceSculptorInited && player.model) {
        faceSculptor = new FaceSculptor(player.model, scene, camera, renderer.domElement);
        faceSculptor.init();
        faceSculptorInited = true;
    }
});

document.addEventListener('customizePlayerEnd', () => {
    isCustomizing = false;
    isFaceTabActive = false;
    if (faceSculptor) faceSculptor.deactivate();
    if (player.model) {
        player.model.position.set(0, -100, 0);
    }
    if (ball && ball.mesh) {
        ball.mesh.visible = true;
    }
});


document.addEventListener('pointerdown', (e) => {
    if (isCustomizing && !isFaceTabActive && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        isDragging = true;
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    }
});

document.addEventListener('pointermove', (e) => {
    if (isCustomizing && !isFaceTabActive && isDragging) {
        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;
        customizationRotation += deltaX * 0.01;
        customizationHeightOffset += deltaY * 0.01;
        customizationHeightOffset = Math.max(0.2, Math.min(customizationHeightOffset, 2.5)); 
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    }
});

document.addEventListener('pointerup', () => {
    isDragging = false;
});

let isCustomizationPaused = false;
document.addEventListener('toggleCustomizationAnimation', (e) => {
    isCustomizationPaused = e.detail.paused;
    if (!isCustomizationPaused) {
        
        customizationAnimState = 'run';
        customizationAnimTimer = 2 + Math.random() * 2;
    }
});


document.addEventListener('wheel', (e) => {
    if (isCustomizing) {
        if (isFaceTabActive) {
            
            faceZoomDistance += e.deltaY * 0.001;
            faceZoomDistance = Math.max(0.2, Math.min(faceZoomDistance, 1.5));
        } else {
            customizationDistance += e.deltaY * 0.005;
            customizationDistance = Math.max(1.5, Math.min(customizationDistance, 7.0));
        }
    }
});


document.addEventListener('customizationTabChanged', (e) => {
    const tab = e.detail.tab;
    isFaceTabActive = (tab === 'face');

    if (isFaceTabActive) {
        
        if (!faceSculptorInited && player.model) {
            faceSculptor = new FaceSculptor(player.model, scene, camera, renderer.domElement);
            faceSculptor.init();
            faceSculptorInited = true;
        }
        if (faceSculptor) faceSculptor.activate();
        faceZoomDistance = 0.55; 
    } else {
        if (faceSculptor) faceSculptor.deactivate();
    }
});


document.addEventListener('resetFaceSculpting', () => {
    if (faceSculptor) faceSculptor.reset();
});

document.addEventListener('previewCustomization', (e) => {
    const { type, color, id } = e.detail;

    if (type === 'shirtTeam') {
        if (id === 'custom') {
            playerCustomizer.changeTexture('Ch38_Shirt', null);
        } else {
            playerCustomizer.changeTexture('Ch38_Shirt', `${import.meta.env.BASE_URL}textures/shirts/${id}.png`);
        }
    }
    if (type === 'shirt') {
        const hex = parseInt(color.replace('#', '0x'));
        playerCustomizer.changeBaseColor('Ch38_Shirt', hex);
    }
    if (type === 'skin') {
        const hex = parseInt(color.replace('#', '0x'));
        playerCustomizer.changeBaseColor('Ch38_Body', hex);
    }
    if (type === 'hair') {
        if (id === "0") {
            
            playerCustomizer.removeAccessory('hair');
            playerCustomizer.toggleDefaultHair(false);
        } else {
            
            playerCustomizer.toggleDefaultHair(false);
            const hairOffsetPos = new THREE.Vector3(0, -1.95, 0.04);
            const hairOffsetRot = new THREE.Euler(0, 2 * Math.PI, 0);
            const hairScale = 1.3;
            playerCustomizer.equipAccessory(
                `${import.meta.env.BASE_URL}models/hair_` + id + '.glb',
                'head',
                'hair',
                hairOffsetPos,
                hairOffsetRot,
                hairScale
            );
        }
    }
    if (type === 'hairColor') {
        playerCustomizer.changeHairColor(color);
    }
    if (type === 'accessory') {
        playerCustomizer.equipGlasses(id);
    }
    if (type === 'hat') {
        playerCustomizer.equipHat(id);
    }
});

document.addEventListener('resetCustomization', () => {
    
    playerCustomizer.toggleDefaultHair(true);
    playerCustomizer.removeAccessory('hair');
    playerCustomizer.equipGlasses('0');
    playerCustomizer.equipHat('0');
    playerCustomizer.changeTexture('Ch38_Shirt', null);
    playerCustomizer.changeBaseColor('Ch38_Shirt', 0xff0000);
    playerCustomizer.changeBaseColor('Ch38_Body', 0xffccaa);
});

document.addEventListener('customizePlayer', (e) => {
    const { shirtTeam, shirtColor, skinColor, hairId, accessoryId, hairColor, hatId } = e.detail;

    if (shirtTeam && shirtTeam !== 'custom') {
        playerCustomizer.changeTexture('Ch38_Shirt', `${import.meta.env.BASE_URL}textures/shirts/${shirtTeam}.png`);
    } else {
        playerCustomizer.changeTexture('Ch38_Shirt', null);
        if (shirtColor) {
            const shirtHex = parseInt(shirtColor.replace('#', '0x'));
            playerCustomizer.changeBaseColor('Ch38_Shirt', shirtHex);
        }
    }

    const skinHex = parseInt(skinColor.replace('#', '0x'));
    playerCustomizer.changeBaseColor('Ch38_Body', skinHex);

    if (hairId !== undefined) {
        if (hairId === "0") {
            
            playerCustomizer.removeAccessory('hair');
            playerCustomizer.toggleDefaultHair(true);
        } else {
            
            playerCustomizer.toggleDefaultHair(false);
            const hairOffsetPos = new THREE.Vector3(0, -1.95, 0.04);
            const hairOffsetRot = new THREE.Euler(0, 2 * Math.PI, 0);
            const hairScale = 1.3;
            playerCustomizer.equipAccessory(
                `${import.meta.env.BASE_URL}models/hair_` + hairId + '.glb',
                'head',
                'hair',
                hairOffsetPos,
                hairOffsetRot,
                hairScale
            );
        }
    }
    if (hairColor) {
        playerCustomizer.changeHairColor(hairColor);
    }
    if (accessoryId !== undefined) {
        playerCustomizer.equipGlasses(accessoryId);
    }
    if (hatId !== undefined) {
        playerCustomizer.equipHat(hatId);
    }
});

const teammates = [
    new Teammate(scene, new THREE.Vector3(10, -100, 0), startYaw),
    new Teammate(scene, new THREE.Vector3(20, -100, 0), startYaw)
];

const homeNames = ["L. Messi", "C. Ronaldo", "K. Mbappé", "N. Barella", "F. Chiesa", "G. Donnarumma", "M. Verratti", "A. Bastoni", "S. Tonali", "F. Dimarco", "G. Di Lorenzo"];
const awayNames = ["K. De Bruyne", "E. Haaland", "V. Vinicius", "J. Bellingham", "H. Kane", "R. Lewandowski", "L. Modric", "M. Salah", "T. Kroos", "A. Griezmann", "P. Foden"];

player.playerName = homeNames[0];
player.position = 'ATT';
player.ovr = 91;
player.avatar = '👤';

teammates[0].playerName = homeNames[1];
teammates[0].position = 'CEN';
teammates[0].ovr = 86;
teammates[0].avatar = '👤';

teammates[1].playerName = homeNames[2];
teammates[1].position = 'DIF';
teammates[1].ovr = 84;
teammates[1].avatar = '👤';

const bots = [
    new Opponent(scene, ball, new THREE.Vector3(-10, -100, 0), 0),
    new Opponent(scene, ball, new THREE.Vector3(-20, -100, 0), 0),
    new Opponent(scene, ball, new THREE.Vector3(-30, -100, 0), 0)
];

const homeGK = new GoalKeeper(scene, ball, 'home', new THREE.Vector3(-48.5, 0, 0), Math.PI / 2);
const awayGK = new GoalKeeper(scene, ball, 'away', new THREE.Vector3(48.5, 0, 0), 3 / 2 * Math.PI);
const referee = new Referee(scene, ball, new THREE.Vector3(5, 0, 5));

homeGK.playerName = homeNames[5];
homeGK.position = 'POR';
homeGK.ovr = 88;
homeGK.avatar = '👤';
homeGK.stamina = 100;

awayGK.playerName = awayNames[5]; 
awayGK.position = 'POR';
awayGK.ovr = 88;
awayGK.avatar = '👤';
awayGK.stamina = 100;


const benchPlayers = [];
const benchPositions = ['ATT', 'CEN', 'CEN', 'DIF', 'DIF', 'DIF', 'POR', 'ATT'];

for (let i = 0; i < 8; i++) {
    const bp = new BenchPlayer(scene, 'home', new THREE.Vector3(-18 + (i * 1.5), -0.5, -35.1), 0);
    bp.playerName = homeNames[3 + i] || "Riserva";
    bp.position = benchPositions[i];
    bp.ovr = Math.floor(Math.random() * 10) + 75; 
    bp.avatar = '👤';
    benchPlayers.push(bp);
}

for (let i = 0; i < 8; i++) {
    const bp = new BenchPlayer(scene, 'away', new THREE.Vector3(7 + (i * 1.5), -0.5, -35.1), 0);
    bp.playerName = awayNames[i];
    bp.position = benchPositions[i];
    bp.ovr = Math.floor(Math.random() * 10) + 75;
    bp.avatar = '👤';
    benchPlayers.push(bp);
}


const uiManager = new UIManager((mode) => {
    matchManager.isGameStarted = true;
    matchManager.startGame(mode);
    isBallInPlay = false; 
    if (player.isTouchDevice) {
        document.getElementById('touch-controls').style.display = 'block';
        uiManager.blocker.style.display = 'none';

        
        const docEl = document.documentElement;
        try {
            if (docEl.requestFullscreen) {
                const p = docEl.requestFullscreen();
                if (p) p.catch(e => console.warn(e));
            } else if (docEl.webkitRequestFullscreen) {
                const p = docEl.webkitRequestFullscreen();
                if (p) p.catch(e => console.warn(e));
            }
        } catch (err) {
            console.warn("Fullscreen API non supportata: ", err);
        }
    } else {
        player.controls.lock();
    }
});


document.addEventListener('updateEnvironment', (e) => {
    updateSceneEnvironment(scene, e.detail.time, e.detail.weather);
});

document.addEventListener('bonusCleared', () => {
    uiManager.clearBonus();
});
const matchManager = new MatchManager(camera, ball, player, teammates, bots, homeGK, awayGK, uiManager);
const bonusManager = new BonusManager(scene, uiManager);
window.fireTrailEffect = new FireTrailEffect(scene);
const possessionManager = new PossessionManager();
matchManager.possessionManager = possessionManager;
homeGK.possessionManager = possessionManager;
const boostPadManager = new BoostPadManager(scene);


const _collisionPushA = new THREE.Vector3();
const _collisionPushB = new THREE.Vector3();

function resolvePlayerCollisions(humanPlayer, allEntities) {
    const PLAYER_RADIUS = 0.5;
    const MIN_DIST = PLAYER_RADIUS * 2; 

    
    const bodies = [];
    for (const entity of allEntities) {
        if (entity && entity.model && entity.model.position) {
            bodies.push(entity);
        }
    }

    
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const b = bodies[j];

            const dx = a.model.position.x - b.model.position.x;
            const dz = a.model.position.z - b.model.position.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < MIN_DIST * MIN_DIST && distSq > 0.0001) {
                const dist = Math.sqrt(distSq);
                const overlap = MIN_DIST - dist;

                
                const nx = dx / dist;
                const nz = dz / dist;

                
                const aIsHuman = (a === humanPlayer);
                const bIsHuman = (b === humanPlayer);

                let weightA, weightB;
                if (aIsHuman) {
                    weightA = 0.2; 
                    weightB = 0.8; 
                } else if (bIsHuman) {
                    weightA = 0.8;
                    weightB = 0.2;
                } else {
                    weightA = 0.5; 
                    weightB = 0.5;
                }

                
                a.model.position.x += nx * overlap * weightA;
                a.model.position.z += nz * overlap * weightA;
                b.model.position.x -= nx * overlap * weightB;
                b.model.position.z -= nz * overlap * weightB;
            }
        }
    }
}



uiManager.blocker.addEventListener('click', () => {
    if (matchManager.isGameStarted && !player.controls.isLocked) {
        if (player.isTouchDevice) {
            document.getElementById('touch-controls').style.display = 'block';
            uiManager.blocker.style.display = 'none';

            
            const docEl = document.documentElement;
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                try {
                    if (docEl.requestFullscreen) {
                        const p = docEl.requestFullscreen();
                        if (p) p.catch(e => console.warn(e));
                    } else if (docEl.webkitRequestFullscreen) {
                        const p = docEl.webkitRequestFullscreen();
                        if (p) p.catch(e => console.warn(e));
                    }
                } catch (err) { console.warn(err); }
            }
        } else {
            player.controls.lock();
        }
    }
});



document.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-btn, button'); 
    if (btn && (btn.innerText.trim().toUpperCase() === 'RIPRENDI' || btn.innerText.trim().toUpperCase() === 'RESUME' || btn.id === 'btn-resume')) {
        if (matchManager.isGameStarted && !player.controls.isLocked) {
            if (player.isTouchDevice) {
                document.getElementById('touch-controls').style.display = 'block';
                uiManager.blocker.style.display = 'none';

                const docEl = document.documentElement;
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    try {
                        if (docEl.requestFullscreen) {
                            const p = docEl.requestFullscreen();
                            if (p) p.catch(e => console.warn(e));
                        } else if (docEl.webkitRequestFullscreen) {
                            const p = docEl.webkitRequestFullscreen();
                            if (p) p.catch(e => console.warn(e));
                        }
                    } catch (err) { console.warn(err); }
                }
            } else {
                player.controls.lock();
            }
        }
    }
}, true);

player.controls.addEventListener('lock', () => { uiManager.blocker.style.display = 'none'; });
player.controls.addEventListener('unlock', () => { if (matchManager.isGameStarted) uiManager.blocker.style.display = 'flex'; });

const touchPauseBtn = document.getElementById('btn-touch-pause');
if (touchPauseBtn) {
    touchPauseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (player.isTouchDevice) {
            document.getElementById('touch-controls').style.display = 'none';
            uiManager.blocker.style.display = 'flex';
        }
    }, { passive: false });
}


let stamina = 100;
let matchTime = 0;
let isBallInPlay = false;


let timeScale = 1.0;
let slowMoTimer = 0;
let targetCameraZoom = 1.0; 

document.addEventListener('triggerSlowMotion', (e) => {
    timeScale = e.detail.scale;
    slowMoTimer = e.detail.duration;
    targetCameraZoom = 1.4; 
});

document.addEventListener('warmUpAssets', () => {
    const audios = [
        matchManager.whistleSound, matchManager.bgMusic, player.action.kickSound, player.nitroSound,
        uiManager.clickSound, uiManager.switchSound, uiManager.bonusSound, uiManager.popupSound
    ];

    audios.forEach(snd => {
        if (snd && typeof snd.play === 'function') {
            const oldVol = snd.volume;
            snd.volume = 0;
            const p = snd.play();
            if (p && p.catch) {
                p.then(() => { snd.pause(); snd.currentTime = 0; snd.volume = oldVol; }).catch(() => {});
            }
        }
    });

    if (player.passArrow) player.passArrow.visible = true;
    if (player.goalCrosshair) player.goalCrosshair.visible = true;
    if (player.aimRing) player.aimRing.visible = true;
    if (player.cornerCrosshair) player.cornerCrosshair.visible = true;
    if (window.fireTrailEffect && window.fireTrailEffect.points) window.fireTrailEffect.points.visible = true;
    
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const ringGeo = new THREE.RingGeometry(1, 1.2, 16);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ringMesh);

    renderer.compile(scene, camera);

    scene.remove(ringMesh);
    ringGeo.dispose();
    ringMat.dispose();

    if (player.passArrow) player.passArrow.visible = false;
    if (player.goalCrosshair) player.goalCrosshair.visible = false;
    if (player.aimRing) player.aimRing.visible = false;
    if (player.cornerCrosshair) player.cornerCrosshair.visible = false;
    if (window.fireTrailEffect && window.fireTrailEffect.points) window.fireTrailEffect.points.visible = false;
});

const replaySystem = new ReplaySystem();
const gameEntities = { ball, player, teammates, bots, homeGK, awayGK, referee };


document.addEventListener('triggerReplay', () => {
    replaySystem.startPlayback();
    uiManager.showReplayUI(true);

    
    if (effects) {
        if (effects.playerIndicator) effects.playerIndicator.visible = false;
        if (effects.targetGoalGroup) effects.targetGoalGroup.visible = false;
    }

    
    if (player) {
        if (player.passArrow) player.passArrow.visible = false;
        if (player.aimRing) player.aimRing.visible = false;
        if (player.goalCrosshair) player.goalCrosshair.visible = false;
    }
});


document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && replaySystem.isPlaying) {
        skipReplay();
    }
});


document.addEventListener('mousedown', (e) => {
    if (replaySystem.isPlaying) skipReplay();
});
document.addEventListener('touchstart', (e) => {
    if (replaySystem.isPlaying) skipReplay();
}, { passive: true });

function skipReplay() {
    replaySystem.stopPlayback();
    uiManager.showReplayUI(false);
    matchManager.resetAfterGoal();
    isBallInPlay = false;

    
    if (effects) {
        if (effects.playerIndicator) effects.playerIndicator.visible = true;
        if (effects.targetGoalGroup) effects.targetGoalGroup.visible = true;
    }
}


function animate(timestamp) {
    requestAnimationFrame(animate);
    clock.update(timestamp);
    let rawDelta = Math.min(clock.getDelta(), 0.1);

    
    if (slowMoTimer > 0) {
        slowMoTimer -= rawDelta; 
        if (slowMoTimer <= 0) {
            timeScale = 1.0;
            targetCameraZoom = 1.0; 
        } else if (slowMoTimer < 0.4) {
            timeScale = THREE.MathUtils.lerp(timeScale, 1.0, 0.1); 
            targetCameraZoom = 1.0; 
        }
    }

    
    if (Math.abs(camera.zoom - targetCameraZoom) > 0.005) {
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetCameraZoom, 0.08);
        camera.updateProjectionMatrix(); 
    }

    let deltaTime = rawDelta * timeScale;

    if (!matchManager.isGameStarted) {
        if (isCustomizing && player.model) {
            const targetPos = player.model.position.clone();

            if (isFaceTabActive) {
                
                
                let headWorldPos = targetPos.clone().add(new THREE.Vector3(0, 1.55, 0));
                if (player.animator && player.animator.bones && player.animator.bones.head) {
                    player.animator.bones.head.getWorldPosition(headWorldPos);
                }
                
                const faceCamPos = new THREE.Vector3(
                    headWorldPos.x,
                    headWorldPos.y,
                    headWorldPos.z + faceZoomDistance
                );
                camera.position.lerp(faceCamPos, 0.12);
                camera.lookAt(headWorldPos);

                
                if (faceSculptor) faceSculptor.update();

                
                if (player.animator) {
                    player.model.rotation.y = customizationRotation;
                    player.animator.animate(0, false, false, false, false, null, 0, null, false, 0);
                }
            } else {
                
                const previewCamPos = new THREE.Vector3(targetPos.x, targetPos.y + customizationHeightOffset, targetPos.z + customizationDistance);
                camera.position.lerp(previewCamPos, 0.1);

                const lookTarget = new THREE.Vector3(targetPos.x, targetPos.y + customizationHeightOffset - 0.2, targetPos.z);
                camera.lookAt(lookTarget);

                
                if (!isCustomizationPaused) {
                    customizationAnimTimer -= rawDelta;

                    if (customizationAnimTimer <= 0) {
                        if (customizationAnimState === 'run') {
                            customizationAnimState = 'header';
                            customizationAnimTimer = player.action.headerDuration * 3;
                            customizationHeaderProgress = 0;
                        } else {
                            customizationAnimState = 'run';
                            customizationAnimTimer = 2 + Math.random() * 2;
                        }
                    }
                }

                if (player.animator) {
                    player.model.rotation.y = customizationRotation;

                    if (!isCustomizationPaused) {
                        if (customizationAnimState === 'run') {
                            player.animator.animate(rawDelta, false, true, true, false, null, 0, null, false, 0);
                        } else {
                            customizationHeaderProgress += rawDelta;
                            let progress = (customizationHeaderProgress % player.action.headerDuration) / player.action.headerDuration;
                            player.animator.animate(rawDelta, false, false, false, false, null, 0, null, true, progress);
                        }
                    } else {
                        player.animator.animate(rawDelta, false, false, false, false, null, 0, null, false, 0);
                    }
                }
            }
        } else {
            const time = clock.getElapsed();
            camera.position.set(Math.cos(time * 0.1) * 60, 30, Math.sin(time * 0.1) * 60);
            camera.lookAt(0, 0, 0);

            
            if (player.model) player.model.rotation.y = startYaw;
        }
    }
    else if (player.controls.isLocked || (player.isTouchDevice && document.getElementById('touch-controls').style.display !== 'none')) {

        
        if (replaySystem.isPlaying) {
            const isStillPlaying = replaySystem.play(gameEntities, camera);
            if (!isStillPlaying) {
                
                uiManager.showReplayUI(false);
                matchManager.resetAfterGoal();
                isBallInPlay = false; 

                
                if (effects) {
                    if (effects.playerIndicator) effects.playerIndicator.visible = true;
                    if (effects.targetGoalGroup) effects.targetGoalGroup.visible = true;
                }
            }
        }
        
        else {
            if (!isBallInPlay && ball.velocity && ball.velocity.lengthSq() > 0.01) {
                isBallInPlay = true;
            }
            
            const isMoving = player.keys.forward || player.keys.backward || player.keys.left || player.keys.right;
            const isRunning = player.keys.run && isMoving && player.stamina > 0;

            if (isRunning) {
                player.stamina -= 1.5 * deltaTime; 
            }
            

            player.stamina = Math.max(0, Math.min(100, player.stamina));
            if (player.stamina === 0) player.keys.run = false;

            if (isBallInPlay) {
                matchTime += deltaTime;
            }
            uiManager.updateHUD(player.playerName, player.stamina, matchTime, matchManager.homeScore, matchManager.awayScore);
            scoreboard.updateScore(matchManager.homeScore, matchManager.awayScore, matchTime);

            if (matchTime >= 120 && matchManager.isGameStarted && matchManager.gameMode !== 'penalty' && matchManager.gameMode !== 'freekick' && matchManager.gameMode !== 'corner') {
                matchManager.isGameStarted = false;
                isBallInPlay = false;
                document.exitPointerLock();
                if (player.controls) player.controls.unlock();
                uiManager.showEndMatchScreen(matchManager.homeScore, matchManager.awayScore, matchManager.playerTeam);
                
                if (matchManager.whistleSound) {
                    const src = matchManager.whistleSound.src;
                    const w1 = new Audio(src); w1.volume = 1.0;
                    const w2 = new Audio(src); w2.volume = 1.0;
                    const w3 = new Audio(src); w3.volume = 1.0;
                    w1.play().catch(e=>console.warn(e));
                    setTimeout(() => w2.play().catch(e=>console.warn(e)), 800);
                    setTimeout(() => w3.play().catch(e=>console.warn(e)), 1600);
                }
            }

            
            ball.update(deltaTime);
            player.update(deltaTime);
            
            const isTrainingMode = matchManager.gameMode === 'penalty' || matchManager.gameMode === 'freekick' || matchManager.gameMode === 'corner';
            if (!isTrainingMode) {
                if (referee.model) referee.model.visible = true;
                referee.update(deltaTime);
            } else {
                if (referee.model) referee.model.visible = false;
            }

            const attackDirX = matchManager.playerTeam === 'home' ? 1 : -1;
            const isMatchStarted = matchManager.isGameStarted;

            possessionManager.update(ball, player, teammates, bots, deltaTime);
            const currentMatchState = possessionManager.getState();
            



            const isBotActive = isBallInPlay && !matchManager.isCelebrating && !ball.isGoal && matchManager.gameMode !== 'penalty' && matchManager.gameMode !== 'freekick';

            teammates.forEach(t => t.update(
                deltaTime,           
                ball,                
                player,              
                bots,                
                teammates,           
                attackDirX,          
                isBotActive,         
                currentMatchState    
            ));
            const opponents = [player, ...teammates];
            bots.forEach(b => b.update(deltaTime, isBotActive, currentMatchState, attackDirX, opponents, bots));

            homeGK.update(deltaTime, player.model);
            awayGK.update(deltaTime, player.model);

            
            resolvePlayerCollisions(player, [player, ...teammates, ...bots, homeGK, awayGK]);
            const isTraining = matchManager.gameMode === 'penalty' || matchManager.gameMode === 'freekick' || matchManager.gameMode === 'corner';

            if (isTraining !== window.isTrainingState) {
                window.isTrainingState = isTraining;
                bonusManager.setVisible(!isTraining);
                boostPadManager.setVisible(!isTraining);
                uiManager.toggleTrainingHUD(isTraining);
            }

            if (!isTraining) {
                bonusManager.update(deltaTime, matchManager.player);
                boostPadManager.update(deltaTime, player);
            }

            window.fireTrailEffect.update(deltaTime);

            const boostFill = document.getElementById('boost-bar-fill');
            if (boostFill) boostFill.style.width = player.boost + '%';

            
            updateEffects(effects, player, matchManager.playerTeam, clock.getElapsed(), isRunning, deltaTime, camera);
            matchManager.updateRules();
            uiManager.updateRadar(player.model, player.yaw, ball.mesh, ball.position, bots);

            updateWeatherParticles(deltaTime, player.model ? player.model.position : new THREE.Vector3());

            
            replaySystem.record(gameEntities);
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


const slides = document.querySelectorAll('.carousel-slide');
const dots = document.querySelectorAll('.dot');
const btnPrev = document.getElementById('btn-prev-slide');
const btnNext = document.getElementById('btn-next-slide');
let currentSlide = 0;

function showSlide(index) {
    
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    
    if (index >= slides.length) currentSlide = 0;
    if (index < 0) currentSlide = slides.length - 1;

    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

btnNext.addEventListener('click', () => {
    currentSlide++;
    showSlide(currentSlide);
});

btnPrev.addEventListener('click', () => {
    currentSlide--;
    showSlide(currentSlide);
});


document.getElementById('btn-commands').addEventListener('click', () => {
    currentSlide = 0;
    showSlide(currentSlide);
});


let subsRemaining = 5;

document.addEventListener('openSubstitutions', () => {
    const activeContainer = document.getElementById('active-players-container');
    const benchContainer = document.getElementById('bench-players-container');
    const subsText = document.getElementById('subs-remaining-text');
    if (!activeContainer || !benchContainer) return;

    if (subsText) {
        subsText.innerText = `Available Substitutions: ${subsRemaining}`;
        if (subsRemaining === 0) subsText.style.color = '#f44336';
    }

    activeContainer.innerHTML = '';
    benchContainer.innerHTML = '';

    const myTeam = matchManager.playerTeam;
    const myGK = myTeam === 'home' ? matchManager.homeGK : matchManager.awayGK;
    const activePlayers = [player, teammates[0], teammates[1], myGK];

    
    activePlayers.forEach((p, index) => {
        let displayData = p;
        if (window.pendingSubstitutions) {
            const pending = window.pendingSubstitutions.find(sub => sub.activePlayer === p);
            if (pending) {
                displayData = pending.subPlayer;
            }
        }
        
        const card = createPlayerCard(displayData, true, index, p);
        
        
        if (displayData !== p) {
            card.style.boxShadow = '0 0 20px #FFEB3B';
            card.style.border = '2px solid #FFEB3B';
        }

        activeContainer.appendChild(card);
    });

    
    const myBench = benchPlayers.filter(bp => bp.team === myTeam && !bp.isSubbed);

    myBench.forEach((bp, index) => {
        const card = createPlayerCard(bp, false, index);
        benchContainer.appendChild(card);
    });
});

function createPlayerCard(playerData, isActive, index, originalPlayer = null) {
    const card = document.createElement('div');
    
    const positionClass = isActive ? `tactical-slot-${index}` : 'bench-slot';
    card.className = `fut-card ${positionClass}`;
    if (!isActive) card.draggable = true;

    const staminaClass = playerData.stamina > 50 ? 'stamina-high' : (playerData.stamina > 20 ? 'stamina-med' : 'stamina-low');
    const displayStamina = Math.floor(playerData.stamina || 100);

    
    let cardTheme = 'gold';
    if (playerData.ovr >= 90) cardTheme = 'special';
    else if (playerData.ovr < 80) cardTheme = 'silver';

    card.classList.add(`theme-${cardTheme}`);

    card.innerHTML = `
        <div class="fut-card-top-left">
            <div class="fut-ovr">${playerData.ovr || 85}</div>
            <div class="fut-pos">${playerData.position || 'CEN'}</div>
        </div>
        <div class="fut-avatar-huge">${playerData.avatar || '👤'}</div>
        <div class="fut-card-bottom-banner">
            <div class="fut-name">${playerData.playerName}</div>
            <div class="fut-stamina-bar-container">
                <div class="fut-stamina-bar ${staminaClass}" style="width: ${displayStamina}%"></div>
            </div>
        </div>
    `;

    if (!isActive) {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
        });
    } else {
        
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const benchIndex = e.dataTransfer.getData('text/plain');
            if (benchIndex !== "") {
                const targetPlayer = originalPlayer || playerData;
                performSubstitution(targetPlayer, parseInt(benchIndex));
            }
        });
    }

    return card;
}

window.pendingSubstitutions = window.pendingSubstitutions || [];

function performSubstitution(activePlayer, benchIndex) {
    if (subsRemaining <= 0) {
        uiManager.showInGameMessage("<span style='color:red'>NO SUBSTITUTIONS LEFT!</span>");
        return;
    }

    const myTeam = matchManager.playerTeam;
    const myBench = benchPlayers.filter(bp => bp.team === myTeam && !bp.isSubbed);
    const subPlayer = myBench[benchIndex];

    if (subPlayer) {
        subsRemaining--;
        subPlayer.isSubbed = true; 

        
        const existingSubIndex = window.pendingSubstitutions.findIndex(sub => sub.activePlayer === activePlayer);
        if (existingSubIndex !== -1) {
            window.pendingSubstitutions[existingSubIndex].subPlayer.isSubbed = false;
            window.pendingSubstitutions[existingSubIndex].subPlayer = subPlayer;
            subsRemaining++; 
        } else {
            window.pendingSubstitutions.push({
                activePlayer: activePlayer,
                subPlayer: subPlayer
            });
        }

        uiManager.showInGameMessage(`
            <div style="font-size: 16px; color: #aaa; margin-bottom: 5px;">SUBSTITUTION SCHEDULED</div>
            <div style="font-size: 14px;">It will happen on the next set piece.</div>
        `);

        
        document.dispatchEvent(new Event('openSubstitutions'));
    }
}

window.executePendingSubstitutions = function () {
    if (!window.pendingSubstitutions || window.pendingSubstitutions.length === 0) return false;

    let messageHtml = `<div style="font-size: 16px; color: #aaa; margin-bottom: 5px;">SUBSTITUTION COMPLETED</div>`;

    for (let sub of window.pendingSubstitutions) {
        const activePlayer = sub.activePlayer;
        const subPlayer = sub.subPlayer;

        const oldName = activePlayer.playerName;
        const newName = subPlayer.playerName;

        
        activePlayer.playerName = subPlayer.playerName;
        activePlayer.avatar = subPlayer.avatar;
        activePlayer.ovr = subPlayer.ovr;
        activePlayer.position = subPlayer.position;
        activePlayer.stamina = 100;

        messageHtml += `
            <div style="margin-top: 5px;"><span style="color: #ff4444; margin-right: 5px;">⬇</span> ${oldName}</div>
            <div><span style="color: #4CAF50; margin-right: 5px;">⬆</span> ${newName}</div>
        `;

        if (activePlayer === matchManager.player) {
            uiManager.updateHUD(matchManager.player.playerName, matchManager.player.stamina, matchTime, matchManager.homeScore, matchManager.awayScore);
        }
    }

    uiManager.showInGameMessage(messageHtml);
    window.pendingSubstitutions = [];
    return true;
};

animate();