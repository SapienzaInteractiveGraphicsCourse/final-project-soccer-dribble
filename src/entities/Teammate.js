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

        this.loadGLB();
    }

    loadGLB() {
        modelManager.load('/models/player.glb', (gltf) => {
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

    update(deltaTime, ball = null, bots = [], attackDirX = 1, isMatchStarted = true, matchState = 'FREE_BALL') {
        if (!this.model) return;

        this.isRunning = false;
        this.isMoving = false;

        // --- BLOCCO CALCIO D'INIZIO ---
        if (!isMatchStarted) {
            if (ball && ball.isLoaded) {
                this._dirToBall.subVectors(ball.position, this.model.position);
                this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                this.model.rotation.y = THREE.MathUtils.lerp(
                    this.model.rotation.y, this.yaw, deltaTime * 15
                );
            }
            // Forza l'animazione di Idle
            this.animator.animate(deltaTime, false, false, false, false, null, 0);
            return; // Interrompe qui la logica: nessun calcolo di movimento
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

            case 'FREE_BALL':
                // Palla contesa: CHI È PIÙ VICINO CI VA (da implementare)
                this.executeFreeBallBehavior(deltaTime, ball);
                break;
        }

        
        this.model.rotation.y = THREE.MathUtils.lerp(
            this.model.rotation.y, this.yaw, deltaTime * 15
        );

        this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);

        // --- AGGIORNAMENTO RADAR ---
        const FIELD_WIDTH_X = 97;
        const FIELD_LENGTH_Z = 65;
        let pX = ((this.model.position.x / FIELD_WIDTH_X) + 0.5) * 100;
        let pZ = ((this.model.position.z / FIELD_LENGTH_Z) + 0.5) * 100;
        
        this.radarDot.style.left = pX + '%';
        this.radarDot.style.top = pZ + '%';

        // --- COLLISIONE FISICA CORPO INTERO ---
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
                } else {
                    pushDir.set(0, 1, 0); 
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
            
            // 1. Avanzamento offensivo
            this._idealPos.x = ball.position.x + (attackDirX * 12); 
            
            // 2. Mantenimento della posizione larga (Fasce o Centro)
            let laneZ = 0;
            if (this.startPosition.z > 5) laneZ = 14;
            else if (this.startPosition.z < -5) laneZ = -14;
            
            if (Math.abs(this.model.position.x) > 30) {
                this._idealPos.z = THREE.MathUtils.lerp(this.model.position.z, 0, deltaTime * 1.5);
            } else {
                this._idealPos.z = THREE.MathUtils.lerp(this.model.position.z, laneZ, deltaTime * 1.5);
            }

            // 3. SMARCAMENTO (Evita i bot e punta la porta)
            const avoidanceRadius = 12.0; // Aumentato un po' per farli reagire in anticipo
            this._avoidanceVector.set(0, 0, 0);
            
            if (bots && bots.length > 0) {
                const targetGoalX = 49.5 * attackDirX; // X della porta avversaria

                bots.forEach(bot => {
                    if (bot && bot.model) {
                        const dist = this.model.position.distanceTo(bot.model.position);
                        if (dist < avoidanceRadius) {
                            // A) Vettore di pura fuga dal bot
                            this._pushAway.subVectors(this.model.position, bot.model.position);
                            this._pushAway.y = 0;
                            this._pushAway.normalize();

                            // B) Vettore verso il centro della porta avversaria
                            const dirToGoal = new THREE.Vector3(targetGoalX - this.model.position.x, 0, 0 - this.model.position.z).normalize();

                            // C) Blend intelligente: se il bot è vicinissimo (distanza vicina a 0) scappa e basta.
                            // Se il bot è ai margini del raggio, curva pesantemente verso la porta.
                            const evasionBlend = dist / avoidanceRadius; 
                            
                            // lerpVectors miscela le due direzioni. Usa evasionBlend o un valore fisso tipo 0.5 o 0.6
                            const escapeDir = new THREE.Vector3().lerpVectors(this._pushAway, dirToGoal, 0.6).normalize();

                            // Scala l'intensità della fuga in base a quanto è vicino il bot
                            escapeDir.multiplyScalar(avoidanceRadius - dist);
                            this._avoidanceVector.add(escapeDir);
                        }
                    }
                });
            }
            
            this._idealPos.add(this._avoidanceVector);

            // 4. Limiti del campo
            this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
            this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

            // 5. Movimento Fisico
            const distToIdeal = this.model.position.distanceTo(this._idealPos);
            const distToBall = this.model.position.distanceTo(ball.position);
            
            if (distToBall < 3.5) {
                this._pushFromBall.subVectors(this.model.position, ball.position);
                this._pushFromBall.y = 0;
                this._pushFromBall.normalize();
                this.model.position.addScaledVector(this._pushFromBall, 7 * deltaTime);
                this.isMoving = true;
                this.isRunning = true;
            } else if (distToIdeal > 1.5) {
                this.isMoving = true;
                this._moveDir.subVectors(this._idealPos, this.model.position);
                this._moveDir.y = 0;
                this._moveDir.normalize();

                const speed = distToIdeal > 8 ? 12 : 6;
                this.isRunning = speed > 8;
                this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
            }

            // 6. Guarda sempre la palla
            this._dirToBall.subVectors(ball.position, this.model.position);
            this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
        }

    }

    executeDefendBehavior(deltaTime, ball, bots) {
        // Qui scriveremo la logica per tornare in posizione o pressare
    }

    executeFreeBallBehavior(deltaTime, ball) {
        if (!ball || !ball.isLoaded) return;

        const distToBall = this.model.position.distanceTo(ball.position);
        
        // Se il compagno è nel raggio di 15 metri, andrà a caccia della palla
        const isNearBall = distToBall < 15.0; 

        if (isNearBall) {
            // 1. AGGRESSIONE: Punta dritto verso la palla
            this._idealPos.copy(ball.position);
            this._idealPos.y = 0;
        } else {
            // 2. TATTICA: Torna verso la sua zona, ma segue l'azione con lo sguardo
            this._idealPos.copy(this.startPosition);
            
            // Si sposta leggermente (30%) verso la X e la Z della palla per non essere troppo statico
            this._idealPos.x = THREE.MathUtils.lerp(this.startPosition.x, ball.position.x, 0.3);
            this._idealPos.z = THREE.MathUtils.lerp(this.startPosition.z, ball.position.z, 0.3);
        }

        // 3. Limiti del campo (per evitare che escano dalle linee)
        this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
        this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

        // 4. Movimento Fisico verso la posizione ideale calcolata
        const distToIdeal = this.model.position.distanceTo(this._idealPos);
        
        if (distToIdeal > 1.0) {
            this.isMoving = true;
            this._moveDir.subVectors(this._idealPos, this.model.position);
            this._moveDir.y = 0;
            this._moveDir.normalize();

            // Se sta andando sulla palla scatta (12), se si sta riposizionando trotterella (6)
            const speed = isNearBall ? 12 : 6; 
            this.isRunning = speed > 8;
            
            this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
        }

        // 5. Indipendentemente da dove va, guarda sempre la palla
        this._dirToBall.subVectors(ball.position, this.model.position);
        this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
    }
}