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
    }
}