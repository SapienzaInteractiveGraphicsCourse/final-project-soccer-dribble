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
        this.globalSettingsMenu = document.getElementById('global-settings-menu');
        this.formationMenu = document.getElementById('formation-menu');
        this.gameUi = document.getElementById('game-ui');
        this.blocker = document.getElementById('blocker');
        this.staminaBarFill = document.getElementById('stamina-bar-fill');
        this.timerElement = document.getElementById('timer');
        this.radarPlayer = document.getElementById('radar-player');
        this.radarBall = document.getElementById('radar-ball');
        this.scoreElement = document.querySelector('.score');
        this.hudPlayerName = document.getElementById('hud-player-name');

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

            const savedShirtColor = localStorage.getItem('customShirtColor');
            const savedShirtTeam = localStorage.getItem('customShirtTeam') || 'custom';
            const alreadyCustomized = savedShirtColor !== null; // true se esiste già una personalizzazione salvata

            setTimeout(() => {
                this.loadingScreen.style.display = 'none';

                const shirtColor = savedShirtColor || '#ff0000';
                const skinColor = localStorage.getItem('customSkinColor') || '#ffccaa';
                const hairId = localStorage.getItem('customHair') || '0';
                const accessoryId = localStorage.getItem('customAccessory') || '0';
                const hairColor = localStorage.getItem('customHairColor') || '#000000';
                const hatId = localStorage.getItem('customHat') || '0';

                if (alreadyCustomized) {
                    // Personalizzazione già presente: applica in background e vai al main menu
                    document.dispatchEvent(new CustomEvent('customizePlayer', {
                        detail: { shirtTeam: savedShirtTeam, shirtColor, skinColor, hairId, accessoryId, hairColor, hatId }
                    }));
                    this.mainMenu.style.display = 'flex';
                } else {
                    // Prima volta: apri il menu di personalizzazione
                    this.customizationMenu.style.display = 'flex';
                    document.dispatchEvent(new Event('customizePlayerStart'));

                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirtTeam', id: savedShirtTeam } }));
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirt', color: shirtColor } }));
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'skin', color: skinColor } }));
                    // I capelli vengono applicati solo se c'è una scelta salvata diversa da '0'
                    if (hairId !== '0') {
                        document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hair', id: hairId } }));
                    }
                    if (accessoryId !== '0') {
                        document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'accessory', id: accessoryId } }));
                    }
                    if (hatId !== '0') {
                        document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hat', id: hatId } }));
                    }
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hairColor', color: hairColor } }));
                }
            }, 500);
        };
    }

    setupEventListeners() {
        document.getElementById('btn-play').addEventListener('click', (e) => {
            e.stopPropagation();
            this.mainMenu.style.display = 'none';
            this.settingsMenu.style.display = 'flex';
        });

        const btnPlay = document.getElementById('btn-play');
        const trainingBtn = document.getElementById('btn-training');
        const btnCustomize = document.getElementById('btn-customize');

        if (btnPlay && trainingBtn && btnCustomize) {
            const savedShirtColor = localStorage.getItem('customShirtColor') || '#ff0000';
            const savedShirtTeam = localStorage.getItem('customShirtTeam') || 'custom';
            const savedSkin = localStorage.getItem('customSkinColor') || '#ffccaa';
            const savedHairColor = localStorage.getItem('customHairColor') || '#000000';

            const customizationMenu = document.getElementById('customization-menu');
            this.customizationMenu = customizationMenu;

            const colorShirtInput = document.getElementById('color-shirt');
            const colorSkinInput = document.getElementById('color-skin');
            const colorHairInput = document.getElementById('color-hair');
            
            if(colorShirtInput) {
                colorShirtInput.value = savedShirtColor;
                colorShirtInput.style.display = savedShirtTeam === 'custom' ? 'block' : 'none';
            }
            if(colorSkinInput) colorSkinInput.value = savedSkin;
            if(colorHairInput) colorHairInput.value = savedHairColor;

            // --- FORZA IL COLORE NERO SUI MODEL VIEWER DEI CAPELLI ---
            
            const modelViewers = customizationMenu.querySelectorAll('.btn-hair model-viewer, .btn-hat model-viewer');
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
            const tabHats = document.getElementById('tab-hats');
            const tabAccessories = document.getElementById('tab-accessories');
            const tabColors = document.getElementById('tab-colors');
            const tabFace = document.getElementById('tab-face');
            const sectionHair = document.getElementById('section-hair');
            const sectionHats = document.getElementById('section-hats');
            const sectionAccessories = document.getElementById('section-accessories');
            const sectionColors = document.getElementById('section-colors');
            const sectionFace = document.getElementById('section-face');

            const _setActiveTab = (activeTab) => {
                // Reset tutti
                tabHair.style.backgroundColor = '#222';
                tabHats.style.backgroundColor = '#222';
                tabAccessories.style.backgroundColor = '#222';
                tabColors.style.backgroundColor = '#222';
                tabFace.style.backgroundColor = '#222';
                sectionHair.style.display = 'none';
                sectionHats.style.display = 'none';
                sectionAccessories.style.display = 'none';
                sectionColors.style.display = 'none';
                sectionFace.style.display = 'none';
                // Attiva quello scelto
                activeTab.btn.style.backgroundColor = '#4CAF50';
                activeTab.section.style.display = 'flex';
                // Notifica cambio tab
                document.dispatchEvent(new CustomEvent('customizationTabChanged', { detail: { tab: activeTab.id } }));
            };

            tabHair.addEventListener('click', (e) => {
                e.stopPropagation();
                _setActiveTab({ btn: tabHair, section: sectionHair, id: 'hair' });
            });

            tabHats.addEventListener('click', (e) => {
                e.stopPropagation();
                _setActiveTab({ btn: tabHats, section: sectionHats, id: 'hats' });
            });

            tabAccessories.addEventListener('click', (e) => {
                e.stopPropagation();
                _setActiveTab({ btn: tabAccessories, section: sectionAccessories, id: 'accessories' });
            });

            tabColors.addEventListener('click', (e) => {
                e.stopPropagation();
                _setActiveTab({ btn: tabColors, section: sectionColors, id: 'colors' });
            });

            tabFace.addEventListener('click', (e) => {
                e.stopPropagation();
                _setActiveTab({ btn: tabFace, section: sectionFace, id: 'face' });
            });

            // Reset a CAPELLI all'apertura
            _setActiveTab({ btn: tabHair, section: sectionHair, id: 'hair' });

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

            // --- EVENTI SCELTA ACCESSORI ---
            let selectedAccessory = localStorage.getItem('customAccessory') || '0';
            const accessoryButtons = document.querySelectorAll('.btn-accessory');
            accessoryButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const accId = btn.getAttribute('data-accessory');
                    selectedAccessory = accId;
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'accessory', id: accId } }));
                });
            });

            // --- EVENTI SCELTA CAPPELLI ---
            let selectedHat = localStorage.getItem('customHat') || '0';
            const hatButtons = document.querySelectorAll('.btn-hat');
            hatButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const hatId = btn.getAttribute('data-hat');
                    selectedHat = hatId;
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hat', id: hatId } }));
                });
            });

            // --- EVENTI SCELTA MAGLIA SQUADRA ---
            let selectedShirtTeam = localStorage.getItem('customShirtTeam') || 'custom';
            const shirtButtons = document.querySelectorAll('.btn-shirt');
            const colorShirtInputEl = document.getElementById('color-shirt');
            
            const updateShirtUI = () => {
                shirtButtons.forEach(b => {
                    b.style.border = b.getAttribute('data-shirt') === selectedShirtTeam ? '3px solid #000' : 'none';
                });
                if (colorShirtInputEl) {
                    colorShirtInputEl.style.display = selectedShirtTeam === 'custom' ? 'block' : 'none';
                }
            };
            updateShirtUI();

            shirtButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedShirtTeam = btn.getAttribute('data-shirt');
                    updateShirtUI();
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirtTeam', id: selectedShirtTeam } }));
                    if (selectedShirtTeam === 'custom') {
                        document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirt', color: colorShirtInputEl.value } }));
                    }
                });
            });

            // --- EVENTI PREVIEW IN TEMPO REALE ---
            document.getElementById('color-shirt').addEventListener('input', (e) => {
                if (selectedShirtTeam === 'custom') {
                    document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirt', color: e.target.value } }));
                }
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

            document.getElementById('btn-reset-customization').addEventListener('click', (e) => {
                e.stopPropagation();

                // Reset valori di default
                const defaultShirtColor = '#ff0000';
                const defaultShirtTeam = 'custom';
                const defaultSkin = '#ffccaa';
                const defaultHairColor = '#000000';
                selectedHair = '0';
                selectedAccessory = '0';
                selectedHat = '0';
                selectedShirtTeam = defaultShirtTeam;

                // Aggiorna visivamente i color picker e i bottoni
                document.getElementById('color-shirt').value = defaultShirtColor;
                updateShirtUI();
                document.getElementById('color-skin').value = defaultSkin;
                document.getElementById('color-hair').value = defaultHairColor;

                // Applica le preview
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirtTeam', id: defaultShirtTeam } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'shirt', color: defaultShirtColor } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'skin', color: defaultSkin } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hair', id: '0' } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'accessory', id: '0' } }));
                document.dispatchEvent(new CustomEvent('previewCustomization', { detail: { type: 'hat', id: '0' } }));

                // Deseleziona tutti i bottoni capello e seleziona "Nessuno"
                document.querySelectorAll('.btn-hair').forEach(b => {
                    b.style.border = '2px solid transparent';
                    b.style.backgroundColor = 'white';
                });
                const noneBtn = document.querySelector('.btn-hair[data-hair="0"]');
                if (noneBtn) {
                    noneBtn.style.border = '2px solid #4CAF50';
                    noneBtn.style.backgroundColor = '#e8f5e9';
                }

                // Deseleziona tutti gli accessori e seleziona "Nessuno"
                document.querySelectorAll('.btn-accessory').forEach(b => {
                    b.style.border = '2px solid transparent';
                    b.style.backgroundColor = 'white';
                });
                const noneAccBtn = document.querySelector('.btn-accessory[data-accessory="0"]');
                if (noneAccBtn) {
                    noneAccBtn.style.border = '2px solid #4CAF50';
                    noneAccBtn.style.backgroundColor = '#e8f5e9';
                }

                // Deseleziona tutti i cappelli e seleziona "Nessuno"
                document.querySelectorAll('.btn-hat').forEach(b => {
                    b.style.border = '2px solid transparent';
                    b.style.backgroundColor = 'white';
                });
                const noneHatBtn = document.querySelector('.btn-hat[data-hat="0"]');
                if (noneHatBtn) {
                    noneHatBtn.style.border = '2px solid #4CAF50';
                    noneHatBtn.style.backgroundColor = '#e8f5e9';
                }

                // Invia evento di reset al motore
                document.dispatchEvent(new Event('resetCustomization'));
            });

            // --- RESET VISO ---
            const btnResetFace = document.getElementById('btn-reset-face');
            if (btnResetFace) {
                btnResetFace.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.dispatchEvent(new Event('resetFaceSculpting'));
                });
            }

            document.getElementById('btn-save-customization').addEventListener('click', (e) => {
                e.stopPropagation();
                
                const shirtColor = document.getElementById('color-shirt').value;
                const skinColor = document.getElementById('color-skin').value;
                const hairColor = document.getElementById('color-hair').value;

                localStorage.setItem('customShirtColor', shirtColor);
                localStorage.setItem('customShirtTeam', selectedShirtTeam);
                localStorage.setItem('customSkinColor', skinColor);
                localStorage.setItem('customHair', selectedHair);
                localStorage.setItem('customAccessory', selectedAccessory);
                localStorage.setItem('customHairColor', hairColor);
                localStorage.setItem('customHat', selectedHat);

                document.dispatchEvent(new CustomEvent('customizePlayer', {
                    detail: { shirtTeam: selectedShirtTeam, shirtColor, skinColor, hairId: selectedHair, accessoryId: selectedAccessory, hairColor, hatId: selectedHat }
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

            const trainingMenu = document.getElementById('training-menu');

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
            
            // --- MENU IMPOSTAZIONI METEO E ORARIO ---
            const settingsMenu = document.getElementById('settings-menu');
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

        const btnGlobalSettings = document.getElementById('btn-global-settings');
        if (btnGlobalSettings) {
            btnGlobalSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.mainMenu.style.display = 'none';
                this.globalSettingsMenu.style.display = 'flex';
            });
        }

        const btnBackGlobalSettings = document.getElementById('btn-back-global-settings');
        if (btnBackGlobalSettings) {
            btnBackGlobalSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.globalSettingsMenu.style.display = 'none';
                
                if (this.globalSettingsMenu.dataset.fromPause === 'true') {
                    document.getElementById('pause-menu').style.display = 'flex';
                    document.getElementById('ui-layer').style.zIndex = '10'; // Ripristina lo z-index normale
                    this.globalSettingsMenu.dataset.fromPause = 'false';
                } else {
                    this.mainMenu.style.display = 'flex';
                }
            });
        }

        // Event listeners for global settings sliders
        const sliderGraphics = document.getElementById('slider-graphics');
        const sliderSensX = document.getElementById('slider-sens-x');
        const sliderSensY = document.getElementById('slider-sens-y');
        
        if (sliderGraphics) {
            sliderGraphics.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                const labels = ["Bassa", "Media", "Alta"];
                document.getElementById('val-graphics').innerText = labels[val];
                if (window.gameSettings) {
                    window.gameSettings.graphicsQuality = val;
                    if (window.applyGraphicsQuality) {
                        window.applyGraphicsQuality(val);
                    }
                }
            });
        }
        
        if (sliderSensX) {
            sliderSensX.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value).toFixed(1);
                document.getElementById('val-sens-x').innerText = val;
                if (window.gameSettings) window.gameSettings.sensitivityX = parseFloat(val);
            });
        }
        
        if (sliderSensY) {
            sliderSensY.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value).toFixed(1);
                document.getElementById('val-sens-y').innerText = val;
                if (window.gameSettings) window.gameSettings.sensitivityY = parseFloat(val);
            });
        }

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
        const btnPauseSettings = document.getElementById('btn-pause-settings');
        const btnExit = document.getElementById('btn-exit');
        const btnSubstitutions = document.getElementById('btn-substitutions');
        const btnCloseSubstitutions = document.getElementById('btn-close-substitutions');
        const pauseMenu = document.getElementById('pause-menu');
        const substitutionsMenu = document.getElementById('substitutions-menu');

        if (btnResume) btnResume.addEventListener('click', (e) => {
            e.stopPropagation();
            document.dispatchEvent(new Event('resumeGame')); // Invia un segnale a main.js
        });

        if (btnSubstitutions) btnSubstitutions.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseMenu.style.display = 'none';
            this.blocker.style.display = 'none';
            document.getElementById('ui-layer').style.zIndex = '100';
            substitutionsMenu.style.display = 'flex';
            document.dispatchEvent(new Event('openSubstitutions'));
        });

        if (btnCloseSubstitutions) btnCloseSubstitutions.addEventListener('click', (e) => {
            e.stopPropagation();
            substitutionsMenu.style.display = 'none';
            document.getElementById('ui-layer').style.zIndex = '10';
            this.blocker.style.display = 'flex';
            pauseMenu.style.display = 'flex';
        });

        if (btnPauseCommands) btnPauseCommands.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseMenu.style.display = 'none';
            this.commandsMenu.style.display = 'flex';
            document.getElementById('ui-layer').style.zIndex = '100'; // Porta la UI in primissimo piano
            this.commandsMenu.dataset.fromPause = 'true';
        });

        if (btnPauseSettings) btnPauseSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseMenu.style.display = 'none';
            this.globalSettingsMenu.style.display = 'flex';
            document.getElementById('ui-layer').style.zIndex = '100';
            this.globalSettingsMenu.dataset.fromPause = 'true';
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
        if (!msg) return;
        
        msg.innerHTML = text;
        msg.style.opacity = ''; // Remove inline opacity to let CSS handle it
        msg.classList.add('show');

        if (msg.fadeTimer) clearTimeout(msg.fadeTimer);

        msg.fadeTimer = setTimeout(() => { 
            msg.classList.remove('show'); 
        }, 2500); // 2.5s display time
    }

    updateHUD(playerName, stamina, matchTime, homeScore, awayScore) {
        if (this.hudPlayerName) this.hudPlayerName.innerText = playerName;
        
        // Stamina
        this.staminaBarFill.style.width = stamina + '%';
        if (stamina > 50) this.staminaBarFill.style.backgroundColor = '#4CAF50';
        else if (stamina > 20) this.staminaBarFill.style.backgroundColor = '#FFEB3B';
        else this.staminaBarFill.style.backgroundColor = '#F44336';
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
        const playerNameHud = document.getElementById('player-name-hud');
        
        // Opzionale: se vuoi nascondere anche i bonus e il tabellone durante il replay
        const bonusHud = document.getElementById('bonus-hud'); 
        
        if (isActive) {
            // --- MOSTRA SCRITTA REPLAY ---
            if (replayIcon) replayIcon.style.display = 'block';

            // --- NASCONDI L'HUD ---
            if (radar) radar.style.display = 'none';
            if (stamina) stamina.style.display = 'none';
            if (boost) boost.style.display = 'none';
            if (bonusHud) bonusHud.style.display = 'none';
            if (playerNameHud) playerNameHud.style.display = 'none';

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
            if (playerNameHud) playerNameHud.style.display = '';
        }
    }
}