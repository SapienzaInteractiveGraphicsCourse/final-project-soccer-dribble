
import * as THREE from 'three';

export class PhysicsWorld {
    constructor(scene) {
        this.scene = scene;
        
        
        this.particlePool = [];
        this.poolSize = 150; 
        this.activeParticles = [];

        
        const grassGeo = new THREE.BoxGeometry(0.02, 0.1, 0.02); 
        const dirtGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06); 

        
        const grassMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50 }); 
        const dirtMat = new THREE.MeshBasicMaterial({ color: 0x5C4033 });  

        
        for (let i = 0; i < this.poolSize; i++) {
            const isGrass = Math.random() > 0.4; 
            const mesh = new THREE.Mesh(isGrass ? grassGeo : dirtGeo, isGrass ? grassMat : dirtMat);
            
            mesh.visible = false;
            this.scene.add(mesh);

            this.particlePool.push({
                mesh: mesh,
                active: false,
                life: 0,
                velocity: new THREE.Vector3(),
                rotSpeed: new THREE.Vector3()
            });
        }
    }

    
    spawnBurst(position, playerDirection) {
        const burstCount = 8 + Math.floor(Math.random() * 8); 

        for (let i = 0; i < burstCount; i++) {
            
            const p = this.particlePool.find(part => !part.active);
            if (!p) break; 

            p.active = true;
            p.mesh.visible = true;
            p.life = 0.5 + Math.random() * 0.5; 
            p.mesh.scale.setScalar(1);

            
            p.mesh.position.copy(position);
            p.mesh.position.y = 0.05; 
            p.mesh.position.x += (Math.random() - 0.5) * 0.4;
            p.mesh.position.z += (Math.random() - 0.5) * 0.4;

            
            
            const kickback = playerDirection.clone().negate().normalize();
            
            p.velocity.set(
                kickback.x * (1 + Math.random() * 2) + (Math.random() - 0.5),
                1.5 + Math.random() * 2.5, 
                kickback.z * (1 + Math.random() * 2) + (Math.random() - 0.5)
            );

            
            p.rotSpeed.set(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
            );

            this.activeParticles.push(p);
        }
    }

    updateParticles(deltaTime) {
        
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            
            p.life -= deltaTime;
            
            
            if (p.life <= 0 || p.mesh.position.y < 0) {
                p.active = false;
                p.mesh.visible = false;
                this.activeParticles.splice(i, 1);
                continue;
            }

            
            p.mesh.position.addScaledVector(p.velocity, deltaTime);
            p.velocity.y -= 9.8 * deltaTime; 

            
            p.mesh.rotation.x += p.rotSpeed.x * deltaTime;
            p.mesh.rotation.y += p.rotSpeed.y * deltaTime;
            p.mesh.rotation.z += p.rotSpeed.z * deltaTime;

            
            p.mesh.scale.setScalar(Math.max(0, p.life));
        }
    }
}