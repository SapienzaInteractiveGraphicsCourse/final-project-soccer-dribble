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
    /**
     * AGGANCIO MODELLI MODULARI 3D (Capelli, Occhiali, Scarpini)
     * Versione senza Box3: si affida a offset precisi passati come parametri
     */
    /**
     * AGGANCIO MODELLI MODULARI 3D
     * Con compensazione della scala dell'osso (Anti-Shrink)
     */
    equipAccessory(modelUrl, boneName, slotName, offsetPos = new THREE.Vector3(0, 0, 0), offsetRot = new THREE.Euler(0, 0, 0), customScale = 1.0) {
        const bone = this.player.animator.bones[boneName];
        if (!bone) {
            console.warn(`Osso ${boneName} non trovato nell'animatore.`);
            return;
        }

        // 1. Rimuove l'accessorio precedente
        this.removeAccessory(slotName);

        // 2. Carica il nuovo modello
        modelManager.load(modelUrl, (gltf) => {
            const accessoryMesh = gltf.scene;

            accessoryMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.frustumCulled = false; // CRITICO: Impedisce alla telecamera di farli sparire
                }
            });

            // 3. COMPENSAZIONE DELLA SCALA DELL'OSSO
            // Troviamo la vera scala dell'osso (es. 0.01) e ne calcoliamo l'inverso (es. 100)
            const boneWorldScale = new THREE.Vector3();
            bone.getWorldScale(boneWorldScale);
            const scaleMultiplier = 1.0 / (boneWorldScale.x > 0.0001 ? boneWorldScale.x : 1.0);

            // Moltiplichiamo la scala scelta da te per l'inverso dell'osso
            accessoryMesh.scale.setScalar(customScale * scaleMultiplier);
            
            // 4. Applichiamo posizione e rotazione forzate
            accessoryMesh.position.copy(offsetPos).multiplyScalar(scaleMultiplier);
            accessoryMesh.rotation.copy(offsetRot);

            // 5. Agganciamo l'oggetto fisicamente allo scheletro
            bone.add(accessoryMesh);
            
            // 6. Salviamo in memoria
            this.equippedAccessories[slotName] = accessoryMesh;
            if (slotName === 'hair') {
            this.changeHairColor('#000000'); 
        }
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
    /**
     * NASCONDI/MOSTRA CAPELLI DI DEFAULT
     */
    toggleDefaultHair(visible) {
        if (!this.player.model) return;
        this.player.model.traverse((child) => {
            if (child.isMesh && child.name === 'Ch38_Hair') {
                child.visible = visible;
            }
        });
    }

    /**
     * CAMBIA COLORE CAPELLI EQUIPAGGIATI
     * @param {string} hexString - Colore in formato '#rrggbb'
     */
    changeHairColor(hexString) {
        const hairAccessory = this.equippedAccessories['hair'];
        if (!hairAccessory) return;

        const color = new THREE.Color(hexString);
        hairAccessory.traverse((child) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.color.copy(color);
                child.material.needsUpdate = true;
            }
        });
    }
}
