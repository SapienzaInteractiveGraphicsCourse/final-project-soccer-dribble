import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js'; 

export class PlayerCustomizer {
    constructor(player) {
        this.player = player; 
        this.equippedAccessories = {}; 
        this.textureLoader = new THREE.TextureLoader();
        this._pendingHairColor = null; 
    }

    /**
     * CAMBIO TEXTURE (Viso, Maglia, Pelle)
     * @param {string} meshName - Il nome esatto della mesh nel tuo player.glb (es. 'Ch38_Shirt')
     * @param {string} textureUrl - Il percorso dell'immagine (es. `${import.meta.env.BASE_URL}textures/face_beards.png`)
     */
    changeTexture(meshName, textureUrl) {
        if (!this.player.model) {
            console.warn("Modello giocatore non ancora caricato.");
            return;
        }

        if (!textureUrl) {
            this.player.model.traverse((child) => {
                if (child.isMesh && child.name === meshName) {
                    child.material = child.material.clone();
                    child.material.map = null;
                    child.material.needsUpdate = true;
                }
            });
            return;
        }

        this.textureLoader.load(textureUrl, (newTexture) => {
            newTexture.flipY = false; 
            newTexture.colorSpace = THREE.SRGBColorSpace; 
            newTexture.wrapS = THREE.RepeatWrapping;
            newTexture.wrapT = THREE.RepeatWrapping;
            newTexture.repeat.set(4, 4); 

            this.player.model.traverse((child) => {
                if (child.isMesh && child.name === meshName) {
                    
                    child.material = child.material.clone();
                    child.material.map = newTexture;
                    child.material.color.setHex(0xffffff); 
                    child.material.needsUpdate = true;
                }
            });
        });
    }

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
     * @param {string} modelUrl - Percorso del file .glb accessorio (es. `${import.meta.env.BASE_URL}models/hair_afro.glb`)
     * @param {string} boneName - Nome dell'osso a cui attaccarlo (es. 'head', 'leftFoot')
     * @param {string} slotName - Categoria per l'inventario (es. 'hair', 'glasses')
     * @param {THREE.Vector3} offsetPos - Offset opzionale per aggiustare il posizionamento
     * @param {THREE.Euler} offsetRot - Offset opzionale per aggiustare la rotazione
     */
    equipAccessory(modelUrl, boneName, slotName, offsetPos = new THREE.Vector3(0, 0, 0), offsetRot = new THREE.Euler(0, 0, 0), customScale = 1.0) {
        const bone = this.player.animator.bones[boneName];
        if (!bone) {
            console.warn(`Osso ${boneName} non trovato nell'animatore.`);
            return;
        }

        
        this.removeAccessory(slotName);

        
        modelManager.load(modelUrl, (gltf) => {
            const accessoryMesh = gltf.scene;

            accessoryMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.frustumCulled = false; 
                }
            });

            
            
            const boneWorldScale = new THREE.Vector3();
            bone.getWorldScale(boneWorldScale);
            const scaleMultiplier = 1.0 / (boneWorldScale.x > 0.0001 ? boneWorldScale.x : 1.0);

            
            accessoryMesh.scale.setScalar(customScale * scaleMultiplier);

            
            accessoryMesh.position.copy(offsetPos).multiplyScalar(scaleMultiplier);
            accessoryMesh.rotation.copy(offsetRot);

            
            bone.add(accessoryMesh);

            
            this.equippedAccessories[slotName] = accessoryMesh;

            
            if (slotName === 'hair') {
                const colorToApply = this._pendingHairColor || '#000000';
                this.changeHairColor(colorToApply);
                this._pendingHairColor = null;
            }
        });
    }

    
    removeAccessory(slotName) {
    const currentAccessory = this.equippedAccessories[slotName];
    if (currentAccessory && currentAccessory.parent) {
        
        
        currentAccessory.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });

        
        currentAccessory.parent.remove(currentAccessory);
        delete this.equippedAccessories[slotName];
    }
}
 
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
        if (!hexString) return;
        const color = new THREE.Color(hexString);
        let applied = false;

        
        const hairAccessory = this.equippedAccessories['hair'];
        if (hairAccessory) {
            hairAccessory.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => {
                            const newMat = m.clone();
                            newMat.color.copy(color);
                            newMat.map = null;
                            newMat.needsUpdate = true;
                            return newMat;
                        });
                    } else {
                        child.material = child.material.clone();
                        child.material.color.copy(color);
                        child.material.map = null;
                        child.material.needsUpdate = true;
                    }
                }
            });
            applied = true;
        }

        
        if (this.player.model) {
            this.player.model.traverse((child) => {
                if (child.isMesh && child.name === 'Ch38_Hair') {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => {
                            const newMat = m.clone();
                            newMat.color.copy(color);
                            newMat.map = null;
                            newMat.needsUpdate = true;
                            return newMat;
                        });
                    } else {
                        child.material = child.material.clone();
                        child.material.color.copy(color);
                        child.material.map = null;
                        child.material.needsUpdate = true;
                    }
                    applied = true;
                }
            });
        }

        
        if (!applied) {
            this._pendingHairColor = hexString;
        }
    }

    
    equipGlasses(id) {
        const slotName = 'accessory';
        if (!id || id === '0') {
            this.removeAccessory(slotName);
            return;
        }

        

        const GLASSES_CONFIG = {
            '1': { position: [0, 0.1, 0.2], rotation: [0, 2 * Math.PI, 0], scale: 0.015 },
            '2': { position: [0, 0.180, 0.110], rotation: [0, Math.PI, 0], scale: 1.190 },
            '3': { position: [0.135, 0.28, 0.22], rotation: [3/2*Math.PI, 2 * Math.PI, 0], scale: 0.02 },
            '4': { position: [0, 0.07, 0.10], rotation: [0, 2 * Math.PI, 0], scale: 0.0015 },
            '5': { position: [0, 0.11, 0.15], rotation: [0, 2 * Math.PI, 0], scale: 0.121 }
        };

        const modelUrl = `${import.meta.env.BASE_URL}models/sunglasses_${id}.glb`;

        this.removeAccessory(slotName);

        modelManager.load(modelUrl, (gltf) => {
            const accessoryMesh = gltf.scene;

            accessoryMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                }
            });

            
            const bone = this.player.animator.bones['head'];
            if (bone) {
                const cleanId = String(id).trim();
                const config = GLASSES_CONFIG[cleanId] || { position: [0, -2.05, 0.10], rotation: [0, 2 * Math.PI, 0], scale: 0.15 };
                

                const boneWorldScale = new THREE.Vector3();
                bone.getWorldScale(boneWorldScale);
                const scaleMultiplier = 1.0 / (boneWorldScale.x > 0.0001 ? boneWorldScale.x : 1.0);

                
                accessoryMesh.scale.setScalar(config.scale * scaleMultiplier);

                
                accessoryMesh.position.set(config.position[0], config.position[1], config.position[2]).multiplyScalar(scaleMultiplier);
                accessoryMesh.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2]);

                bone.add(accessoryMesh);
                this.equippedAccessories[slotName] = accessoryMesh;
            } else {
                console.warn("Osso 'head' non trovato sul personaggio!");
            }
        });
    }

   
    equipHat(id) {
        const slotName = 'hat';
        if (!id || id === '0') {
            this.removeAccessory(slotName);
            return;
        }

        
        
        
        const HAT_CONFIG = {
            '1': { position: [0, 0.22, 0.05], rotation: [0, 0, 0], scale: 0.05 },
            '2': { position: [0, 0.30, 0.05], rotation: [0, Math.PI / 2, 0], scale: 0.15 },
            '3': { position: [0, -3.22, 0.05], rotation: [0, 0, 0], scale: 2 },
            '4': { position: [0, 0.22, 0.05], rotation: [0, 0, 0], scale: 0.15 },
            '5': { position: [0, 0.10, 0.05], rotation: [0, 0, 0], scale: 0.009 }
        };

        const modelUrl = `${import.meta.env.BASE_URL}models/hat_${id}.glb`;

        this.removeAccessory(slotName);

        modelManager.load(modelUrl, (gltf) => {
            const accessoryMesh = gltf.scene;

            accessoryMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            
            const bone = this.player.animator.bones['head'];
            if (bone) {
                const cleanId = String(id).trim();
                const config = HAT_CONFIG[cleanId] || { position: [0, 0.22, 0.05], rotation: [0, 0, 0], scale: 0.15 };

                const boneWorldScale = new THREE.Vector3();
                bone.getWorldScale(boneWorldScale);
                const scaleMultiplier = 1.0 / (boneWorldScale.x > 0.0001 ? boneWorldScale.x : 1.0);

                
                accessoryMesh.scale.setScalar(config.scale * scaleMultiplier);

                
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
