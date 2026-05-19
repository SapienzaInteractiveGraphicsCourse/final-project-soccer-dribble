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

        // --- CACHE VETTORI (OTTIMIZZAZIONE) ---
        this._idealPos = new THREE.Vector3();
        this._moveDir = new THREE.Vector3();
        this._dirToBall = new THREE.Vector3();

        this.loadGLB();
    }

    loadGLB() {
        modelManager.load('/models/player.glb', (gltf) => {
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
        
        // --- 1. GESTIONE BATTITORE RIMESSA ---
        if (this.isThrowingIn) {
            this.throwInTimer += deltaTime;

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
            const releaseTime = waitTime + 0.55;
            const endTime = releaseTime + 0.4;

            let isThrowingInAnim = false;
            let isThrowingInState = true;

            if (this.throwInTimer >= waitTime) {
                isThrowingInState = false;
                isThrowingInAnim = true;

                if (this.throwInTimer >= releaseTime && this.ball.isHeld) {
                    let throwYaw = this.yaw + (Math.random() * 0.1 - 0.05);
                    this.action.executeThrow(this.ball, throwYaw, this.scene);

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

            // Segue il compagno che si avvicina con il corpo
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

            const waitTime = 1.2;          // Tempo di attesa/posizionamento
            const kickTime = waitTime + 0.2; // Inizio calcio di piatto assistito
            const endTime = kickTime + 0.4;  // Fine animazione follow-through

            // Fase di caricamento fittizio per attivare le ossa dell'animator
            if (this.cornerTimer >= waitTime && this.cornerTimer < kickTime) {
                if (!this.action.chargingAction) {
                    this.action.startCharge('pass');
                }
                this.action.updateCharge(deltaTime, null);
            }

            // Esecuzione del calcio assistito verso il ricevitore
            if (this.cornerTimer >= kickTime && this.action.chargingAction) {
                this.action.executeKick(this.ball, this.yaw, 0, null, this.targetReceiver);
                if (this.targetReceiver) {
                    this.targetReceiver.isReceivingCorner = false;
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

        // --- 4. GESTIONE RICEVITORE CALCIO D'ANGOLO ---
        if (this.isReceivingCorner && !this.isTakingCorner) {
            // Se la palla si muove ed è stata calciata, il bot torna libero
            if (this.ball.velocity.lengthSq() > 5.0) {
                this.isReceivingCorner = false;
            } else {
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

                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                return;
            }
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
            throwerPos.x + (Math.random() * 6 - 3), 
            0,
            throwerPos.z - (side * 7)
        );
    }

    // --- NUOVI METODI PER IL CORNER ---
    startCorner(receiver = null) {
        this.isTakingCorner = true;
        this.cornerTimer = 0;
        this.targetReceiver = receiver;
        this.isMoving = false;
        this.isRunning = false;
        
        // Inizializza i flag di sbilanciamento del calcio d'angolo in PlayerAction
        this.action.startCorner(this.ball);
    }

    setReceiveCornerTarget(kickerPos, ballX, ballZ) {
        this.isReceivingCorner = true;
        
        // Calcola i vettori per far entrare il bot dentro l'area di rigore in diagonale
        const dirX = ballX > 0 ? -1 : 1;
        const dirZ = ballZ > 0 ? -1 : 1;

        // Si posiziona a circa 10m di X e 12m di Z rispetto alla bandierina (vertice dell'area)
        this.cornerSupportPos.set(
            ballX + (dirX * 10.0),
            0,
            ballZ + (dirZ * 12.0)
        );
    }
}