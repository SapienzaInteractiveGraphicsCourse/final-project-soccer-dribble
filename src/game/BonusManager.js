import * as THREE from 'three';

export class BonusManager {
    constructor(scene, uiManager) {
        this.scene = scene;
        this.uiManager = uiManager;
        this.bonuses = [];
        this.particles = [];

        
        this.diamondMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x0088ff,
            emissiveIntensity: 0.6,
            metalness: 0.8,
            roughness: 0.1,
            transparent: true,
            opacity: 0.85
        });

        this.spawnTimer = 0;
        this.spawnInterval = 15; 
        this.maxBonuses = 3;     
    }

    createDiamond() {
        
        const geo = new THREE.OctahedronGeometry(0.8, 0);
        const mesh = new THREE.Mesh(geo, this.diamondMaterial);
        mesh.scale.set(1, 1.5, 1); 

        
        mesh.castShadow = true;
        return mesh;
    }

    spawn() {
        const diamond = this.createDiamond();

        
        const pWidth = 100.8;  
        const pLength = 61.8;  

        const margin = 5.0; 
        const safeWidth = pWidth - (margin * 2);
        const safeLength = pLength - (margin * 2);

        let bestX = 0;
        let bestZ = 0;
        let maxMinDist = -1;

        
        for (let i = 0; i < 10; i++) {
            const candX = (Math.random() - 0.5) * safeWidth;
            const candZ = (Math.random() - 0.5) * safeLength;
            
            let minDist = Infinity;
            for (const b of this.bonuses) {
                const dist = Math.hypot(candX - b.mesh.position.x, candZ - b.mesh.position.z);
                if (dist < minDist) minDist = dist;
            }
            
            if (minDist > maxMinDist) {
                maxMinDist = minDist;
                bestX = candX;
                bestZ = candZ;
            }
        }

        diamond.position.set(bestX, 1.5, bestZ);
        this.scene.add(diamond);

        this.bonuses.push({
            mesh: diamond,
            baseY: 1.5,
            time: Math.random() * 100 
        });
    }
    

    breakDiamond(index, player) {
        const bonus = this.bonuses[index];

        
        const isElectric = Math.random() > 0.5; 

        let animDuration = 3;
        
        if (isElectric) {
            if (this.uiManager) {
                animDuration = this.uiManager.triggerBonusRoulette("⚡ TIRO ELETTRICO", "bonus-electricshot") || 3;
            }
            setTimeout(() => {
                player.action.hasElectricShot = true;
                if (window.fireTrailEffect && player.ball) {
                    window.fireTrailEffect.activate(player.ball, 'electric');
                }
            }, animDuration * 1000);
        } else {
            if (this.uiManager) {
                animDuration = this.uiManager.triggerBonusRoulette("🔥 SUPER TIRO", "bonus-supershot") || 3;
            }
            setTimeout(() => {
                player.action.hasSuperShot = true;
                if (window.fireTrailEffect && player.ball) {
                    window.fireTrailEffect.activate(player.ball, 'fire');
                }
            }, animDuration * 1000);
        }

        this.createExplosion(bonus.mesh.position, isElectric);

        
        this.scene.remove(bonus.mesh);
        this.bonuses.splice(index, 1);
    }

    createExplosion(position, isElectric = false) {
        const fragGeo = new THREE.TetrahedronGeometry(0.2); 
        
        
        let mat = this.diamondMaterial;
        if (!isElectric) {
            mat = this.diamondMaterial.clone();
            mat.color.setHex(0xffaa00);
            mat.emissive.setHex(0xff4400);
        }

        for (let i = 0; i < 10; i++) {
            const fragment = new THREE.Mesh(fragGeo, mat);
            fragment.position.copy(position);

            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                Math.random() * 6 + 2, 
                (Math.random() - 0.5) * 8
            );

            this.scene.add(fragment);
            this.particles.push({ mesh: fragment, velocity: velocity, life: 1.0 }); 
        }
    }

    update(deltaTime, player) {
        
        if (this.bonuses.length < this.maxBonuses) {
            this.spawnTimer += deltaTime;
            if (this.spawnTimer > this.spawnInterval) {
                this.spawn();
                this.spawnTimer = 0;
            }
        }

        
        for (let i = this.bonuses.length - 1; i >= 0; i--) {
            const b = this.bonuses[i];
            b.time += deltaTime * 3;

            
            b.mesh.rotation.y += deltaTime * 2;
            b.mesh.position.y = b.baseY + Math.sin(b.time) * 0.3;

            
            if (player && player.model) {
                const dist = player.model.position.distanceTo(b.mesh.position);
                if (dist < 3.0) { 
                    this.breakDiamond(i, player);
                }
            }
        }

        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            } else {
                p.mesh.position.addScaledVector(p.velocity, deltaTime);
                p.velocity.y -= 15 * deltaTime; 
                p.mesh.rotation.x += deltaTime * 10;
                p.mesh.rotation.y += deltaTime * 10;
                p.mesh.scale.setScalar(p.life); 
            }
        }
    }

    setVisible(visible) {
        if (!visible) {
            
            for (let i = this.bonuses.length - 1; i >= 0; i--) {
                this.scene.remove(this.bonuses[i].mesh);
                this.bonuses.splice(i, 1);
            }
            
            for (let i = this.particles.length - 1; i >= 0; i--) {
                this.scene.remove(this.particles[i].mesh);
                this.particles.splice(i, 1);
            }
            this.spawnTimer = 0;
        }
    }
}