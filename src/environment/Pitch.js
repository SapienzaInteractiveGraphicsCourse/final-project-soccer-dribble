import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';

export function createEnvironment(scene) {
    const pitchGroup = new THREE.Group(); // Creiamo un gruppo per muovere tutto insieme

    // --- PARAMETRI DEL CAMPO ---
    const pWidth = 61.8;  // Larghezza (asse X)
    const pLength = 100.8; // Lunghezza (asse Z)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // --- 1. LE LINEE DEL CAMPO ---
    function buildPitchLines() {
        const lines = new THREE.Group();

        // Perimetro esterno
        const outlineGeo = new THREE.PlaneGeometry(pWidth, pLength);
        const edges = new THREE.EdgesGeometry(outlineGeo); // Crea solo i bordi
        const outline = new THREE.LineSegments(edges, lineMat);
        outline.rotation.x = -Math.PI / 2;
        lines.add(outline);

        // Linea di metà campo
        const centerLineGeo = new THREE.PlaneGeometry(pWidth, 0.2);
        const centerLine = new THREE.Mesh(centerLineGeo, lineMat);
        centerLine.rotation.x = -Math.PI / 2;
        lines.add(centerLine);

        // Cerchio centrale
        const circleGeo = new THREE.RingGeometry(9, 9.2, 32);
        const circle = new THREE.Mesh(circleGeo, lineMat);
        circle.rotation.x = -Math.PI / 2;
        lines.add(circle);

        // --- NUOVE LINEE: AREE E LUNETTE ---
        // Dimensioni standard proporzionate
        const penaltyBoxW = 40.3; // Larghezza area di rigore
        const penaltyBoxL = 16.5; // Lunghezza (profondità) area di rigore
        const goalBoxW = 18.3;    // Larghezza area piccola
        const goalBoxL = 5.5;     // Lunghezza area piccola
        const spotDist = 11.0;    // Distanza del dischetto dalla linea di porta
        const arcRadius = 9.15;   // Raggio della lunetta

        // Funzione di supporto per disegnare rettangoli (Aree)
        function createAreaBox(w, l, zPos) {
            const geo = new THREE.PlaneGeometry(w, l);
            const edgeGeo = new THREE.EdgesGeometry(geo);
            const mesh = new THREE.LineSegments(edgeGeo, lineMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.z = zPos;
            return mesh;
        }

        // Aggiungiamo le Aree di Rigore (Grande)
        // Posizionate alle due estremità calcolando il centro del rettangolo
        lines.add(createAreaBox(penaltyBoxW, penaltyBoxL, pLength / 2 - penaltyBoxL / 2));
        lines.add(createAreaBox(penaltyBoxW, penaltyBoxL, -pLength / 2 + penaltyBoxL / 2));

        // Aggiungiamo le Aree del Portiere (Piccola)
        lines.add(createAreaBox(goalBoxW, goalBoxL, pLength / 2 - goalBoxL / 2));
        lines.add(createAreaBox(goalBoxW, goalBoxL, -pLength / 2 + goalBoxL / 2));

        // Funzione di supporto per disegnare le Lunette (Penalty Arcs)
        // Calcoliamo matematicamente l'angolo esatto in cui il cerchio tocca l'area di rigore
        const arcAngle = Math.acos((penaltyBoxL - spotDist) / arcRadius);

        function createArc(zCenter, isTopGoal) {
            // Definiamo verso dove guarda l'arco (verso il centro del campo)
            const baseAngle = isTopGoal ? -Math.PI / 2 : Math.PI / 2;
            const curve = new THREE.ArcCurve(0, 0, arcRadius, baseAngle - arcAngle, baseAngle + arcAngle, false);
            const points = curve.getPoints(32);
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const arcMesh = new THREE.Line(geo, lineMat);
            
            arcMesh.rotation.x = -Math.PI / 2;
            arcMesh.position.z = zCenter;
            return arcMesh;
        }

        // Aggiungiamo le lunette partendo dal centro del dischetto di rigore
        lines.add(createArc(-pLength / 2 + spotDist, true));  // Porta Nord
        lines.add(createArc(pLength / 2 - spotDist, false)); // Porta Sud

        pitchGroup.add(lines);
    }

    // --- 3. CARICAMENTO STADIO ---
    function loadRealStadium() {
        modelManager.load(`${import.meta.env.BASE_URL}models/stadium.glb`, (gltf) => {
            const model = gltf.scene;
            model.scale.set(1, 1, 1);

            // 1. Calcoliamo la Bounding Box del modello
            const box = new THREE.Box3().setFromObject(model);

            // 2. Troviamo il suo centro matematico
            const center = new THREE.Vector3();
            box.getCenter(center);

            // 3. Spostiamo il modello in X e Z per centrare il prato
            model.position.x = -center.x;
            model.position.z = -center.z;

            // 4. ALZIAMO LO STADIO: Ignoriamo center.y e lo mettiamo a 0 (o lo regoliamo a mano)
            model.position.y = 0;

            // Nascondiamo le porte modellate
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.name.toLowerCase().includes('goal')) {
                        child.visible = false;
                    }
                }
            });

            scene.add(model);
        });
    }

    // --- ESECUZIONE ---
    buildPitchLines();

    // Alziamo il gruppo del campo di un soffio per evitare che "tremi" sopra l'erba
    pitchGroup.position.y = 0.02;

    // SE IL CAMPO È GIRATO NEL VERSO SBAGLIATO RISPETTO ALLO STADIO:
    // Scommenta la riga sotto per ruotarlo di 90 gradi
    pitchGroup.rotation.y = Math.PI / 2;

    scene.add(pitchGroup);
    loadRealStadium();
}