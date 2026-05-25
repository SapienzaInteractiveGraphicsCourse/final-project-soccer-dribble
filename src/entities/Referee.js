import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';

export class Referee {
    constructor(scene, ball, startPos = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene;
        this.ball = ball;
        this.model = null;
        
        // Ricicliamo l'animatore che usi per i giocatori!
        this.animator = new PlayerAnimator();
        
        // --- PARAMETRI IA ARBITRO ---
        this.speed = 4;              // Velocità di base
        this.minDistance = 8;        // Se la palla è più vicina di 8 metri, si allontana
        this.maxDistance = 15;       // Se la palla è più lontana di 15 metri, la insegue
        // Tra gli 8 e i 15 metri l'arbitro starà fermo a guardare l'azione
        
        // --- CACHE VETTORI (OTTIMIZZAZIONE) ---
        this._ballPosOnGround = new THREE.Vector3();
        this._direction = new THREE.Vector3();

        this.loadGLB(startPos);
    }

    loadGLB(startPos) {
        modelManager.load('./models/player.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(1.5, 1.5, 1.5);
            this.model.position.copy(startPos);

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = false;
                    
                    // --- VESTIAMO L'ARBITRO ---
                    // Maglietta Gialla
                    if (child.name === 'Ch38_Shirt') {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xffff00); // Giallo acceso
                    }
                    // Pantaloncini Neri 
                    // (Cerco nomi comuni, se nel tuo GLB si chiamano diversamente aggiorna il nome)
                    if (child.name.includes('Pants') || child.name.includes('Shorts') || child.name === 'Ch38_Pants') {
                        child.material = child.material.clone();
                        child.material.color.setHex(0x111111); // Grigio molto scuro / Nero
                    }
                    // Opzionale: calzettoni neri
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

    update(deltaTime) {
        if (!this.model || !this.ball || !this.ball.isLoaded) return;

        // Troviamo la posizione della palla ma teniamo la Y al livello dell'arbitro
        // (così non guarda in aria se la palla si alza o non cerca di volare)
        this._ballPosOnGround.set(this.ball.position.x, this.model.position.y, this.ball.position.z);
        
        // Calcoliamo la distanza
        const distanceToBall = this.model.position.distanceTo(this._ballPosOnGround);

        let moving = false;
        let running = false;

        // L'arbitro guarda SEMPRE la palla
        this.model.lookAt(this._ballPosOnGround);

        // --- LOGICA DI MOVIMENTO ---
        if (distanceToBall > this.maxDistance) {
            // La palla è troppo lontana: INSEGUE
            this._direction.subVectors(this._ballPosOnGround, this.model.position).normalize();
            
            // Se è lontanissima (es. lancio lungo), si mette a correre, altrimenti cammina veloce
            running = distanceToBall > 25;
            const currentSpeed = running ? this.speed * 1.8 : this.speed;
            
            this.model.position.addScaledVector(this._direction, currentSpeed * deltaTime);
            moving = true;

        } else if (distanceToBall < this.minDistance) {
            // La palla è troppo vicina: SI SPOSTA ALL'INDIETRO (per non intralciare)
            this._direction.subVectors(this.model.position, this._ballPosOnGround).normalize();
            this.model.position.addScaledVector(this._direction, (this.speed * 0.7) * deltaTime);
            moving = true;
            running = false;
        }

        // --- AGGIORNAMENTO ANIMAZIONE ---
        // Passiamo i parametri all'animatore: 
        // (deltaTime, throwAnimPlaying=false, moving, running, isThrowingIn=false)
        this.animator.animate(deltaTime, false, moving, running, false);
    }
}