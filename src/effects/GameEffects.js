import * as THREE from 'three';

export function setupEffects(scene) {
    
    const indicatorGeo = new THREE.ConeGeometry(0.25, 0.6, 4);
    indicatorGeo.rotateX(Math.PI); 
    const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffff00 }); 
    const playerIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    playerIndicator.visible = false;
    scene.add(playerIndicator);

    
    const targetGoalGroup = new THREE.Group();
    const targetArrowGeo = new THREE.ConeGeometry(1.5, 3, 8);
    targetArrowGeo.rotateX(Math.PI);
    const targetArrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 });
    const targetArrow = new THREE.Mesh(targetArrowGeo, targetArrowMat);
    
    const arrowEdgesGeo = new THREE.EdgesGeometry(targetArrowGeo);
    const arrowEdgesMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const targetArrowEdges = new THREE.LineSegments(arrowEdgesGeo, arrowEdgesMat);
    targetArrow.add(targetArrowEdges);
    targetGoalGroup.add(targetArrow);
    targetGoalGroup.visible = false;
    scene.add(targetGoalGroup);

    
    const windLinesGroup = new THREE.Group();
    const windLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 });
    
    for (let i = 0; i < 20; i++) {
        const lineGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.0, 4);
        lineGeo.rotateX(Math.PI / 2);
        const line = new THREE.Mesh(lineGeo, windLineMat);
        line.position.set((Math.random() - 0.5) * 5, Math.random() * 2 + 0.5, (Math.random() - 0.5) * 6);
        windLinesGroup.add(line);
    }
    scene.add(windLinesGroup);

    return { playerIndicator, targetGoalGroup, windLinesGroup, windLineMat };
}

export function updateEffects(effects, player, playerTeam, elapsedTime, isRunning, deltaTime, camera) {
    const { playerIndicator, targetGoalGroup, windLinesGroup, windLineMat } = effects;

    
    if (player.model) {
        playerIndicator.visible = true;
        const bounce = Math.sin(elapsedTime * 6) * 0.1;
        playerIndicator.position.set(player.model.position.x, player.model.position.y + 3.2 + bounce, player.model.position.z);
        playerIndicator.rotation.y = elapsedTime * 3;
    } else {
        playerIndicator.visible = false;
    }

    
    targetGoalGroup.visible = true;
    targetGoalGroup.position.y = 6 + Math.sin(elapsedTime * 4) * 1.0;
    targetGoalGroup.rotation.y = elapsedTime * 2;
    targetGoalGroup.position.x = playerTeam === 'home' ? 49.5 : -49.5;

    
    if (isRunning) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, 90, deltaTime * 8);
        windLineMat.opacity = THREE.MathUtils.lerp(windLineMat.opacity, 0.4, deltaTime * 10);
        if (player.model) {
            windLinesGroup.position.copy(player.model.position);
            windLinesGroup.rotation.y = player.yaw;
            windLinesGroup.children.forEach(line => {
                line.position.z += deltaTime * 25;
                if (line.position.z > 2) {
                    line.position.z = -4 - Math.random() * 2;
                    line.position.x = (Math.random() - 0.5) * 4;
                    line.position.y = Math.random() * 2 + 0.5;
                }
            });
        }
    } else {
        camera.fov = THREE.MathUtils.lerp(camera.fov, 75, deltaTime * 8);
        windLineMat.opacity = THREE.MathUtils.lerp(windLineMat.opacity, 0, deltaTime * 10);
    }
    camera.updateProjectionMatrix();
}