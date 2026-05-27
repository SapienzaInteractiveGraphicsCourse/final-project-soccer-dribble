import * as THREE from 'three';

export class BoostPadManager {
    constructor(scene) {
        this.scene = scene;
        this.pads = [];

        // --- MATERIALI ---
        this.baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111, 
            metalness: 0.9,
            roughness: 0.3
        });

        this.centerActiveMaterial = new THREE.MeshStandardMaterial({
            color: 0xffcc00,       
            emissive: 0xffaa00,    
            emissiveIntensity: 2.0, 
            transparent: true,
            opacity: 0.9
        });

        this.centerInactiveMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            emissive: 0x000000,
            transparent: true,
            opacity: 0.6
        });

        this.createPads();
    }

    createPads() {
        const positions = [
            {x: -25, z: 20}, {x: 25, z: 20},   
            {x: -25, z: -20}, {x: 25, z: -20}, 
            {x: -3, z: 28}, {x: -3, z: -28}    
        ];

        // --- GEOMETRIE RIMPICCIOILITE ---
        // Anello esterno: raggio da 1.2 a 0.7, spessore tubo da 0.15 a 0.08
        const ringGeo = new THREE.TorusGeometry(0.7, 0.08, 8, 32);
        ringGeo.rotateX(Math.PI / 2); 

        // Cerchio interno: raggio da 0.9 a 0.5
        const centerGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);

        positions.forEach(pos => {
            const group = new THREE.Group();
            group.position.set(pos.x, 0, pos.z);

            const ring = new THREE.Mesh(ringGeo, this.baseMaterial);
            ring.position.y = 0.02; // Ancora più raso terra
            ring.receiveShadow = true;

            const center = new THREE.Mesh(centerGeo, this.centerActiveMaterial);
            center.position.y = 0.02; 
            center.receiveShadow = true;

            group.add(ring);
            group.add(center);
            this.scene.add(group);

            this.pads.push({
                group: group,
                center: center,
                isActive: true,
                cooldown: 0
            });
        });
    }

    update(deltaTime, player) {
        for (let pad of this.pads) {
            if (!pad.isActive) {
                pad.cooldown -= deltaTime;
                if (pad.cooldown <= 0) {
                    pad.isActive = true;
                    pad.center.material = this.centerActiveMaterial;
                }
            } else {
                if (player && player.model) {
                    const dist = player.model.position.distanceTo(pad.group.position);
                    
                    // --- COLLISIONE RIMPICCIOLITA ---
                    // Ridotto da 1.8 a 1.0 (più preciso)
                    if (dist < 1.0 && player.boost < 100) {
                        player.boost = Math.min(100, player.boost + 25); 
                        pad.isActive = false; 
                        pad.cooldown = 10;    
                        pad.center.material = this.centerInactiveMaterial;
                    }
                }
            }
        }
    }

    setVisible(visible) {
        for (let pad of this.pads) {
            pad.group.visible = visible;
        }
    }
}