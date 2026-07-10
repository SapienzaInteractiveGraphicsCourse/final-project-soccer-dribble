import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';

export class Referee {
    constructor(scene, ball, startPos = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene;
        this.ball = ball;
        this.model = null;
        
        
        this.animator = new PlayerAnimator();
        
        
        this.speed = 4;              
        this.minDistance = 8;        
        this.maxDistance = 15;       
        
        
        
        this._ballPosOnGround = new THREE.Vector3();
        this._direction = new THREE.Vector3();

        this.loadGLB(startPos);
    }

    loadGLB(startPos) {
        modelManager.load(`${import.meta.env.BASE_URL}models/player.glb`, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(1.5, 1.5, 1.5);
            this.model.position.copy(startPos);

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = false;
                    
                    
                    
                    if (child.name === 'Ch38_Shirt') {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xffff00); 
                    }
                    
                    
                    if (child.name.includes('Pants') || child.name.includes('Shorts') || child.name === 'Ch38_Pants') {
                        child.material = child.material.clone();
                        child.material.color.setHex(0x111111); 
                    }
                    
                    if (child.name.includes('Socks')) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0x111111);
                    }
                }
            });

            this.animator.initBones(this.model);
            this.scene.add(this.model);
        });
    }

    _isInPenaltyArea(x, z) {
        const penaltyX = 33;
        const penaltyZ = 20.16;
        return Math.abs(x) >= penaltyX && Math.abs(z) <= penaltyZ;
    }

    
    _getSafeWatchPosition(ballX, ballZ) {
        const penaltyX = 33;
        const penaltyZ = 20.16;
        const margin = 2.0;

        
        if (!this._isInPenaltyArea(ballX, ballZ)) {
            return new THREE.Vector3(ballX, 0, ballZ);
        }

        
        
        const watchX = ballX > 0 ? penaltyX - margin : -penaltyX + margin;
        const watchZ = THREE.MathUtils.clamp(ballZ, -penaltyZ - 2, penaltyZ + 2);

        return new THREE.Vector3(watchX, 0, watchZ);
    }

    update(deltaTime) {
        if (!this.model || !this.ball || !this.ball.isLoaded) return;

        this._ballPosOnGround.set(this.ball.position.x, this.model.position.y, this.ball.position.z);

        const watchPos = this._getSafeWatchPosition(this.ball.position.x, this.ball.position.z);
        watchPos.y = this.model.position.y;

        const distanceToWatch = this.model.position.distanceTo(watchPos);

        let moving = false;
        let running = false;

        // Always look at the ball
        this.model.lookAt(this._ballPosOnGround);

        const ballInArea = this._isInPenaltyArea(this.ball.position.x, this.ball.position.z);

        let wantToMove = false;
        let moveSpeed = 0;

        if (ballInArea) {
            if (distanceToWatch > 1.5) {
                this._direction.subVectors(watchPos, this.model.position).normalize();
                running = distanceToWatch > 15;
                moveSpeed = running ? this.speed * 1.8 : this.speed;
                wantToMove = true;
            }
        } else {
            if (distanceToWatch > this.maxDistance) {
                this._direction.subVectors(watchPos, this.model.position).normalize();
                running = distanceToWatch > 25;
                moveSpeed = running ? this.speed * 1.8 : this.speed;
                wantToMove = true;
            } else if (distanceToWatch < this.minDistance) {
                this._direction.subVectors(this.model.position, watchPos).normalize();
                moveSpeed = this.speed * 0.7;
                wantToMove = true;
                running = false;
            }
        }

        if (wantToMove) {
            const step = moveSpeed * deltaTime;
            const nextX = this.model.position.x + this._direction.x * step;
            const nextZ = this.model.position.z + this._direction.z * step;

            // Only apply the move if it doesn't enter a penalty area
            if (!this._isInPenaltyArea(nextX, nextZ)) {
                this.model.position.x = nextX;
                this.model.position.z = nextZ;
                moving = true;
            }
            // If blocked, just stand still — no teleport, no flicker
        }

        this.animator.animate(deltaTime, false, moving, running, false);
    }
}