import * as THREE from 'three';

export class Ball {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;

        this.radius = 0.22;
        this.position = new THREE.Vector3(0, this.radius, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);

        
        
        
        this.gravity = 12.0;         
        this.dragCoefficient = 0.018; 
        this.groundFriction = 0.96;  
        this.restitution = 0.7;      

        
        this.spin = 0;

        this.isOut = false;
        this.isHeld = false;
        this.isLoaded = false;

        this.powerRings = []; 
        this.isPowerShot = false;
        this.powerShotTimer = 0;
        this.isGoal = false;

        
        this.isElectricShot = false;
        this.electricShotTimer = 0;
        this.electricZigZagTimer = 0;
        
        
        this._dragForce = new THREE.Vector3();
        this._magnusForce = new THREE.Vector3();
        this._displacement = new THREE.Vector3();
        this._p0 = new THREE.Vector3();
        this._p1 = new THREE.Vector3();
        this._rotationAxis = new THREE.Vector3();
        this._lookTarget = new THREE.Vector3();
        
        
        this._ringGeo = new THREE.RingGeometry(this.radius * 6.0, this.radius * 8.0, 16);

        this.loadModel();
    }

    loadModel() {
        
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        
        
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(`${import.meta.env.BASE_URL}textures/ball/qatar_07.jpg`, () => {
            this.isLoaded = true;
        });

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.4,
            metalness: 0.1
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    
    triggerPowerEffect() {
        this.isPowerShot = true;
        this.powerShotTimer = 0.4; 
        this.spawnAirRing(); 
    }

    triggerElectricEffect() {
        this.isElectricShot = true;
        this.electricShotTimer = 1.5; 
        this.electricZigZagTimer = 0;
        this.triggerPowerEffect(); 
    }

    
    spawnAirRing() {
        
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false 
        });
        const ringMesh = new THREE.Mesh(this._ringGeo, ringMat);

        
        ringMesh.position.copy(this.position);

        
        this._lookTarget.copy(this.position).add(this.velocity);
        ringMesh.lookAt(this._lookTarget);

        this.scene.add(ringMesh);

        
        this.powerRings.push({
            mesh: ringMesh,
            life: 1.0, 
            scale: 1.0
        });
    }

    update(deltaTime) {
        if (!this.isLoaded || !this.mesh) return;
        if (this.isHeld) return;

        
        
        
        this.velocity.y -= this.gravity * deltaTime;

        
        const speedSq = this.velocity.lengthSq();
        if (speedSq > 0) {
            const speed = Math.sqrt(speedSq);
            
            this._dragForce.copy(this.velocity).normalize().multiplyScalar(-this.dragCoefficient * speedSq);
            this.velocity.add(this._dragForce.multiplyScalar(deltaTime));
        }

        
        
        if (Math.abs(this.spin) > 0.01 && !this.isGoal && !this.isOut && !this.isOutBaseline && this.position.y > this.radius) {
            
            this._magnusForce.set(-this.velocity.z, 0, this.velocity.x).multiplyScalar(this.spin * deltaTime);
            this.velocity.add(this._magnusForce);
            
            
            this.spin *= Math.pow(0.995, deltaTime * 60);
        }

        
        if (this.isElectricShot && !this.isGoal && !this.isOut && !this.isOutBaseline) {
            this.electricShotTimer -= deltaTime;
            this.electricZigZagTimer -= deltaTime;

            if (this.electricShotTimer <= 0) {
                this.isElectricShot = false;
            } else if (this.electricZigZagTimer <= 0) {
                
                const speedStutter = 15.0;  
                const lateralZigZag = 15.0; 
                
                this.velocity.x += (Math.random() - 0.5) * speedStutter; 
                this.velocity.z += (Math.random() - 0.5) * lateralZigZag; 
                this.velocity.y += (Math.random() - 0.5) * 5.0;

                
                const minForwardSpeed = 25.0;
                if (this.velocity.x > 0 && this.velocity.x < minForwardSpeed) this.velocity.x = minForwardSpeed;
                if (this.velocity.x < 0 && this.velocity.x > -minForwardSpeed) this.velocity.x = -minForwardSpeed;

                this.electricZigZagTimer = 0.05 + Math.random() * 0.05; 
            }
        }

        
        
        this._displacement.copy(this.velocity).multiplyScalar(deltaTime);
        this._p0.copy(this.position); 
        
        this.position.add(this._displacement);
        
        this._p1.copy(this.position); 

        const borderX = 48.5; 
        const borderZ = 30.5; 
        const goalHalfWidth = 6.5;  
        const goalHeight = 4.2;     
        const goalDepth = 5.0;      

        if (this._p0.x <= borderX && this._p1.x > borderX) {
            
            const t = (borderX - this._p0.x) / (this._p1.x - this._p0.x); 
            const intersectY = this._p0.y + t * (this._p1.y - this._p0.y);
            const intersectZ = this._p0.z + t * (this._p1.z - this._p0.z);

            
            if (intersectY <= goalHeight && Math.abs(intersectZ) <= goalHalfWidth) {
                this.isGoal = true; 
            } else if (!this.isGoal) {
                this.isOutBaseline = true; 
            }
        }
        
        
        else if (this._p0.x >= -borderX && this._p1.x < -borderX) {
            const t = (-borderX - this._p0.x) / (this._p1.x - this._p0.x);
            const intersectY = this._p0.y + t * (this._p1.y - this._p0.y);
            const intersectZ = this._p0.z + t * (this._p1.z - this._p0.z);

            if (intersectY <= goalHeight && Math.abs(intersectZ) <= goalHalfWidth) {
                this.isGoal = true; 
            } else if (!this.isGoal) {
                this.isOutBaseline = true;
            }
        }

        
        if (this.isGoal) {
            
            if (this.position.x > borderX + goalDepth) {
                this.position.x = borderX + goalDepth;
                this.velocity.x *= -0.3; 
            } else if (this.position.x < -borderX - goalDepth) {
                this.position.x = -borderX - goalDepth;
                this.velocity.x *= -0.3;
            }

            
            if (this.position.x > borderX || this.position.x < -borderX) {
                if (Math.abs(this.position.z) > goalHalfWidth) {
                    this.position.z = Math.sign(this.position.z) * goalHalfWidth;
                    this.velocity.z *= -0.3;
                }
                if (this.position.y > goalHeight) {
                    this.position.y = goalHeight;
                    this.velocity.y *= -0.3;
                }
            }
        }

   
        
        if (this.position.z > borderZ) { this.position.z = borderZ; this.velocity.set(0, 0, 0); this.isOut = true; }
        else if (this.position.z < -borderZ) { this.position.z = -borderZ; this.velocity.set(0, 0, 0); this.isOut = true; }
        else { this.isOut = false; }

        
        const groundLevel = this.radius + 0.005;
        if (this.position.y <= groundLevel) {
            this.position.y = groundLevel;
            
            
            if (this.velocity.y < -2) { 
                this.velocity.y *= -this.restitution; 
            } else { 
                this.velocity.y = 0; 
            }

            
            this.spin = 0;

            
            this.velocity.x *= Math.pow(this.groundFriction, deltaTime * 60);
            this.velocity.z *= Math.pow(this.groundFriction, deltaTime * 60);
        }

        this.mesh.position.copy(this.position);

        const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (horizontalSpeed > 0.01) {
            this._rotationAxis.set(this.velocity.z, 0, -this.velocity.x).normalize();
            const rotationAngle = horizontalSpeed * deltaTime / this.radius;
            this.mesh.rotateOnWorldAxis(this._rotationAxis, rotationAngle);
        }

        
        
        
        if (this.isPowerShot) {
            this.powerShotTimer -= deltaTime;
            if (this.powerShotTimer <= 0) {
                this.isPowerShot = false;
            } else if (Math.random() > 0.5) {
                
                this.spawnAirRing();
            }
        }

        
        for (let i = this.powerRings.length - 1; i >= 0; i--) {
            let ringData = this.powerRings[i];

            
            ringData.life -= deltaTime * 3.5; 
            ringData.scale += deltaTime * 6.0; 

            ringData.mesh.scale.set(ringData.scale, ringData.scale, ringData.scale);
            ringData.mesh.material.opacity = ringData.life;

            
            if (ringData.life <= 0) {
                this.scene.remove(ringData.mesh);
                
                ringData.mesh.material.dispose();
                this.powerRings.splice(i, 1);
            }
        }
    }

    applyImpulse(forceVector) {
        this.velocity.add(forceVector);
    }
}