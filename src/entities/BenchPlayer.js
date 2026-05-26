import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';

export class BenchPlayer {
    constructor(scene, team, position, rotationY) {
        this.scene = scene;
        this.team = team;
        this.position = position;
        this.rotationY = rotationY;
        this.model = null;
        
        // --- STATISTICHE GIOCATORE ---
        this.stamina = 100;
        this.playerName = "Riserva";
        this.avatar = "👤";

        this.loadGLB();
    }

    loadGLB() {
        modelManager.load(`${import.meta.env.BASE_URL}models/player.glb`, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(1.5, 1.5, 1.5);
            this.model.position.copy(this.position);
            this.model.rotation.y = this.rotationY;

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = false;

                    // Colora la maglia in base alla squadra (Rosso per Home, Blu per Away)
                    if (child.name === 'Ch38_Shirt') {
                        child.material = child.material.clone();
                        child.material.color.setHex(this.team === 'home' ? 0xff0000 : 0x0000ff);
                    }
                }

                // Mette il giocatore in posa seduta flettendo le ossa delle gambe
                if (child.isBone) {
                    const b = child.name.toLowerCase();
                    
                    // Posa base delle braccia
                    if (b.endsWith('leftarm') || b.endsWith('rightarm')) child.rotation.x += 1.3;
                    if (b.endsWith('leftforearm')) child.rotation.z += 0.5;
                    if (b.endsWith('rightforearm')) child.rotation.z -= 0.5;

                    // Gambe piegate in avanti (Bacino) e in giù (Ginocchia) a ~90 gradi
                    if (b.endsWith('leftupleg') || b.endsWith('rightupleg')) child.rotation.x -= 1.5; 
                    if (b.endsWith('leftleg') || b.endsWith('rightleg')) child.rotation.x -= 1.5; 
                }
            });

            // Aggiunge la mesh alla scena, resterà statico.
            this.scene.add(this.model);
        });
    }
}