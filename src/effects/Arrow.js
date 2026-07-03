import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

export class CoolArrow extends THREE.Mesh {
    constructor() {
        // --- 1. Geometria Custom per la Freccia Estesa ---
        const headGeometry = new THREE.ConeGeometry(0.35, 1.8, 8, 1, false);
        headGeometry.rotateX(Math.PI / 2); 
        headGeometry.translate(0, 0, 0.9); 

        const tailGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
        tailGeometry.rotateX(Math.PI / 2); 
        tailGeometry.translate(0, 0, -0.3); 

        const geometries = [headGeometry, tailGeometry];
        const mergeFn = BufferGeometryUtils.mergeGeometries || BufferGeometryUtils.mergeBufferGeometries;
        const mergedGeometry = mergeFn(geometries);

        // --- 2. Materiale ad Alto Impatto Visivo (EFFETTO VETRO) ---
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xccffff,       
            emissive: 0x001122,    
            flatShading: true,      
            transparent: true,      
            opacity: 0.35,          
            roughness: 0.05,        
            metalness: 0.0,         
            transmission: 0.9,       
            ior: 1.5,                
            thickness: 0.5,          
            specularColor: 0xffffff, 
            sheen: 0.1,              
            sheenColor: 0xccffff,    
        });

        super(mergedGeometry, glassMaterial);

        // --- 3. AGGIUNTA DEI BORDI NERI NETTI (OUTLINE) ---
        const edgesGeometry = new THREE.EdgesGeometry(mergedGeometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0x000000, 
            linewidth: 2,    
        });

        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        this.add(edges);

        this.visible = false;
        
        // --- NUOVO: Variabile per tenere traccia del livello di carica (da 0 a 1) ---
        this.chargeRatio = 0; 
        
        // Impostiamo la scala base
        this.baseScale = 1.5;
        this.scale.set(this.baseScale, this.baseScale, this.baseScale); 
    }

    // --- NUOVO: Metodo per aggiornare la percentuale di carica ---
    setChargeLevel(ratio) {
        // Assicuriamoci che il valore sia sempre compreso tra 0 e 1
        this.chargeRatio = Math.max(0, Math.min(1, ratio));
    }

    animate(deltaTime) {
        if (!this.visible) return;

        // Pulsazione ritmica base
        const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.08;
        
        // Applichiamo la scala: X e Y (spessore) pulsano normalmente
        this.scale.set(
            this.baseScale * pulse, 
            this.baseScale * pulse, 
            this.baseScale * pulse
        );

        // Aumentiamo l'illuminazione interna e il bagliore man mano che si carica
        this.material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.2 + (this.chargeRatio * 1.5);
    }
}