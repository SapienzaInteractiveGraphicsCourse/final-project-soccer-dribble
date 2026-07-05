import * as THREE from 'three';

const LOCALSTORAGE_KEY = 'faceDeformations_v3';

const FACE_HANDLES = [
    {
        id: 'nose',
        label: '👃 Naso',
        color: 0xff6b6b,
        offset: new THREE.Vector3(0.01, 0.10, 0.12),
        radius: 0.04,
    },
    {
        id: 'mouth',
        label: '👄 Bocca',
        color: 0xff2244,
        offset: new THREE.Vector3(0.01, 0.02, 0.11),
        radius: 0.045,
    },
    {
        id: 'eye_l',
        label: '👁 Occhio SX',
        color: 0x44aaff,
        offset: new THREE.Vector3(0.11, 0.16, 0.10),
        radius: 0.035,
    },
    {
        id: 'eye_r',
        label: '👁 Occhio DX',
        color: 0x44aaff,
        offset: new THREE.Vector3(-0.09, 0.16, 0.10),
        radius: 0.035,
    },
    {
        id: 'ear_l',
        label: '👂 Orecchio SX',
        color: 0xffaa44,
        offset: new THREE.Vector3(0.15, 0.13, 0.02),
        radius: 0.04,
    },
    {
        id: 'ear_r',
        label: '👂 Orecchio DX',
        color: 0xffaa44,
        offset: new THREE.Vector3(-0.15, 0.13, 0.02),
        radius: 0.04,
    },
];

export class FaceSculptor {
    constructor(playerModel, scene, camera, canvas) {
        this.playerModel = playerModel;
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;

        this.isActive = false;
        this.targetMeshes = [];
        this.meshData = []; 
        this.headBone = null;

        this.handles = [];

        
        this.isDragging = false;
        this.activeHandleIdx = -1;
        this.lastX = 0;
        this.lastY = 0;

        this.raycaster = new THREE.Raycaster();

        
        this._onDown = this._onDown.bind(this);
        this._onMove = this._onMove.bind(this);
        this._onUp   = this._onUp.bind(this);
    }

    
    init() {
        if (!this.playerModel) { console.warn('[FS] playerModel null!'); return; }

        this.playerModel.traverse((child) => {
            const name = child.name ? child.name.toLowerCase() : '';
            if (child.isMesh && (name.includes('body') || name.includes('eyelashes') || name.includes('hair'))) {
                child.geometry = child.geometry.clone(); 
                this.targetMeshes.push(child);
            }
            if (child.isBone && name.endsWith('head')) {
                this.headBone = child;
            }
        });

        if (this.targetMeshes.length === 0) { console.warn('[FS] Nessuna mesh facciale trovata!'); return; }
        if (!this.headBone) { console.warn('[FS] head bone non trovato, uso fallback'); }

        this.targetMeshes.forEach(mesh => {
            const posAttr = mesh.geometry.getAttribute('position');
            const originalPositions = new Float32Array(posAttr.array);
            const currentOffsets    = new Float32Array(posAttr.count * 3);
            const headVertexIndices = [];

            mesh.geometry.computeBoundingBox();
            const bbox = mesh.geometry.boundingBox;
            const yRange = bbox.max.y - bbox.min.y;
            
            let headYThreshold = -Infinity;
            if (mesh.name.toLowerCase().includes('body')) {
                headYThreshold = bbox.min.y + yRange * 0.82;
            }

            for (let i = 0; i < posAttr.count; i++) {
                if (posAttr.getY(i) >= headYThreshold) {
                    headVertexIndices.push(i);
                }
            }

            this.meshData.push({
                mesh,
                originalPositions,
                currentOffsets,
                headVertexIndices
            });
        });

        console.log('[FS] Mesh caricate:', this.meshData.map(m => m.mesh.name));

        this._buildHandles();
        this.loadDeformations();

        console.log('[FS] init() completato ✓');
    }

    _buildHandles() {
        this.handles.forEach(h => { if (h.mesh.parent) h.mesh.parent.remove(h.mesh); });
        this.handles = [];

        FACE_HANDLES.forEach((def, i) => {
            const geo = new THREE.SphereGeometry(0.008, 16, 10);
            const mat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.85,
                depthTest: false,
                depthWrite: false,
            });
            const sphere = new THREE.Mesh(geo, mat);
            sphere.renderOrder = 999;
            sphere.userData.handleIdx = i;
            sphere.visible = false;

            
            const rGeo = new THREE.RingGeometry(0.010, 0.014, 32);
            const rMat = new THREE.MeshBasicMaterial({
                color: def.color, transparent: true, opacity: 0.55,
                side: THREE.DoubleSide, depthTest: false, depthWrite: false,
            });
            const ring = new THREE.Mesh(rGeo, rMat);
            ring.renderOrder = 999;
            sphere.add(ring);

            this.scene.add(sphere);
            this.handles.push({ def, mesh: sphere, deformAccum: new THREE.Vector3() });
        });
    }

    
    activate() {
        if (this.meshData.length === 0) {
            this.init();
            if (this.meshData.length === 0) return;
        }
        this.isActive = true;
        this.handles.forEach(h => { h.mesh.visible = true; });

        
        document.addEventListener('pointerdown', this._onDown);
        document.addEventListener('pointermove', this._onMove);
        document.addEventListener('pointerup',   this._onUp);

        console.log('[FS] activato, handles:', this.handles.length);
    }

    deactivate() {
        this.isActive = false;
        this.isDragging = false;
        this.activeHandleIdx = -1;
        this.handles.forEach(h => { h.mesh.visible = false; });

        document.removeEventListener('pointerdown', this._onDown);
        document.removeEventListener('pointermove', this._onMove);
        document.removeEventListener('pointerup',   this._onUp);
    }

    
    update() {
        if (!this.isActive) return;

        const hw = this._headWorldPos();
        const q  = this.playerModel.quaternion;
        const fwd   = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        const up    = new THREE.Vector3(0, 1, 0).applyQuaternion(q);

        const t = Date.now() * 0.003;
        this.handles.forEach((h, i) => {
            const off = h.def.offset;
            const wp = hw.clone()
                .addScaledVector(right, off.x)
                .addScaledVector(up,    off.y)
                .addScaledVector(fwd,   off.z)
                .add(h.deformAccum);

            h.mesh.position.copy(wp);
            if (h.mesh.children[0]) h.mesh.children[0].lookAt(this.camera.position);

            if (i === this.activeHandleIdx) {
                h.mesh.scale.setScalar(1.3);
                h.mesh.material.opacity = 1.0;
            } else {
                h.mesh.scale.setScalar(1 + Math.sin(t + i) * 0.06);
                h.mesh.material.opacity = 0.85;
            }
        });
    }

    _headWorldPos() {
        if (this.headBone) {
            const p = new THREE.Vector3();
            this.headBone.getWorldPosition(p);
            return p;
        }
        const p = new THREE.Vector3();
        this.playerModel.getWorldPosition(p);
        p.y += 1.55 * this.playerModel.scale.x;
        return p;
    }

    
    _getNDC(e) {
        const rect = this.canvas.getBoundingClientRect();
        return new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width)  * 2 - 1,
           -((e.clientY - rect.top)  / rect.height) * 2 + 1,
        );
    }

    _onDown(e) {
        if (!this.isActive) return;
        
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

        const ndc = this._getNDC(e);
        this.raycaster.setFromCamera(ndc, this.camera);

        const meshes = this.handles.map(h => h.mesh);
        const hits = this.raycaster.intersectObjects(meshes, false);

        if (hits.length > 0) {
            this.activeHandleIdx = hits[0].object.userData.handleIdx;
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            e.stopPropagation();
        }
    }

    _onMove(e) {
        if (!this.isActive || !this.isDragging) return;

        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;

        if (dx === 0 && dy === 0) return;

        const handle = this.handles[this.activeHandleIdx];
        const dist = this.camera.position.distanceTo(handle.mesh.position);
        const fovRad = (this.camera.fov || 75) * Math.PI / 180;
        const screenH = this.canvas.clientHeight || this.canvas.height || 800;
        const worldPerPixel = (2 * dist * Math.tan(fovRad / 2)) / screenH;

        const camRight = new THREE.Vector3();
        const camUp    = new THREE.Vector3();
        const camFwd   = new THREE.Vector3();
        this.camera.matrixWorld.extractBasis(camRight, camUp, camFwd);

        const worldDelta = camRight.clone()
            .multiplyScalar(dx * worldPerPixel)
            .addScaledVector(camUp, -dy * worldPerPixel);

        handle.deformAccum.add(worldDelta);

        let worldToBind = new THREE.Matrix4();
        const primaryMesh = this.meshData.find(m => m.mesh.name.toLowerCase().includes('body'))?.mesh || this.meshData[0].mesh;
        
        if (primaryMesh.skeleton && this.headBone) {
            const headIdx = primaryMesh.skeleton.bones.indexOf(this.headBone);
            if (headIdx !== -1) {
                const boneInverse = primaryMesh.skeleton.boneInverses[headIdx];
                const bindToWorld = new THREE.Matrix4().multiplyMatrices(this.headBone.matrixWorld, boneInverse);
                worldToBind.copy(bindToWorld).invert();
            } else {
                primaryMesh.updateWorldMatrix(true, false);
                worldToBind.copy(primaryMesh.matrixWorld).invert();
            }
        } else {
            primaryMesh.updateWorldMatrix(true, false);
            worldToBind.copy(primaryMesh.matrixWorld).invert();
        }

        const handleWorldPos = handle.mesh.position.clone();
        const centerBind     = handleWorldPos.clone().applyMatrix4(worldToBind);
        
        const worldEnd       = handleWorldPos.clone().add(worldDelta);
        const deltaBindEnd   = worldEnd.clone().applyMatrix4(worldToBind);
        const deltaBind      = deltaBindEnd.clone().sub(centerBind);

        const radiusPt   = handleWorldPos.clone().add(new THREE.Vector3(handle.def.radius, 0, 0)).applyMatrix4(worldToBind);
        const radiusBind = centerBind.distanceTo(radiusPt);

        this._applyGaussian(centerBind, deltaBind, radiusBind);
    }

    _onUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.activeHandleIdx = -1;
            this.saveDeformations();
        }
    }

    
    _applyGaussian(centerBind, deltaBind, radiusBind) {
        const sigma2 = radiusBind * radiusBind * 2;

        this.meshData.forEach(data => {
            const { mesh, currentOffsets, headVertexIndices } = data;
            const posAttr = mesh.geometry.getAttribute('position');
            let affected = 0;

            for (const idx of headVertexIndices) {
                const vx = posAttr.getX(idx);
                const vy = posAttr.getY(idx);
                const vz = posAttr.getZ(idx);

                const dx = vx - centerBind.x;
                const dy = vy - centerBind.y;
                const dz = vz - centerBind.z;

                
                
                
                const d2 = dx*dx + dy*dy + (dz * 0.3)*(dz * 0.3);
                
                const w  = Math.exp(-d2 / sigma2);
                if (w < 0.002) continue;
                affected++;

                posAttr.setXYZ(idx,
                    vx + deltaBind.x * w,
                    vy + deltaBind.y * w,
                    vz + deltaBind.z * w,
                );
                currentOffsets[idx * 3]     += deltaBind.x * w;
                currentOffsets[idx * 3 + 1] += deltaBind.y * w;
                currentOffsets[idx * 3 + 2] += deltaBind.z * w;
            }

            if (affected > 0) {
                posAttr.needsUpdate = true;
                mesh.geometry.computeVertexNormals();
            }
        });
    }

    
    reset() {
        this.meshData.forEach(md => {
            const posAttr = md.mesh.geometry.getAttribute('position');
            for (const idx of md.headVertexIndices) {
                posAttr.setXYZ(idx,
                    md.originalPositions[idx * 3],
                    md.originalPositions[idx * 3 + 1],
                    md.originalPositions[idx * 3 + 2],
                );
            }
            posAttr.needsUpdate = true;
            md.mesh.geometry.computeVertexNormals();
            md.currentOffsets.fill(0);
        });
        this.handles.forEach(h => h.deformAccum.set(0, 0, 0));
        localStorage.removeItem(LOCALSTORAGE_KEY);
        console.log('[FS] reset effettuato');
    }

    
    saveDeformations() {
        const meshesSave = this.meshData.map(data => {
            const sparse = [];
            const n = data.currentOffsets.length / 3;
            for (let i = 0; i < n; i++) {
                const ox = data.currentOffsets[i * 3];
                const oy = data.currentOffsets[i * 3 + 1];
                const oz = data.currentOffsets[i * 3 + 2];
                if (Math.abs(ox) + Math.abs(oy) + Math.abs(oz) > 1e-7) {
                    sparse.push([i, ox, oy, oz]);
                }
            }
            return { name: data.mesh.name, sparse };
        });

        const accums = this.handles.map(h => [h.deformAccum.x, h.deformAccum.y, h.deformAccum.z]);
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({ meshesSave, accums }));
    }

    loadDeformations() {
        const raw = localStorage.getItem(LOCALSTORAGE_KEY);
        if (!raw || this.meshData.length === 0) return;
        try {
            const parsed = JSON.parse(raw);
            if (parsed.sparse) {
                console.warn('[FS] Vecchio formato salvataggio incompatibile, reset...');
                localStorage.removeItem(LOCALSTORAGE_KEY);
                return;
            }

            const { meshesSave, accums } = parsed;

            meshesSave.forEach(saveData => {
                const md = this.meshData.find(m => m.mesh.name === saveData.name);
                if (!md) return;
                const posAttr = md.mesh.geometry.getAttribute('position');
                for (const [i, ox, oy, oz] of saveData.sparse) {
                    if (i >= posAttr.count) continue;
                    posAttr.setXYZ(i,
                        md.originalPositions[i * 3] + ox,
                        md.originalPositions[i * 3 + 1] + oy,
                        md.originalPositions[i * 3 + 2] + oz,
                    );
                    md.currentOffsets[i * 3]     = ox;
                    md.currentOffsets[i * 3 + 1] = oy;
                    md.currentOffsets[i * 3 + 2] = oz;
                }
                posAttr.needsUpdate = true;
                md.mesh.geometry.computeVertexNormals();
            });

            if (accums) accums.forEach(([x, y, z], i) => {
                if (this.handles[i]) this.handles[i].deformAccum.set(x, y, z);
            });
            console.log('[FS] deformazioni caricate per', meshesSave.length, 'mesh');
        } catch (err) {
            console.warn('[FS] errore load:', err);
        }
    }
}
