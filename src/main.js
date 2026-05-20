import './style.css';
import * as THREE from 'three';

// Import moduli e refactor
import { setupScene, updateSceneEnvironment, updateWeatherParticles } from './core/SceneSetup.js';
import { UIManager } from './ui/UIManager.js';
import { setupEffects, updateEffects } from './effects/GameEffects.js';
import { MatchManager } from './game/MatchManager.js';

// Import entità originali
import { createEnvironment } from './environment/Pitch.js';
import { Player } from './entities/Player.js';
import { Ball } from './entities/Ball.js';
import { Teammate } from './entities/Teammate.js';
import { Referee } from './entities/Referee.js';
import { Bot } from './entities/Bot.js';
import { GoalKeeper } from './entities/GoalKeeper.js';
import { BonusManager } from './game/BonusManager.js';
import { FireTrailEffect } from './effects/FireTrailEffect.js'
import { BoostPadManager } from './game/BoostPadManager.js';
import { ReplaySystem } from './core/ReplaySystem.js';
import { BenchPlayer } from './entities/BenchPlayer.js';
import { PossessionManager, MatchState } from './game/PossessionManager.js';
import { PlayerCustomizer } from './effects/PlayerCustomizer.js';

// --- INIZIALIZZAZIONE CORE ---
const { scene, camera, renderer } = setupScene();
createEnvironment(scene);
const effects = setupEffects(scene);
const clock = new THREE.Clock();

// --- INIZIALIZZAZIONE ENTITÀ ---
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
let customizationDistance = 3.5;

document.addEventListener('customizePlayerStart', () => {
    isCustomizing = true;
    customizationRotation = 0; // Reset frontale verso la telecamera
    customizationDistance = 3.5; // Reset zoom
    if (player.model) {
        player.model.position.set(0, 0, 0); // Mettilo sul campo per vedere lo stadio!
    }
    if (ball && ball.mesh) {
        ball.mesh.visible = false; // Nascondi la palla
    }
});

document.addEventListener('customizePlayerEnd', () => {
    isCustomizing = false;
    if (player.model) {
        player.model.position.set(0, -100, 0); // Nascondilo di nuovo
    }
    if (ball && ball.mesh) {
        ball.mesh.visible = true; // Mostra di nuovo la palla
    }
});

// Aggiungiamo il drag per ruotare il personaggio
document.addEventListener('pointerdown', (e) => {
    if (isCustomizing && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        isDragging = true;
        previousMouseX = e.clientX;
    }
});

document.addEventListener('pointermove', (e) => {
    if (isCustomizing && isDragging) {
        const deltaX = e.clientX - previousMouseX;
        customizationRotation += deltaX * 0.01;
        previousMouseX = e.clientX;
    }
});

document.addEventListener('pointerup', () => {
    isDragging = false;
});

let isCustomizationPaused = false;
document.addEventListener('toggleCustomizationAnimation', (e) => {
    isCustomizationPaused = e.detail.paused;
});

// Aggiungiamo lo zoom con la rotellina del mouse
document.addEventListener('wheel', (e) => {
    if (isCustomizing) {
        customizationDistance += e.deltaY * 0.005;
        // Limitiamo lo zoom (min: 1.5, max: 7.0)
        customizationDistance = Math.max(1.5, Math.min(customizationDistance, 7.0));
    }
});

document.addEventListener('previewCustomization', (e) => {
    const { type, color } = e.detail;
    const hex = parseInt(color.replace('#', '0x'));
    if (type === 'shirt') playerCustomizer.changeBaseColor('Ch38_Shirt', hex);
    if (type === 'skin') playerCustomizer.changeBaseColor('Ch38_Body', hex);
});

document.addEventListener('customizePlayer', (e) => {
    const { shirtColor, skinColor } = e.detail;
    
    const shirtHex = parseInt(shirtColor.replace('#', '0x'));
    const skinHex = parseInt(skinColor.replace('#', '0x'));
    
    playerCustomizer.changeBaseColor('Ch38_Shirt', shirtHex);
    playerCustomizer.changeBaseColor('Ch38_Body', skinHex);
});

const teammates = [
    new Teammate(scene, new THREE.Vector3(10, -100, 0), startYaw),
    new Teammate(scene, new THREE.Vector3(20, -100, 0), startYaw)
];
const bots = [
    new Bot(scene, ball, new THREE.Vector3(-10, -100, 0), 0),
    new Bot(scene, ball, new THREE.Vector3(-20, -100, 0), 0),
    new Bot(scene, ball, new THREE.Vector3(-30, -100, 0), 0)
];

const homeGK = new GoalKeeper(scene, ball, 'home', new THREE.Vector3(-48.5, 0, 0), Math.PI / 2);
const awayGK = new GoalKeeper(scene, ball, 'away', new THREE.Vector3(48.5, 0, 0), 3 / 2 * Math.PI);
const referee = new Referee(scene, ball, new THREE.Vector3(5, 0, 5));

// --- INIZIALIZZAZIONE PANCHINA ---
const benchPlayers = [];
// Panchina Home (Rossa)
for (let i = 0; i < 8; i++) {
    // Coordinate indicative della panchina: Y alzato per seduta, Z fuori dal campo.
    benchPlayers.push(new BenchPlayer(scene, 'home', new THREE.Vector3(-18 + (i * 1.5), -0.5, -35.1), 0));
}
// Panchina Away (Blu)
for (let i = 0; i < 8; i++) {
    benchPlayers.push(new BenchPlayer(scene, 'away', new THREE.Vector3(7 + (i * 1.5), -0.5, -35.1), 0));
}

// --- INIZIALIZZAZIONE MANAGER ---
const uiManager = new UIManager((mode) => {
    matchManager.isGameStarted = true;
    matchManager.startGame(mode);
    isBallInPlay = false; // <--- NUOVO: Reset all'inizio del match
    player.controls.lock();
});

// Ascolta l'evento per cambiare le condizioni meteo/orario
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
const boostPadManager = new BoostPadManager(scene);

// Gestione Pointer Lock
// Cliccando sullo sfondo (il blocker) riprende il gioco
uiManager.blocker.addEventListener('click', () => {
    if (matchManager.isGameStarted && !player.controls.isLocked) player.controls.lock();
});

// Intercettiamo in modo globale e forzato (useCapture = true) il click sul pulsante "RIPRENDI"
// Questo aggira eventuali e.stopPropagation() presenti nel codice dell'interfaccia (UIManager)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-btn, button'); // Cerchiamo un bottone o un elemento con classe menu-btn
    if (btn && btn.innerText.trim().toUpperCase() === 'RIPRENDI') {
        if (matchManager.isGameStarted && !player.controls.isLocked) player.controls.lock();
    }
}, true);

player.controls.addEventListener('lock', () => { uiManager.blocker.style.display = 'none'; });
player.controls.addEventListener('unlock', () => { if (matchManager.isGameStarted) uiManager.blocker.style.display = 'flex'; });

// Stato Locale
let stamina = 100;
let matchTime = 0;
let isBallInPlay = false;

// --- GESTIONE SLOW MOTION ---
let timeScale = 1.0;
let slowMoTimer = 0;
let targetCameraZoom = 1.0; // Livello di zoom base

document.addEventListener('triggerSlowMotion', (e) => {
    timeScale = e.detail.scale;
    slowMoTimer = e.detail.duration;
    targetCameraZoom = 1.4; // Effetto zoom-in intenso durante lo slow-mo
});

const replaySystem = new ReplaySystem();
const gameEntities = { ball, player, teammates, bots, homeGK, awayGK, referee };

// Ascoltatore per l'inizio del replay (lanciato dal MatchManager)
document.addEventListener('triggerReplay', () => {
    replaySystem.startPlayback();
    uiManager.showReplayUI(true);

    // Nasconde gli indicatori globali (ping giallo e freccia verde della porta)
    if (effects) {
        if (effects.playerIndicator) effects.playerIndicator.visible = false;
        if (effects.targetGoalGroup) effects.targetGoalGroup.visible = false;
    }

    // Nasconde gli indicatori visivi di mira del giocatore (frecce, mirino)
    if (player) {
        if (player.passArrow) player.passArrow.visible = false;
        if (player.aimRing) player.aimRing.visible = false;
        if (player.goalCrosshair) player.goalCrosshair.visible = false;
    }
});

// Ascoltatore per skippare il replay con SPAZIO
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && replaySystem.isPlaying) {
        replaySystem.stopPlayback();
        uiManager.showReplayUI(false);
        matchManager.resetAfterGoal();
        isBallInPlay = false;

        // RIATTIVA GLI INDICATORI
        if (effects) {
            if (effects.playerIndicator) effects.playerIndicator.visible = true;
            if (effects.targetGoalGroup) effects.targetGoalGroup.visible = true;
        }
    }
});

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    let rawDelta = Math.min(clock.getDelta(), 0.1);

    // --- SLOW MOTION UPDATE ---
    if (slowMoTimer > 0) {
        slowMoTimer -= rawDelta; // Usa il tempo reale per scalare il timer
        if (slowMoTimer <= 0) {
            timeScale = 1.0;
            targetCameraZoom = 1.0; // Reset istantaneo (backup di sicurezza)
        } else if (slowMoTimer < 0.4) {
            timeScale = THREE.MathUtils.lerp(timeScale, 1.0, 0.1); // Ritorno fluido alla normalità
            targetCameraZoom = 1.0; // Inizia a rimpicciolire fluidamente l'inquadratura
        }
    }

    // --- EFFETTO ZOOM DINAMICO ---
    if (Math.abs(camera.zoom - targetCameraZoom) > 0.005) {
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetCameraZoom, 0.08);
        camera.updateProjectionMatrix(); // Necessario in Three.js per applicare le modifiche allo zoom
    }

    let deltaTime = rawDelta * timeScale;

    if (!matchManager.isGameStarted) {
        if (isCustomizing && player.model) {
            const targetPos = player.model.position.clone();
            const previewCamPos = new THREE.Vector3(targetPos.x, targetPos.y + 1.2, targetPos.z + customizationDistance);
            camera.position.lerp(previewCamPos, 0.1); // Movimento fluido della telecamera
            
            const lookTarget = new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z);
            camera.lookAt(lookTarget);
            
            // --- NUOVA LOGICA ANIMAZIONE ---
            if (!isCustomizationPaused) {
                customizationAnimTimer -= rawDelta;

                if (customizationAnimTimer <= 0) {
                    if (customizationAnimState === 'run') {
                        customizationAnimState = 'header';
                        customizationAnimTimer = player.action.headerDuration * 3; // Esegui l'animazione di testa 3 volte
                        customizationHeaderProgress = 0;
                    } else {
                        customizationAnimState = 'run';
                        customizationAnimTimer = 2 + Math.random() * 2; // Corri per 2-4 secondi
                    }
                }
            }

            if (player.animator) {
                player.model.rotation.y = customizationRotation; // Usa la rotazione interattiva

                if (!isCustomizationPaused) {
                    if (customizationAnimState === 'run') {
                        player.animator.animate(rawDelta, false, true, true, false, null, 0, null, false, 0);
                    } else { // 'header'
                        customizationHeaderProgress += rawDelta;
                        let progress = (customizationHeaderProgress % player.action.headerDuration) / player.action.headerDuration;
                        player.animator.animate(rawDelta, false, false, false, false, null, 0, null, true, progress);
                    }
                }
            }
        } else {
            const time = clock.getElapsedTime();
            camera.position.set(Math.cos(time * 0.1) * 60, 30, Math.sin(time * 0.1) * 60);
            camera.lookAt(0, 0, 0);
            
            // Resetta la rotazione se esci dalla customizzazione
            if (player.model) player.model.rotation.y = startYaw;
        }
    }
    else if (player.controls.isLocked) {

        // --- LOGICA REPLAY ---
        if (replaySystem.isPlaying) {
            const isStillPlaying = replaySystem.play(gameEntities, camera);
            if (!isStillPlaying) {
                // Fine del replay
                uiManager.showReplayUI(false);
                matchManager.resetAfterGoal();
                isBallInPlay = false; // <--- NUOVO: Blocca i compagni per il nuovo calcio d'inizio
                
                // RIATTIVA GLI INDICATORI
                if (effects) {
                    if (effects.playerIndicator) effects.playerIndicator.visible = true;
                    if (effects.targetGoalGroup) effects.targetGoalGroup.visible = true;
                }
            }
        }
        // --- LOGICA GIOCO NORMALE ---
        else {
            if (!isBallInPlay && ball.velocity && ball.velocity.lengthSq() > 0.01) {
                isBallInPlay = true;
            }
            // Logica Stamina (Tuo codice originale)
            const isMoving = player.keys.forward || player.keys.backward || player.keys.left || player.keys.right;
            const isRunning = player.keys.run && isMoving && stamina > 0;

            if (isRunning) stamina -= 0.001 * deltaTime;
            else stamina += 100 * deltaTime;

            stamina = Math.max(0, Math.min(100, stamina));
            if (stamina === 0) player.keys.run = false;

            matchTime += deltaTime;
            uiManager.updateHUD(stamina, matchTime, matchManager.homeScore, matchManager.awayScore);

            // Aggiornamento Entità
            ball.update(deltaTime);
            player.update(deltaTime);
            referee.update(deltaTime);

            const attackDirX = matchManager.playerTeam === 'home' ? 1 : -1;
            const isMatchStarted = matchManager.isGameStarted;

            possessionManager.update(ball, player, teammates, bots, deltaTime);
            const currentMatchState = possessionManager.getState();
           


            teammates.forEach(t => t.update(deltaTime, ball, bots, attackDirX, isBallInPlay, currentMatchState, player, teammates));
            const opponents = [player, ...teammates]; 
            bots.forEach(b => b.update(deltaTime, isBallInPlay, currentMatchState, attackDirX, opponents, bots));
            
            homeGK.update(deltaTime, player.model);
            awayGK.update(deltaTime, player.model);
            bonusManager.update(deltaTime, matchManager.player);
            window.fireTrailEffect.update(deltaTime);
            boostPadManager.update(deltaTime, player);

            const boostFill = document.getElementById('boost-bar-fill');
            if (boostFill) boostFill.style.width = player.boost + '%';

            // Effetti, Regole e Radar
            updateEffects(effects, player, matchManager.playerTeam, clock.getElapsedTime(), isRunning, deltaTime, camera);
            matchManager.updateRules();
            uiManager.updateRadar(player.model, player.yaw, ball.mesh, ball.position, bots);
            
            updateWeatherParticles(deltaTime, player.model ? player.model.position : new THREE.Vector3());

            // REGISTRA IL FRAME
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

// --- LOGICA CAROSELLO COMANDI ---
const slides = document.querySelectorAll('.carousel-slide');
const dots = document.querySelectorAll('.dot');
const btnPrev = document.getElementById('btn-prev-slide');
const btnNext = document.getElementById('btn-next-slide');
let currentSlide = 0;

function showSlide(index) {
  // Rimuovi la classe active da tutto
  slides.forEach(slide => slide.classList.remove('active'));
  dots.forEach(dot => dot.classList.remove('active'));

  // Gestisci i limiti (loop continuo)
  if (index >= slides.length) currentSlide = 0;
  if (index < 0) currentSlide = slides.length - 1;

  // Aggiungi la classe active alla slide corrente
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

// Resetta il carosello alla prima pagina ogni volta che apri il menu comandi
document.getElementById('btn-commands').addEventListener('click', () => {
  currentSlide = 0;
  showSlide(currentSlide);
});

animate();