// Bot.js
import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';
import { PlayerAction } from '../animation-action/PlayerAction.js';

export class Bot {
    constructor(scene, ball, startPos, startYaw) {
        this.scene = scene;
        this.ball = ball;
        this.startPos = startPos;
        this.yaw = startYaw;
        this.model = null;

        this.animator = new PlayerAnimator();
        this.action = new PlayerAction();

        this.targetReceiver = null;
        
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
        this.cornerTargetGoalX = 0; // Memorizza quale porta attaccare

        // --- STATI RIMESSA DAL FONDO ---
        this.isReceivingGoalKick = false;
        this.goalKickRunDir = 1;

        // --- STATI CALCIO D'INIZIO ---
        this.isTakingKickOff = false;
        this.kickOffTimer = 0;

        // --- CACHE VETTORI (OTTIMIZZAZIONE) ---
        this._idealPos = new THREE.Vector3();
        this._moveDir = new THREE.Vector3();
        this._dirToBall = new THREE.Vector3();

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
                    this.isRunning = distToSupport > 4;
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
                this.action.executeKick(this.ball, this.yaw, 0, null, fakeTarget);

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
                    this.isRunning = distToSupport > 4;
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
                    this.action.executeKick(this.ball, this.yaw + shotError, -0.1, null, null);
                    
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
            if (!this.ball.isHeld && this.ball.velocity.lengthSq() > 5.0) {
                const distToBallXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                     .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
                
                // Interrompe la routine se la palla tocca terra o è a distanza di controllo palla
                if (distToBallXZ < 3.0 || this.ball.position.y <= this.ball.radius + 0.1) {
                    this.isReceivingGoalKick = false;
                } else {
                    this.isMoving = true;
                    this.isRunning = true;
                    this._moveDir.set(this.ball.position.x - this.model.position.x, 0, this.ball.position.z - this.model.position.z).normalize();
                    this.model.position.addScaledVector(this._moveDir, 11 * deltaTime); // Insegue la traiettoria
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                }
            } else {
                this.isMoving = true;
                this.isRunning = true;
                this._moveDir.set(this.goalKickRunDir, 0, 0); // Scatta in avanti
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
                this.action.executeKick(this.ball, this.yaw, 0, null, passTarget);
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
        this.isRunning = false;
        this.isMoving = false;

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
                this.executeAttackBehavior(deltaTime);
                break;
        }

        this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
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
        if (distToIdeal > 1.0) {
            this.isMoving = true;
            this._moveDir.subVectors(this._idealPos, this.model.position);
            this._moveDir.y = 0;
            this._moveDir.normalize();
            const speed = distToIdeal > 4 ? 11 : 7; 
            this.isRunning = speed > 7;
            this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
        }

        this._dirToBall.subVectors(this.ball.position, this.model.position);
        this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
    }

    executeAttackBehavior(deltaTime) {
        if (this.ball && this.ball.isLoaded) {
            this._dirToBall.subVectors(this.ball.position, this.model.position);
            this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
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
                if (pushDir.lengthSq() > 0.001) pushDir.normalize();
                else pushDir.set(0, 1, 0); 

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