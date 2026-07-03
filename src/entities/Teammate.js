import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';

export class Teammate {
    constructor(scene, startPosition, startYaw = 0) {
        this.scene = scene;
        this.model = null;
        this.animator = new PlayerAnimator();
        
        this.startPosition = startPosition;
        this.yaw = startYaw; // <--- NUOVO

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
        this._pushAway = new THREE.Vector3();
        this._pushFromBall = new THREE.Vector3();
        this._moveDir = new THREE.Vector3();
        this._dirToBall = new THREE.Vector3();

        // --- STATI RIMESSA DAL FONDO ---
        this.isReceivingGoalKick = false;
        this.goalKickRunDir = 1;

        // --- STATI RIMESSA LATERALE ---
        this.isReceivingThrowIn = false;
        this.throwInSupportPos = new THREE.Vector3();

        // --- STATI CALCIO D'ANGOLO ---
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

    update(deltaTime, ball = null, bots = [], attackDirX = 1, isMatchStarted = true, matchState = 'HOME_POSSESSION') {
        if (!this.model) return;
        
        // Reset manuale di X e Z per evitare flip visivi (es. dopo il ReplaySystem)
        this.model.rotation.x = 0;
        this.model.rotation.z = 0;

        // NOTA: NON resettiamo isMoving/isRunning qui.
        // Ogni metodo di comportamento gestisce il proprio stato
        // per preservare l'isteresi anti-flickering.

        // --- BLOCCO CALCIO D'INIZIO ---
        if (!isMatchStarted) {
            if (ball && ball.isLoaded) {
                this._dirToBall.subVectors(ball.position, this.model.position);
                this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
            }
            // Forza l'animazione di Idle
            this.animator.animate(deltaTime, false, false, false, false, null, 0);
            return; // Interrompe qui la logica: nessun calcolo di movimento
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
            if (!ball.isHeld && ball.velocity.lengthSq() > 5.0) {
                const distToBallXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                     .distanceTo(new THREE.Vector2(ball.position.x, ball.position.z));
                
                if (distToBallXZ < 3.0 || ball.position.y <= ball.radius + 0.1) {
                    this.isReceivingGoalKick = false;
                } else {
                    this.isMoving = true;
                    this.isRunning = true;
                    this._moveDir.set(ball.position.x - this.model.position.x, 0, ball.position.z - this.model.position.z).normalize();
                    this.model.position.addScaledVector(this._moveDir, 11 * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                }
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
                // La palla ce l'hai tu o un compagno: ATTACCO
                this.executeAttackBehavior(deltaTime, ball, bots, attackDirX);
                break;

            case 'AWAY_POSSESSION':
                // La palla ce l'ha l'avversario: DIFESA (da implementare)
                this.executeDefendBehavior(deltaTime, ball, bots);
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


    executeAttackBehavior(deltaTime, ball, bots, attackDirX) {
        if (ball && ball.isLoaded) {
            this._idealPos.set(0, 0, 0);
            
            // 1. Identificazione Ruolo (Fascia o Centro)
            let laneZ = 0;
            if (this.startPosition.z > 5) laneZ = 14;
            else if (this.startPosition.z < -5) laneZ = -14;

            // 2. Calcolo Avanzamento Offensivo e Posizionamento Z
            const isBallNearGoal = (attackDirX === 1 && ball.position.x > 30) ||
                                   (attackDirX === -1 && ball.position.x < -30);

            if (isBallNearGoal) {
                // In zona d'attacco: i giocatori sulle fasce tagliano verso l'area, ma non si sovrappongono
                let targetZ = laneZ * 0.5; // Stringono verso il centro (es. da 14 a 7)
                
                // Manteniamo una distanza di sicurezza dal portiere e creiamo opzioni di passaggio (cutback)
                let targetX = ball.position.x + (attackDirX * 4); 
                
                // Limite massimo di profondità per non incollarsi al portiere
                const maxDepth = 40; 
                if (attackDirX === 1) targetX = Math.min(targetX, maxDepth);
                else targetX = Math.max(targetX, -maxDepth);

                this._idealPos.x = targetX;
                this._idealPos.z = THREE.MathUtils.lerp(this.model.position.z, targetZ, deltaTime * 2.0);
            } else {
                // Costruzione dell'azione a centrocampo/difesa
                this._idealPos.x = ball.position.x + (attackDirX * 14); 
                this._idealPos.z = THREE.MathUtils.lerp(this.model.position.z, laneZ, deltaTime * 1.5);
            }

            // 3. SMARCAMENTO (Evita i bot avversari)
            const avoidanceRadius = 15.0; 
            this._avoidanceVector.set(0, 0, 0);
            
            if (bots && bots.length > 0) {
                bots.forEach(bot => {
                    if (bot && bot.model) {
                        const dist = this.model.position.distanceTo(bot.model.position);
                        if (dist < avoidanceRadius) {
                            // Fuga dal bot
                            this._pushAway.subVectors(this.model.position, bot.model.position);
                            this._pushAway.y = 0;
                            this._pushAway.normalize();

                            // Direzione verso la posizione ideale
                            const dirToIdeal = new THREE.Vector3(this._idealPos.x - this.model.position.x, 0, this._idealPos.z - this.model.position.z);
                            if (dirToIdeal.lengthSq() > 0.001) dirToIdeal.normalize();
                            else dirToIdeal.set(1, 0, 0);

                            // Blend intelligente: allontanati dal difensore ma cerca di andare verso la meta
                            const evasionBlend = Math.min(dist / avoidanceRadius, 1.0); 
                            
                            const escapeDir = new THREE.Vector3().lerpVectors(this._pushAway, dirToIdeal, evasionBlend).normalize();

                            // Più il bot è vicino, più forte è la repulsione
                            escapeDir.multiplyScalar(avoidanceRadius - dist);
                            this._avoidanceVector.add(escapeDir);
                        }
                    }
                });
            }
            
            // Applica il vettore di smarcamento
            this._idealPos.add(this._avoidanceVector);

            // 4. Limiti del campo (non uscire dal campo)
            this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
            this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

            // 5. Movimento Fisico
            const distToIdeal = this.model.position.distanceTo(this._idealPos);
            const distToBall = this.model.position.distanceTo(ball.position);
            
            // Isteresi per la zona di dodge dalla palla
            const dodgeEnter = 3.5;
            const dodgeExit = 5.0;
            const isDodging = this._isDodgingBall 
                ? (distToBall < dodgeExit)  // Una volta che scansa, continua finché non è a 5m
                : (distToBall < dodgeEnter); // Inizia a scansare a 3.5m
            this._isDodgingBall = isDodging;

            if (isDodging) {
                // Scansa la palla se ci finisce troppo vicino per non disturbare il giocatore
                this._pushFromBall.subVectors(this.model.position, ball.position);
                this._pushFromBall.y = 0;
                this._pushFromBall.normalize();
                this.model.position.addScaledVector(this._pushFromBall, 7 * deltaTime);
                this.isMoving = true;
                this.isRunning = true;
            } else {
                // Isteresi per isMoving: evita flickering tra camminata e idle
                let shouldMove;
                if (this.isMoving) {
                    shouldMove = distToIdeal > 0.8; // Una volta in moto, fermati solo quando sei vicino
                } else {
                    shouldMove = distToIdeal > 2.0; // Da fermo, parti solo quando sei lontano
                }

                if (shouldMove) {
                    this.isMoving = true;
                    this._moveDir.subVectors(this._idealPos, this.model.position);
                    this._moveDir.y = 0;
                    this._moveDir.normalize();

                    // Isteresi per evitare flickering tra corsa e camminata
                    if (this.isRunning) {
                        this.isRunning = distToIdeal > 4.5;
                    } else {
                        this.isRunning = distToIdeal > 7;
                    }
                    const speed = this.isRunning ? 12 : 7;
                    this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
                } else {
                    this.isMoving = false;
                    this.isRunning = false;
                }
            }

            // 6. Guarda sempre la palla
            this._dirToBall.subVectors(ball.position, this.model.position);
            this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
        }

    }

    executeDefendBehavior(deltaTime, ball, bots) {
        // In difesa il compagno resta fermo (logica futura)
        this.isMoving = false;
        this.isRunning = false;
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