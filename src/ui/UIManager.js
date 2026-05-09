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
        THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const percentuale = (itemsLoaded / itemsTotal) * 100;
            this.loadingBarFill.style.width = percentuale + '%';
            this.loadingText.innerText = Math.floor(percentuale) + '%';
        };
        THREE.DefaultLoadingManager.onLoad = () => {
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
                this.mainMenu.style.display = 'flex';
            }, 500);
        };
    }

    setupEventListeners() {
        document.getElementById('btn-play').addEventListener('click', (e) => {
            e.stopPropagation();
            this.mainMenu.style.display = 'none';
            this.formationMenu.style.display = 'flex';
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