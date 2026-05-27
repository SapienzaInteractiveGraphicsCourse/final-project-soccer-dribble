import * as THREE from 'three';

export class BonusManager {
    constructor(scene, uiManager) {
        this.scene = scene;
        this.uiManager = uiManager;
        this.bonuses = [];
        this.particles = [];

        // Materiale per il diamante (brillante, azzurro e leggermente trasparente)
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
        this.spawnInterval = 15; // Spawna un diamante ogni 15 secondi (puoi regolarlo)
        this.maxBonuses = 3;     // Limite massimo di diamanti in campo
    }

    createDiamond() {
        // Un ottaedro scalato è perfetto per fare la forma di un diamante
        const geo = new THREE.OctahedronGeometry(0.8, 0);
        const mesh = new THREE.Mesh(geo, this.diamondMaterial);
        mesh.scale.set(1, 1.5, 1); // Lo allunghiamo sull'asse Y

        // Facciamo in modo che proietti ombre
        mesh.castShadow = true;
        return mesh;
    }

    spawn() {
        const diamond = this.createDiamond();

        // Invertiamo i valori per riflettere la rotazione di 90° fatta in Pitch.js
        const pWidth = 100.8;  // Ora la lunghezza visiva è sulla X
        const pLength = 61.8;  // Ora la larghezza visiva è sulla Z

        const margin = 5.0; // Margine aumentato per non spawnare troppo attaccati alle linee esterne
        const safeWidth = pWidth - (margin * 2);
        const safeLength = pLength - (margin * 2);

        let bestX = 0;
        let bestZ = 0;
        let maxMinDist = -1;

        // Genera 10 posizioni candidate e sceglie quella più lontana dai diamanti già esistenti
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
    // Nel BonusManager.js, dentro la funzione breakDiamond():

    breakDiamond(index, player) {
        const bonus = this.bonuses[index];

        // 1. ASSEGNA IL VANTAGGIO
        const isElectric = Math.random() > 0.5; // 50% di probabilità per tipo

        if (isElectric) {
            player.action.hasElectricShot = true;
            
            if (window.fireTrailEffect && player.ball) {
                window.fireTrailEffect.activate(player.ball, 'electric');
            }
            if (this.uiManager) {
                this.uiManager.triggerBonusRoulette("TIRO ELETTRICO", "bonus-electricshot");
            }
        } else {
            player.action.hasSuperShot = true;
            
            if (window.fireTrailEffect && player.ball) {
                window.fireTrailEffect.activate(player.ball, 'fire');
            }
            if (this.uiManager) {
                this.uiManager.triggerBonusRoulette("SUPER TIRO", "bonus-supershot");
            }
        }

        this.createExplosion(bonus.mesh.position, isElectric);

        // RIMUOVI IL DIAMANTE
        this.scene.remove(bonus.mesh);
        this.bonuses.splice(index, 1);
    }

    createExplosion(position, isElectric = false) {
        const fragGeo = new THREE.TetrahedronGeometry(0.2); // Piccoli triangolini
        
        // Colore esplosione in base al bonus
        let mat = this.diamondMaterial;
        if (!isElectric) {
            mat = this.diamondMaterial.clone();
            mat.color.setHex(0xffaa00);
            mat.emissive.setHex(0xff4400);
        }

        for (let i = 0; i < 10; i++) {
            const fragment = new THREE.Mesh(fragGeo, mat);
            fragment.position.copy(position);

            // Diamo una direzione esplosiva casuale
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                Math.random() * 6 + 2, // Schizzano verso l'alto
                (Math.random() - 0.5) * 8
            );

            this.scene.add(fragment);
            this.particles.push({ mesh: fragment, velocity: velocity, life: 1.0 }); // Vivono 1 secondo
        }
    }

    update(deltaTime, player) {
        // Gestione Spawner
        if (this.bonuses.length < this.maxBonuses) {
            this.spawnTimer += deltaTime;
            if (this.spawnTimer > this.spawnInterval) {
                this.spawn();
                this.spawnTimer = 0;
            }
        }

        // Aggiorna i diamanti in campo
        for (let i = this.bonuses.length - 1; i >= 0; i--) {
            const b = this.bonuses[i];
            b.time += deltaTime * 3;

            // Animazione: Galleggia su e giù e ruota su se stesso
            b.mesh.rotation.y += deltaTime * 2;
            b.mesh.position.y = b.baseY + Math.sin(b.time) * 0.3;

            // Controllo Collisione con il giocatore
            if (player && player.model) {
                const dist = player.model.position.distanceTo(b.mesh.position);
                if (dist < 1.5) { // Se passa abbastanza vicino, lo rompe
                    this.breakDiamond(i, player);
                }
            }
        }

        // Aggiorna le particelle dell'esplosione
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            } else {
                p.mesh.position.addScaledVector(p.velocity, deltaTime);
                p.velocity.y -= 15 * deltaTime; // Effetto gravità sui frammenti
                p.mesh.rotation.x += deltaTime * 10;
                p.mesh.rotation.y += deltaTime * 10;
                p.mesh.scale.setScalar(p.life); // Si rimpiccioliscono prima di sparire
            }
        }
    }

    setVisible(visible) {
        if (!visible) {
            // Rimuovi tutti i diamanti
            for (let i = this.bonuses.length - 1; i >= 0; i--) {
                this.scene.remove(this.bonuses[i].mesh);
                this.bonuses.splice(i, 1);
            }
            // Rimuovi tutte le particelle
            for (let i = this.particles.length - 1; i >= 0; i--) {
                this.scene.remove(this.particles[i].mesh);
                this.particles.splice(i, 1);
            }
            this.spawnTimer = 0;
        }
    }
}