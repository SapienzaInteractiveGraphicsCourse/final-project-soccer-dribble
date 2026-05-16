// Bot.js
import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';

export class Bot {
    constructor(scene, ball, startPos, startYaw) {
        this.scene = scene;
        this.ball = ball;
        this.startPos = startPos;
        this.yaw = startYaw;
        this.model = null;

        this.animator = new PlayerAnimator();

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
                    
                    // COLORA LA MAGLIETTA DI BLU
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

    update(deltaTime) {
        if (!this.model) return;
        
        // Per ora il bot sta fermo a fare l'animazione di "fiatone" (idle)
        // finché non ne prendi il controllo premendo C.
        this.animator.animate(deltaTime, false, false, false, false, null, 0);

        // --- COLLISIONE FISICA CORPO INTERO ---
        if (this.ball && this.ball.isLoaded) {
            const playerHeight = 1.8;
            const playerRadius = 0.35; // Raggio della capsula
            
            // Punto più vicino lungo l'asse Y del bot
            const closestY = Math.max(this.model.position.y, Math.min(this.model.position.y + playerHeight, this.ball.position.y));
            const closestPointOnPlayer = new THREE.Vector3(this.model.position.x, closestY, this.model.position.z);
            
            const distanceToBall3D = closestPointOnPlayer.distanceTo(this.ball.position);
            const minDistance = playerRadius + this.ball.radius;

            if (distanceToBall3D < minDistance) {
                const pushDir = new THREE.Vector3().subVectors(this.ball.position, closestPointOnPlayer);
                if (pushDir.lengthSq() > 0.001) {
                    pushDir.normalize();
                } else {
                    pushDir.set(0, 1, 0); 
                }

                // Risoluzione compenetrazione: sposta la palla fuori dal modello
                const overlap = minDistance - distanceToBall3D;
                this.ball.position.addScaledVector(pushDir, overlap);

                // Calcolo della velocità di rimbalzo
                const dot = this.ball.velocity.dot(pushDir);
                if (dot < 0) {
                    const restitution = 0.3; // Il corpo assorbe l'urto
                    const bounceImpulse = pushDir.clone().multiplyScalar(dot * (1 + restitution));
                    this.ball.velocity.sub(bounceImpulse);
                }
            }
        }
    }
}