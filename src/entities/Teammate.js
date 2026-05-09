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

    update(deltaTime, ball = null, bots = [], attackDirX = 1) {
        if (!this.model) return;

        let isRunning = false;
        let isMoving = false;

        // --- IA D'ATTACCO ---
        if (ball && ball.isLoaded) {
            this._idealPos.set(0, 0, 0);
            
            // 1. Avanzamento offensivo
            // Cerca di proporsi in avanti rispetto alla palla per ricevere un passaggio
            this._idealPos.x = ball.position.x + (attackDirX * 12); 
            
            // 2. Mantenimento della posizione larga (Fasce o Centro)
            let laneZ = 0;
            if (this.startPosition.z > 5) laneZ = 14;
            else if (this.startPosition.z < -5) laneZ = -14;
            
            // Se siamo in zona d'attacco (vicini all'area di rigore), stringi verso il centro
            if (Math.abs(this.model.position.x) > 30) {
                this._idealPos.z = THREE.MathUtils.lerp(this.model.position.z, 0, deltaTime * 1.5);
            } else {
                this._idealPos.z = THREE.MathUtils.lerp(this.model.position.z, laneZ, deltaTime * 1.5);
            }

            // 3. Evita gli avversari (Ricerca Spazio Libero)
            const avoidanceRadius = 8.0;
            this._avoidanceVector.set(0, 0, 0);
            
            if (bots && bots.length > 0) {
                bots.forEach(bot => {
                    if (bot && bot.model) {
                        const dist = this.model.position.distanceTo(bot.model.position);
                        if (dist < avoidanceRadius) {
                            this._pushAway.subVectors(this.model.position, bot.model.position);
                            this._pushAway.y = 0;
                            this._pushAway.normalize().multiplyScalar(avoidanceRadius - dist);
                            this._avoidanceVector.add(this._pushAway);
                        }
                    }
                });
            }
            
            this._idealPos.add(this._avoidanceVector);

            // 4. Limiti del campo (per evitare che i giocatori escano)
            this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
            this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

            // 5. Movimento Fisico
            const distToIdeal = this.model.position.distanceTo(this._idealPos);
            const distToBall = this.model.position.distanceTo(ball.position);
            
            // Se il compagno è troppo vicino alla palla (rischia di rubarla al player), si allontana
            if (distToBall < 3.5) {
                this._pushFromBall.subVectors(this.model.position, ball.position);
                this._pushFromBall.y = 0;
                this._pushFromBall.normalize();
                this.model.position.addScaledVector(this._pushFromBall, 7 * deltaTime);
                isMoving = true;
                isRunning = true;
            } else if (distToIdeal > 1.5) {
                isMoving = true;
                this._moveDir.subVectors(this._idealPos, this.model.position);
                this._moveDir.y = 0;
                this._moveDir.normalize();

                const speed = distToIdeal > 8 ? 12 : 6;
                isRunning = speed > 8;
                this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
            }

            // 6. Guarda sempre la palla per essere pronto a ricevere
            this._dirToBall.subVectors(ball.position, this.model.position);
            this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
        }

        this.model.rotation.y = THREE.MathUtils.lerp(
            this.model.rotation.y, this.yaw, deltaTime * 15
        );

        this.animator.animate(deltaTime, false, isMoving, isRunning, false, null, 0);

        const FIELD_WIDTH_X = 97;
        const FIELD_LENGTH_Z = 65;
        let pX = ((this.model.position.x / FIELD_WIDTH_X) + 0.5) * 100;
        let pZ = ((this.model.position.z / FIELD_LENGTH_Z) + 0.5) * 100;
        
        this.radarDot.style.left = pX + '%';
        this.radarDot.style.top = pZ + '%';
    }
}