// FaceSculptor.js — v3
// Handle in world-space agganciati all'head bone.
// Drag con delta-pixel → world-space conversion semplificata.

import * as THREE from 'three';

const LOCALSTORAGE_KEY = 'faceDeformations_v3';

const FACE_HANDLES = [
    {
        id: 'nose',
        label: '👃 Naso',
        color: 0xff6b6b,
        offset: new THREE.Vector3(0, 0.06, 0.12),
        radius: 0.12,
    },
    {
        id: 'mouth',
        label: '👄 Bocca',
        color: 0xff2244,
        offset: new THREE.Vector3(0, 0.01, 0.11),
        radius: 0.13,
    },
    {
        id: 'eye_l',
        label: '👁 Occhio SX',
        color: 0x44aaff,
        offset: new THREE.Vector3(0.04, 0.11, 0.10),
        radius: 0.08,
    },
    {
        id: 'eye_r',
        label: '👁 Occhio DX',
        color: 0x44aaff,
        offset: new THREE.Vector3(-0.04, 0.11, 0.10),
        radius: 0.08,
    },
    {
        id: 'ear_l',
        label: '👂 Orecchio SX',
        color: 0xffaa44,
        offset: new THREE.Vector3(0.09, 0.06, 0.02),
        radius: 0.10,
    },
    {
        id: 'ear_r',
        label: '👂 Orecchio DX',
        color: 0xffaa44,
        offset: new THREE.Vector3(-0.09, 0.06, 0.02),
        radius: 0.10,
    },
];

export class FaceSculptor {
    constructor(playerModel, scene, camera, canvas) {
        this.playerModel = playerModel;
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;

        this.isActive = false;
        this.bodyMesh = null;
        this.headBone = null;

        this.originalPositions = null;
        this.currentOffsets = null;
        this.headVertexIndices = [];

        this.handles = [];

        // Drag state
        this.isDragging = false;
        this.activeHandleIdx = -1;
        this.lastX = 0;
        this.lastY = 0;

        this.raycaster = new THREE.Raycaster();

        // bind
        this._onDown = this._onDown.bind(this);
        this._onMove = this._onMove.bind(this);
        this._onUp   = this._onUp.bind(this);
    }

    // ----------------------------------------------------------------
    init() {
        if (!this.playerModel) { console.warn('[FS] playerModel null!'); return; }

        this.playerModel.traverse((child) => {
            if (child.isMesh && child.name.toLowerCase() === 'ch38_body') {
                this.bodyMesh = child;
            }
            if (child.isBone && child.name.toLowerCase().endsWith('head')) {
                this.headBone = child;
            }
        });

        if (!this.bodyMesh) { console.warn('[FS] ch38_body non trovata!'); return; }
        if (!this.headBone) { console.warn('[FS] head bone non trovato, uso fallback'); }

        // Salva posizioni originali
        const posAttr = this.bodyMesh.geometry.getAttribute('position');
        this.originalPositions = new Float32Array(posAttr.array);
        this.currentOffsets    = new Float32Array(posAttr.count * 3);

        // Bounding box
        this.bodyMesh.geometry.computeBoundingBox();
        const bbox   = this.bodyMesh.geometry.boundingBox;
        const yRange = bbox.max.y - bbox.min.y;
        const headYThreshold = bbox.min.y + yRange * 0.82;

        console.log('[FS] bbox min.y=', bbox.min.y.toFixed(3), ' max.y=', bbox.max.y.toFixed(3),
                    ' headThreshold=', headYThreshold.toFixed(3),
                    ' modelScale=', this.playerModel.scale.x);

        for (let i = 0; i < posAttr.count; i++) {
            if (posAttr.getY(i) >= headYThreshold) {
                this.headVertexIndices.push(i);
            }
        }
        console.log('[FS] Vertici testa:', this.headVertexIndices.length);

        this._buildHandles();
        this.loadDeformations();

        console.log('[FS] init() completato ✓');
    }

    _buildHandles() {
        this.handles.forEach(h => { if (h.mesh.parent) h.mesh.parent.remove(h.mesh); });
        this.handles = [];

        FACE_HANDLES.forEach((def, i) => {
            const geo = new THREE.SphereGeometry(0.015, 16, 10);
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

            // Ring
            const rGeo = new THREE.RingGeometry(0.018, 0.024, 32);
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

    // ----------------------------------------------------------------
    activate() {
        if (!this.bodyMesh) {
            this.init();
            if (!this.bodyMesh) return;
        }
        this.isActive = true;
        this.handles.forEach(h => { h.mesh.visible = true; });

        // Ascoltiamo sul DOCUMENT così non ci sono problemi di propagazione
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

    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    _getNDC(e) {
        const rect = this.canvas.getBoundingClientRect();
        return new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width)  * 2 - 1,
           -((e.clientY - rect.top)  / rect.height) * 2 + 1,
        );
    }

    _onDown(e) {
        if (!this.isActive) return;
        // Ignora click su pulsanti UI
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

        const ndc = this._getNDC(e);
        this.raycaster.setFromCamera(ndc, this.camera);

        const meshes = this.handles.map(h => h.mesh);
        const hits = this.raycaster.intersectObjects(meshes, false);

        console.log('[FS] pointerdown ndc=', ndc.x.toFixed(3), ndc.y.toFixed(3), 'hits=', hits.length);

        if (hits.length > 0) {
            this.activeHandleIdx = hits[0].object.userData.handleIdx;
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            console.log('[FS] drag START → handle', this.handles[this.activeHandleIdx].def.id);
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

        // Converti pixels → world units usando la distanza camera-handle e il FOV
        const handle = this.handles[this.activeHandleIdx];
        const dist = this.camera.position.distanceTo(handle.mesh.position);
        const fovRad = (this.camera.fov || 75) * Math.PI / 180;
        const screenH = this.canvas.clientHeight || this.canvas.height || 800;
        const worldPerPixel = (2 * dist * Math.tan(fovRad / 2)) / screenH;

        // Direzioni camera-relative in world space
        const camRight = new THREE.Vector3();
        const camUp    = new THREE.Vector3();
        const camFwd   = new THREE.Vector3();
        this.camera.matrixWorld.extractBasis(camRight, camUp, camFwd);

        // Delta world = destra * dx + su * (-dy perché Y schermo è invertito)
        const worldDelta = camRight.clone()
            .multiplyScalar(dx * worldPerPixel)
            .addScaledVector(camUp, -dy * worldPerPixel);

        console.log('[FS] drag dx=', dx, 'dy=', dy, 'worldPerPixel=', worldPerPixel.toFixed(5),
                    'worldDelta=', worldDelta.x.toFixed(4), worldDelta.y.toFixed(4), worldDelta.z.toFixed(4));

        // Accumula spostamento handle in world space
        handle.deformAccum.add(worldDelta);

        // --- CONVERSIONE IN BIND POSE (Local Space reale dei vertici) ---
        // La mesh ch38_body è una SkinnedMesh. I vertici nella geometria (posAttr)
        // sono definiti nel "bind pose". Per deormarli correttamente, dobbiamo mappare
        // la posizione dell'handle (world space) nel bind pose space della testa.
        let worldToBind = new THREE.Matrix4();
        if (this.bodyMesh.skeleton && this.headBone) {
            const headIdx = this.bodyMesh.skeleton.bones.indexOf(this.headBone);
            if (headIdx !== -1) {
                const boneInverse = this.bodyMesh.skeleton.boneInverses[headIdx];
                // bindToWorld = headBone.matrixWorld * boneInverse
                const bindToWorld = new THREE.Matrix4().multiplyMatrices(this.headBone.matrixWorld, boneInverse);
                worldToBind.copy(bindToWorld).invert();
            } else {
                this.bodyMesh.updateWorldMatrix(true, false);
                worldToBind.copy(this.bodyMesh.matrixWorld).invert();
            }
        } else {
            this.bodyMesh.updateWorldMatrix(true, false);
            worldToBind.copy(this.bodyMesh.matrixWorld).invert();
        }

        const handleWorldPos = handle.mesh.position.clone();
        const centerBind     = handleWorldPos.clone().applyMatrix4(worldToBind);
        
        const worldEnd       = handleWorldPos.clone().add(worldDelta);
        const deltaBindEnd   = worldEnd.clone().applyMatrix4(worldToBind);
        const deltaBind      = deltaBindEnd.clone().sub(centerBind);

        // Calcoliamo il raggio convertendo un punto distante 'radius' in world space
        const radiusPt   = handleWorldPos.clone().add(new THREE.Vector3(handle.def.radius, 0, 0)).applyMatrix4(worldToBind);
        const radiusBind = centerBind.distanceTo(radiusPt);

        console.log('[FS] centerBind=', centerBind.x.toFixed(3), centerBind.y.toFixed(3), centerBind.z.toFixed(3),
                    'radiusBind=', radiusBind.toFixed(4), 'deltaBind=', deltaBind.x.toFixed(5), deltaBind.y.toFixed(5));

        this._applyGaussian(centerBind, deltaBind, radiusBind);
    }

    _onUp(e) {
        if (this.isDragging) {
            console.log('[FS] drag END → salvato');
            this.isDragging = false;
            this.activeHandleIdx = -1;
            this.saveDeformations();
        }
    }

    // ----------------------------------------------------------------
    _applyGaussian(centerLocal, deltaLocal, radiusLocal) {
        const posAttr = this.bodyMesh.geometry.getAttribute('position');
        const sigma2  = radiusLocal * radiusLocal * 2;
        let affected  = 0;

        for (const idx of this.headVertexIndices) {
            const vx = posAttr.getX(idx);
            const vy = posAttr.getY(idx);
            const vz = posAttr.getZ(idx);

            const d2 = (vx - centerLocal.x) ** 2 +
                       (vy - centerLocal.y) ** 2 +
                       (vz - centerLocal.z) ** 2;
            const w  = Math.exp(-d2 / sigma2);
            if (w < 0.002) continue;
            affected++;

            posAttr.setXYZ(idx,
                vx + deltaLocal.x * w,
                vy + deltaLocal.y * w,
                vz + deltaLocal.z * w,
            );
            this.currentOffsets[idx * 3]     += deltaLocal.x * w;
            this.currentOffsets[idx * 3 + 1] += deltaLocal.y * w;
            this.currentOffsets[idx * 3 + 2] += deltaLocal.z * w;
        }

        if (affected > 0) {
            posAttr.needsUpdate = true;
            this.bodyMesh.geometry.computeVertexNormals();
        }
        console.log('[FS] vertici deformati:', affected, '/', this.headVertexIndices.length);
    }

    // ----------------------------------------------------------------
    reset() {
        if (!this.bodyMesh) return;
        const posAttr = this.bodyMesh.geometry.getAttribute('position');
        for (const idx of this.headVertexIndices) {
            posAttr.setXYZ(idx,
                this.originalPositions[idx * 3],
                this.originalPositions[idx * 3 + 1],
                this.originalPositions[idx * 3 + 2],
            );
        }
        posAttr.needsUpdate = true;
        this.bodyMesh.geometry.computeVertexNormals();
        this.currentOffsets.fill(0);
        this.handles.forEach(h => h.deformAccum.set(0, 0, 0));
        localStorage.removeItem(LOCALSTORAGE_KEY);
        console.log('[FS] reset effettuato');
    }

    // ----------------------------------------------------------------
    saveDeformations() {
        const sparse = [];
        const n = this.currentOffsets.length / 3;
        for (let i = 0; i < n; i++) {
            const ox = this.currentOffsets[i * 3];
            const oy = this.currentOffsets[i * 3 + 1];
            const oz = this.currentOffsets[i * 3 + 2];
            if (Math.abs(ox) + Math.abs(oy) + Math.abs(oz) > 1e-7) {
                sparse.push([i, ox, oy, oz]);
            }
        }
        const accums = this.handles.map(h => [h.deformAccum.x, h.deformAccum.y, h.deformAccum.z]);
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({ sparse, accums }));
    }

    loadDeformations() {
        const raw = localStorage.getItem(LOCALSTORAGE_KEY);
        if (!raw || !this.bodyMesh) return;
        try {
            const { sparse, accums } = JSON.parse(raw);
            const posAttr = this.bodyMesh.geometry.getAttribute('position');
            for (const [i, ox, oy, oz] of sparse) {
                if (i >= posAttr.count) continue;
                posAttr.setXYZ(i,
                    this.originalPositions[i * 3] + ox,
                    this.originalPositions[i * 3 + 1] + oy,
                    this.originalPositions[i * 3 + 2] + oz,
                );
                this.currentOffsets[i * 3]     = ox;
                this.currentOffsets[i * 3 + 1] = oy;
                this.currentOffsets[i * 3 + 2] = oz;
            }
            if (accums) accums.forEach(([x, y, z], i) => {
                if (this.handles[i]) this.handles[i].deformAccum.set(x, y, z);
            });
            posAttr.needsUpdate = true;
            this.bodyMesh.geometry.computeVertexNormals();
            console.log('[FS] deformazioni caricate:', sparse.length, 'vertici');
        } catch (err) {
            console.warn('[FS] errore load:', err);
        }
    }
}
