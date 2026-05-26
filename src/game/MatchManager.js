import * as THREE from 'three';


export class MatchManager {
    constructor(camera, ball, player, teammates, bots, homeGK, awayGK, uiManager) {
        this.camera = camera;
        this.ball = ball;
        this.player = player;
        this.teammates = teammates;
        this.bots = bots;
        this.homeGK = homeGK;
        this.awayGK = awayGK;
        this.uiManager = uiManager;

        // Stato Partita
        this.isGameStarted = false;
        this.gameMode = 'match';
        this.currentFormation = null;
        this.playerTeam = 'home';
        this.lastTouchedTeam = 'home';
        this.kickOffTeam = 'home';
        this.homeScore = 0;
        this.awayScore = 0;
        this.isCelebrating = false;

        this.isControllingGK = false;
        this.controlledGK = null;

        // Entità attive per il controllo
        this.currentT1 = teammates[0];
        this.currentT2 = teammates[1];
        this.currentO1 = bots[0];
        this.currentO2 = bots[1];
        this.currentO3 = bots[2];

        // Assegna i compagni al player per il sistema di passaggio
        this.player.teammates = [this.currentT1, this.currentT2];

        this.setupInputHandling();
        this.setupSetPieceEvents();
        this.setupPassEvent();
        this.setupAutoSwitchEvent(); // <--- AGGIUNGI QUESTO

        /* --- AUDIO DI SOTTOFONDO (STADIO / MUSICA) ---
        // this.bgMusic = new Audio(`${import.meta.env.BASE_URL}sound/confusion.mp3`);
        this.bgMusic.loop = true; // Va a ripetizione all'infinito
        this.bgMusic.volume = 0.4; // Volume al 40% per non coprire troppo il suono dei calci
        
        this.bgMusic.play().catch(e => {
            const startAudio = () => {
                this.bgMusic.play().catch(() => {});
                // Rimuoviamo tutti i listener una volta che l'audio è partito
                ['click', 'mousedown', 'keydown'].forEach(evt => document.removeEventListener(evt, startAudio));
            };
            // Ci mettiamo in ascolto di qualsiasi interazione (tastiera o mouse)
            ['click', 'mousedown', 'keydown'].forEach(evt => document.addEventListener(evt, startAudio));
        });*/
    }

    setupAutoSwitchEvent() {
        document.addEventListener('autoSwitchRequested', (e) => {
            // Blocca lo switch automatico negli allenamenti o se stai usando il portiere
            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return;
            if (this.isControllingGK) return;

            const targetTeammate = e.detail.target;
            if (targetTeammate && targetTeammate.model) {
                this.switchCharacter(targetTeammate);
            }
        });
    }

    setupSetPieceEvents() {
        document.addEventListener('cornerKicked', () => {
            if (!this.ball.mesh || !this.currentT1.model || !this.currentT2.model) return;

            // --- FIX PORTIERE ---
            // Lasciamo fare tutto a restoreGoalkeeper() che gestisce correttamente anche l'IA
            this.restoreGoalkeeper();

            // Normale auto-switch all'attaccante per ricevere la palla
            const distT1 = this.currentT1.model.position.distanceTo(this.ball.position);
            const distT2 = this.currentT2.model.position.distanceTo(this.ball.position);
            const targetTeammate = distT1 < distT2 ? this.currentT1 : this.currentT2;
            this.switchCharacter(targetTeammate);
        });

        document.addEventListener('goalKicked', () => {
            if (!this.ball.mesh || !this.currentT1.model || !this.currentT2.model) return;

            this.restoreGoalkeeper();

            const distT1 = this.currentT1.model.position.distanceTo(this.ball.position);
            const distT2 = this.currentT2.model.position.distanceTo(this.ball.position);
            const targetTeammate = distT1 < distT2 ? this.currentT1 : this.currentT2;
            this.switchCharacter(targetTeammate);
        });
    }

    setupPassEvent() {
        document.addEventListener('passExecuted', (e) => {
            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return;
            const targetTeammate = e.detail.target;
            if (targetTeammate && targetTeammate.model) {
                this.switchCharacter(targetTeammate);
            }
        });
    }

    setupInputHandling() {
        document.addEventListener('keydown', (e) => {
            const isGameActive = this.player.controls.isLocked || (this.player.isTouchDevice && document.getElementById('touch-controls').style.display !== 'none');
            if (!isGameActive) return;

            // Tasto rapido per rimettere a posto la palla in allenamento
            if (e.code === 'KeyR' && (this.gameMode === 'penalty' || this.gameMode === 'freekick')) {
                this.startGame(this.gameMode);
                this.uiManager.showInGameMessage("PALLA RIPOSIZIONATA");
            }

            if (e.code === 'KeyE') {
                if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return; // Blocca cambio in allenamento
                if (this.isControllingGK) return; // BLOCCO: Non puoi cambiare giocatore mentre rinvii
                if (!this.ball.mesh || !this.currentT1.model || !this.currentT2.model) return;

                const distT1 = this.currentT1.model.position.distanceTo(this.ball.position);
                const distT2 = this.currentT2.model.position.distanceTo(this.ball.position);
                this.switchCharacter(distT1 < distT2 ? this.currentT1 : this.currentT2);
            }
            else if (e.code === 'KeyT') {
                if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return; // Blocca scivolata in allenamento
                if (this.isControllingGK) return; // Il portiere non scivola
                if (this.player && this.player.animator) {
                    this.player.animator.triggerSlide();
                }
            }
        });
    }

    switchCharacter(teammate) {
        if (!this.player.model || !teammate.model) return;
        document.dispatchEvent(new CustomEvent('bonusCleared'));
        // --- INIZIO FIX: RESET BONUS AL CAMBIO GIOCATORE ---
        if (this.player.action && (this.player.action.hasSuperShot || this.player.action.hasElectricShot)) {
            this.player.action.hasSuperShot = false;
            this.player.action.hasElectricShot = false;

            // Spegne il bagliore (glow) dal vecchio corpo
            if (this.player.action.glowingModel) {
                this.player.action.glowingModel.traverse((child) => {
                    if (child.isMesh && child.material && child.userData.originalEmissive) {
                        child.material.emissive.copy(child.userData.originalEmissive);
                        child.material.emissiveIntensity = 1.0;
                        delete child.userData.originalEmissive;
                    }
                });
                this.player.action.glowingModel = null;
            }

            // Spegne la palla infuocata
            if (window.fireTrailEffect) {
                window.fireTrailEffect.deactivate();
            }
        }


        this.player.action.chargingAction = null;
        this.player.action.isThrowingIn = false;

        this.player.animator.cancelCharge();
        teammate.animator.cancelCharge();

        const tempModel = this.player.model;
        this.player.model = teammate.model;
        teammate.model = tempModel;


        const tempAnimator = this.player.animator;
        this.player.animator = teammate.animator;
        teammate.animator = tempAnimator;

        const tempYaw = this.player.yaw;
        this.player.yaw = teammate.yaw;
        teammate.yaw = tempYaw;

        if (teammate.boost === undefined) {
            teammate.boost = 0;
        }

        // Scambiamo la percentuale di boost tra te e il compagno
        const tempBoost = this.player.boost;
        this.player.boost = teammate.boost;
        teammate.boost = tempBoost;

        if (this.ball && this.ball.mesh) {
            const targetYaw = Math.atan2(
                this.ball.position.x - this.player.model.position.x,
                this.ball.position.z - this.player.model.position.z
            );
            this.player.yaw = targetYaw;
            this.player.model.rotation.y = targetYaw;
        }

        const offset = this.player.cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
        this.camera.position.copy(this.player.model.position.clone().add(offset));

        const cameraTarget = this.player.model.position.clone();
        cameraTarget.y += 1.5;
        this.camera.lookAt(cameraTarget);
    }


    startGame(mode) {
        this.gameMode = mode;
        this.player.isTraining = (mode === 'penalty' || mode === 'freekick'); // Imposta lo stato di allenamento

        if (mode === '2-1' || mode === '1-2') {
            this.currentFormation = mode;
            this.resetKickOff();
        } else if (mode === 'penalty') {
            this.setupPenalty();
            this.uiManager.showInGameMessage("ALLENAMENTO RIGORI<br><span style='font-size:20px'>Premi 'R' per riposizionare</span>");
        } else if (mode === 'freekick') {
            this.setupFreeKick();
            this.uiManager.showInGameMessage("ALLENAMENTO PUNIZIONI<br><span style='font-size:20px'>Premi 'R' per riposizionare</span>");
        }

        // Reset Telecamera dietro al giocatore
        const offset = this.player.cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
        this.camera.position.copy(this.player.model.position.clone().add(offset));
        const cameraTarget = this.player.model.position.clone();
        cameraTarget.y += 1.5;
        this.camera.lookAt(cameraTarget);
    }

    setupPenalty() {
        this.playerTeam = 'home';
        this.homeScore = 0;
        this.awayScore = 0;

        // Dischetto del rigore
        this.ball.position.set(37.5, this.ball.radius, 0);
        this.ball.velocity.set(0, 0, 0);
        this.ball.isGoal = false;
        this.ball.isOut = false;
        this.ball.isOutBaseline = false;
        this.ball.isElectricShot = false;
        this.ball.isPowerShot = false;
        this.ball.spin = 0;

        if (this.player.model) {
            this.player.model.position.set(34, 0, 0);
            const targetYaw = Math.PI / 2; // Guarda la porta
            this.player.model.rotation.y = targetYaw;
            this.player.yaw = targetYaw;
        }

        // Manda gli altri giocatori sotto il campo per nasconderli
        [this.currentT1, this.currentT2, this.currentO1, this.currentO2, this.currentO3].forEach(npc => {
            if (npc.model) npc.model.position.set(0, -100, 0);
        });

        // Posiziona il portiere nemico sulla linea e nascondi il nostro
        if (this.awayGK.model) {
            this.awayGK.model.position.set(48.5, 0, 0);
            this.awayGK.model.rotation.y = 3 / 2 * Math.PI;
            this.awayGK.yaw = 3 / 2 * Math.PI;
            this.awayGK.isSwappedOut = false;
        }
        if (this.homeGK.model) { this.homeGK.model.position.set(-48.5, -100, 0); }
    }

    setupFreeKick() {
        this.playerTeam = 'home';
        this.homeScore = 0;
        this.awayScore = 0;

        // Zona limite area, angolata
        const ballX = 25.0;
        const ballZ = -12.0;
        this.ball.position.set(ballX, this.ball.radius, ballZ);
        this.ball.velocity.set(0, 0, 0);
        this.ball.isGoal = false;
        this.ball.isOut = false;
        this.ball.isOutBaseline = false;
        this.ball.isElectricShot = false;
        this.ball.isPowerShot = false;
        this.ball.spin = 0;

        if (this.player.model) {
            this.player.model.position.set(21.0, 0, ballZ - 2.0);
            const targetYaw = Math.atan2(48.5 - 21.0, 0 - (ballZ - 2.0));
            this.player.model.rotation.y = targetYaw;
            this.player.yaw = targetYaw;
        }

        // Crea la barriera! (Usiamo i Bot)
        if (this.currentO1.model) { this.currentO1.model.position.set(34, 0, -6); this.currentO1.model.rotation.y = 3 / 2 * Math.PI; }
        if (this.currentO2.model) { this.currentO2.model.position.set(34, 0, -7.5); this.currentO2.model.rotation.y = 3 / 2 * Math.PI; }
        if (this.currentO3.model) { this.currentO3.model.position.set(34, 0, -9); this.currentO3.model.rotation.y = 3 / 2 * Math.PI; }

        [this.currentT1, this.currentT2].forEach(npc => {
            if (npc.model) npc.model.position.set(0, -100, 0);
        });

        if (this.awayGK.model) {
            this.awayGK.model.position.set(48.5, 0, 0);
            this.awayGK.model.rotation.y = 3 / 2 * Math.PI;
            this.awayGK.yaw = 3 / 2 * Math.PI;
            this.awayGK.isSwappedOut = false;
        }
        if (this.homeGK.model) { this.homeGK.model.position.set(-48.5, -100, 0); }
    }

    resetKickOff() {
        this.ball.position.set(0, this.ball.radius, 0);
        this.ball.velocity.set(0, 0, 0);
        this.ball.isGoal = false;
        this.ball.isOut = false;
        this.ball.isOutBaseline = false;
        this.ball.isElectricShot = false;
        this.ball.isPowerShot = false;
        this.ball.spin = 0;

        if (this.currentFormation === '2-1' || this.currentFormation === '1-2') {
            if (this.kickOffTeam === 'home') {
                if (this.player.model) {
                    this.player.model.position.set(-1.5, 0, 0);
                    this.player.yaw = Math.PI / 2;
                    this.player.model.rotation.y = Math.PI / 2;
                }
                if (this.currentT1.model) { this.currentT1.model.position.set(-15, 0, 15); }
                if (this.currentT2.model) { this.currentT2.model.position.set(-15, 0, -15); }

                if (this.currentO1.model) { this.currentO1.model.position.set(10.5, 0, 0); this.currentO1.model.rotation.y = 3 / 2 * Math.PI; this.currentO1.yaw = 3 / 2 * Math.PI; }
                if (this.currentO2.model) { this.currentO2.model.position.set(20, 0, -15); this.currentO2.model.rotation.y = 3 / 2 * Math.PI; this.currentO2.yaw = 3 / 2 * Math.PI; }
                if (this.currentO3.model) { this.currentO3.model.position.set(20, 0, 15); this.currentO3.model.rotation.y = 3 / 2 * Math.PI; this.currentO3.yaw = 3 / 2 * Math.PI; }
            } else {
                // Il team 'away' (Bot) batte il calcio d'inizio
                if (this.player.model) {
                    this.player.model.position.set(-10.5, 0, 0);
                    this.player.yaw = Math.PI / 2;
                    this.player.model.rotation.y = Math.PI / 2;
                }
                if (this.currentT1.model) { this.currentT1.model.position.set(-20, 0, 15); }
                if (this.currentT2.model) { this.currentT2.model.position.set(-20, 0, -15); }

                if (this.currentO1.model) { 
                    this.currentO1.model.position.set(1.5, 0, 0); 
                    this.currentO1.model.rotation.y = 3 / 2 * Math.PI; 
                    this.currentO1.yaw = 3 / 2 * Math.PI;
                    this.currentO1.startKickOff(this.currentO2); // Inizia l'azione
                }
                if (this.currentO2.model) { this.currentO2.model.position.set(15, 0, -15); this.currentO2.model.rotation.y = 3 / 2 * Math.PI; this.currentO2.yaw = 3 / 2 * Math.PI; }
                if (this.currentO3.model) { this.currentO3.model.position.set(15, 0, 15); this.currentO3.model.rotation.y = 3 / 2 * Math.PI; this.currentO3.yaw = 3 / 2 * Math.PI; }
            }

            if (this.homeGK.model) {
                this.homeGK.model.position.set(-48.5, 0, 0);
                this.homeGK.model.rotation.y = Math.PI / 2;
                this.homeGK.yaw = Math.PI / 2;
            }
            if (this.awayGK.model) {
                this.awayGK.model.position.set(48.5, 0, 0);
                this.awayGK.model.rotation.y = 3 / 2 * Math.PI;
                this.awayGK.yaw = 3 / 2 * Math.PI;
            }
        }
    }

    updateRules() {
        // Tracker dell'ultimo tocco
        // Tracker dell'ultimo tocco e Logica Dinamica Fuoco
        if (!this.ball.isHeld) {
            const trackingRadius = 1.3; // Raggio entro cui consideriamo un "tocco"
            let closestDist = trackingRadius;
            let closestEntity = null;

            // Creiamo una lista di tutti i possibili giocatori in campo
            const allParticipants = [
                this.player, this.currentT1, this.currentT2,
                this.currentO1, this.currentO2, this.currentO3,
                this.homeGK, this.awayGK
            ];

            // Troviamo chi è il più vicino alla palla in questo istante
            for (let ent of allParticipants) {
                if (ent && ent.model) {
                    const dist = ent.model.position.distanceTo(this.ball.position);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEntity = ent;
                    }
                }
            }

            // Se qualcuno sta toccando la palla
            if (closestEntity) {
                // 1. Aggiorna la squadra dell'ultimo tocco (per rimesse/goal)
                const isMyTeam = (closestEntity === this.player || closestEntity === this.currentT1 || closestEntity === this.currentT2);
                this.lastTouchedTeam = isMyTeam ? this.playerTeam : (this.playerTeam === 'home' ? 'away' : 'home');

                // 2. LOGICA FUOCO:
                if (window.fireTrailEffect) {
                    if (closestEntity === this.player && this.player.action.hasSuperShot) {
                        if (!window.fireTrailEffect.isActive || window.fireTrailEffect.mode !== 'fire') {
                            window.fireTrailEffect.activate(this.ball, 'fire');
                        }
                    } else if (closestEntity === this.player && this.player.action.hasElectricShot) {
                        if (!window.fireTrailEffect.isActive || window.fireTrailEffect.mode !== 'electric') {
                            window.fireTrailEffect.activate(this.ball, 'electric');
                        }
                    }
                    // SE IL TOCCO È DI QUALSIASI ALTRO (Compagno o Avversario) -> SPEGNI
                    else {
                        if (window.fireTrailEffect.isActive) {
                            window.fireTrailEffect.deactivate();
                        }
                    }
                }
            }
        }

        // Logica Goal
        if (this.ball.isGoal && !this.isCelebrating) {
            this.isCelebrating = true;
            if (this.ball.position.x > 0) {
                this.homeScore++;
                this.kickOffTeam = 'away';
                this.uiManager.showInGameMessage(this.playerTeam === 'home' ? "⚽ GOOOAAALLL!!! ⚽" : "🤦‍♂️ GOL SUBITO / AUTOGOAL 🤦‍♂️");
            } else {
                this.awayScore++;
                this.kickOffTeam = 'home';
                this.uiManager.showInGameMessage(this.playerTeam === 'away' ? "⚽ GOOOAAALLL!!! ⚽" : "🤦‍♂️ GOL SUBITO / AUTOGOAL 🤦‍♂️");
            }

            // Lancia l'evento del replay dopo 1.5s (permette di vedere un po' di esultanza dal vivo prima del replay)
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('triggerReplay'));
            }, 1500);
        }

        // Fuorigioco / Rimesse / Corner
        if (this.ball.isOutBaseline && !this.isCelebrating) {
            this.ball.isOutBaseline = false;
            this.ball.isElectricShot = false;
            this.ball.isPowerShot = false;
            this.ball.spin = 0;

            // Se siamo in allenamento e la palla va fuori rimettila semplicemente a posto
            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') {
                this.uiManager.showInGameMessage("RITENTA!<br><span style='font-size:20px'>Premi 'R' per riposizionare</span>");
                setTimeout(() => { this.startGame(this.gameMode); }, 1500);
                return;
            }

            const fieldEndX = 49.5;
            const fieldEndZ = 30.5;

            const isRightSide = this.ball.position.x > 0;
            const isTopCorner = this.ball.position.z > 0;
            const defendingTeam = isRightSide ? 'away' : 'home';
            const isCornerKick = this.lastTouchedTeam === defendingTeam;
            const attackingTeam = isCornerKick ? (defendingTeam === 'home' ? 'away' : 'home') : defendingTeam;


            const ballX = isCornerKick ? (isRightSide ? fieldEndX : -fieldEndX) : (isRightSide ? 44.0 : -44.0);
            // ... continua con il posizionamento della palla ...
            const ballZ = isCornerKick ? (isTopCorner ? fieldEndZ : -fieldEndZ) : 0;
            const targetFocusX = isRightSide ? 40 : -40;
            const targetYaw = Math.atan2(targetFocusX - ballX, 0 - ballZ);

            this.ball.position.set(ballX, this.ball.radius, ballZ);
            this.ball.velocity.set(0, 0, 0);

            let activeSetPieceNPC = null;

            if (attackingTeam === this.playerTeam) {
                if (!isCornerKick) {
                    const activeGK = this.homeGK;
                    this.switchCharacter(activeGK);

                    this.isControllingGK = true;
                    this.controlledGK = activeGK;
                    this.controlledGK.isSwappedOut = true;
                } else {
                    this.restoreGoalkeeper();
                }

                this.player.model.position.set(ballX - Math.sin(targetYaw) * 1.0, 0, ballZ - Math.cos(targetYaw) * 1.0);
                this.player.yaw = targetYaw;
                this.player.model.rotation.y = targetYaw;

                if (isCornerKick) {
                    this.player.action.startCorner(this.ball);
                }
                else {
                    this.player.action.startGoalKick(this.ball);
                }
            } else {
                this.restoreGoalkeeper();

                if (isCornerKick) {
                    let closestBot = null;
                    let secondClosestBot = null;
                    let minDist1 = Infinity;
                    let minDist2 = Infinity;

                    // Calcolo delle distanze per estrarre sia il battitore che il ricevitore vicino
                    [this.currentO1, this.currentO2, this.currentO3].forEach(bot => {
                        if (bot && bot.model) {
                            const dist = bot.model.position.distanceTo(new THREE.Vector3(ballX, 0, ballZ));
                            if (dist < minDist1) {
                                minDist2 = minDist1;
                                secondClosestBot = closestBot;
                                
                                minDist1 = dist;
                                closestBot = bot;
                            } else if (dist < minDist2) {
                                minDist2 = dist;
                                secondClosestBot = bot;
                            }
                        }
                    });

                    const kickerBot = closestBot;
                    const receiverBot = secondClosestBot;

                    // Posiziona il battitore dietro la palla nella bandierina
                    kickerBot.model.position.set(ballX - Math.sin(targetYaw) * 1.0, 0, ballZ - Math.cos(targetYaw) * 1.0);
                    kickerBot.yaw = targetYaw;
                    kickerBot.model.rotation.y = targetYaw;
                    
                    // Avvia lo stato cooperativo del Calcio d'Angolo
                    kickerBot.startCorner(receiverBot);
                    
                    if (receiverBot) {
                        receiverBot.setReceiveCornerTarget(kickerBot.model.position, ballX, ballZ);
                    }
                    
                    activeSetPieceNPC = kickerBot;
                } else {
                    const botGK = this.awayGK;
                    botGK.model.position.set(ballX - Math.sin(targetYaw) * 1.0, 0, ballZ - Math.cos(targetYaw) * 1.0);
                    botGK.yaw = targetYaw;
                    botGK.model.rotation.y = targetYaw;

                    botGK.startGoalKick(null); // Il target gli verrà assegnato poco più giù
                    activeSetPieceNPC = botGK;
                }
            }

            const allNPCs = [this.currentT1, this.currentT2, this.currentO1, this.currentO2, this.currentO3];
            if (this.isControllingGK && this.controlledGK) {
                allNPCs.push(this.controlledGK);
            }

            allNPCs.forEach(npc => {
                if (npc.model && npc !== activeSetPieceNPC) {
                    let randX, randZ;
                    if (isCornerKick) {
                        randX = targetFocusX + (Math.random() * 8 - 4);
                        randZ = (Math.random() * 16 - 8);
                    } else {
                        // Posizioni di partenza vicino alla propria area per farli scattare in avanti
                        const startX = isRightSide ? 30 : -30;
                        randX = startX + (Math.random() * 8 - 4);
                        randZ = (Math.random() * 20 - 10);
                    }
                    npc.model.position.set(randX, 0, randZ);
                    npc.model.rotation.y = Math.atan2(ballX - randX, ballZ - randZ);
                    
                    if (npc.isReceivingGoalKick !== undefined) npc.isReceivingGoalKick = false;
                }
            });

            // --- FIX RIMESSA DAL FONDO: I BOT SCATTANO IN AVANTI ---
            if (!isCornerKick) {
                const runDir = isRightSide ? -1 : 1; // Corrono verso la porta avversaria
                
                if (attackingTeam === this.playerTeam) {
                    [this.currentT1, this.currentT2].forEach(bot => {
                        if (bot && bot.model && bot.setReceiveGoalKickTarget) bot.setReceiveGoalKickTarget(runDir);
                    });
                } else {
                    const receivers = [this.currentO1, this.currentO2, this.currentO3].filter(b => b && b.model);
                    if (receivers.length > 0) {
                        receivers[0].setReceiveGoalKickTarget(runDir);
                        if (receivers.length > 1) receivers[1].setReceiveGoalKickTarget(runDir);
                        if (activeSetPieceNPC && activeSetPieceNPC.startGoalKick) activeSetPieceNPC.targetReceiver = receivers[0];
                    }
                }
            }

            const teamName = attackingTeam === 'home' ? 'ROSSA' : 'BLU';
            this.uiManager.showInGameMessage(isCornerKick ? `CALCIO D'ANGOLO: SQUADRA ${teamName}` : `RIMESSA DAL FONDO: SQUADRA ${teamName}`);
        } else {
            // --- INIZIO FIX: Controllo se un qualsiasi Bot sta battendo ---
            const allBots = [this.currentO1, this.currentO2, this.currentO3, this.currentT1, this.currentT2];
            const isAnyBotThrowingIn = allBots.some(bot => bot && bot.isThrowingIn);

            // Aggiungi !isAnyBotThrowingIn alla condizione
            if (this.ball.isOut && !this.player.isThrowingIn && !isAnyBotThrowingIn && !this.ball.isGoal) {
                this.ball.isOut = false;
            this.ball.isElectricShot = false;
            this.ball.isPowerShot = false;
            this.ball.spin = 0;
            // --- FINE FIX ---

            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') {
                this.uiManager.showInGameMessage("RITENTA!<br><span style='font-size:20px'>Premi 'R' per riposizionare</span>");
                setTimeout(() => { this.startGame(this.gameMode); }, 1500);
                return;
            }

            this.restoreGoalkeeper(); // <--- AGGIUNGI QUI
            const throwInTeam = this.lastTouchedTeam === 'home' ? 'away' : 'home';

            const side = this.ball.position.z > 0 ? 1 : -1;
            const outOfBoundsOffset = 1.5;

            if (throwInTeam === this.playerTeam) {
                this.player.model.position.set(this.ball.position.x, 0, this.ball.position.z + (outOfBoundsOffset * side));
                this.player.yaw = side > 0 ? Math.PI : 0;
                this.player.startThrowIn();
                this.uiManager.showInGameMessage("RIMESSA: SQUADRA ROSSA");
            } else {
                // Rimessa Laterale Bot avversario
                // --- INIZIO: Trova chi batte e chi riceve ---
                let closestBot = null;
                let secondClosestBot = null;
                let minDist1 = Infinity;
                let minDist2 = Infinity;

                [this.currentO1, this.currentO2, this.currentO3].forEach(bot => {
                    if (bot && bot.model) {
                        const dist = bot.model.position.distanceTo(new THREE.Vector3(this.ball.position.x, 0, this.ball.position.z));
                        if (dist < minDist1) {
                            // Quello che prima era il più vicino scala al secondo posto
                            minDist2 = minDist1;
                            secondClosestBot = closestBot; 
                            
                            // Abbiamo un nuovo bot più vicino
                            minDist1 = dist;
                            closestBot = bot; 
                        } else if (dist < minDist2) {
                            // È più lontano del primo, ma più vicino del secondo
                            minDist2 = dist;
                            secondClosestBot = bot; 
                        }
                    }
                });

                const throwerBot = closestBot;
                const receiverBot = secondClosestBot;

                throwerBot.model.position.set(this.ball.position.x, 0, this.ball.position.z + (outOfBoundsOffset * side));
                const botYaw = side > 0 ? Math.PI : 0;
                throwerBot.yaw = botYaw;
                throwerBot.model.rotation.y = botYaw;

                // 1. Passiamo il ricevitore al battitore
                throwerBot.startThrowIn(receiverBot);
                
                // 2. Diciamo al ricevitore di farsi incontro
                if (receiverBot) {
                    receiverBot.setReceiveThrowInTarget(throwerBot.model.position, side);
                }
                // --- FINE FIX RIMESSA IA ---

                this.uiManager.showInGameMessage("RIMESSA: SQUADRA BLU");
            }
        }
        }
    }

    restoreGoalkeeper() {
        if (this.isControllingGK && this.controlledGK) {
            this.controlledGK.isSwappedOut = false; // Riattiva l'IA del portiere

            // --- FIX ANIMAZIONE ---
            // Cancella la memoria del caricamento tiro prima di ridargli il corpo
            // così lo scheletro torna dritto.
            this.player.animator.cancelCharge();

            this.switchCharacter(this.controlledGK); // Ridagli il corpo!
            this.isControllingGK = false;
            this.controlledGK = null;
        }
    }

    resetAfterGoal() {
        this.restoreGoalkeeper();

        if (this.gameMode === 'penalty' || this.gameMode === 'freekick') {
            this.startGame(this.gameMode); // Resetta istantaneamente se fa gol in allenamento
        } else {
            this.resetKickOff();

            // Reset della telecamera standard
            const offset = this.player.cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
            this.camera.position.copy(this.player.model.position.clone().add(offset));
            const cameraTarget = this.player.model.position.clone();
            cameraTarget.y += 1.5;
            this.camera.lookAt(cameraTarget);
        }

        this.isCelebrating = false;
    }
}