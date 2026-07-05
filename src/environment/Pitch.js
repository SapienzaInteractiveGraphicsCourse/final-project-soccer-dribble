import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';

export function createEnvironment(scene) {
    const pitchGroup = new THREE.Group(); 

    
    const pWidth = 61.8;  
    const pLength = 100.8; 
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    
    function buildPitchLines() {
        const lines = new THREE.Group();

        
        const outlineGeo = new THREE.PlaneGeometry(pWidth, pLength);
        const edges = new THREE.EdgesGeometry(outlineGeo); 
        const outline = new THREE.LineSegments(edges, lineMat);
        outline.rotation.x = -Math.PI / 2;
        lines.add(outline);

        
        const centerLineGeo = new THREE.PlaneGeometry(pWidth, 0.2);
        const centerLine = new THREE.Mesh(centerLineGeo, lineMat);
        centerLine.rotation.x = -Math.PI / 2;
        lines.add(centerLine);

        
        const circleGeo = new THREE.RingGeometry(9, 9.2, 32);
        const circle = new THREE.Mesh(circleGeo, lineMat);
        circle.rotation.x = -Math.PI / 2;
        lines.add(circle);

        
        
        const penaltyBoxW = 40.3; 
        const penaltyBoxL = 16.5; 
        const goalBoxW = 18.3;    
        const goalBoxL = 5.5;     
        const spotDist = 11.0;    
        const arcRadius = 9.15;   

        
        function createAreaBox(w, l, zPos) {
            const geo = new THREE.PlaneGeometry(w, l);
            const edgeGeo = new THREE.EdgesGeometry(geo);
            const mesh = new THREE.LineSegments(edgeGeo, lineMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.z = zPos;
            return mesh;
        }

        
        
        lines.add(createAreaBox(penaltyBoxW, penaltyBoxL, pLength / 2 - penaltyBoxL / 2));
        lines.add(createAreaBox(penaltyBoxW, penaltyBoxL, -pLength / 2 + penaltyBoxL / 2));

        
        lines.add(createAreaBox(goalBoxW, goalBoxL, pLength / 2 - goalBoxL / 2));
        lines.add(createAreaBox(goalBoxW, goalBoxL, -pLength / 2 + goalBoxL / 2));

        
        
        const arcAngle = Math.acos((penaltyBoxL - spotDist) / arcRadius);

        function createArc(zCenter, isTopGoal) {
            
            const baseAngle = isTopGoal ? -Math.PI / 2 : Math.PI / 2;
            const curve = new THREE.ArcCurve(0, 0, arcRadius, baseAngle - arcAngle, baseAngle + arcAngle, false);
            const points = curve.getPoints(32);
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const arcMesh = new THREE.Line(geo, lineMat);
            
            arcMesh.rotation.x = -Math.PI / 2;
            arcMesh.position.z = zCenter;
            return arcMesh;
        }

        
        lines.add(createArc(-pLength / 2 + spotDist, true));  
        lines.add(createArc(pLength / 2 - spotDist, false)); 

        pitchGroup.add(lines);
    }

    
    function loadRealStadium() {
        modelManager.load(`${import.meta.env.BASE_URL}models/stadium.glb`, (gltf) => {
            const model = gltf.scene;
            model.scale.set(1, 1, 1);

            
            const box = new THREE.Box3().setFromObject(model);

            
            const center = new THREE.Vector3();
            box.getCenter(center);

            
            model.position.x = -center.x;
            model.position.z = -center.z;

            
            model.position.y = 0;

            
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(model);
        });
    }

    
    buildPitchLines();

    
    pitchGroup.position.y = 0.02;

    
    
    pitchGroup.rotation.y = Math.PI / 2;

    scene.add(pitchGroup);
    loadRealStadium();
}