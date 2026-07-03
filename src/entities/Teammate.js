import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';
import { tacticalManager } from '../game/TacticalManager.js';

export class Teammate {
    constructor(scene, startPosition, startYaw = 0) {
        this.id = Math.random().toString(36).substr(2, 9); // ID univoco per il manager
        this.scene = scene;
        this.model = null;
        this.animator = new PlayerAnimator();
        
        this.startPosition = startPosition;
        this.yaw = startYaw; 

        // --- STATISTICHE GIOCATORE ---
        this.stamina = 100;
        this.playerName = "Compagno";
        this.avatar = "👤";

        this.radarDot = document.createElement('div');
        this.radarDot.style.position = 'absolute';
        this.radarDot.style.width = '8px';
        this.radarDot.style.height = '8px';
        this.radarDot.style.backgroundColor = '#f44336';
        this.radarDot.style.borderRadius = '50%';
        this.radarDot.style.transform = 'translate(-50%, -50%)';
        this.radarDot.style.zIndex = '5';
        
        setTimeout(() => {
            const radarContainer = document.getElementById('radar-player').parentNode;
            if(radarContainer) radarContainer.appendChild(this.radarDot);
        }, 500);

        // --- CACHE VETTORI (OTTIMIZZAZIONE) ---
        this._idealPos = new THREE.Vector3();
        this._avoidanceVector = new THREE.Vector3();
        this._teammateSeparation = new THREE.Vector3(); // <--- NUOVO
        this._pushAway = new THREE.Vector3();
        this._pushFromBall = new THREE.Vector3();
        this._moveDir = new THREE.Vector3();
        this._dirToBall = new THREE.Vector3();

        // (Stati rimessa e corner omessi per brevità, mantieni i tuoi)
        this.isReceivingGoalKick = false;
        this.goalKickRunDir = 1;
        this.isReceivingThrowIn = false;
        this.throwInSupportPos = new THREE.Vector3();
        this.isReceivingCorner = false;
        this.cornerSupportPos = new THREE.Vector3();

        this.loadGLB();
    }

    loadGLB() {
        modelManager.load(`${import.meta.env.BASE_URL}models/player.glb`, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(1.5, 1.5, 1.5);
            this.model.position.copy(this.startPosition);
            this.model.rotation.y = this.yaw; // <--- Applichiamo la rotazione
            
            this.model.traverse((child) => {
                if (child.isMesh) { 
                    child.castShadow = true; 
                    child.receiveShadow = false; 
                    if (child.name === 'Ch38_Shirt') {
                        child.material = child.material.clone(); 
                        child.material.color.setHex(0xff0000); 
                    }
                }
            });

            this.animator.initBones(this.model);
            this.scene.add(this.model);
        });
    }

    update(deltaTime, ball, player = null, opponents = [], teammates = [], attackDirX = 1, isMatchStarted = true, matchState = 'HOME_POSSESSION') {
        if (!this.model) return;
        
        this.model.rotation.x = 0;
        this.model.rotation.z = 0;

        if (!isMatchStarted) {
            if (ball && ball.isLoaded) {
                this._dirToBall.subVectors(ball.position, this.model.position);
                this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
            }
            this.animator.animate(deltaTime, false, false, false, false, null, 0);
            return; 
        }

        // --- GESTIONE RICEVITORE RIMESSA LATERALE ---
        if (this.isReceivingThrowIn) {
            if (ball && !ball.isHeld) {
                // La palla è stata lanciata, torna alla logica normale
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
                    this._dirToBall.subVectors(ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }

                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);

                this.updateRadar();
                this.handleCollisions(ball);
                return;
            }
        }

        // --- GESTIONE RICEVITORE RIMESSA DAL FONDO ---
        if (this.isReceivingGoalKick) {
            const distToBallXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                 .distanceTo(new THREE.Vector2(ball.position.x, ball.position.z));
            
            const isBallOutArea = Math.abs(ball.position.x) < 33; 
            const isBallKicked = !ball.isHeld && ball.velocity.lengthSq() > 5.0;

            if (distToBallXZ < 3.0 || (isBallKicked && isBallOutArea && ball.position.y <= ball.radius + 0.2)) {
                this.isReceivingGoalKick = false;
            } else {
                this.isMoving = true;
                this.isRunning = true;
                this._moveDir.set(this.goalKickRunDir, 0, 0);
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
                
                this.updateRadar();
                this.handleCollisions(ball);
                return;
            }
        }

        // --- GESTIONE RICEVITORE CALCIO D'ANGOLO ---
        if (this.isReceivingCorner) {
            if (ball.velocity.lengthSq() > 2.0) {
                this.isReceivingCorner = false; // Il cross è partito, torna alla logica normale per attaccare la palla
            } else {
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
                    this._dirToBall.subVectors(ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
                
                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                
                this.updateRadar();
                this.handleCollisions(ball);
                return;
            }
        }

        switch (matchState) {
            case 'HOME_POSSESSION':
                tacticalManager.updateOffensiveLanes(player, teammates, ball, attackDirX);
                this.executeAttackBehavior(deltaTime, ball, player, opponents, teammates, attackDirX);
                break;

            case 'AWAY_POSSESSION':
                // Passiamo tutto il contesto anche alla difesa
                this.executeDefendBehavior(deltaTime, ball, player, opponents, teammates, attackDirX);
                break;
        }

        this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
        this.updateRadar();
        this.handleCollisions(ball);
    }

    updateRadar() {
        const FIELD_WIDTH_X = 97;
        const FIELD_LENGTH_Z = 65;
        let pX = ((this.model.position.x / FIELD_WIDTH_X) + 0.5) * 100;
        let pZ = ((this.model.position.z / FIELD_LENGTH_Z) + 0.5) * 100;
        
        this.radarDot.style.left = pX + '%';
        this.radarDot.style.top = pZ + '%';
    }

    handleCollisions(ball) {
        if (ball && ball.isLoaded) {
            const playerHeight = 1.8;
            const playerRadius = 0.35; 
            
            const closestY = Math.max(this.model.position.y, Math.min(this.model.position.y + playerHeight, ball.position.y));
            const closestPointOnPlayer = new THREE.Vector3(this.model.position.x, closestY, this.model.position.z);
            
            const distanceToBall3D = closestPointOnPlayer.distanceTo(ball.position);
            const minDistance = playerRadius + ball.radius;

            if (distanceToBall3D < minDistance) {
                const pushDir = new THREE.Vector3().subVectors(ball.position, closestPointOnPlayer);
                if (pushDir.lengthSq() > 0.001) {
                    pushDir.normalize();
                    if (pushDir.y > 0.5) {
                        pushDir.y = 0.2;
                        pushDir.x += Math.sign(pushDir.x || (Math.random() - 0.5)) * 1.5;
                        pushDir.z += Math.sign(pushDir.z || (Math.random() - 0.5)) * 1.5;
                        pushDir.normalize();
                    }
                } else {
                    pushDir.set((Math.random() - 0.5), 0.2, (Math.random() - 0.5)).normalize(); 
                }

                const overlap = minDistance - distanceToBall3D;
                ball.position.addScaledVector(pushDir, overlap);

                const dot = ball.velocity.dot(pushDir);
                if (dot < 0) {
                    const restitution = 0.3; 
                    const bounceImpulse = pushDir.clone().multiplyScalar(dot * (1 + restitution));
                    ball.velocity.sub(bounceImpulse);

                    if (this.isMoving && this._moveDir) {
                        const speed = this.isRunning ? 12 : 6;
                        const playerVel = this._moveDir.clone().multiplyScalar(speed);
                        
                        const impactVel = playerVel.dot(pushDir);
                        if (impactVel > 0) {
                            ball.velocity.add(pushDir.multiplyScalar(impactVel * 0.4));
                        }
                    }
                }
            }
        }
    }


    executeAttackBehavior(deltaTime, ball, player = null, opponents = [], teammates = [], attackDirX = 1) {
        if (!ball || !ball.isLoaded) return;
        
        this._idealPos.set(0, 0, 0);
        
        // 1. IDENTIFICAZIONE CORSIA DINAMICA (Position Replacement)
        const laneZ = tacticalManager.getAssignedLaneZ(this.id);

        // 2. CALCOLO AVANZAMENTO E PROFONDITÀ (Fix: Assegnazione diretta, il LERP avviene nel movimento fisico)
        const isBallNearGoal = (attackDirX === 1 && ball.position.x > 30) ||
                               (attackDirX === -1 && ball.position.x < -30);

        if (isBallNearGoal) {
            let targetZ = laneZ * 0.5; 
            let targetX = ball.position.x + (attackDirX * 4); 
            
            const maxDepth = 40; 
            targetX = attackDirX === 1 ? Math.min(targetX, maxDepth) : Math.max(targetX, -maxDepth);

            this._idealPos.x = targetX;
            this._idealPos.z = targetZ; // <--- FIX: Niente LERP, posizione assoluta
        } else {
            this._idealPos.x = ball.position.x + (attackDirX * 14); 
            this._idealPos.z = laneZ;   // <--- FIX: Niente LERP, posizione assoluta
        }

        // 3. SEPARATION TRA COMPAGNI (Non calpestarsi i piedi)
        const teamSeparationRadius = 6.0;
        this._teammateSeparation.set(0, 0, 0);
        let forceMoveAway = false; // <--- FLAG PER FORZARE LO SPOSTAMENTO

        const allAllies = [...teammates, player].filter(a => a && a !== this && a.model);
        allAllies.forEach(ally => {
            const dist = this.model.position.distanceTo(ally.model.position);
            if (dist < teamSeparationRadius) {
                const push = new THREE.Vector3().subVectors(this.model.position, ally.model.position);
                push.y = 0;
                // Spinta aumentata (x 1.5) per una repulsione chiara e netta
                push.normalize().multiplyScalar((teamSeparationRadius - dist) * 1.5); 
                this._teammateSeparation.add(push);
                
                forceMoveAway = true; // Se siamo troppo vicini, IGNORA la deadzone e scappa
            }
        });
        this._idealPos.add(this._teammateSeparation);

        // 4. SMARCAMENTO DAGLI AVVERSARI (Avoidance)
        const avoidanceRadius = 15.0; 
        this._avoidanceVector.set(0, 0, 0);
        
        if (opponents && opponents.length > 0) {
            opponents.forEach(bot => {
                if (bot && bot.model) {
                    const dist = this.model.position.distanceTo(bot.model.position);
                    if (dist < avoidanceRadius) {
                        this._pushAway.subVectors(this.model.position, bot.model.position);
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

        // 5. LIMITI DEL CAMPO
        this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
        this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

        // 6. MOVIMENTO FISICO E SCHIVATA PALLA
        const distToIdeal = this.model.position.distanceTo(this._idealPos);
        const distToBall = this.model.position.distanceTo(ball.position);
        
        const dodgeEnter = 3.5;
        const dodgeExit = 5.0;
        this._isDodgingBall = this._isDodgingBall ? (distToBall < dodgeExit) : (distToBall < dodgeEnter);

        if (this._isDodgingBall) {
            this._pushFromBall.subVectors(this.model.position, ball.position);
            this._pushFromBall.y = 0;
            this._pushFromBall.normalize();
            this.model.position.addScaledVector(this._pushFromBall, 7 * deltaTime);
            this.isMoving = true;
            this.isRunning = true;
        } else {
            // FIX: forceMoveAway salta la regola dei 2 metri di tolleranza
            let shouldMove = forceMoveAway || (this.isMoving ? (distToIdeal > 0.8) : (distToIdeal > 2.0));

            if (shouldMove) {
                this.isMoving = true;
                this._moveDir.subVectors(this._idealPos, this.model.position);
                this._moveDir.y = 0;
                this._moveDir.normalize();

                this.isRunning = this.isRunning ? (distToIdeal > 4.5) : (distToIdeal > 7);
                
                const speed = this.isRunning ? 12 : 7;
                this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
            } else {
                this.isMoving = false;
                this.isRunning = false;
            }
        }

        // 7. ORIENTAMENTO VERSO LA PALLA
        this._dirToBall.subVectors(ball.position, this.model.position);
        this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
    }

    executeDefendBehavior(deltaTime, ball, player = null, opponents = [], teammates = [], attackDirX = 1) {
        if (!ball || !ball.isLoaded) return;
        
        // 1. IDENTIFICAZIONE PORTA (La porta da difendere è opposta a quella d'attacco)
        const myGoalX = -49.5 * attackDirX; 
        const goalPos = new THREE.Vector3(myGoalX, 0, 0);

        // 2. ASSEGNAZIONE MARCATURA A UOMO
        let targetOpponent = null;
        const myIndex = teammates.indexOf(this);
        
        // Il compagno 0 marca il bot 0, il compagno 1 marca il bot 1
        if (myIndex !== -1 && opponents[myIndex]) {
            targetOpponent = opponents[myIndex];
        }

        // 3. POSIZIONAMENTO TATTICO
        if (targetOpponent) {
            // Si mette in mezzo (al 10%) tra l'avversario e la propria porta
            const oppPos = targetOpponent.model ? targetOpponent.model.position : targetOpponent.position;
            this._idealPos.lerpVectors(oppPos, goalPos, 0.1); 
        } else {
            // Se non ha una marcatura, copre la sua zona di partenza
            this._idealPos.copy(this.startPosition);
        }

        // 4. AVOIDANCE COMPAGNI (Non sbattere contro il player o l'altro teammate)
        const allAllies = [...teammates, player].filter(a => a && a !== this && a.model);
        const avoidanceRadius = 1.5; 
        
        if (allAllies.length > 0) {
            allAllies.forEach(ally => {
                const dist = this.model.position.distanceTo(ally.model.position);
                if (dist < avoidanceRadius && dist > 0.01) {
                    const pushAway = new THREE.Vector3().subVectors(this.model.position, ally.model.position);
                    pushAway.y = 0;
                    pushAway.normalize().multiplyScalar((avoidanceRadius - dist) * 0.8);
                    this._idealPos.add(pushAway);
                }
            });
        }

        // 5. LIMITI DEL CAMPO
        this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
        this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

        // 6. MOVIMENTO FISICO CON ISTERESI
        const distToIdeal = this.model.position.distanceTo(this._idealPos);

        let shouldMove;
        if (this.isMoving) {
            shouldMove = distToIdeal > 0.5; // Una volta in moto, fermati solo se sei arrivato
        } else {
            shouldMove = distToIdeal > 1.5; // Da fermo, parti solo se il target si allontana
        }

        if (shouldMove) {
            this.isMoving = true;
            this._moveDir.subVectors(this._idealPos, this.model.position);
            this._moveDir.y = 0;
            this._moveDir.normalize();
            
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

        // 7. ORIENTAMENTO (Guarda sempre la palla)
        this._dirToBall.subVectors(ball.position, this.model.position);
        this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
    }

    setReceiveThrowInTarget(throwerPos, side) {
        this.isReceivingThrowIn = true;
        this.throwInSupportPos.set(
            throwerPos.x + (Math.random() * 4 - 2),
            0,
            throwerPos.z - (side * 6) // Mantiene distanza per una ricezione comoda
        );
    }

    setReceiveCornerTarget(ballX, ballZ) {
        this.isReceivingCorner = true;
        const dirX = ballX > 0 ? -1 : 1;
        // Posizionamento al centro dell'area di rigore (zona dischetto e limite area piccola)
        this.cornerSupportPos.set(
            ballX + (dirX * (11 + Math.random() * 4)), 
            0,
            (Math.random() * 12 - 6) 
        );
    }

    setReceiveGoalKickTarget(dirX) {
        this.isReceivingGoalKick = true;
        this.goalKickRunDir = dirX;
    }
}