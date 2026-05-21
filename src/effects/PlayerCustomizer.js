import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js'; // Usa il tuo manager esistente

export class PlayerCustomizer {
    constructor(player) {
        this.player = player; // Riferimento all'istanza della classe Player
        this.equippedAccessories = {}; // Mappa per tracciare cosa indossa in ogni "slot"
        this.textureLoader = new THREE.TextureLoader();
        this._pendingHairColor = null; // Colore capelli da applicare dopo il caricamento asincrono
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

            // 7. Applica il colore capelli pendente (salvato prima del caricamento asincrono)
            if (slotName === 'hair') {
                const colorToApply = this._pendingHairColor || '#000000';
                this.changeHairColor(colorToApply);
                this._pendingHairColor = null;
            }
        });
    }

    /**
     * RIMUOZIONE ACCESSORIO
     */
    removeAccessory(slotName) {
    const currentAccessory = this.equippedAccessories[slotName];
    if (currentAccessory && currentAccessory.parent) {
        
        // 1. Svuota la memoria della GPU
        currentAccessory.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    // Controlla se il materiale è un array (modelli con multi-materiale)
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });

        // 2. Rimuovi dalla scena
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
        const color = new THREE.Color(hexString);
        let applied = false;

        // Colora il capello custom (accessorio equipaggiato)
        const hairAccessory = this.equippedAccessories['hair'];
        if (hairAccessory) {
            hairAccessory.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color.copy(color);
                    child.material.needsUpdate = true;
                }
            });
            applied = true;
        }

        // Colora il capello di default del modello (Ch38_Hair),
        // ma solo se è visibile: se è nascosto (capello custom in caricamento)
        // lasciamo applied = false così _pendingHairColor viene impostato correttamente.
        if (this.player.model) {
            this.player.model.traverse((child) => {
                if (child.isMesh && child.name === 'Ch38_Hair' && child.visible) {
                    child.material = child.material.clone();
                    child.material.color.copy(color);
                    child.material.needsUpdate = true;
                    applied = true;
                }
            });
        }

        // Se il modello custom non è ancora caricato, salva il colore per dopo
        if (!applied) {
            this._pendingHairColor = hexString;
        }
    }

    /**
     * EQUIPAGGIA OCCHIALI DA SOLE
     * Utilizza la mesh delle ciglia per un posizionamento più preciso come richiesto
     */
    equipGlasses(id) {
        const slotName = 'accessory';
        if (!id || id === '0') {
            this.removeAccessory(slotName);
            return;
        }

        // =======================================================
        // MAPPATURA CONFIGURAZIONE OCCHIALI DA SOLE
        // Puoi modificare questi valori per ogni singolo occhiale:
        // - position: [asse_x (destra/sinistra), asse_y (su/giù), asse_z (avanti/indietro)]
        // - rotation: [asse_x, asse_y, asse_z] (rotazione in radianti, es. Math.PI/2)
        // - scale: grandezza generale del modello
        // =======================================================

        const GLASSES_CONFIG = {
            '1': { position: [0, 0.1, 0.2], rotation: [0, 2 * Math.PI, 0], scale: 0.015 },
            '2': { position: [0, 0.180, 0.110], rotation: [0, Math.PI, 0], scale: 1.190 },
            '3': { position: [0.135, 0.28, 0.22], rotation: [3/2*Math.PI, 2 * Math.PI, 0], scale: 0.02 },
            '4': { position: [0, 0.07, 0.10], rotation: [0, 2 * Math.PI, 0], scale: 0.0015 },
            '5': { position: [0, -2.05, 0.10], rotation: [0, 2 * Math.PI, 0], scale: 0.15 }
        };

        const modelUrl = `/models/sunglasses_${id}.glb`;

        this.removeAccessory(slotName);

        modelManager.load(modelUrl, (gltf) => {
            const accessoryMesh = gltf.scene;

            accessoryMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                }
            });

            // Attacchiamo all'osso della testa (metodo più sicuro per i modelli animati)
            const bone = this.player.animator.bones['head'];
            if (bone) {
                const cleanId = String(id).trim();
                const config = GLASSES_CONFIG[cleanId] || { position: [0, -2.05, 0.10], rotation: [0, 2 * Math.PI, 0], scale: 0.15 };
                console.log("ciao")
                // Aggiungi questo log per confermare cosa sta leggendo davvero il motore
                console.log(`[DEBUG] ID: "${cleanId}" | Configurazione trovata in mappa:`, GLASSES_CONFIG[cleanId] ? "SÌ" : "NO (Sto usando il Fallback!)");

                const boneWorldScale = new THREE.Vector3();
                bone.getWorldScale(boneWorldScale);
                const scaleMultiplier = 1.0 / (boneWorldScale.x > 0.0001 ? boneWorldScale.x : 1.0);

                // Applica scala
                accessoryMesh.scale.setScalar(config.scale * scaleMultiplier);

                // Applica posizione e rotazione
                accessoryMesh.position.set(config.position[0], config.position[1], config.position[2]).multiplyScalar(scaleMultiplier);
                accessoryMesh.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2]);

                bone.add(accessoryMesh);
                this.equippedAccessories[slotName] = accessoryMesh;
            } else {
                console.warn("Osso 'head' non trovato sul personaggio!");
            }
        });
    }
}
