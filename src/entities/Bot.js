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
        this.isReceivingThrowIn = false;
        this.throwInSupportPos = new THREE.Vector3();

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

    // AGGIUNTI PARAMETRI: opponents (Player + Teammates) e bots
    update(deltaTime, isMatchStarted = true, matchState = 'HOME_POSSESSION', defendDirX = 1, opponents = [], bots = []) {
        if (!this.model) return;
        if (this.isThrowingIn) {
            this.throwInTimer += deltaTime;

            // Fai guardare fluidamente il battitore verso il compagno che si avvicina!
            if (this.targetReceiver && this.targetReceiver.model) {
                 this.yaw = Math.atan2(
                     this.targetReceiver.model.position.x - this.model.position.x,
                     this.targetReceiver.model.position.z - this.model.position.z
                 );
                 // Ruota il bacino fluidamente verso il compagno
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
                    // Lancia esattamente dove sta guardando (verso il compagno)
                    let throwYaw = this.yaw + (Math.random() * 0.1 - 0.05);
                    this.action.executeThrow(this.ball, throwYaw, this.scene);

                    // Libera il ricevitore dal suo incarico (tornerà a giocare normale)
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

        // --- 2. GESTIONE RICEVITORE ---
        if (this.isReceivingThrowIn && !this.isThrowingIn) {
            // Sicurezza: se la palla viene rubata o è tornata in gioco, smetti di aspettare
            if (!this.ball.isHeld) {
                this.isReceivingThrowIn = false;
            } else {
                const distToSupport = this.model.position.distanceTo(this.throwInSupportPos);
                
                // Se non è ancora arrivato sul posto, corri
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
                    // Arrivato sul posto: fermati e guarda la palla aspettando il lancio
                    this.isMoving = false;
                    this.isRunning = false;
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
                
                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                
                // Applica la rotazione fluida calcolata (il fix dell'effetto scattoso!)
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);

                return; // Ferma l'esecuzione qui, ignora l'IA di attacco/difesa normale
            }
        }if (this.isThrowingIn) {
            this.throwInTimer += deltaTime;

            // Fai guardare fluidamente il battitore verso il compagno che si avvicina!
            if (this.targetReceiver && this.targetReceiver.model) {
                 this.yaw = Math.atan2(
                     this.targetReceiver.model.position.x - this.model.position.x,
                     this.targetReceiver.model.position.z - this.model.position.z
                 );
                 // Ruota il bacino fluidamente verso il compagno
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
                    // Lancia esattamente dove sta guardando (verso il compagno)
                    let throwYaw = this.yaw + (Math.random() * 0.1 - 0.05);
                    this.action.executeThrow(this.ball, throwYaw, this.scene);

                    // Libera il ricevitore dal suo incarico (tornerà a giocare normale)
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

        // --- 2. GESTIONE RICEVITORE ---
        if (this.isReceivingThrowIn && !this.isThrowingIn) {
            // Sicurezza: se la palla viene rubata o è tornata in gioco, smetti di aspettare
            if (!this.ball.isHeld) {
                this.isReceivingThrowIn = false;
            } else {
                const distToSupport = this.model.position.distanceTo(this.throwInSupportPos);
                
                // Se non è ancora arrivato sul posto, corri
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
                    // Arrivato sul posto: fermati e guarda la palla aspettando il lancio
                    this.isMoving = false;
                    this.isRunning = false;
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
                
                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                
                // Applica la rotazione fluida calcolata (il fix dell'effetto scattoso!)
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);

                return; // Ferma l'esecuzione qui, ignora l'IA di attacco/difesa normale
            }
        }
        
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
        
        // Calcola la distanza più breve tra i due angoli
        let diff = targetRot - currentRot;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // Gira il modello fluidamente (velocità 10)
        this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
        // --- FINE FIX ROTAZIONE ---

        this.handleCollisions();
        
    }

   executeDefendBehavior(deltaTime, defendDirX, opponents, bots) {
        if (!this.ball || !this.ball.isLoaded) return;

        const myGoalX = 49.5 * defendDirX; 
        const goalPos = new THREE.Vector3(myGoalX, 0, 0);

        // 1. MAPPATURA 1-A-1: Trova il mio indice nell'array dei bot
        let targetOpponent = null;
        const myIndex = bots.indexOf(this);
        
        // Assegna l'avversario con lo stesso indice (Bot 0 marca Opponent 0, Bot 1 marca Opp 1, ecc.)
        if (myIndex !== -1 && opponents[myIndex]) {
            targetOpponent = opponents[myIndex];
        }

        // 2. MARCATURA A UOMO RIGIDA
        if (targetOpponent) {
            const oppPos = targetOpponent.model ? targetOpponent.model.position : targetOpponent.position;
            // 0.1 significa: 90% letteralmente incollato all'avversario, 10% sfalsato verso la propria porta per fare scudo
            this._idealPos.lerpVectors(oppPos, goalPos, 0.1); 
        } else {
            // Fallback se per qualche motivo salta l'assegnazione
            this._idealPos.copy(this.startPos);
        }

        // 3. EVITAMENTO SOVRAPPOSIZIONI (Raggio ridotto, interviene solo se si incrociano le traiettorie)
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

        // 4. Limiti del campo
        this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
        this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

        // 5. Movimento Fisico
        const distToIdeal = this.model.position.distanceTo(this._idealPos);
        
        if (distToIdeal > 1.0) {
            this.isMoving = true;
            this._moveDir.subVectors(this._idealPos, this.model.position);
            this._moveDir.y = 0;
            this._moveDir.normalize();

            // Velocità ritoccata per fargli tenere bene il passo dell'uomo che stanno marcando
            const speed = distToIdeal > 4 ? 11 : 7; 
            this.isRunning = speed > 7;
            this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
        }

        // 6. Guarda sempre la palla (marcano a uomo ma col corpo rivolto al gioco)
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


    
    // Modifica questo metodo per fargli accettare il "receiver"
    startThrowIn(receiver = null) {
        this.isThrowingIn = true;
        this.throwInTimer = 0;
        this.targetReceiver = receiver; // Memorizza a chi dovrà lanciare
        
        this.isMoving = false;
        this.isRunning = false;
        
        const rightHand = this.animator.bones.rightHand;
        this.action.startThrowIn(this.ball, rightHand);
    }

    // Aggiungi questo metodo per il bot che deve ricevere la palla
    setReceiveThrowInTarget(throwerPos, side) {
        this.isReceivingThrowIn = true;
        // Si posiziona a circa 7 metri dal battitore, rientrando verso il centro del campo
        // 'side' ci dice in che metà campo siamo (1 o -1), quindi invertiamo per andare al centro
        this.throwInSupportPos.set(
            throwerPos.x + (Math.random() * 6 - 3), // Si smarca un po' a destra/sinistra
            0,
            throwerPos.z - (side * 7) // Entra in campo di 7 metri
        );
    }
}