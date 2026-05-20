import * as THREE from 'three';

export class UIManager {
    constructor(onStartGame) {
        this.onStartGame = onStartGame; // Funzione da chiamare quando si clicca play

        // Elementi DOM
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingBarFill = document.getElementById('loading-bar-fill');
        this.loadingText = document.getElementById('loading-text');
        this.mainMenu = document.getElementById('main-menu');
        this.commandsMenu = document.getElementById('commands-menu');
        this.formationMenu = document.getElementById('formation-menu');
        this.gameUi = document.getElementById('game-ui');
        this.blocker = document.getElementById('blocker');
        this.staminaBarFill = document.getElementById('stamina-bar-fill');
        this.timerElement = document.getElementById('timer');
        this.radarPlayer = document.getElementById('radar-player');
        this.radarBall = document.getElementById('radar-ball');
        this.scoreElement = document.querySelector('.score');

        this.setupLoadingManager();
        this.setupEventListeners();
    }

    setupLoadingManager() {
        this.mainMenu.style.display = 'none';
        let isFirstLoad = true;
        
        THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const percentuale = (itemsLoaded / itemsTotal) * 100;
            this.loadingBarFill.style.width = percentuale + '%';
            this.loadingText.innerText = Math.floor(percentuale) + '%';
        };
        THREE.DefaultLoadingManager.onLoad = () => {
            if (!isFirstLoad) return; // Evita che il menu riappaia quando si carica il meteo in background
            isFirstLoad = false;
            
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
                this.customizationMenu.style.display = 'flex';
                document.dispatchEvent(new Event('customizePlayerStart'));
                
                const savedShirt = localStorage.getItem('customShirtColor') || '#ff0000';
                const savedSkin = localStorage.getItem('customSkinColor') || '#ffccaa';
                const savedHair = localStorage.getItem('customHair') || '0';
                const savedHairColor = localStorage.getItem('customHairColor') || '#000000';
                
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirt', color: savedShirt } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'skin', color: savedSkin } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hair', id: savedHair } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hairColor', color: savedHairColor } }));
            }, 500);
        };
    }

    setupEventListeners() {
        document.getElementById('btn-play').addEventListener('click', (e) => {
            e.stopPropagation();
            this.mainMenu.style.display = 'none';
            this.settingsMenu.style.display = 'flex';
        });

        // Crea dinamicamente il tasto "TRAINING" e il relativo sottomenu
        const btnPlay = document.getElementById('btn-play');
        if (btnPlay && btnPlay.parentNode) {
            const trainingBtn = document.createElement('button');
            trainingBtn.id = 'btn-training';
            trainingBtn.className = btnPlay.className; // Usa lo stesso stile di CSS
            trainingBtn.innerText = 'TRAINING';
            trainingBtn.style.marginTop = '15px';
            btnPlay.parentNode.insertBefore(trainingBtn, btnPlay.nextSibling);

            const btnCustomize = document.createElement('button');
            btnCustomize.id = 'btn-customize';
            btnCustomize.className = btnPlay.className;
            btnCustomize.innerText = 'PERSONALIZZA GIOCATORE';
            btnCustomize.style.marginTop = '15px';
            btnPlay.parentNode.insertBefore(btnCustomize, trainingBtn.nextSibling);

            const savedShirt = localStorage.getItem('customShirtColor') || '#ff0000';
            const savedSkin = localStorage.getItem('customSkinColor') || '#ffccaa';
            const savedHairColor = localStorage.getItem('customHairColor') || '#000000';

            // --- MENU PERSONALIZZAZIONE ---
            const customizationMenu = document.createElement('div');
            customizationMenu.id = 'customization-menu';
            customizationMenu.className = this.formationMenu.className;
            customizationMenu.style.display = 'none';
            customizationMenu.style.flexDirection = 'row';
            customizationMenu.style.justifyContent = 'flex-start';
            customizationMenu.style.alignItems = 'center';
            customizationMenu.style.backgroundColor = 'transparent'; // Sfondo trasparente per l'anteprima 3D
            customizationMenu.innerHTML = `
                <div style="background: rgba(0,0,0,0.8); padding: 30px; border-radius: 15px; display: flex; flex-direction: column; align-items: center; gap: 20px; margin-left: 5vw; border: 2px solid #4CAF50; box-shadow: 0 0 20px rgba(76, 175, 80, 0.4); width: 400px; max-height: 80vh; overflow-y: auto;">
                    <h1 style="color: white; font-family: sans-serif; margin-bottom: 5px; font-size: 2.5rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); text-align: center;">CREA IL TUO GIOCATORE</h1>
                    
                    <!-- SEZIONI TABS -->
                    <div style="display: flex; gap: 10px; width: 100%; justify-content: center; margin-bottom: 15px;">
                        <button id="tab-hair" class="menu-btn" style="padding: 10px 15px; font-size: 1rem; width: auto; background-color: #4CAF50;">CAPELLI</button>
                        <button id="tab-colors" class="menu-btn" style="padding: 10px 15px; font-size: 1rem; width: auto; background-color: #222;">COLORI</button>
                    </div>

                    <!-- SEZIONE CAPELLI -->
                    <div id="section-hair" style="display: flex; flex-direction: column; gap: 15px; width: 100%;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <button class="menu-btn btn-hair" data-hair="0" style="padding: 10px; font-size: 1rem; width: 100%; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: white; border-radius: 10px; border: 2px solid transparent; transition: 0.3s;">
                                <div style="width: 100%; height: 70px; display: flex; align-items: center; justify-content: center; font-size: 2rem;">🧑‍🦲</div>
                                <span style="font-size: 0.9rem; margin-top: 5px; color: white;">Nessuno</span>
                            </button>
                            <button class="menu-btn btn-hair" data-hair="1" style="padding: 10px; font-size: 1rem; width: 100%; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: white; border-radius: 10px; border: 2px solid transparent; transition: 0.3s;">
                                <model-viewer src="/models/hair_1.glb" style="width: 100%; height: 70px; background-color: transparent; pointer-events: none;" interaction-prompt="none" disable-zoom auto-rotate></model-viewer>  
                            </button>
                            <button class="menu-btn btn-hair" data-hair="2" style="padding: 10px; font-size: 1rem; width: 100%; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: white; border-radius: 10px; border: 2px solid transparent; transition: 0.3s;">
                                <model-viewer src="/models/hair_2.glb" style="width: 100%; height: 70px; background-color: transparent; pointer-events: none;" interaction-prompt="none" disable-zoom auto-rotate></model-viewer>
                                
                            </button>
                            <button class="menu-btn btn-hair" data-hair="3" style="padding: 10px; font-size: 1rem; width: 100%; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: white; border-radius: 10px; border: 2px solid transparent; transition: 0.3s;">
                                <model-viewer src="/models/hair_3.glb" style="width: 100%; height: 70px; background-color: transparent; pointer-events: none;" interaction-prompt="none" disable-zoom auto-rotate></model-viewer>
                                
                            </button>
                            <button class="menu-btn btn-hair" data-hair="5" style="padding: 10px; font-size: 1rem; width: 100%; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: white; border-radius: 10px; border: 2px solid transparent; transition: 0.3s;">
                                <model-viewer src="/models/hair_5.glb" style="width: 100%; height: 70px; background-color: transparent; pointer-events: none;" interaction-prompt="none" disable-zoom auto-rotate></model-viewer>
                            </button>
                        </div>
                    </div>

                    <!-- SEZIONE COLORI -->
                    <div id="section-colors" style="display: none; flex-direction: column; gap: 20px; width: 100%; font-family: sans-serif;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <label style="color: white; margin-bottom: 10px; font-size: 1.2rem; font-weight: bold;">COLORE MAGLIA</label>
                            <input type="color" id="color-shirt" value="${savedShirt}" style="width: 60px; height: 60px; cursor: pointer; border: 2px solid white; border-radius: 8px; background: none;">
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <label style="color: white; margin-bottom: 10px; font-size: 1.2rem; font-weight: bold;">COLORE PELLE</label>
                            <input type="color" id="color-skin" value="${savedSkin}" style="width: 60px; height: 60px; cursor: pointer; border: 2px solid white; border-radius: 8px; background: none;">
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <label style="color: white; margin-bottom: 10px; font-size: 1.2rem; font-weight: bold;">COLORE CAPELLI</label>
                            <input type="color" id="color-hair" value="${savedHairColor}" style="width: 60px; height: 60px; cursor: pointer; border: 2px solid white; border-radius: 8px; background: none;">
                        </div>
                    </div>

                    <button id="btn-save-customization" class="${btnPlay.className}" style="margin-top: 20px; width: 100%;">SALVA E CONTINUA</button>
                </div>
                <button id="btn-toggle-animation" class="${btnPlay.className}" style="position: absolute; bottom: 30px; right: 30px; font-size: 1.2rem; padding: 15px 30px; background-color: #f44336; border-color: #f44336; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">STOP ANIMAZIONE</button>
            `;
            this.mainMenu.parentNode.appendChild(customizationMenu);
            this.customizationMenu = customizationMenu;

            // --- FORZA IL COLORE NERO SUI MODEL VIEWER DEI CAPELLI ---
            
            const modelViewers = customizationMenu.querySelectorAll('model-viewer');
            modelViewers.forEach(viewer => {
                viewer.addEventListener('load', () => {
                    if (viewer.model && viewer.model.materials) {
                        viewer.model.materials.forEach(material => {
                            if (material.pbrMetallicRoughness) {
                                material.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 1]); // R, G, B, A (Nero opaco)
                            }
                        });
                    }
                });
            });

            // --- EVENTI TABS ---
            const tabHair = document.getElementById('tab-hair');
            const tabColors = document.getElementById('tab-colors');
            const sectionHair = document.getElementById('section-hair');
            const sectionColors = document.getElementById('section-colors');

            tabHair.addEventListener('click', (e) => {
                e.stopPropagation();
                sectionHair.style.display = 'flex';
                sectionColors.style.display = 'none';
                tabHair.style.backgroundColor = '#4CAF50';
                tabColors.style.backgroundColor = '#222';
            });

            tabColors.addEventListener('click', (e) => {
                e.stopPropagation();
                sectionHair.style.display = 'none';
                sectionColors.style.display = 'flex';
                tabColors.style.backgroundColor = '#4CAF50';
                tabHair.style.backgroundColor = '#222';
            });

            // --- EVENTI SCELTA CAPELLI ---
            let selectedHair = localStorage.getItem('customHair') || '0';
            const hairButtons = document.querySelectorAll('.btn-hair');
            hairButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const hairId = btn.getAttribute('data-hair');
                    selectedHair = hairId;
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hair', id: hairId } }));
                });
            });

            // --- EVENTI PREVIEW IN TEMPO REALE ---
            document.getElementById('color-shirt').addEventListener('input', (e) => {
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirt', color: e.target.value } }));
            });
            document.getElementById('color-skin').addEventListener('input', (e) => {
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'skin', color: e.target.value } }));
            });
            document.getElementById('color-hair').addEventListener('input', (e) => {
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hairColor', color: e.target.value } }));
            });

            let isAnimationPaused = false;
            document.getElementById('btn-toggle-animation').addEventListener('click', (e) => {
                e.stopPropagation();
                isAnimationPaused = !isAnimationPaused;
                e.target.innerText = isAnimationPaused ? 'RIPRENDI ANIMAZIONE' : 'STOP ANIMAZIONE';
                e.target.style.backgroundColor = isAnimationPaused ? '#4CAF50' : '#f44336';
                e.target.style.borderColor = isAnimationPaused ? '#4CAF50' : '#f44336';
                document.dispatchEvent(new CustomEvent('toggleCustomizationAnimation', { detail: { paused: isAnimationPaused } }));
            });

            document.getElementById('btn-save-customization').addEventListener('click', (e) => {
                e.stopPropagation();
                
                const shirtColor = document.getElementById('color-shirt').value;
                const skinColor = document.getElementById('color-skin').value;
                const hairColor = document.getElementById('color-hair').value;

                localStorage.setItem('customShirtColor', shirtColor);
                localStorage.setItem('customSkinColor', skinColor);
                localStorage.setItem('customHair', selectedHair);
                localStorage.setItem('customHairColor', hairColor);

                document.dispatchEvent(new CustomEvent('customizePlayer', {
                    detail: { shirtColor, skinColor, hairId: selectedHair, hairColor }
                }));
                document.dispatchEvent(new Event('customizePlayerEnd'));

                this.customizationMenu.style.display = 'none';
                this.mainMenu.style.display = 'flex';
            });

            btnCustomize.addEventListener('click', (e) => {
                e.stopPropagation();
                this.mainMenu.style.display = 'none';
                this.customizationMenu.style.display = 'flex';
                document.dispatchEvent(new Event('customizePlayerStart'));
                
                // Reset bottone e stato animazione
                isAnimationPaused = false;
                const btnAnim = document.getElementById('btn-toggle-animation');
                if (btnAnim) {
                    btnAnim.innerText = 'STOP ANIMAZIONE';
                    btnAnim.style.backgroundColor = '#f44336';
                    btnAnim.style.borderColor = '#f44336';
                }
                document.dispatchEvent(new CustomEvent('toggleCustomizationAnimation', { detail: { paused: false } }));
            });

            const trainingMenu = document.createElement('div');
            trainingMenu.id = 'training-menu';
            trainingMenu.className = this.formationMenu.className;
            trainingMenu.style.display = 'none';
            trainingMenu.style.flexDirection = 'column';
            trainingMenu.style.alignItems = 'center';
            trainingMenu.style.gap = '20px';
            trainingMenu.innerHTML = `
                <h1 style="color: white; font-family: sans-serif; margin-bottom: 20px; font-size: 3rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">TRAINING MODE</h1>
                <button id="btn-train-freekick" class="${btnPlay.className}">PUNIZIONE</button>
                <button id="btn-train-penalty" class="${btnPlay.className}">RIGORE</button>
                <button id="btn-back-training" class="${btnPlay.className}" style="margin-top: 20px;">INDIETRO</button>
            `;
            this.mainMenu.parentNode.appendChild(trainingMenu);

            trainingBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.mainMenu.style.display = 'none';
                trainingMenu.style.display = 'flex';
            });

            document.getElementById('btn-back-training').addEventListener('click', (e) => {
                e.stopPropagation();
                trainingMenu.style.display = 'none';
                this.mainMenu.style.display = 'flex';
            });

            document.getElementById('btn-train-freekick').addEventListener('click', (e) => {
                e.stopPropagation();
                trainingMenu.style.display = 'none';
                this.startGame('freekick');
            });

            document.getElementById('btn-train-penalty').addEventListener('click', (e) => {
                e.stopPropagation();
                trainingMenu.style.display = 'none';
                this.startGame('penalty');
            });
            
            // --- NUOVO: MENU IMPOSTAZIONI METEO E ORARIO ---
            const settingsMenu = document.createElement('div');
            settingsMenu.id = 'settings-menu';
            settingsMenu.className = this.formationMenu.className;
            settingsMenu.style.display = 'none';
            settingsMenu.style.flexDirection = 'column';
            settingsMenu.style.alignItems = 'center';
            settingsMenu.style.gap = '20px';
            settingsMenu.innerHTML = `
                <h1 style="color: white; font-family: sans-serif; margin-bottom: 20px; font-size: 3rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">IMPOSTAZIONI PARTITA</h1>
                <div style="display: flex; gap: 30px; font-family: sans-serif; margin-bottom: 20px;">
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <label style="color: white; margin-bottom: 10px; font-size: 1.5rem; font-weight: bold;">ORARIO</label>
                        <select id="select-time" style="padding: 10px 20px; font-size: 18px; border-radius: 8px; border: 2px solid #4CAF50; background: rgba(0,0,0,0.7); color: white; cursor: pointer; outline: none;">
                            <option value="day">Giorno (Day)</option>
                            <option value="night">Notte (Night)</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <label style="color: white; margin-bottom: 10px; font-size: 1.5rem; font-weight: bold;">METEO</label>
                        <select id="select-weather" style="padding: 10px 20px; font-size: 18px; border-radius: 8px; border: 2px solid #4CAF50; background: rgba(0,0,0,0.7); color: white; cursor: pointer; outline: none;">
                            <option value="clear">Sereno (Clear)</option>
                            <option value="fog">Nebbia (Fog)</option>
                            <option value="rain">Pioggia (Rain)</option>
                            <option value="snow">Neve (Snow)</option>
                        </select>
                    </div>
                </div>
                <button id="btn-next-settings" class="${btnPlay.className}">AVANTI</button>
                <button id="btn-back-settings" class="${btnPlay.className}" style="margin-top: 10px;">INDIETRO</button>
            `;
            this.mainMenu.parentNode.appendChild(settingsMenu);
            this.settingsMenu = settingsMenu;

            document.getElementById('btn-next-settings').addEventListener('click', (e) => {
                e.stopPropagation();
                this.settingsMenu.style.display = 'none';
                this.formationMenu.style.display = 'flex';
                
                const time = document.getElementById('select-time').value;
                const weather = document.getElementById('select-weather').value;
                // Segnala al motore di gioco di aggiornare il meteo
                document.dispatchEvent(new CustomEvent('updateEnvironment', { detail: { time, weather } }));
            });

            document.getElementById('btn-back-settings').addEventListener('click', (e) => {
                e.stopPropagation();
                this.settingsMenu.style.display = 'none';
                this.mainMenu.style.display = 'flex';
            });
        }

        document.getElementById('btn-commands').addEventListener('click', (e) => {
            e.stopPropagation();
            this.mainMenu.style.display = 'none';
            this.commandsMenu.style.display = 'flex';
        });

        document.getElementById('btn-back-commands').addEventListener('click', (e) => {
            e.stopPropagation();
            this.commandsMenu.style.display = 'none';
            
            // Controlla se abbiamo aperto i comandi dal menu di pausa
            if (this.commandsMenu.dataset.fromPause === 'true') {
                document.getElementById('pause-menu').style.display = 'flex';
                document.getElementById('ui-layer').style.zIndex = '10'; // Ripristina lo z-index normale
                this.commandsMenu.dataset.fromPause = 'false';
            } else {
                this.mainMenu.style.display = 'flex';
            }
        });

        document.getElementById('btn-back-formation').addEventListener('click', (e) => {
            e.stopPropagation();
            this.formationMenu.style.display = 'none';
            this.mainMenu.style.display = 'flex';
        });

        document.getElementById('btn-form-21').addEventListener('click', (e) => {
            e.stopPropagation();
            this.startGame('2-1');
        });

        document.getElementById('btn-form-12').addEventListener('click', (e) => {
            e.stopPropagation();
            this.startGame('1-2');
        });

        // --- BOTTONI MENU DI PAUSA ---
        const btnResume = document.getElementById('btn-resume');
        const btnPauseCommands = document.getElementById('btn-pause-commands');
        const btnExit = document.getElementById('btn-exit');
        const pauseMenu = document.getElementById('pause-menu');

        if (btnResume) btnResume.addEventListener('click', (e) => {
            e.stopPropagation();
            document.dispatchEvent(new Event('resumeGame')); // Invia un segnale a main.js
        });

        if (btnPauseCommands) btnPauseCommands.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseMenu.style.display = 'none';
            this.commandsMenu.style.display = 'flex';
            document.getElementById('ui-layer').style.zIndex = '100'; // Porta la UI in primissimo piano
            this.commandsMenu.dataset.fromPause = 'true';
        });

        if (btnExit) btnExit.addEventListener('click', (e) => {
            e.stopPropagation();
            location.reload(); // Ricarica la pagina resettando il gioco
        });
    }

    startGame(formation) {
        this.formationMenu.style.display = 'none';
        this.gameUi.style.display = 'block';
        this.onStartGame(formation); // Passa la formazione al GameLogic
    }

    showInGameMessage(text) {
        let msg = document.getElementById('ingame-message-box');
        if (!msg) {
            msg = document.createElement('div');
            msg.id = 'ingame-message-box';
            document.body.appendChild(msg);
        }
        msg.innerHTML = text;
        msg.style.cssText = `
        position: fixed; 
        bottom: 10%; 
        left: 50%; 
        transform: translateX(-50%);
        color: white; 
        font-size: 50px; 
        font-weight: bold; 
        text-shadow: 2px 2px 10px black;
        pointer-events: none; 
        transition: opacity 1s; 
        z-index: 100; 
        font-family: sans-serif;
        opacity: 1; 
    `;

        if (msg.fadeTimer) clearTimeout(msg.fadeTimer);
        if (msg.removeTimer) clearTimeout(msg.removeTimer);

        msg.fadeTimer = setTimeout(() => { msg.style.opacity = '0'; }, 1000);
        msg.removeTimer = setTimeout(() => { msg.remove(); }, 2000);
    }

    updateHUD(stamina, matchTime, homeScore, awayScore) {
        // Stamina
        this.staminaBarFill.style.width = stamina + '%';
        if (stamina > 50) this.staminaBarFill.style.backgroundColor = '#4CAF50';
        else if (stamina > 20) this.staminaBarFill.style.backgroundColor = '#FFEB3B';
        else this.staminaBarFill.style.backgroundColor = '#F44336';

        // Tempo
        const minutes = Math.floor(matchTime / 60).toString().padStart(2, '0');
        const seconds = Math.floor(matchTime % 60).toString().padStart(2, '0');
        this.timerElement.innerText = `${minutes}:${seconds}`;

        // Score
        this.scoreElement.innerText = `${homeScore} - ${awayScore}`;
    }

    updateRadar(playerModel, playerYaw, ballMesh, ballPosition, bots = []) {
        const FIELD_WIDTH_X = 97;
        const FIELD_LENGTH_Z = 65;

        if (playerModel) {
            let pX = ((playerModel.position.x / FIELD_WIDTH_X) + 0.5) * 100;
            let pZ = ((playerModel.position.z / FIELD_LENGTH_Z) + 0.5) * 100;
            this.radarPlayer.style.left = pX + '%';
            this.radarPlayer.style.top = pZ + '%';
            let rot = playerYaw * (180 / Math.PI);
            this.radarPlayer.style.transform = `translate(-50%, -50%) rotate(${-rot + 180}deg)`;
        }
        if (ballMesh) {
            let bX = ((ballPosition.x / FIELD_WIDTH_X) + 0.5) * 100;
            let bZ = ((ballPosition.z / FIELD_LENGTH_Z) + 0.5) * 100;
            this.radarBall.style.left = bX + '%';
            this.radarBall.style.top = bZ + '%';
        }

        // Gestione punti radar dei bot
        if (!this.botRadarDots) {
            this.botRadarDots = [];
        }

        while (this.botRadarDots.length < bots.length) {
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.backgroundColor = '#2196F3'; // Blu per i bot
            dot.style.borderRadius = '50%';
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.zIndex = '4';
            
            const radarContainer = document.getElementById('radar');
            if (radarContainer) radarContainer.appendChild(dot);
            
            this.botRadarDots.push(dot);
        }

        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            const dot = this.botRadarDots[i];
            if (bot && bot.model) {
                let bX = ((bot.model.position.x / FIELD_WIDTH_X) + 0.5) * 100;
                let bZ = ((bot.model.position.z / FIELD_LENGTH_Z) + 0.5) * 100;
                dot.style.left = bX + '%';
                dot.style.top = bZ + '%';
                dot.style.display = 'block';
            } else {
                dot.style.display = 'none';
            }
        }
    }


    triggerBonusRoulette(finalBonusText, finalBonusClass) {
        const roller = document.getElementById('bonus-roller');
        if (!roller) return;

        // Una lista di bonus "finti" che vedrai scorrere per dare l'illusione della casualità
        const fakeBonuses = [
            "VELOCITÀ FLASH", "MAGNETE", "SCUDO FERREO", "PALLA INFUOCATA", 
            "TACKLE GIGANTE", "INVISIBILITÀ", "TELETRASPORTO"
        ];

        // 1. Resettiamo il rullo
        roller.innerHTML = '';
        roller.style.transition = 'none'; // Spegniamo l'animazione per riportarlo giù
        roller.style.transform = 'translateY(0px)';

        // 2. Riempiamo il rullo con 15 elementi casuali
        const totalItems = 15;
        for (let i = 0; i < totalItems - 1; i++) {
            const randomBonus = fakeBonuses[Math.floor(Math.random() * fakeBonuses.length)];
            const div = document.createElement('div');
            div.className = 'bonus-item bonus-random';
            div.innerText = randomBonus;
            roller.appendChild(div);
        }

        // 3. Aggiungiamo il bonus REALE alla fine della lista
        const finalDiv = document.createElement('div');
        finalDiv.className = `bonus-item ${finalBonusClass}`;
        finalDiv.innerText = finalBonusText;
        roller.appendChild(finalDiv);

        // 4. Forziamo il browser ad aggiornare la grafica prima di far partire l'animazione
        void roller.offsetWidth;

        // 5. Facciamo partire l'animazione! (35px è l'altezza che abbiamo dato nel CSS)
        const scrollDistance = (totalItems - 1) * 35; 
        
        // Usiamo una curva "cubic-bezier" che parte veloce e rallenta molto dolcemente alla fine
        roller.style.transition = 'transform 3s cubic-bezier(0.15, 0.85, 0.3, 1)'; 
        roller.style.transform = `translateY(-${scrollDistance}px)`;
    }

    clearBonus() {
        const roller = document.getElementById('bonus-roller');
        if (!roller) return;
        roller.style.transition = 'none';
        roller.style.transform = 'translateY(0px)';
        roller.innerHTML = '<div class="bonus-item bonus-empty">NESSUNO</div>';
    }

    showReplayUI(isActive) {
        let replayIcon = document.getElementById('replay-indicator');
        
        // Recuperiamo gli elementi della UI dal DOM
        const radar = document.getElementById('radar');
        const stamina = document.getElementById('stamina-container');
        const boost = document.getElementById('boost-container');
        
        // Opzionale: se vuoi nascondere anche i bonus e il tabellone durante il replay
        const bonusHud = document.getElementById('bonus-hud'); 
        
        if (isActive) {
            // --- MOSTRA SCRITTA REPLAY ---
            if (!replayIcon) {
                replayIcon = document.createElement('div');
                replayIcon.id = 'replay-indicator';
                replayIcon.innerHTML = '<span style="animation: blinker 1s linear infinite; display: inline-block;">🔴 REPLAY</span><br><span style="font-size: 16px; color: white; font-weight: normal; text-shadow: 1px 1px 0 #000;">PRESS SPACEBAR TO SKIP</span>';
                replayIcon.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    color: red;
                    font-size: 30px;
                    font-weight: bold;
                    font-family: sans-serif;
                    text-shadow: 2px 2px 0 #000;
                    z-index: 1000;
                `;
                const style = document.createElement('style');
                style.innerHTML = `@keyframes blinker { 50% { opacity: 0; } }`;
                document.head.appendChild(style);
                document.body.appendChild(replayIcon);
            } else {
                replayIcon.innerHTML = '<span style="animation: blinker 1s linear infinite; display: inline-block;">🔴 REPLAY</span><br><span style="font-size: 16px; color: white; font-weight: normal; text-shadow: 1px 1px 0 #000;">PRESS SPACEBAR TO SKIP</span>';
            }
            replayIcon.style.display = 'block';

            // --- NASCONDI L'HUD ---
            if (radar) radar.style.display = 'none';
            if (stamina) stamina.style.display = 'none';
            if (boost) boost.style.display = 'none';
            if (bonusHud) bonusHud.style.display = 'none';

        } else {
            // --- NASCONDI SCRITTA REPLAY ---
            if (replayIcon) {
                replayIcon.style.display = 'none';
            }

            // --- RIATTIVA L'HUD ---
            // Usiamo '' (stringa vuota) per rimuovere lo stile inline 
            // e far tornare le regole CSS originali del tuo file style.css
            if (radar) radar.style.display = '';
            if (stamina) stamina.style.display = '';
            if (boost) boost.style.display = '';
            if (bonusHud) bonusHud.style.display = '';
        }
    }
}