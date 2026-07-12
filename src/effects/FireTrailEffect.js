import * as THREE from 'three';

export class FireTrailEffect {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        
        
        this.fireTexture = this.createCircleTexture();
        this.electricTexture = this.createElectricTexture();

        this.particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff, 
            size: 0.3,
            blending: THREE.AdditiveBlending, 
            transparent: true,
            depthWrite: false, 
            map: this.fireTexture, 
            vertexColors: true 
        });

        this.geometry = new THREE.BufferGeometry();
        this.points = new THREE.Points(this.geometry, this.particleMaterial);
        this.points.frustumCulled = false;
        this.scene.add(this.points);
        
        this.isActive = false;
        this.ball = null;
        this.mode = 'fire'; 
    }

    createCircleTexture() {
        
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 0, 1)'); 
        gradient.addColorStop(0.4, 'rgba(255, 69, 0, 0.8)'); 
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)'); 
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createElectricTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(0, 255, 255, 1)'); 
        gradient.addColorStop(0.4, 'rgba(0, 100, 255, 0.8)'); 
        gradient.addColorStop(1, 'rgba(0, 0, 255, 0)'); 
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        return new THREE.CanvasTexture(canvas);
    }

    activate(ball, mode = 'fire') {
        this.isActive = true;
        this.ball = ball;
        this.mode = mode;
        this.particles = []; 
        this.points.visible = true;
        
        if (this.mode === 'electric') {
            this.particleMaterial.map = this.electricTexture;
        } else {
            this.particleMaterial.map = this.fireTexture;
        }
    }

    deactivate() {
        this.isActive = false;
        this.ball = null;
        
    }

    update(deltaTime) {
        if (!this.isActive || !this.ball) {
            
            this.updateParticles(deltaTime);
            return;
        }

        
        for (let i = 0; i < 5; i++) {
            let velocity;
            if (this.mode === 'electric') {
                
                velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6
                );
            } else {
                
                velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 1,
                    Math.random() * 2 + 1, 
                    (Math.random() - 0.5) * 1
                );
            }

            this.particles.push({
                position: this.ball.position.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                )),
                velocity: velocity,
                life: this.mode === 'electric' ? (0.2 + Math.random() * 0.3) : 1.0, 
                size: 0.3 + Math.random() * 0.2
            });
        }

        this.updateParticles(deltaTime);
    }

    updateParticles(deltaTime) {
        const positions = [];
        const sizes = [];
        const colors = [];

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                if (this.mode === 'electric') {
                    
                    p.velocity.x += (Math.random() - 0.5) * 20 * deltaTime;
                    p.velocity.y += (Math.random() - 0.5) * 20 * deltaTime;
                    p.velocity.z += (Math.random() - 0.5) * 20 * deltaTime;
                } else {
                    
                    p.velocity.y += 2 * deltaTime; 
                    p.velocity.x *= 0.95; 
                    p.velocity.z *= 0.95;
                }
                
                p.position.addScaledVector(p.velocity, deltaTime);

                positions.push(p.position.x, p.position.y, p.position.z);
                
                
                const t = 1.0 - p.life; 
                sizes.push(p.size * p.life * (this.mode === 'electric' ? 2.0 : 1.0)); 
                
                if (this.mode === 'electric') {
                    
                    colors.push(0.5 + p.life * 0.5, 0.8 + p.life * 0.2, 1.0);
                } else {
                    
                    colors.push(1.0, 1.0 - t * 0.8, 0.0);
                }
            }
        }

        
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }
}