import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js'; // Usa il tuo manager esistente

export class PlayerCustomizer {
    constructor(player) {
        this.player = player; // Riferimento all'istanza della classe Player
        this.equippedAccessories = {}; // Mappa per tracciare cosa indossa in ogni "slot"
        this.textureLoader = new THREE.TextureLoader();
    }

    /**
     * CAMBIO TEXTURE (Viso, Maglia, Pelle)
     * @param {string} meshName - Il nome esatto della mesh nel tuo player.glb (es. 'Ch38_Shirt')
     * @param {string} textureUrl - Il percorso dell'immagine (es. '/textures/face_beards.png')
     */
    changeTexture(meshName, textureUrl) {
        if (!this.player.model) {
            console.warn("Modello giocatore non ancora caricato.");
            return;
        }

        this.textureLoader.load(textureUrl, (newTexture) => {
            newTexture.flipY = false; // Spesso necessario con GLTF esportati da Blender
            newTexture.colorSpace = THREE.SRGBColorSpace; // Correzione colore per Three.js moderno

            this.player.model.traverse((child) => {
                if (child.isMesh && child.name === meshName) {
                    // Clona il materiale per evitare che tutti i giocatori in campo cambino faccia
                    child.material = child.material.clone();
                    child.material.map = newTexture;
                    child.material.needsUpdate = true;
                }
            });
        });
    }

    /**
     * CAMBIO COLORE TINTE UNITE (Senza caricare texture, ottimo per la pelle base)
     */
    changeBaseColor(meshName, hexColor) {
        if (!this.player.model) return;

        this.player.model.traverse((child) => {
            if (child.isMesh && child.name === meshName) {
                child.material = child.material.clone();
                child.material.color.setHex(hexColor);
                child.material.needsUpdate = true;
            }
        });
    }

    /**
     * AGGANCIO MODELLI MODULARI 3D (Capelli, Occhiali, Scarpini)
     * @param {string} modelUrl - Percorso del file .glb accessorio (es. '/models/hair_afro.glb')
     * @param {string} boneName - Nome dell'osso a cui attaccarlo (es. 'head', 'leftFoot')
     * @param {string} slotName - Categoria per l'inventario (es. 'hair', 'glasses')
     * @param {THREE.Vector3} offsetPos - Offset opzionale per aggiustare il posizionamento
     * @param {THREE.Euler} offsetRot - Offset opzionale per aggiustare la rotazione
     */
    equipAccessory(modelUrl, boneName, slotName, offsetPos = new THREE.Vector3(), offsetRot = new THREE.Euler()) {
        const bone = this.player.animator.bones[boneName];
        if (!bone) {
            console.warn(`Osso ${boneName} non trovato nell'animatore.`);
            return;
        }

        // 1. Rimuove l'accessorio precedente se lo slot è già occupato
        this.removeAccessory(slotName);

        // 2. Carica il nuovo modello
        modelManager.load(modelUrl, (gltf) => {
            const accessoryMesh = gltf.scene;

            // Assicuriamoci che l'accessorio proietti ombre
            accessoryMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Applica eventuali offset di correzione
            accessoryMesh.position.copy(offsetPos);
            accessoryMesh.rotation.copy(offsetRot);

            // 3. Aggancia l'oggetto fisicamente allo scheletro
            bone.add(accessoryMesh);
            
            // 4. Salva la reference per poterlo rimuovere in futuro
            this.equippedAccessories[slotName] = accessoryMesh;
        });
    }

    /**
     * RIMUOZIONE ACCESSORIO
     */
    removeAccessory(slotName) {
        const currentAccessory = this.equippedAccessories[slotName];
        if (currentAccessory && currentAccessory.parent) {
            currentAccessory.parent.remove(currentAccessory);
            delete this.equippedAccessories[slotName];
        }
    }
}