// Player.js
import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// I nostri moduli esterni
import { CoolArrow } from '../effects/Arrow.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';
import { PlayerAction } from '../animation-action/PlayerAction.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { BoosterTrail } from '../effects/BoosTrail.js'; // Aggiusta il percorso se necessario
import { PlayerCustomizer } from '../effects/PlayerCustomizer.js';

export class Player {
    constructor(camera, domElement, scene, ball, startPos = new THREE.Vector3(0, 0, 0), startYaw = 0) {
        this.camera = camera;
        this.scene = scene;
        this.ball = ball;
        this.model = null;

        this.startPos = startPos;
        this.yaw = startYaw;
        this.isTraining = false;

        // --- CONTROLLI REINTEGRATI ---
        this.controls = new PointerLockControls(this.camera, domElement);
        this.keys = { forward: false, backward: false, left: false, right: false, run: false, boost: false };
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        this.boost = 0;
        this.pitch = 0;

        // --- STATISTICHE GIOCATORE ---
        this.stamina = 100;
        this.playerName = "Giocatore";
        this.avatar = "👤";

        // --- ANIMAZIONE RIMESSA LATERALE ---
        this.throwAnimPlaying = false;
        this.throwTimer = 0;
        this.ballThrown = false;
        this.kickButtonHeld = false;

        this.customizer = new PlayerCustomizer(this);

        // 🎥 CAMERA SETTINGS
        this.cameraOffset = new THREE.Vector3(0, 3.5, -8);
        this.cameraTarget = new THREE.Vector3();
        this.modelRotationSpeed = 15;

        // INIZIALIZZIAMO I MODULI
        this.animator = new PlayerAnimator();
        this.action = new PlayerAction();
        this.physicsWorld = new PhysicsWorld(this.scene);
        this.boosterTrail = new BoosterTrail(this.scene);

        // --- SISTEMA GRAFICO FRECCIA E MIRA ---
        this.passArrow = new CoolArrow();
        scene.add(this.passArrow);

        const ringGeo = new THREE.RingGeometry(2.8, 3.0, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.DoubleSide
        });
        this.aimRing = new THREE.Mesh(ringGeo, ringMat);
        this.aimRing.rotation.x = -Math.PI / 2;
        scene.add(this.aimRing);

        const crosshairGeo = new THREE.RingGeometry(0.3, 0.5, 32);
        const crosshairMat = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Rosso di base
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthTest: false // IMPORTANTE: fa sì che il mirino si veda sempre SOPRA la rete o i pali
        });
        this.goalCrosshair = new THREE.Mesh(crosshairGeo, crosshairMat);
        this.goalCrosshair.rotation.y = Math.PI / 2; // Lo giriamo verso il campo
        this.goalCrosshair.visible = false;
        scene.add(this.goalCrosshair);

        this.loadGLB();
        this.initListeners();
    }

    get isThrowingIn() {
        return this.action.isThrowingIn;
    }

    loadGLB() {
        modelManager.load(`${import.meta.env.BASE_URL}models/player.glb`, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(1.5, 1.5, 1.5);

            this.model.position.copy(this.startPos);
            this.model.rotation.y = this.yaw;

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = false;

                    if (child.name === 'Ch38_Shirt') {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xff0000);
                    }
                }
            });

            this.animator.initBones(this.model);
            this.scene.add(this.model);
        });
    }

    // --- LOGICA INPUT ---
    initListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.keys.forward = true;
            if (e.code === 'KeyS') this.keys.backward = true;
            if (e.code === 'KeyA') this.keys.left = true;
            if (e.code === 'KeyD') this.keys.right = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.run = true;
            if (e.code === 'Space') this.keys.boost = true; // <--- AGGIUNGI QUESTO
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.keys.forward = false;
            if (e.code === 'KeyS') this.keys.backward = false;
            if (e.code === 'KeyA') this.keys.left = false;
            if (e.code === 'KeyD') this.keys.right = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.run = false;
            if (e.code === 'Space') this.keys.boost = false;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.controls.isLocked) {
                this.yaw -= e.movementX * 0.003;
                this.pitch -= e.movementY * 0.003;
                this.pitch = Math.max(0, Math.min(Math.PI / 3, this.pitch));
            }
        });

        // Deleghiamo le azioni a PlayerAction.js
        document.addEventListener('mousedown', (e) => {
            if (this.controls.isLocked) {
                if (this.action.isThrowingIn && e.button === 0) {
                    // Avvia l'animazione di caricamento invece di lanciare immediatamente la palla
                    if (!this.throwAnimPlaying) {
                        this.throwAnimPlaying = true;
                        this.throwTimer = 0;
                        this.ballThrown = false;
                    }
                } else if (this.ball && this.ball.isLoaded && !this.action.chargingAction) {
                    if (e.button === 0) {
                        this.action.startCharge('pass');
                        this.kickButtonHeld = true;
                    } else if (e.button === 2) {
                        this.action.startCharge('shoot');
                        this.kickButtonHeld = true;
                    }
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.controls.isLocked && this.action.chargingAction) {
                if ((this.action.chargingAction === 'pass' && e.button === 0) ||
                    (this.action.chargingAction === 'shoot' && e.button === 2)) {
                    this.kickButtonHeld = false;
                }
            }
        });

        // --- LOGICA TOUCH (MOBILE/IPAD) ---
        const touchZone = document.getElementById('touch-joystick-zone');
        const touchStick = document.getElementById('touch-joystick-stick');
        const touchBase = document.getElementById('touch-joystick-base');

        if (touchZone && touchStick && touchBase) {
            let joystickCenter = { x: 0, y: 0 };
            let joystickTouchId = null;
            const maxRadius = 70; // Aumentato rispetto a prima per il joystick più grande

            touchZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (joystickTouchId === null) {
                        joystickTouchId = touch.identifier;
                        const rect = touchBase.getBoundingClientRect();
                        joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                        this.updateJoystick(touch, joystickCenter, maxRadius, touchStick);
                    }
                }
            }, {passive: false});

            touchZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === joystickTouchId) {
                        this.updateJoystick(touch, joystickCenter, maxRadius, touchStick);
                    }
                }
            }, {passive: false});

            const endJoystick = (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickTouchId) {
                        joystickTouchId = null;
                        touchStick.style.transform = `translate(0px, 0px)`;
                        this.keys.forward = false;
                        this.keys.backward = false;
                        this.keys.left = false;
                        this.keys.right = false;
                        this.keys.run = false; // Ferma l'auto-corsa
                    }
                }
            };

            touchZone.addEventListener('touchend', endJoystick);
            touchZone.addEventListener('touchcancel', endJoystick);
        }

        const bindTouchButton = (id, onStart, onEnd) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); onStart(); }, {passive: false});
            btn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); onEnd(); });
            btn.addEventListener('touchcancel', (e) => { e.preventDefault(); e.stopPropagation(); onEnd(); });
        };

        bindTouchButton('btn-touch-pass', () => {
            if (this.ball && this.ball.isLoaded && !this.action.chargingAction) {
                this.action.startCharge('pass');
                this.kickButtonHeld = true;
            }
        }, () => {
            if (this.action.chargingAction === 'pass') {
                this.kickButtonHeld = false;
            }
        });

        bindTouchButton('btn-touch-shoot', () => {
            if (this.ball && this.ball.isLoaded && !this.action.chargingAction) {
                this.action.startCharge('shoot');
                this.kickButtonHeld = true;
            }
        }, () => {
            if (this.action.chargingAction === 'shoot') {
                this.kickButtonHeld = false;
            }
        });

        bindTouchButton('btn-touch-boost', () => { this.keys.boost = true; }, () => { this.keys.boost = false; });
        
        bindTouchButton('btn-touch-switch', () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
        }, () => {
            document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
        });
    }

    updateJoystick(touch, center, maxRadius, stickElem) {
        let dx = touch.clientX - center.x;
        let dy = touch.clientY - center.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > maxRadius) {
            dx = (dx / distance) * maxRadius;
            dy = (dy / distance) * maxRadius;
        }
        
        stickElem.style.transform = `translate(${dx}px, ${dy}px)`;
        
        const threshold = 15;
        this.keys.forward = false;
        this.keys.backward = false;
        this.keys.left = false;
        this.keys.right = false;

        if (distance > threshold) {
            let absX = Math.abs(dx);
            let absY = Math.abs(dy);
            
            // Sensibilità ridotta: ignora movimenti diagonali lievi per evitare lo "strafe" o "orbita" involontario
            // Devi muovere il dito nettamente verso i lati per girare, altrimenti andrà dritto verso la palla.
            if (absY > absX * 0.4) {
                if (dy < 0) this.keys.forward = true;
                else this.keys.backward = true;
            }
            if (absX > absY * 0.4) {
                if (dx < 0) this.keys.left = true;
                else this.keys.right = true;
            }
        }
        
        // Auto-run su mobile quando il joystick è mosso oltre la soglia
        this.keys.run = this.keys.forward || this.keys.backward || this.keys.left || this.keys.right;
    }

    // Metodo che potrai chiamare da fuori per la rimessa
    startThrowIn() {
        this.keys.forward = false;
        this.keys.backward = false;
        this.keys.left = false;
        this.keys.right = false;

        // Resetta le variabili dell'animazione
        this.throwAnimPlaying = false;
        this.throwTimer = 0;
        this.ballThrown = false;

        // Passiamo la palla e l'osso della mano a PlayerAction
        this.action.startThrowIn(this.ball, this.animator.bones.rightHand);
    }

    getBestPassTarget() {
        if (!this.teammates || this.teammates.length === 0) return null;

        const cameraDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDir);
        cameraDir.y = 0;
        if (cameraDir.lengthSq() > 0) cameraDir.normalize();

        let bestTeammate = null;
        let smallestAngle = Infinity;

        for (const t of this.teammates) {
            if (!t.model || t.model.position.y < -10) continue; // Ignora se nascosto sotto la mappa
            
            const dirToTeammate = new THREE.Vector3().subVectors(t.model.position, this.model.position);
            dirToTeammate.y = 0;
            if (dirToTeammate.lengthSq() < 0.1) continue;
            dirToTeammate.normalize();

            const angle = cameraDir.angleTo(dirToTeammate);
            if (angle < smallestAngle) {
                smallestAngle = angle;
                bestTeammate = t;
            }
        }
        return bestTeammate;
    }

    update(deltaTime) {

        const isGameActive = this.controls.isLocked || (this.isTouchDevice && document.getElementById('touch-controls').style.display !== 'none');
        if (!isGameActive || !this.model) return;
        
        // Reset manuale di X e Z per evitare flip visivi (es. dopo il ReplaySystem)
        this.model.rotation.x = 0;
        this.model.rotation.z = 0;

        // --- NUOVA LOGICA DIREZIONE MOVIMENTO E TELECAMERA (Lock-on sulla palla) ---
        let dir, right;

        if (this.ball && this.ball.isLoaded && !this.action.isThrowingIn && !this.action.isTakingCorner && !this.action.isTakingGoalKick) {
            // Se siamo su Touch, la telecamera segue automaticamente la palla (evita swipe involontari)
            if (this.isTouchDevice) {
                const angleToBall = Math.atan2(this.ball.position.x - this.model.position.x, this.ball.position.z - this.model.position.z);
                const diff = angleToBall - this.yaw;
                const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));
                this.yaw += shortestAngle * deltaTime * 6; // Segue fluidamente la palla
                this.pitch = Math.PI / 8; // Leggermente inclinato in basso
            }

            // 1. Calcoliamo la direzione dal giocatore verso la palla sul piano XZ
            dir = new THREE.Vector3()
                .subVectors(this.ball.position, this.model.position)
                .setY(0)
                .normalize();

            // Fallback se siamo esattamente sopra la palla per evitare errori matematici
            if (dir.lengthSq() < 0.001) {
                dir.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            }

            // 2. Calcoliamo il vettore destra perpendicolare alla palla
            right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        } else {
            // Fallback originale: movimento basato sulla telecamera (per rimesse o se manca la palla)
            dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        }


        let moving = false;
        let isChargingAnim = this.action.chargingAction;

        // Controlliamo se il giocatore può muoversi
        // Controlliamo se il giocatore può muoversi (non può farlo mentre salta di testa)
        const canMove = !this.action.isThrowingIn && !this.action.isTakingCorner && !this.action.isTakingGoalKick && !this.action.chargingAction && !this.animator.isSliding && !this.action.isHeading;

        // --- LOGICA CONSUMO BOOST ---
        const isPressingMovement = (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) && canMove;
        const isBoosting = this.keys.boost && isPressingMovement && this.boost > 0;

        // 🔥 NUOVO: Un'unica variabile per sapere se il giocatore sta scattando (Shift o Spazio)
        const isSprinting = this.keys.run || isBoosting;

        if (isBoosting) {
            this.boost -= 45 * deltaTime;
            this.boost = Math.max(0, this.boost);
        }



        // --- CALCOLO VELOCITÀ ---
        const speed = isBoosting ? 15 : (this.keys.run ? 8 : 5);
        const finalSpeed = speed * deltaTime;

        if (canMove) {
            if (this.keys.forward) { this.model.position.addScaledVector(dir, finalSpeed); moving = true; }
            if (this.keys.backward) { this.model.position.addScaledVector(dir, -finalSpeed); moving = true; }
            if (this.keys.left) { this.model.position.addScaledVector(right, -finalSpeed); moving = true; }
            if (this.keys.right) { this.model.position.addScaledVector(right, finalSpeed); moving = true; }
        }

        // --- SPINTA FISICA SCIVOLATA ---
        if (this.animator.isSliding) {
            const slideDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y).normalize();
            const slideProgress = this.animator.slideTimer / 1.0;
            let slideSpeed = 0;

            if (slideProgress < 0.2) {
                slideSpeed = 14 * (slideProgress / 0.2); // Accelerazione esplosiva iniziale ridotta
            } else if (slideProgress < 0.7) {
                slideSpeed = 14 * (1 - ((slideProgress - 0.2) / 0.5)); // Attrito sull'erba: rallenta fino a fermarsi
            }

            this.model.position.addScaledVector(slideDir, slideSpeed * deltaTime);

            // --- IMPATTO PALLA (TACKLE) ---
            // Solo nelle prime due fasi dell'animazione (discesa e strisciata), non mentre si rialza (progress > 0.7)
            if (this.ball && this.ball.isLoaded && slideProgress < 0.7) {
                const distToBall = this.model.position.distanceTo(this.ball.position);

                // Raggio di 1.5 metri per simulare l'estensione della gamba
                if (distToBall < 1.5) {
                    // Mixiamo la direzione della scivolata con il vettore d'impatto per un rimpallo realistico
                    const impactDir = new THREE.Vector3().subVectors(this.ball.position, this.model.position).setY(0).normalize();
                    const finalKickDir = new THREE.Vector3().lerpVectors(slideDir, impactDir, 0.5).normalize();

                    this.ball.velocity.set(0, 0, 0); // "Sradica" la palla annullando la sua velocità precedente
                    const impulse = finalKickDir.multiplyScalar(15); // Forza della spazzata ridotta
                    impulse.y = 3; // La palla si alza meno a campanile a causa del contrasto
                    this.ball.applyImpulse(impulse);
                }
            }
        }



        // --- EFFETTO TURBO (RAZZO) ---
        if (this.boosterTrail) {
            if (isBoosting) {
                // Origine posizionata dietro la schiena del giocatore
                const boostPos = this.model.position.clone().add(new THREE.Vector3(0, 0.6, -0.3).applyQuaternion(this.model.quaternion));
                this.boosterTrail.emit(boostPos, dir, deltaTime);
            }
            this.boosterTrail.update(deltaTime);
        }

        // --- PARTICELLE TERRENO---
        if ((moving && this.keys.run && Math.random() > 0.6) || (this.animator.isSliding && this.animator.slideTimer < 0.7 && Math.random() > 0.3)) {
            const burstDir = this.animator.isSliding ? new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y).normalize() : dir;
            this.physicsWorld.spawnBurst(this.model.position, burstDir);
        }
        this.physicsWorld.updateParticles(deltaTime);

        // Rotazione modello
        if (this.ball && this.ball.isLoaded && !this.action.isThrowingIn && !this.action.isTakingCorner && !this.animator.isSliding) {

            // 1. Calcoliamo l'angolo esatto verso la palla sul piano XZ
            const angleToBall = Math.atan2(
                this.ball.position.x - this.model.position.x,
                this.ball.position.z - this.model.position.z
            );

            // 2. Calcoliamo la differenza di angolo più breve (evita bug di rotazione a 360°)
            const diff = angleToBall - this.model.rotation.y;
            const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));

            // 3. Ruotiamo il modello fluidamente verso quell'angolo
            this.model.rotation.y += shortestAngle * deltaTime * this.modelRotationSpeed;

        } else if ((moving || this.action.isThrowingIn || this.action.isTakingCorner || this.action.isTakingGoalKick) && !this.animator.isSliding) {
            // Fallback originale: segue la direzione di corsa/mira se la palla non c'è o siamo su palla inattiva
            this.model.rotation.y = THREE.MathUtils.lerp(
                this.model.rotation.y, this.yaw, deltaTime * this.modelRotationSpeed
            );
        }

        // Posizionamento Camera
        // --- Posizionamento Camera Dinamico ---
        let targetOffset = this.cameraOffset; // Offset di base (0, 3.5, -8)

        // Se stiamo battendo un corner, la telecamera si avvicina molto e si abbassa un po'
        if (this.action.isTakingCorner || this.action.isTakingGoalKick) {
            targetOffset = new THREE.Vector3(0, 2.5, -3);
        }

        const offset = targetOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        this.camera.position.lerp(this.model.position.clone().add(offset), 0.1);

        this.cameraTarget.copy(this.model.position);
        this.cameraTarget.y += 1.5 + (this.pitch * 4);
        this.camera.lookAt(this.cameraTarget);

        // Interazioni con la Palla (MIRA E DRIBBLING)
        let currentDribbleTouch = null;
        if (this.ball && this.ball.isLoaded && !this.action.isThrowingIn && !this.throwAnimPlaying) {

            // --- NUOVO: GESTIONE COOLDOWN COLPO DI TESTA ---
            if (this.headerCooldown === undefined) this.headerCooldown = 0;
            if (this.headerCooldown > 0) this.headerCooldown -= deltaTime;

            const distanceToBall2D = new THREE.Vector2(this.model.position.x, this.model.position.z)
                .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
            const ballHeight = this.ball.position.y;

            // --- TRIGGER COLPO DI TESTA ---
            const isBallHigh = ballHeight > 1.3 && ballHeight < 3.5; 

            // Aggiunto il controllo: this.headerCooldown <= 0
            if (!this.action.isHeading && isBallHigh && distanceToBall2D < 3.5 && this.headerCooldown <= 0) {
                
                // 1. Tiro o Passaggio
                if (this.kickButtonHeld && this.action.chargingAction) {
                    const actionType = this.action.chargingAction; 
                    this.action.cancelCharge(this.passArrow);      
                    this.action.startHeader(this.ball, actionType);
                    this.kickButtonHeld = false;
                    this.headerCooldown = 1.2; // <-- COOLDOWN: Evita il loop!
                } 
                // 2. Controllo palla automatico
                else if (distanceToBall2D < 2.8 && !this.action.chargingAction) {
                    this.action.startHeader(this.ball, 'control');
                    this.headerCooldown = 1.2; // <-- COOLDOWN: Evita il loop!
                }
            }

            // --- AGGIORNAMENTO FISICO COLPO DI TESTA ---
            let headerProgress = 0;
            if (this.action.isHeading) {
                headerProgress = this.action.updateHeader(deltaTime, this.ball, this.yaw, this.pitch);
                
                // 1. MAGNETISMO
                if (headerProgress < 0.42 && this.action.frozenBallPos) {
                    const targetPosXZ = new THREE.Vector3(this.action.frozenBallPos.x, this.model.position.y, this.action.frozenBallPos.z);
                    this.model.position.lerp(targetPosXZ, deltaTime * 12); 
                }

                // 2. MIRA INTELLIGENTE
                let targetAngle = this.yaw; 
                
                if (this.action.headerType === 'shoot') {
                    const aimDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
                    const targetGoalX = aimDir.x > 0 ? 49.5 : -49.5; 
                    targetAngle = Math.atan2(targetGoalX - this.model.position.x, 0 - this.model.position.z);
                }

                // 3. APPLICA ROTAZIONE IN VOLO
                const diff = targetAngle - this.model.rotation.y;
                const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));
                this.model.rotation.y += shortestAngle * deltaTime * 25;
            }
            
            // --- COLLISIONE FISICA CORPO INTERO ---
            if (!this.action.isTakingCorner && !this.action.isTakingGoalKick && !this.animator.isSliding) {
                const playerHeight = 1.8;
                const playerRadius = 0.45; // Raggio della capsula aumentato per hitbox più solida
                
                // Punto più vicino lungo l'asse Y del giocatore
                const closestY = Math.max(this.model.position.y, Math.min(this.model.position.y + playerHeight, this.ball.position.y));
                const closestPointOnPlayer = new THREE.Vector3(this.model.position.x, closestY, this.model.position.z);
                
                const distanceToBall3D = closestPointOnPlayer.distanceTo(this.ball.position);
                const minDistance = playerRadius + this.ball.radius;

                if (distanceToBall3D < minDistance) {
                    const pushDir = new THREE.Vector3().subVectors(this.ball.position, closestPointOnPlayer);
                    if (pushDir.lengthSq() > 0.001) {
                        pushDir.normalize();
                    } else {
                        pushDir.set(0, 1, 0); 
                    }

                    // Risoluzione compenetrazione: sposta la palla fuori dal modello
                    const overlap = minDistance - distanceToBall3D;
                    this.ball.position.addScaledVector(pushDir, overlap);

                    // Calcolo della velocità di rimbalzo
                    const dot = this.ball.velocity.dot(pushDir);
                    if (dot < 0) {
                        const restitution = 0.3; // Il corpo assorbe l'urto
                        const bounceImpulse = pushDir.clone().multiplyScalar(dot * (1 + restitution));
                        this.ball.velocity.sub(bounceImpulse);

                        if (moving) {
                            const moveVec = new THREE.Vector3();
                            if (this.keys.forward) moveVec.add(dir);
                            if (this.keys.backward) moveVec.sub(dir);
                            if (this.keys.left) moveVec.sub(right);
                            if (this.keys.right) moveVec.add(right);
                            
                            if (moveVec.lengthSq() > 0) {
                                moveVec.normalize();
                                const playerVel = moveVec.multiplyScalar(speed); // usa la speed calcolata sopra
                                
                                const impactVel = playerVel.dot(pushDir);
                                if (impactVel > 0) {
                                    this.ball.velocity.add(pushDir.multiplyScalar(impactVel * 0.4));
                                }
                            }
                        }
                    }
                }
            }

            const distance = new THREE.Vector2(this.model.position.x, this.model.position.z)
                .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));

            const touchRadius = 1.2; // Aumentato per migliorare la collisione ravvicinata
            const controlRadius = 2.0; // Distanza a cui inizia il controllo palla magnetico
            const aimRadius = 3.0;

            // --- EFFETTO MAGNETE (Controllo palla a distanza) ---
            if (distance < controlRadius && moving && !this.action.chargingAction && this.ball.velocity.lengthSq() < 600) {
                // Punto ideale davanti ai piedi del giocatore
                const idealPos = this.model.position.clone().add(
                    new THREE.Vector3(0, 0, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y)
                );
                idealPos.y = this.ball.position.y;
                
                const pullVec = new THREE.Vector3().subVectors(idealPos, this.ball.position);
                if (pullVec.length() > 0.1) {
                    // Forza proporzionale a quanto siamo vicini al raggio di controllo
                    const magnetForce = (1 - (distance / controlRadius)) * 25 * deltaTime;
                    this.ball.velocity.add(pullVec.normalize().multiplyScalar(magnetForce));
                }
            }

            if (distance < touchRadius) {
                currentDribbleTouch = this.action.dribble(this.ball, this.yaw, isSprinting, isBoosting, this.keys, deltaTime);
            }
            if (this.aimRing) {
                this.aimRing.visible = true;
                this.aimRing.position.set(this.ball.position.x, 0.02, this.ball.position.z);
                if (this.action.chargingAction) {
                    this.aimRing.material.color.setHex(0x00ccff);
                    this.aimRing.material.opacity = 0.8;
                } else {
                    this.aimRing.material.color.setHex(0xffffff);
                    this.aimRing.material.opacity = 1;
                }
            }

            if (this.action.chargingAction) {
                this.passArrow.visible = true;
                this.passArrow.position.set(this.ball.position.x, this.ball.position.y + 0.15, this.ball.position.z);
                this.passArrow.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
                this.passArrow.animate(deltaTime);

                if (distance > touchRadius) {
                    const runDir = new THREE.Vector3().subVectors(this.ball.position, this.model.position).setY(0).normalize();
                    const autoSpeed = (isSprinting ? 12 : 8) * deltaTime;
                    this.model.position.addScaledVector(runDir, autoSpeed);
                    moving = true;

                    const angleToBall = Math.atan2(runDir.x, runDir.z);
                    const diff = angleToBall - this.model.rotation.y;
                    const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));
                    this.model.rotation.y += shortestAngle * deltaTime * this.modelRotationSpeed;

                    isChargingAnim = null; // Non attivare la posa di carica finché corre
                } else {
                    // Spara automaticamente se abbiamo rilasciato il tasto o raggunto il 100% di carica
                    if (!this.kickButtonHeld || this.action.getChargeRatio() >= 1.0) {
                        const wasTakingCorner = this.action.isTakingCorner;
                        const wasTakingGoalKick = this.action.isTakingGoalKick;
                        this.animator.lastChargeRatio = this.action.getChargeRatio();
                        
                        let passTarget = null;
                        if (this.action.chargingAction === 'shoot') {
                            this.animator.wasChargingShoot = true;
                            this.animator.shootFollowThroughTimer = 0;
                        } else if (this.action.chargingAction === 'pass') {
                            this.animator.wasChargingPass = true;
                            this.animator.passFollowThroughTimer = 0;
                            passTarget = this.getBestPassTarget();
                        }

                        this.action.executeKick(this.ball, this.yaw, this.pitch, this.passArrow, passTarget);
                        if (wasTakingCorner) {
                            document.dispatchEvent(new CustomEvent('cornerKicked'));
                        }
                        if (wasTakingGoalKick) {
                            document.dispatchEvent(new CustomEvent('goalKicked'));
                        }
                        
                        if (passTarget) {
                            document.dispatchEvent(new CustomEvent('passExecuted', { detail: { target: passTarget } }));
                        }
                        this.kickButtonHeld = false;
                        isChargingAnim = null;
                    }
                }
            } else {
                this.passArrow.visible = false;
            }

            if (this.action.chargingAction || distance < aimRadius) {
                const aimDir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(-this.pitch, this.yaw, 0, 'YXZ'));
                const targetGoalX = aimDir.x > 0 ? 49.5 : -49.5;
                const distanceToGoal = Math.abs(targetGoalX - this.model.position.x);

                if (distanceToGoal < 35 && Math.abs(aimDir.x) > 0.01) {
                    const t = (targetGoalX - this.ball.position.x) / aimDir.x;
                    if (t > 0) {
                        const hitY = this.ball.position.y + 0.15 + (t * aimDir.y);
                        const hitZ = this.ball.position.z + (t * aimDir.z);
                        if (hitY > -1 && hitY < 15) {
                            this.goalCrosshair.position.set(targetGoalX, hitY, hitZ);
                            this.goalCrosshair.visible = true;
                            const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
                            this.goalCrosshair.scale.set(pulse, pulse, pulse);
                            const isInsideGoal = hitY < 3.5 && Math.abs(hitZ) < 5.0;
                            this.goalCrosshair.material.color.setHex(isInsideGoal ? 0x00ff00 : 0xff0000);
                        } else {
                            this.goalCrosshair.visible = false;
                        }
                    } else {
                        this.goalCrosshair.visible = false;
                    }
                } else {
                    this.goalCrosshair.visible = false;
                }
            } else {
                if (this.goalCrosshair) this.goalCrosshair.visible = false;
            }

        } else {
            if (this.passArrow) this.passArrow.visible = false;
            if (this.aimRing) this.aimRing.visible = false;
            if (this.goalCrosshair) this.goalCrosshair.visible = false;
        }

        // Aggiorniamo la carica del tiro
        if (this.action.chargingAction && !this.kickButtonHeld) {
            // Tieni la potenza bloccata (il giocatore ha rilasciato il tasto ma sta correndo verso la palla)
        } else {
            this.action.updateCharge(deltaTime, this.passArrow);
        }

        if (this.throwAnimPlaying) {
            this.throwTimer += deltaTime;

            // A ~0.89s (Math.PI / speed) l'animazione scatta in avanti: lanciamo la palla!
            if (this.throwTimer >= 0.65 && !this.ballThrown) {
                this.action.executeThrow(this.ball, this.yaw, this.scene);
                this.ballThrown = true;
            }

            // A ~1.35s (Math.PI * 1.5 / speed) il follow-through è completo
            if (this.throwTimer >= 1.35) {
                this.throwAnimPlaying = false;
                this.ballThrown = false;
            }
        }

        const chargeRatio = this.action.getChargeRatio();

        // Aggiorniamo le animazioni (usando la nuova variabile isSprinting)
        // Aggiorniamo le animazioni
        this.animator.animate(
            deltaTime,
            this.throwAnimPlaying,
            moving,
            isSprinting,
            this.action.isThrowingIn,
            isChargingAnim,
            chargeRatio,
            currentDribbleTouch,
            this.action.isHeading,  // NUOVO PARAMETRO
            this.action.isHeading ? (this.action.headerTimer / this.action.headerDuration) : 0 // NUOVO PARAMETRO
        );

    }
}
