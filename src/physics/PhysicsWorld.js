// PhysicsWorld.js
import * as THREE from 'three';

export class PhysicsWorld {
    constructor(scene) {
        this.scene = scene;
        
        // --- SISTEMA PARTICELLE OTTIMIZZATO (POOLING) ---
        this.particlePool = [];
        this.poolSize = 150; // Numero massimo di particelle gestibili contemporaneamente
        this.activeParticles = [];

        // Geometrie
        const grassGeo = new THREE.BoxGeometry(0.02, 0.1, 0.02); // Fili d'erba sottili
        const dirtGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06); // Zolle di terra

        // Materiali
        const grassMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50 }); // Verde erba
        const dirtMat = new THREE.MeshBasicMaterial({ color: 0x5C4033 });  // Marrone terra

        // Pre-generiamo le particelle spente per risparmiare memoria
        for (let i = 0; i < this.poolSize; i++) {
            const isGrass = Math.random() > 0.4; // 60% erba, 40% terra
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

    // Spawn di un "burst" (una manciata di particelle) basato sulla direzione del giocatore
    spawnBurst(position, playerDirection) {
        const burstCount = 8 + Math.floor(Math.random() * 8); // Crea dalle 8 alle 15 particelle per passo

        for (let i = 0; i < burstCount; i++) {
            // Cerchiamo la prima particella libera nel pool
            const p = this.particlePool.find(part => !part.active);
            if (!p) break; // Se il pool è pieno, fermiamo lo spawn

            p.active = true;
            p.mesh.visible = true;
            p.life = 0.5 + Math.random() * 0.5; // Durata casuale tra 0.5s e 1s
            p.mesh.scale.setScalar(1);

            // Posizione iniziale: vicina ai piedi con un po' di dispersione laterale
            p.mesh.position.copy(position);
            p.mesh.position.y = 0.05; // Altezza terreno
            p.mesh.position.x += (Math.random() - 0.5) * 0.4;
            p.mesh.position.z += (Math.random() - 0.5) * 0.4;

            // --- FISICA DIREZIONALE ---
            // Calcoliamo lo schizzo: opposto alla direzione della corsa
            const kickback = playerDirection.clone().negate().normalize();
            
            p.velocity.set(
                kickback.x * (1 + Math.random() * 2) + (Math.random() - 0.5),
                1.5 + Math.random() * 2.5, // Forza verso l'alto (zolle che saltano)
                kickback.z * (1 + Math.random() * 2) + (Math.random() - 0.5)
            );

            // Rotazione casuale su tutti gli assi
            p.rotSpeed.set(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
            );

            this.activeParticles.push(p);
        }
    }

    updateParticles(deltaTime) {
        // Ciclo inverso per poter rimuovere in modo sicuro elementi dall'array attivo
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            
            p.life -= deltaTime;
            
            // Se la vita è finita o tocca terra, spegniamo la particella e la rimettiamo a disposizione
            if (p.life <= 0 || p.mesh.position.y < 0) {
                p.active = false;
                p.mesh.visible = false;
                this.activeParticles.splice(i, 1);
                continue;
            }

            // Applichiamo movimento e gravità
            p.mesh.position.addScaledVector(p.velocity, deltaTime);
            p.velocity.y -= 9.8 * deltaTime; // Gravità

            // Applichiamo la rotazione (spin)
            p.mesh.rotation.x += p.rotSpeed.x * deltaTime;
            p.mesh.rotation.y += p.rotSpeed.y * deltaTime;
            p.mesh.rotation.z += p.rotSpeed.z * deltaTime;

            // Rimpiccioliamo le particelle mentre spariscono
            p.mesh.scale.setScalar(Math.max(0, p.life));
        }
    }
}