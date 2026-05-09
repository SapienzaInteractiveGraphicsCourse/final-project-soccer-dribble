import * as THREE from 'three';

export class FireTrailEffect {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        
        // Texture sfumate per i due tipi di bonus
        this.fireTexture = this.createCircleTexture();
        this.electricTexture = this.createElectricTexture();

        this.particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff, // Il colore ora è deciso dai vertexColors
            size: 0.3,
            blending: THREE.AdditiveBlending, // Per farle brillare
            transparent: true,
            depthWrite: false, // Per evitare artefatti con la palla
            map: this.fireTexture, 
            vertexColors: true // Per gestire sia il fuoco che il fulmine
        });

        this.geometry = new THREE.BufferGeometry();
        this.points = new THREE.Points(this.geometry, this.particleMaterial);
        this.points.frustumCulled = false;
        this.scene.add(this.points);
        
        this.isActive = false;
        this.ball = null;
        this.mode = 'fire'; // 'fire' o 'electric'
    }

    createCircleTexture() {
        // Crea una semplice texture circolare sfumata con Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 0, 1)'); // Giallo al centro
        gradient.addColorStop(0.4, 'rgba(255, 69, 0, 0.8)'); // Arancione
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)'); // Rosso trasparente ai bordi
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
        gradient.addColorStop(0.2, 'rgba(0, 255, 255, 1)'); // Ciano al centro
        gradient.addColorStop(0.4, 'rgba(0, 100, 255, 0.8)'); // Blu elettrico
        gradient.addColorStop(1, 'rgba(0, 0, 255, 0)'); // Trasparente ai bordi
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        return new THREE.CanvasTexture(canvas);
    }

    activate(ball, mode = 'fire') {
        this.isActive = true;
        this.ball = ball;
        this.mode = mode;
        this.particles = []; // Resetta le particelle
        
        if (this.mode === 'electric') {
            this.particleMaterial.map = this.electricTexture;
        } else {
            this.particleMaterial.map = this.fireTexture;
        }
    }

    deactivate() {
        this.isActive = false;
        this.ball = null;
        // Opzionale: lascia che le particelle esistenti svaniscano
    }

    update(deltaTime) {
        if (!this.isActive || !this.ball) {
            // Aggiorna e rimuovi particelle esistenti anche se non più attivo
            this.updateParticles(deltaTime);
            return;
        }

        // Aggiungi nuove particelle alla posizione attuale della palla
        for (let i = 0; i < 5; i++) {
            let velocity;
            if (this.mode === 'electric') {
                // Elettricità schizza in direzioni caotiche a 360°
                velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6
                );
            } else {
                // Fuoco va verso l'alto
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
                life: this.mode === 'electric' ? (0.2 + Math.random() * 0.3) : 1.0, // Le scintille durano pochissimo
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
                    // Aumentiamo il caos durante il movimento
                    p.velocity.x += (Math.random() - 0.5) * 20 * deltaTime;
                    p.velocity.y += (Math.random() - 0.5) * 20 * deltaTime;
                    p.velocity.z += (Math.random() - 0.5) * 20 * deltaTime;
                } else {
                    // Gravità "inversa" classica per il fuoco
                    p.velocity.y += 2 * deltaTime; // Salgono
                    p.velocity.x *= 0.95; // attrito
                    p.velocity.z *= 0.95;
                }
                
                p.position.addScaledVector(p.velocity, deltaTime);

                positions.push(p.position.x, p.position.y, p.position.z);
                
                // Rimpicciolisci e cambia colore col tempo
                const t = 1.0 - p.life; // Da 0 a 1
                sizes.push(p.size * p.life * (this.mode === 'electric' ? 2.0 : 1.0)); 
                
                if (this.mode === 'electric') {
                    // Colore Azzurro, Bianco brillante o Blu acceso
                    colors.push(0.5 + p.life * 0.5, 0.8 + p.life * 0.2, 1.0);
                } else {
                    // Colore da Giallo/Arancione a Rosso/Nero
                    colors.push(1.0, 1.0 - t * 0.8, 0.0);
                }
            }
        }

        // Aggiorna la BufferGeometry
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }
}