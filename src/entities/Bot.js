// Bot.js
import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';
import { PlayerAction } from '../animation-action/PlayerAction.js';
import { TacticalManager } from '../game/TacticalManager.js';

const botTacticalManager = new TacticalManager();

export class Bot {
    constructor(scene, ball, startPos, startYaw) {
        this.id = Math.random().toString(36).substr(2, 9); // <--- ID UNIVOCO (NECESSARIO)
        this.scene = scene;
        this.ball = ball;
        this.startPos = startPos;
        this.yaw = startYaw;
        this.model = null;

        this.animator = new PlayerAnimator();
        this.action = new PlayerAction();

        this.targetReceiver = null;
        
        // --- MACCHINA A STATI POSSESSO PALLA ---
        this.possessionState = 'DRIBBLE';
        this.passCooldownTimer = 0;
        this.receiveLockTimer = 0;
        this.chosenReceiver = null;
        this.wasPossessingBall = false;

        // --- STATI RIMESSA ---
        this.isThrowingIn = false;
        this.throwInTimer = 0;
        this.isReceivingThrowIn = false;
        this.throwInSupportPos = new THREE.Vector3();

        // --- STATI CALCIO D'ANGOLO ---
        this.isTakingCorner = false;
        this.cornerTimer = 0;
        this.isReceivingCorner = false;
        this.cornerSupportPos = new THREE.Vector3();
        this.cornerTargetGoalX = 0; 

        // --- STATI RIMESSA DAL FONDO ---
        this.isReceivingGoalKick = false;
        this.goalKickRunDir = 1;

        // --- STATI CALCIO D'INIZIO ---
        this.isTakingKickOff = false;
        this.kickOffTimer = 0;

        // --- STATI ATTESA IN AREA ---
        this.isWaitingInArea = false;

        // --- CACHE VETTORI (OTTIMIZZAZIONE) ---
        this._idealPos = new THREE.Vector3();
        this._moveDir = new THREE.Vector3();
        this._dirToBall = new THREE.Vector3();
        
        // --- NUOVI VETTORI PER LA GESTIONE DEGLI SPAZI ---
        this._teammateSeparation = new THREE.Vector3();
        this._avoidanceVector = new THREE.Vector3();
        this._pushAway = new THREE.Vector3();

        this.loadGLB();
    }

    loadGLB() {
        modelManager.load(`${import.meta.env.BASE_URL}models/player.glb`, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(1.5, 1.5, 1.5);
            
            this.model.position.copy(this.startPos);
            this.model.rotation.y = this.yaw;

            this.model.traverse((child) => {
                if (child.isMesh) { 
                    child.castShadow = true; 
                    child.receiveShadow = false; 
                    
                    if (child.name === 'Ch38_Shirt') {
                        child.material = child.material.clone(); 
                        child.material.color.setHex(0x0000ff); 
                    }
                }
            });
            
            this.animator.initBones(this.model);
            this.scene.add(this.model);
        });
    }

    update(deltaTime, isMatchStarted = true, matchState = 'HOME_POSSESSION', defendDirX = 1, opponents = [], bots = []) {
        if (!this.model) return;
        
        // Reset manuale di X e Z per evitare flip visivi (es. dopo il ReplaySystem)
        this.model.rotation.x = 0;
        this.model.rotation.z = 0;
        
        // --- 1. GESTIONE BATTITORE RIMESSA ---
        if (this.isThrowingIn) {
            let receiverReady = true;

            if (this.targetReceiver && this.targetReceiver.model) {
                 this.yaw = Math.atan2(
                     this.targetReceiver.model.position.x - this.model.position.x,
                     this.targetReceiver.model.position.z - this.model.position.z
                 );
                 const currentRot = this.model.rotation.y;
                 let diff = this.yaw - currentRot;
                 while (diff < -Math.PI) diff += Math.PI * 2;
                 while (diff > Math.PI) diff -= Math.PI * 2;
                 this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);

                 // Se il compagno sta ancora correndo per avvicinarsi, non siamo pronti
                 if (this.targetReceiver.isMoving) {
                     receiverReady = false;
                 }
            }

            // Aspetta che il compagno si avvicini fermandosi (bloccando il timer prima del lancio)
            if (!receiverReady && this.throwInTimer >= 0.9) {
                this.throwInTimer += deltaTime * 0.02; // Fallback di ~5 secondi in caso il bot si incastri
            } else {
                this.throwInTimer += deltaTime;
            }

            const waitTime = 1.0;
            const releaseTime = waitTime + 0.55;
            const endTime = releaseTime + 0.4;

            let isThrowingInAnim = false;
            let isThrowingInState = true;

            if (this.throwInTimer >= waitTime) {
                isThrowingInState = false;
                isThrowingInAnim = true;

                if (this.throwInTimer >= releaseTime && this.ball.isHeld) {
                    let throwYaw = this.yaw; // Mira perfetta verso il ricevitore (nessun errore casuale)
                    this.action.executeThrow(this.ball, throwYaw, this.scene, this.targetReceiver);

                    if (this.targetReceiver) {
                        this.targetReceiver.isReceivingThrowIn = false;
                        this.targetReceiver = null;
                    }
                }
            }

            if (this.throwInTimer >= endTime) {
                this.isThrowingIn = false;
                isThrowingInAnim = false;
                this.animator.resetToBasePose();
            }

            this.animator.animate(deltaTime, isThrowingInAnim, false, false, isThrowingInState, null, 0);
            return; 
        }

        // --- 2. GESTIONE RICEVITORE RIMESSA ---
        if (this.isReceivingThrowIn && !this.isThrowingIn) {
            if (!this.ball.isHeld) {
                this.isReceivingThrowIn = false;
            } else {
                const distToSupport = this.model.position.distanceTo(this.throwInSupportPos);
                if (distToSupport > 0.5) {
                    this.isMoving = true;
                    // Isteresi per evitare flickering
                    if (this.isRunning) {
                        this.isRunning = distToSupport > 3;
                    } else {
                        this.isRunning = distToSupport > 5;
                    }
                    this._moveDir.subVectors(this.throwInSupportPos, this.model.position);
                    this._moveDir.y = 0;
                    this._moveDir.normalize();
                    const speed = this.isRunning ? 9 : 5;
                    this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                } else {
                    this.isMoving = false;
                    this.isRunning = false;
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
                
                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                return;
            }
        }

        // --- 3. GESTIONE BATTITORE CALCIO D'ANGOLO ---
        if (this.isTakingCorner) {
            this.cornerTimer += deltaTime;

            if (this.targetReceiver && this.targetReceiver.model) {
                this.yaw = Math.atan2(
                    this.targetReceiver.model.position.x - this.model.position.x,
                    this.targetReceiver.model.position.z - this.model.position.z
                );
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
            }

            const waitTime = 1.2;
            // Aumentiamo il tempo di caricamento per fargli fare un cross con una parabola bella alta
            const kickTime = waitTime + 0.35;
            const endTime = kickTime + 0.4;

            if (this.cornerTimer >= waitTime && this.cornerTimer < kickTime) {
                if (!this.action.chargingAction) {
                    this.action.startCharge('pass');
                }
                this.action.updateCharge(deltaTime, null);
            }

            if (this.cornerTimer >= kickTime && this.action.chargingAction) {
                // Creiamo un bersaglio fittizio vicino al ricevitore, per non renderlo un passaggio laser
                let fakeTarget = null;
                if (this.targetReceiver && this.targetReceiver.model) {
                    // Offset casuale ridotto a +/- 2 metri per renderlo raggiungibile
                    const errorX = (Math.random() - 0.5) * 4;
                    const errorZ = (Math.random() - 0.5) * 4;
                    const destPos = new THREE.Vector3(
                        this.targetReceiver.model.position.x + errorX,
                        0,
                        this.targetReceiver.model.position.z + errorZ
                    );
                    fakeTarget = {
                        model: { position: destPos }
                    };
                    // COMUNICHIAMO al ricevitore il punto di caduta del cross
                    this.targetReceiver.cornerCrossTarget = destPos;
                }
                
                // Rimettiamo il 'pass' con bersaglio, così la fisica calcola la parabola esatta per raggiungere l'area
                this.action.executeKick(this.ball, this.yaw, 0, null, fakeTarget, true);

                if (this.targetReceiver) {
                    this.targetReceiver = null;
                }
            }

            if (this.cornerTimer >= endTime) {
                this.isTakingCorner = false;
                this.animator.resetToBasePose();
            }

            let chargingAnim = (this.cornerTimer >= waitTime && this.cornerTimer < kickTime) ? 'pass' : null;
            let chargeRatio = this.action.getChargeRatio();
            this.animator.animate(deltaTime, false, false, false, false, chargingAnim, chargeRatio);
            return;
        }

        // --- 4. GESTIONE RICEVITORE CALCIO D'ANGOLO (CROSS & GOAL) ---
        if (this.isReceivingCorner && !this.isTakingCorner) {
            
            // FASE A: La palla non è ancora partita o è appena stata toccata
            if (this.ball.velocity.lengthSq() < 1.0) {
                const distToSupport = this.model.position.distanceTo(this.cornerSupportPos);
                if (distToSupport > 0.5) {
                    this.isMoving = true;
                    // Isteresi per evitare flickering
                    if (this.isRunning) {
                        this.isRunning = distToSupport > 3;
                    } else {
                        this.isRunning = distToSupport > 5;
                    }
                    this._moveDir.subVectors(this.cornerSupportPos, this.model.position);
                    this._moveDir.y = 0;
                    this._moveDir.normalize();
                    const speed = this.isRunning ? 9 : 5;
                    this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                } else {
                    this.isMoving = false;
                    this.isRunning = false;
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
            } 
            // FASE B: IL CROSS È PARTITO! Insegue la palla e si prepara al tiro
            else {
                const distanceToBall3D = this.model.position.distanceTo(this.ball.position);

                // 1. Insegue il punto di caduta del cross finché la palla è alta, poi corregge sull'ombra esatta
                let targetPointXZ = (this.cornerCrossTarget && this.ball.position.y > 4.0) 
                                    ? this.cornerCrossTarget 
                                    : this.ball.position;
                                    
                const distToTargetXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                     .distanceTo(new THREE.Vector2(targetPointXZ.x, targetPointXZ.z));

                if (distToTargetXZ > 0.5) {
                    this.isMoving = true;
                    this.isRunning = true;
                    this._moveDir.set(targetPointXZ.x - this.model.position.x, 0, targetPointXZ.z - this.model.position.z).normalize();
                    this.model.position.addScaledVector(this._moveDir, 12 * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                } else {
                    this.isMoving = false;
                    this.isRunning = false;
                    this.yaw = Math.atan2(this.cornerTargetGoalX - this.model.position.x, 0 - this.model.position.z);
                }

                // 2. La palla è vicina (in caduta): Guarda la porta e CARICA IL TIRO
                if (distanceToBall3D < 6.0) {
                    this.yaw = Math.atan2(this.cornerTargetGoalX - this.model.position.x, 0 - this.model.position.z);
                    
                    if (!this.action.chargingAction) {
                        this.action.startCharge('shoot');
                    }
                    // Carica il tiro 3 volte più veloce per essere pronto all'impatto!
                    this.action.updateCharge(deltaTime * 3, null); 
                }

                // 3. IMPATTO! La palla scende ed è vicina al giocatore
                const distToBallXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                     .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
                                     
                if (distToBallXZ < 2.5 && this.ball.position.y < 3.0) {
                    // Mira fissa sulla porta
                    this.yaw = Math.atan2(this.cornerTargetGoalX - this.model.position.x, 0 - this.model.position.z);
                    
                    // Sicurezza: spara comunque una botta potente se non ha caricato tutto
                    if (this.action.kickPower < this.action.shootMaxPower * 0.7) {
                        this.action.kickPower = this.action.shootMaxPower * 0.85;
                    }
                    
                    // BOOM! Calcia con una traiettoria dritta (-0.1) ma aggiungendo un piccolo margine d'errore
                    const shotError = (Math.random() - 0.5) * 0.35;
                    this.action.executeKick(this.ball, this.yaw + shotError, -0.1, null, null, true);
                    
                    // Sgancia l'IA, l'azione da fermo è conclusa
                    this.isReceivingCorner = false;
                    this.cornerCrossTarget = null;
                }
            }

            // Manda all'animator lo stato del movimento E l'eventuale caricamento del tiro
            let chargingAnim = this.action.chargingAction;
            let chargeRatio = this.action.getChargeRatio();
            this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, chargingAnim, chargeRatio);

            const currentRot = this.model.rotation.y;
            let diff = this.yaw - currentRot;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
            return;
        }

        // --- 4.5. GESTIONE RICEVITORE RIMESSA DAL FONDO ---
        if (this.isReceivingGoalKick) {
            const distToBallXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                 .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
            
            const isBallOutArea = Math.abs(this.ball.position.x) < 33; 
            const isBallKicked = !this.ball.isHeld && this.ball.velocity.lengthSq() > 5.0;

            // Interrompe la routine solo se riceve la palla o se la palla esce dall'area
            if (distToBallXZ < 3.0 || (isBallKicked && isBallOutArea && this.ball.position.y <= this.ball.radius + 0.2)) {
                this.isReceivingGoalKick = false;
            } else {
                this.isMoving = true;
                this.isRunning = true;
                this._moveDir.set(this.goalKickRunDir, 0, 0); // Scatta in avanti lontano dal portiere
                this.model.position.addScaledVector(this._moveDir, 10 * deltaTime);
                this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
            }

            if (this.isReceivingGoalKick) {
                this.model.position.x = THREE.MathUtils.clamp(this.model.position.x, -48, 48);
                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                this.handleCollisions();
                return;
            }
        }
        
        // --- 4.8 GESTIONE BATTITORE CALCIO D'INIZIO ---
        if (this.isTakingKickOff) {
            this.kickOffTimer += deltaTime;

            if (this.targetReceiver && this.targetReceiver.model) {
                this.yaw = Math.atan2(
                    this.targetReceiver.model.position.x - this.model.position.x,
                    this.targetReceiver.model.position.z - this.model.position.z
                );
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
            }

            const waitTime = 1.0;
            const kickTime = waitTime + 0.35;
            const endTime = kickTime + 0.4;

            if (this.kickOffTimer >= waitTime && this.kickOffTimer < kickTime) {
                if (!this.action.chargingAction) {
                    this.action.startCharge('pass');
                }
                this.action.updateCharge(deltaTime, null);
            }

            if (this.kickOffTimer >= kickTime && this.action.chargingAction) {
                let passTarget = this.targetReceiver;
                this.action.executeKick(this.ball, this.yaw, 0, null, passTarget, true);
                this.targetReceiver = null;
            }

            if (this.kickOffTimer >= endTime) {
                this.isTakingKickOff = false;
                this.animator.resetToBasePose();
            }

            let chargingAnim = (this.kickOffTimer >= waitTime && this.kickOffTimer < kickTime) ? 'pass' : null;
            let chargeRatio = this.action.getChargeRatio();
            this.animator.animate(deltaTime, false, false, false, false, chargingAnim, chargeRatio);
            return;
        }

        // --- 5. COMPORTAMENTO IA STANDARD ---
        // NOTA: NON resettiamo isMoving/isRunning qui.
        // Ogni metodo di comportamento gestisce il proprio stato
        // per preservare l'isteresi anti-flickering.

        // --- BLOCCO ATTESA IN AREA (corner/rimesse avversarie) ---
        if (this.isWaitingInArea) {
            // La palla è stata calciata? Esci dallo stato di attesa
            if (this.ball && !this.ball.isHeld && this.ball.velocity.lengthSq() > 2.0) {
                this.isWaitingInArea = false;
            } else {
                // Resta fermo e guarda la palla
                this.isMoving = false;
                this.isRunning = false;
                if (this.ball && this.ball.isLoaded) {
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
                this.animator.animate(deltaTime, false, false, false, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                return;
            }
        }

        if (!isMatchStarted) {
            if (this.ball && this.ball.isLoaded) {
                this._dirToBall.subVectors(this.ball.position, this.model.position);
                this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
            }
            this.animator.animate(deltaTime, false, false, false, false, null, 0);
            return; 
        }

        switch (matchState) {
            case 'HOME_POSSESSION':
                this.executeDefendBehavior(deltaTime, defendDirX, opponents, bots);
                break;

            case 'AWAY_POSSESSION':
                // <--- AGGIUNTO 'opponents' COME PARAMETRO
                this.executeAttackBehavior(deltaTime, defendDirX, bots, opponents); 
                break;
        }

        let chargingAnim = this.action && this.action.chargingAction ? this.action.chargingAction : null;
        let chargeRatio = this.action ? this.action.getChargeRatio() : 0;
        this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, chargingAnim, chargeRatio);

        const currentRot = this.model.rotation.y;
        const targetRot = this.yaw;
        
        let diff = targetRot - currentRot;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
        this.handleCollisions();
    }

    executeDefendBehavior(deltaTime, defendDirX, opponents, bots) {
        if (!this.ball || !this.ball.isLoaded) return;
        const myGoalX = 49.5 * defendDirX; 
        const goalPos = new THREE.Vector3(myGoalX, 0, 0);

        let targetOpponent = null;
        const myIndex = bots.indexOf(this);
        if (myIndex !== -1 && opponents[myIndex]) {
            targetOpponent = opponents[myIndex];
        }

        if (targetOpponent) {
            const oppPos = targetOpponent.model ? targetOpponent.model.position : targetOpponent.position;
            this._idealPos.lerpVectors(oppPos, goalPos, 0.1); 
        } else {
            this._idealPos.copy(this.startPos);
        }

        if (bots && bots.length > 0) {
            const avoidanceRadius = 1.5; 
            bots.forEach(otherBot => {
                if (otherBot !== this && otherBot.model) {
                    const dist = this.model.position.distanceTo(otherBot.model.position);
                    if (dist < avoidanceRadius && dist > 0.01) {
                        const pushAway = new THREE.Vector3().subVectors(this.model.position, otherBot.model.position);
                        pushAway.y = 0;
                        pushAway.normalize().multiplyScalar((avoidanceRadius - dist) * 0.8);
                        this._idealPos.add(pushAway);
                    }
                }
            });
        }

        this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
        this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

        const distToIdeal = this.model.position.distanceTo(this._idealPos);

        // Isteresi per isMoving: evita flickering tra camminata e idle
        let shouldMove;
        if (this.isMoving) {
            shouldMove = distToIdeal > 0.5; // Una volta in moto, fermati solo quando sei molto vicino
        } else {
            shouldMove = distToIdeal > 1.5; // Da fermo, parti solo quando sei abbastanza lontano
        }

        if (shouldMove) {
            this.isMoving = true;
            this._moveDir.subVectors(this._idealPos, this.model.position);
            this._moveDir.y = 0;
            this._moveDir.normalize();
            // Isteresi per isRunning: evita flickering tra corsa e camminata
            if (this.isRunning) {
                this.isRunning = distToIdeal > 3;
            } else {
                this.isRunning = distToIdeal > 5;
            }
            const speed = this.isRunning ? 11 : 7;
            this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
        } else {
            this.isMoving = false;
            this.isRunning = false;
        }

        this._dirToBall.subVectors(this.ball.position, this.model.position);
        this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
    }

    executeAttackBehavior(deltaTime, defendDirX, bots, opponents) {
        if (!this.ball || !this.ball.isLoaded) return;
        
        // --- UPDATE TIMERS ---
        if (this.passCooldownTimer > 0) this.passCooldownTimer -= deltaTime;
        if (this.receiveLockTimer > 0) this.receiveLockTimer -= deltaTime;

        const attackGoalX = -49.5 * defendDirX;
        const targetGoalPos = new THREE.Vector3(attackGoalX, 0, 0);
        const attackDirX = attackGoalX > 0 ? 1 : -1;
        
        // 1. TROVA IL PORTATORE DI PALLA (Chi è più vicino)
        let ballCarrier = null;
        let isClosest = true;
        const myDistToBall = this.model.position.distanceTo(this.ball.position);
        let minDist = Infinity;
        
        if (bots && bots.length > 0) {
            bots.forEach(otherBot => {
                if (otherBot && otherBot.model) {
                    const dist = otherBot.model.position.distanceTo(this.ball.position);
                    if (dist < minDist) {
                        minDist = dist;
                        ballCarrier = otherBot;
                    }
                    if (otherBot !== this && dist < myDistToBall) {
                        isClosest = false;
                    }
                }
            });
            if (!ballCarrier) ballCarrier = this;
        } else {
            ballCarrier = this;
        }

        // 2. AGGIORNA LE CORSIE TATTICHE DEI BOT
        const otherBots = bots.filter(b => b !== ballCarrier);
        // Il ballCarrier funge da "player" (prenota la sua corsia), gli altri due si adattano
        botTacticalManager.updateOffensiveLanes(ballCarrier, otherBots, this.ball, attackDirX);

        // 3. LOGICA DI ATTACCO
        if (isClosest) {
            if (myDistToBall < 1.5) {
                this.isMoving = true;
                this.isRunning = true;
                
                // Entrata in possesso iniziale
                if (!this.wasPossessingBall) {
                    this.wasPossessingBall = true;
                    this.possessionState = 'RECEIVING';
                    this.receiveLockTimer = 0.5; // mezzo secondo di controllo palla (receive lock)
                    this.chosenReceiver = null;
                }

                if (this.possessionState === 'RECEIVING') {
                    if (this.receiveLockTimer <= 0) {
                        this.possessionState = 'DRIBBLE';
                    }
                }

                if (this.possessionState === 'DRIBBLE') {
                    const distToGoal = this.model.position.distanceTo(targetGoalPos);
                    
                    if (distToGoal < 25) {
                        this.possessionState = 'SHOOT';
                    } else if (this.passCooldownTimer <= 0) {
                        let opponentNear = false;
                        let closestOppDist = Infinity;
                        
                        if (opponents && opponents.length > 0) {
                            for (let opp of opponents) {
                                const oppPos = opp.model ? opp.model.position : opp.position;
                                if (oppPos) {
                                    const dist = this.model.position.distanceTo(oppPos);
                                    if (dist < closestOppDist) closestOppDist = dist;
                                    if (dist < 6.0) { // Aumentato a 6.0 per sicurezza
                                        opponentNear = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (opponentNear && bots.length > 1) {
                            console.log(`Bot ${this.id} under pressure (dist: ${closestOppDist.toFixed(2)}). Searching for receiver...`);

                            let bestScore = -Infinity;
                            let bestReceiver = null;

                            bots.forEach(ally => {
                                if (ally !== this && ally.model) {
                                    const allyPos = ally.model.position;
                                    let score = 0;
                                    
                                    // 1. Distanza dalla porta
                                    const distToGoalAlly = allyPos.distanceTo(targetGoalPos);
                                    score += (100 - distToGoalAlly);

                                    // 2. Libertà da marcature
                                    let minOppDist = Infinity;
                                    opponents.forEach(opp => {
                                        const oppPos = opp.model ? opp.model.position : opp.position;
                                        if (oppPos) {
                                            const d = allyPos.distanceTo(oppPos);
                                            if (d < minOppDist) minOppDist = d;
                                        }
                                    });
                                    if (minOppDist !== Infinity) {
                                        score += (minOppDist * 2);
                                    }

                                    // 3. Posizione avanzata
                                    const isForward = (allyPos.x - this.model.position.x) * attackDirX > 0;
                                    if (isForward) score += 20;

                                    if (score > bestScore) {
                                        bestScore = score;
                                        bestReceiver = ally;
                                    }
                                }
                            });

                            if (bestReceiver) {
                                console.log(`Bot ${this.id} selected receiver ${bestReceiver.id}. Transitioning to PASS state.`);
                                this.chosenReceiver = bestReceiver;
                                this.possessionState = 'PASS';
                            }
                        }
                    }
                }

                if (this.possessionState !== 'PASS') {
                    this._moveDir.subVectors(targetGoalPos, this.model.position);
                    this._moveDir.y = 0;
                    
                    if (this._moveDir.lengthSq() > 0.001) {
                        this._moveDir.normalize();
                        this.model.position.addScaledVector(this._moveDir, 12 * deltaTime);
                        this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                    }

                    this.action.dribble(this.ball, this.yaw, this.isRunning, false, { forward: true, backward: false, left: false, right: false }, deltaTime);
                }

                if (this.possessionState === 'SHOOT') {
                    console.log(`Bot ${this.id} is SHOOTING!`);
                    if (this.action.chargingAction !== 'shoot') {
                        this.action.startCharge('shoot');
                    }
                    this.action.updateCharge(deltaTime * 2.5, null); 
                    
                    if (this.action.kickPower >= this.action.shootMaxPower * 0.85) {
                        const shotError = (Math.random() - 0.5) * 0.2;
                        this.action.executeKick(this.ball, this.yaw + shotError, -0.15, null, null, true);
                        this.possessionState = 'DRIBBLE';
                        this.wasPossessingBall = false;
                    }
                } else if (this.possessionState === 'PASS') {
                    if (this.chosenReceiver) {
                        this.yaw = Math.atan2(
                            this.chosenReceiver.model.position.x - this.model.position.x,
                            this.chosenReceiver.model.position.z - this.model.position.z
                        );

                        if (this.action.chargingAction !== 'pass') {
                            console.log(`Bot ${this.id} starts charging pass!`);
                            this.action.startCharge('pass');
                        }
                        this.action.updateCharge(deltaTime * 15.0, null); // Carica veloce
                        
                        if (this.action.kickPower >= this.action.passMaxPower * 0.5) {
                            console.log(`Bot ${this.id} KICKS pass!`);
                            this.action.executeKick(this.ball, this.yaw, 0, null, this.chosenReceiver, true);
                            this.passCooldownTimer = 1.5;
                            this.possessionState = 'DRIBBLE';
                            this.chosenReceiver = null;
                            this.wasPossessingBall = false;
                        }
                    } else {
                        this.possessionState = 'DRIBBLE';
                        if (this.action.chargingAction === 'pass') {
                            this.action.cancelCharge(null);
                        }
                    }
                }

            } else {
                this.isMoving = true;
                this.isRunning = true;

                this._moveDir.subVectors(this.ball.position, this.model.position);
                this._moveDir.y = 0;
                if (this._moveDir.lengthSq() > 0.001) {
                    this._moveDir.normalize();
                    this.model.position.addScaledVector(this._moveDir, 11 * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                }
                
                if (this.action.chargingAction) {
                    this.action.cancelCharge(null);
                }
            }
        } else {
            // --- NUOVA LOGICA: SMARCAMENTO E POSITION REPLACEMENT ---
            this.wasPossessingBall = false;
            this.possessionState = 'DRIBBLE';
            this.chosenReceiver = null;
            
            this._idealPos.set(0, 0, 0);

            // A) Identificazione Corsia
            const laneZ = botTacticalManager.getAssignedLaneZ(this.id);

            // B) Calcolo Avanzamento in Profondità
            const isBallNearGoal = (attackDirX === 1 && this.ball.position.x > 30) ||
                                   (attackDirX === -1 && this.ball.position.x < -30);

            if (isBallNearGoal) {
                let targetZ = laneZ * 0.5; 
                let targetX = this.ball.position.x + (attackDirX * 4); 
                
                const maxDepth = 40; 
                targetX = attackDirX === 1 ? Math.min(targetX, maxDepth) : Math.max(targetX, -maxDepth);

                this._idealPos.x = targetX;
                this._idealPos.z = targetZ; // Niente LERP, posizione fissa
            } else {
                this._idealPos.x = this.ball.position.x + (attackDirX * 10); // I bot di supporto stanno un po' più vicini
                this._idealPos.z = laneZ; // Niente LERP
            }

            // C) Separation tra bot alleati (evita collisioni in contropiede)
            const teamSeparationRadius = 6.0;
            this._teammateSeparation.set(0, 0, 0);
            let forceMoveAway = false;

            bots.forEach(ally => {
                if (ally !== this && ally.model) {
                    const dist = this.model.position.distanceTo(ally.model.position);
                    if (dist < teamSeparationRadius) {
                        const push = new THREE.Vector3().subVectors(this.model.position, ally.model.position);
                        push.y = 0;
                        push.normalize().multiplyScalar((teamSeparationRadius - dist) * 1.5); 
                        this._teammateSeparation.add(push);
                        forceMoveAway = true;
                    }
                }
            });
            this._idealPos.add(this._teammateSeparation);

            // D) Avoidance degli avversari (I bot evitano i TUOI giocatori)
            const avoidanceRadius = 15.0; 
            this._avoidanceVector.set(0, 0, 0);
            
            if (opponents && opponents.length > 0) {
                opponents.forEach(opp => {
                    if (opp && opp.model) {
                        const dist = this.model.position.distanceTo(opp.model.position);
                        if (dist < avoidanceRadius) {
                            this._pushAway.subVectors(this.model.position, opp.model.position);
                            this._pushAway.y = 0;
                            this._pushAway.normalize();

                            const dirToIdeal = new THREE.Vector3(this._idealPos.x - this.model.position.x, 0, this._idealPos.z - this.model.position.z).normalize();
                            const evasionBlend = Math.min(dist / avoidanceRadius, 1.0); 
                            
                            const escapeDir = new THREE.Vector3().lerpVectors(this._pushAway, dirToIdeal, evasionBlend).normalize();
                            escapeDir.multiplyScalar((avoidanceRadius - dist) * 1.2);
                            this._avoidanceVector.add(escapeDir);
                        }
                    }
                });
            }
            this._idealPos.add(this._avoidanceVector);

            // E) Limiti del campo
            this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
            this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

            // F) Movimento Fisico
            const distToIdeal = this.model.position.distanceTo(this._idealPos);
            
            let shouldMove = forceMoveAway || (this.isMoving ? (distToIdeal > 0.8) : (distToIdeal > 2.0));

            if (shouldMove) {
                this.isMoving = true;
                this._moveDir.subVectors(this._idealPos, this.model.position);
                this._moveDir.y = 0;
                this._moveDir.normalize();

                this.isRunning = this.isRunning ? (distToIdeal > 4.5) : (distToIdeal > 7);
                const speed = this.isRunning ? 11 : 7;
                this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
            } else {
                this.isMoving = false;
                this.isRunning = false;
            }

            // G) Orientamento verso la palla
            this._dirToBall.subVectors(this.ball.position, this.model.position);
            this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);

            if (this.action.chargingAction) {
                this.action.cancelCharge(null);
            }
        }
    }

    handleCollisions() {
        if (this.ball && this.ball.isLoaded) {
            const playerHeight = 1.8;
            const playerRadius = 0.35; 
            const closestY = Math.max(this.model.position.y, Math.min(this.model.position.y + playerHeight, this.ball.position.y));
            const closestPointOnPlayer = new THREE.Vector3(this.model.position.x, closestY, this.model.position.z);
            const distanceToBall3D = closestPointOnPlayer.distanceTo(this.ball.position);
            const minDistance = playerRadius + this.ball.radius;

            if (distanceToBall3D < minDistance) {
                const pushDir = new THREE.Vector3().subVectors(this.ball.position, closestPointOnPlayer);
                if (pushDir.lengthSq() > 0.001) {
                    pushDir.normalize();
                    if (pushDir.y > 0.5) {
                        // Rendi la testa scivolosa forzando il vettore normalizzato ad essere molto orizzontale
                        pushDir.y = 0.2;
                        pushDir.x += Math.sign(pushDir.x || (Math.random() - 0.5)) * 1.5;
                        pushDir.z += Math.sign(pushDir.z || (Math.random() - 0.5)) * 1.5;
                        pushDir.normalize();
                    }
                } else {
                    pushDir.set((Math.random() - 0.5), 0.2, (Math.random() - 0.5)).normalize();
                }

                const overlap = minDistance - distanceToBall3D;
                this.ball.position.addScaledVector(pushDir, overlap);

                const dot = this.ball.velocity.dot(pushDir);
                if (dot < 0) {
                    const restitution = 0.3; 
                    const bounceImpulse = pushDir.clone().multiplyScalar(dot * (1 + restitution));
                    this.ball.velocity.sub(bounceImpulse);

                    if (this.isMoving && this._moveDir) {
                        const speed = this.isRunning ? 12 : 6;
                        const playerVel = this._moveDir.clone().multiplyScalar(speed);
                        const impactVel = playerVel.dot(pushDir);
                        if (impactVel > 0) {
                            this.ball.velocity.add(pushDir.multiplyScalar(impactVel * 0.4));
                        }
                    }
                }
            }
        }
    }

    startKickOff(receiver = null) {
        this.isTakingKickOff = true;
        this.kickOffTimer = 0;
        this.targetReceiver = receiver;
        this.isMoving = false;
        this.isRunning = false;
        if (this.ball) {
            this.ball.velocity.set(0, 0, 0);
        }
    }

    startThrowIn(receiver = null) {
        this.isThrowingIn = true;
        this.throwInTimer = 0;
        this.targetReceiver = receiver;
        this.isMoving = false;
        this.isRunning = false;
        const rightHand = this.animator.bones.rightHand;
        this.action.startThrowIn(this.ball, rightHand);
    }

    setReceiveThrowInTarget(throwerPos, side) {
        this.isReceivingThrowIn = true;
        this.throwInSupportPos.set(
            throwerPos.x + (Math.random() * 4 - 2), 
            0,
            throwerPos.z - (side * 6) // Mantiene un po' di distanza per una ricezione comoda
        );
    }

    startCorner(receiver = null) {
        this.isTakingCorner = true;
        this.cornerTimer = 0;
        this.targetReceiver = receiver;
        this.isMoving = false;
        this.isRunning = false;
        this.action.startCorner(this.ball);
    }

    setReceiveCornerTarget(kickerPos, ballX, ballZ) {
        this.isReceivingCorner = true;
        this.cornerTargetGoalX = ballX > 0 ? 48.5 : -48.5; 
        this.cornerCrossTarget = null;
        
        const dirX = ballX > 0 ? -1 : 1;

        // Si apposta nel cuore dell'area di rigore (Zona dischetto/limite area piccola)
        this.cornerSupportPos.set(
            ballX + (dirX * (11 + Math.random() * 3)), 
            0,
            (Math.random() * 8 - 4) 
        );
    }

    setReceiveGoalKickTarget(dirX) {
        this.isReceivingGoalKick = true;
        this.goalKickRunDir = dirX;
    }
}