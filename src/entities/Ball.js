import * as THREE from 'three';

export class Ball {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;

        this.radius = 0.22;
        this.position = new THREE.Vector3(0, this.radius, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);

        // ==========================================
        // 1. FISICA REALISTICA (NUOVI PARAMETRI)
        // ==========================================
        this.gravity = 12.0;         // 9.81 è la realtà, 12.0 dà un feedback migliore in-game
        this.dragCoefficient = 0.018; // Resistenza dell'aria (crea la parabola che scende ripida)
        this.groundFriction = 0.96;  // Attrito rotolamento sull'erba
        this.restitution = 0.7;      // Rimbalzo leggermente più vivo

        // --- MAGNUS EFFECT (TIRO A GIRO) ---
        this.spin = 0;

        this.isOut = false;
        this.isHeld = false;
        this.isLoaded = false;

        this.powerRings = []; 
        this.isPowerShot = false;
        this.powerShotTimer = 0;
        this.isGoal = false;

        // --- Elettricità ---
        this.isElectricShot = false;
        this.electricShotTimer = 0;
        this.electricZigZagTimer = 0;
        
        // --- CACHE VETTORI (OTTIMIZZAZIONE) ---
        this._dragForce = new THREE.Vector3();
        this._magnusForce = new THREE.Vector3();
        this._displacement = new THREE.Vector3();
        this._p0 = new THREE.Vector3();
        this._p1 = new THREE.Vector3();
        this._rotationAxis = new THREE.Vector3();
        this._lookTarget = new THREE.Vector3();
        
        // Riutilizziamo la geometria degli anelli per risparmiare memoria
        this._ringGeo = new THREE.RingGeometry(this.radius * 6.0, this.radius * 8.0, 16);

        this.loadModel();
    }

    loadModel() {
        // Creiamo la sfera con il raggio fisico reale della palla
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        
        // Carichiamo la texture dalla cartella "texture"
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

    // --- NUOVO METODO PER INNESCARE L'EFFETTO ---
    triggerPowerEffect() {
        this.isPowerShot = true;
        this.powerShotTimer = 0.4; // L'effetto scia dura 0.4 secondi
        this.spawnAirRing(); // Spawna il primo anello immediatamente
    }

    triggerElectricEffect() {
        this.isElectricShot = true;
        this.electricShotTimer = 1.5; // L'effetto dura 1.5 secondi
        this.electricZigZagTimer = 0;
        this.triggerPowerEffect(); // Innesca anche l'effetto degli anelli visivi
    }

    // --- NUOVO METODO PER CREARE L'ANELLO ---
    spawnAirRing() {
        // Creiamo un anello piatto (raggio interno, raggio esterno, segmenti)
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false // Evita problemi di sovrapposizione visiva con le trasparenze
        });
        const ringMesh = new THREE.Mesh(this._ringGeo, ringMat);

        // Posizioniamo l'anello dove si trova la palla
        ringMesh.position.copy(this.position);

        // Orientiamo l'anello perpendicolarmente alla direzione in cui sta andando la palla
        this._lookTarget.copy(this.position).add(this.velocity);
        ringMesh.lookAt(this._lookTarget);

        this.scene.add(ringMesh);

        // Salviamo l'anello nell'array con le sue statistiche di vita
        this.powerRings.push({
            mesh: ringMesh,
            life: 1.0, // Vita da 1.0 a 0.0
            scale: 1.0
        });
    }

    update(deltaTime) {
        if (!this.isLoaded || !this.mesh) return;
        if (this.isHeld) return;

        // --- APPLICAZIONE FISICA REALE ---
        
        // 1. Gravità
        this.velocity.y -= this.gravity * deltaTime;

        // 2. Resistenza Aerodinamica (Frena la palla in volo creando l'effetto "Drop")
        const speedSq = this.velocity.lengthSq();
        if (speedSq > 0) {
            const speed = Math.sqrt(speedSq);
            // La forza di attrito dell'aria è opposta alla direzione e proporzionale al quadrato della velocità
            this._dragForce.copy(this.velocity).normalize().multiplyScalar(-this.dragCoefficient * speedSq);
            this.velocity.add(this._dragForce.multiplyScalar(deltaTime));
        }

        // 3. EFFETTO MAGNUS (TIRO A GIRO)
        // La palla curva solo in aria (Y > radius) e se ha uno spin assegnato
        if (Math.abs(this.spin) > 0.01 && !this.isGoal && !this.isOut && !this.isOutBaseline && this.position.y > this.radius) {
            // Calcolo della forza Magnus: prodotto vettoriale tra Velocità e asse Y (0,1,0) = (-Vz, 0, Vx)
            this._magnusForce.set(-this.velocity.z, 0, this.velocity.x).multiplyScalar(this.spin * deltaTime);
            this.velocity.add(this._magnusForce);
            
            // Decadimento quasi inesistente: la palla continuerà a curvare in modo innaturale fino all'impatto
            this.spin *= Math.pow(0.995, deltaTime * 60);
        }

        // --- FISICA ZIG ZAG ELETTRICO ---
        if (this.isElectricShot && !this.isGoal && !this.isOut && !this.isOutBaseline) {
            this.electricShotTimer -= deltaTime;
            this.electricZigZagTimer -= deltaTime;

            if (this.electricShotTimer <= 0) {
                this.isElectricShot = false;
            } else if (this.electricZigZagTimer <= 0) {
                // Scatti caotici per l'aria
                const speedStutter = 15.0;  // Variazione di velocità avanti
                const lateralZigZag = 15.0; // Scatto laterale
                
                this.velocity.x += (Math.random() - 0.5) * speedStutter; // Variazione della velocità frontale come richiesto
                this.velocity.z += (Math.random() - 0.5) * lateralZigZag; 
                this.velocity.y += (Math.random() - 0.5) * 5.0;

                // Forza una spinta minima sull'asse X per evitare che non raggiunga la rete
                const minForwardSpeed = 25.0;
                if (this.velocity.x > 0 && this.velocity.x < minForwardSpeed) this.velocity.x = minForwardSpeed;
                if (this.velocity.x < 0 && this.velocity.x > -minForwardSpeed) this.velocity.x = -minForwardSpeed;

                this.electricZigZagTimer = 0.05 + Math.random() * 0.05; // Dai 50 ai 100 millisecondi per ogni "strattone"
            }
        }

        // Calcolo dello spostamento
        // Calcolo dello spostamento con Continuous Collision Detection (CCD)
        this._displacement.copy(this.velocity).multiplyScalar(deltaTime);
        this._p0.copy(this.position); // Salviamo la posizione PRIMA dello spostamento
        
        this.position.add(this._displacement);
        
        this._p1.copy(this.position); // Questa è la posizione DOPO lo spostamento

        const borderX = 48.5; // Allineato esattamente alla linea di porta reale
        const borderZ = 30.5; // Allineato ai bordi del campo reali
        const goalHalfWidth = 6.5;  // Aumentato per coprire perfettamente la porta visiva
        const goalHeight = 4.2;     // Aumentato per evitare che tiri sotto la traversa contino fuori
        const goalDepth = 5.0;      // Profondità della rete

        // --- 1. CCD PER LA LINEA DI PORTA DESTRA ---
        // Se nel frame precedente era prima della linea, e ora è oltre la linea
        if (this._p0.x <= borderX && this._p1.x > borderX) {
            // Calcoliamo matematicamente l'esatto punto in cui ha tagliato la linea
            const t = (borderX - this._p0.x) / (this._p1.x - this._p0.x); 
            const intersectY = this._p0.y + t * (this._p1.y - this._p0.y);
            const intersectZ = this._p0.z + t * (this._p1.z - this._p0.z);

            // Controlliamo se quel punto esatto era dentro lo specchio della porta
            if (intersectY <= goalHeight && Math.abs(intersectZ) <= goalHalfWidth) {
                this.isGoal = true; 
            } else if (!this.isGoal) {
                this.isOutBaseline = true; // Lasciamo che la palla continui a volare naturalmente!
            }
        }
        
        // --- 2. CCD PER LA LINEA DI PORTA SINISTRA ---
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

        // --- 3. FISICA DELLA RETE E DEL FONDO CAMPO ---
        if (this.isGoal) {
            // Se è gol, la facciamo rimbalzare smorzata sulla rete in fondo
            if (this.position.x > borderX + goalDepth) {
                this.position.x = borderX + goalDepth;
                this.velocity.x *= -0.3; // Le reti assorbono l'impatto, non fanno l'effetto "muro"
            } else if (this.position.x < -borderX - goalDepth) {
                this.position.x = -borderX - goalDepth;
                this.velocity.x *= -0.3;
            }

            // Aggiungiamo i limiti laterali e superiori della rete per intrappolarla bene!
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

   
        // --- GESTIONE DEI FALLI LATERALI (Z) ---
        if (this.position.z > borderZ) { this.position.z = borderZ; this.velocity.set(0, 0, 0); this.isOut = true; }
        else if (this.position.z < -borderZ) { this.position.z = -borderZ; this.velocity.set(0, 0, 0); this.isOut = true; }
        else { this.isOut = false; }

        // --- CONTATTO COL TERRENO ---
        const groundLevel = this.radius + 0.005;
        if (this.position.y <= groundLevel) {
            this.position.y = groundLevel;
            
            // Rimbalzo
            if (this.velocity.y < -2) { 
                this.velocity.y *= -this.restitution; 
            } else { 
                this.velocity.y = 0; 
            }

            // Il contatto a terra interrompe il volo e la rotazione aerodinamica
            this.spin = 0;

            // 3. Attrito col suolo (solo quando tocca l'erba)
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

        // ==========================================
        // 5. AGGIORNAMENTO EFFETTO WOW (NUOVO)
        // ==========================================
        if (this.isPowerShot) {
            this.powerShotTimer -= deltaTime;
            if (this.powerShotTimer <= 0) {
                this.isPowerShot = false;
            } else if (Math.random() > 0.5) {
                // Spawna un nuovo anello randomicamente mentre la palla vola
                this.spawnAirRing();
            }
        }

        // Anima ed elimina gli anelli vecchi (ciclo al contrario per rimuovere elementi in sicurezza)
        for (let i = this.powerRings.length - 1; i >= 0; i--) {
            let ringData = this.powerRings[i];

            // Fai crescere e svanire l'anello
            ringData.life -= deltaTime * 3.5; // Velocità di dissolvenza
            ringData.scale += deltaTime * 6.0; // Velocità di espansione

            ringData.mesh.scale.set(ringData.scale, ringData.scale, ringData.scale);
            ringData.mesh.material.opacity = ringData.life;

            // Quando l'anello è invisibile, eliminalo per liberare memoria
            if (ringData.life <= 0) {
                this.scene.remove(ringData.mesh);
                // La geometria è condivisa (this._ringGeo), non facciamo il dispose!
                ringData.mesh.material.dispose();
                this.powerRings.splice(i, 1);
            }
        }
    }

    applyImpulse(forceVector) {
        this.velocity.add(forceVector);
    }
}