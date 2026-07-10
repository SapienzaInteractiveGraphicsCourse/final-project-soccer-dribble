
import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';


import { CoolArrow } from '../effects/Arrow.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';
import { PlayerAction } from '../animation-action/PlayerAction.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { BoosterTrail } from '../effects/BoosTrail.js'; 
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

        
        this.controls = new PointerLockControls(this.camera, domElement);
        this.keys = { forward: false, backward: false, left: false, right: false, run: false, boost: false };
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        this.boost = 0;
        this.wasBoosting = false;
        this.nitroSound = new Audio(`${import.meta.env.BASE_URL}sound/freesound_community-nitro-activation-48077.mp3`);
        this.nitroSound.loop = true;

        this.mixer = null;

        this.pitch = 0;

        
        this.stamina = 100;
        this.playerName = "Giocatore";
        this.avatar = "👤";

        
        this.throwAnimPlaying = false;
        this.throwTimer = 0;
        this.ballThrown = false;
        this.kickButtonHeld = false;
        this.headerCooldown = 0;

        this.customizer = new PlayerCustomizer(this);

        
        this.cameraOffset = new THREE.Vector3(0, 3.5, -8);
        this.cameraTarget = new THREE.Vector3();
        this.modelRotationSpeed = 15;

        
        this.animator = new PlayerAnimator();
        this.action = new PlayerAction();
        this.physicsWorld = new PhysicsWorld(this.scene);
        this.boosterTrail = new BoosterTrail(this.scene);

        
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
            color: 0xff0000, 
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthTest: false 
        });
        this.goalCrosshair = new THREE.Mesh(crosshairGeo, crosshairMat);
        this.goalCrosshair.rotation.y = Math.PI / 2; 
        this.goalCrosshair.visible = false;
        scene.add(this.goalCrosshair);

        this.cornerTargetPos = new THREE.Vector3(40, 0, 0);
        
        const cornerCrosshairGeo = new THREE.RingGeometry(1.0, 1.3, 32);
        const cornerCrosshairMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00, 
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthTest: false 
        });
        this.cornerCrosshair = new THREE.Mesh(cornerCrosshairGeo, cornerCrosshairMat);
        this.cornerCrosshair.rotation.x = -Math.PI / 2;
        this.cornerCrosshair.visible = false;
        scene.add(this.cornerCrosshair);

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

    
    initListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.keys.forward = true;
            if (e.code === 'KeyS') this.keys.backward = true;
            if (e.code === 'KeyA') this.keys.left = true;
            if (e.code === 'KeyD') this.keys.right = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.run = true;
            if (e.code === 'Space') this.keys.boost = true; 
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
                const sensX = window.gameSettings ? window.gameSettings.sensitivityX : 1.0;
                const sensY = window.gameSettings ? window.gameSettings.sensitivityY : 1.0;
                
                if (this.action && this.action.isTakingCorner) {
                    const cornerSens = 0.05 * sensX;
                    const fx = Math.sin(this.yaw);
                    const fz = Math.cos(this.yaw);
                    const rx = -fz;
                    const rz = fx;
                    
                    this.cornerTargetPos.x += fx * e.movementY * cornerSens;
                    this.cornerTargetPos.z += fz * e.movementY * cornerSens;
                    
                    this.cornerTargetPos.x -= rx * e.movementX * cornerSens;
                    this.cornerTargetPos.z -= rz * e.movementX * cornerSens;
                    
                    this.cornerTargetPos.x = Math.max(25, Math.min(49.5, this.cornerTargetPos.x));
                    this.cornerTargetPos.z = Math.max(-25, Math.min(25, this.cornerTargetPos.z));
                } else {
                    this.yaw -= e.movementX * 0.003 * sensX;
                    this.pitch -= e.movementY * 0.003 * sensY;
                    this.pitch = Math.max(0, Math.min(Math.PI / 3, this.pitch));
                }
            }
        });

        
        document.addEventListener('mousedown', (e) => {
            if (this.controls.isLocked) {
                if (this.action.isThrowingIn && e.button === 0) {
                    
                    if (!this.throwAnimPlaying) {
                        this.throwAnimPlaying = true;
                        this.throwTimer = 0;
                        this.ballThrown = false;
                    }
                } else if (this.ball && this.ball.isLoaded && !this.action.chargingAction && this.canKickBall()) {
                    
                    const isSetPiece = this.action.isTakingCorner || this.action.isTakingGoalKick;
                    if (e.button === 0) {
                        this.action.startCharge('pass');
                        this.kickButtonHeld = true;
                    } else if (e.button === 2 && !isSetPiece) {
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

        
        const touchZone = document.getElementById('touch-joystick-zone');
        const touchStick = document.getElementById('touch-joystick-stick');
        const touchBase = document.getElementById('touch-joystick-base');

        if (touchZone && touchStick && touchBase) {
            let joystickCenter = { x: 0, y: 0 };
            let joystickTouchId = null;
            const maxRadius = 70; 

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
                        this.keys.run = false; 
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
            if (this.ball && this.ball.isLoaded && !this.action.chargingAction && this.canKickBall()) {
                this.action.startCharge('pass');
                this.kickButtonHeld = true;
            }
        }, () => {
            if (this.action.chargingAction === 'pass') {
                this.kickButtonHeld = false;
            }
        });

        bindTouchButton('btn-touch-shoot', () => {
            const isSetPiece = this.action.isTakingCorner || this.action.isTakingGoalKick;
            if (this.ball && this.ball.isLoaded && !this.action.chargingAction && !isSetPiece && this.canKickBall()) {
                this.action.startCharge('shoot');
                this.kickButtonHeld = true;
            }
        }, () => {
            if (this.action.chargingAction === 'shoot') {
                this.kickButtonHeld = false;
            }
        });

        bindTouchButton('btn-touch-boost', () => {
            if (!this.action.isTakingCorner && !this.action.isTakingGoalKick) this.keys.boost = true;
        }, () => { this.keys.boost = false; });
        
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
            
            
            
            if (absY > absX * 0.4) {
                if (dy < 0) this.keys.forward = true;
                else this.keys.backward = true;
            }
            if (absX > absY * 0.4) {
                if (dx < 0) this.keys.left = true;
                else this.keys.right = true;
            }
        }
        
        
        this.keys.run = this.keys.forward || this.keys.backward || this.keys.left || this.keys.right;
    }

    
    startThrowIn() {
        this.keys.forward = false;
        this.keys.backward = false;
        this.keys.left = false;
        this.keys.right = false;

        
        this.throwAnimPlaying = false;
        this.throwTimer = 0;
        this.ballThrown = false;

        
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
            if (!t.model || t.model.position.y < -10) continue; 
            
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

    canKickBall() {
        if (!this.ball || !this.ball.isLoaded || !this.model) return false;
        
        if (this.action.isTakingCorner || this.action.isTakingGoalKick) return true;
        const dist2D = new THREE.Vector2(this.model.position.x, this.model.position.z)
            .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
        const ballHeight = this.ball.position.y;
        return dist2D < 3.5 && ballHeight < 3.0;
    }

    update(deltaTime) {

        const isGameActive = this.controls.isLocked || (this.isTouchDevice && document.getElementById('touch-controls').style.display !== 'none');
        if (!isGameActive || !this.model) return;
        
        if (this.action && this.action.isTakingCorner) {
            this.cornerCrosshair.visible = true;
            this.cornerCrosshair.position.copy(this.cornerTargetPos);
            this.cornerCrosshair.position.y = 0.05;
        } else if (this.cornerCrosshair) {
            this.cornerCrosshair.visible = false;
        }

        this.model.rotation.x = 0;
        this.model.rotation.z = 0;

        
        let dir, right;

        if (this.ball && this.ball.isLoaded && !this.action.isThrowingIn && !this.action.isTakingCorner && !this.action.isTakingGoalKick) {
            
            if (this.isTouchDevice) {
                const angleToBall = Math.atan2(this.ball.position.x - this.model.position.x, this.ball.position.z - this.model.position.z);
                const diff = angleToBall - this.yaw;
                const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));
                this.yaw += shortestAngle * deltaTime * 6; 
                this.pitch = Math.PI / 8; 
            }

            
            dir = new THREE.Vector3()
                .subVectors(this.ball.position, this.model.position)
                .setY(0)
                .normalize();

            
            if (dir.lengthSq() < 0.001) {
                dir.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            }

            
            right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        } else {
            
            dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        }


        let moving = false;
        let isChargingAnim = this.action.chargingAction;

        
        
        const canMove = !this.action.isThrowingIn && !this.action.isTakingCorner && !this.action.isTakingGoalKick && !this.action.chargingAction && !this.animator.isSliding && !this.action.isHeading;

        
        const isPressingMovement = (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) && canMove;
        const isBoosting = this.keys.boost && isPressingMovement && this.boost > 0;
        
        if (isBoosting && !this.wasBoosting && this.nitroSound) {
            this.nitroSound.currentTime = 0;
            this.nitroSound.play().catch(() => {});
        } else if (!isBoosting && this.wasBoosting && this.nitroSound) {
            this.nitroSound.pause();
        }
        this.wasBoosting = isBoosting;

        
        const isSprinting = this.keys.run || isBoosting;

        if (isBoosting) {
            this.boost -= 45 * deltaTime;
            this.boost = Math.max(0, this.boost);
        }



        
        const speed = isBoosting ? 15 : (this.keys.run ? 8 : 5);
        const finalSpeed = speed * deltaTime;

        if (canMove) {
            if (this.keys.forward) { this.model.position.addScaledVector(dir, finalSpeed); moving = true; }
            if (this.keys.backward) { this.model.position.addScaledVector(dir, -finalSpeed); moving = true; }
            if (this.keys.left) { this.model.position.addScaledVector(right, -finalSpeed); moving = true; }
            if (this.keys.right) { this.model.position.addScaledVector(right, finalSpeed); moving = true; }
        }

        
        if (this.animator.isSliding) {
            const slideDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y).normalize();
            const slideProgress = this.animator.slideTimer / 1.0;
            let slideSpeed = 0;

            if (slideProgress < 0.2) {
                slideSpeed = 14 * (slideProgress / 0.2); 
            } else if (slideProgress < 0.7) {
                slideSpeed = 14 * (1 - ((slideProgress - 0.2) / 0.5)); 
            }

            this.model.position.addScaledVector(slideDir, slideSpeed * deltaTime);

            
            
            if (this.ball && this.ball.isLoaded && slideProgress < 0.7) {
                const distToBall = this.model.position.distanceTo(this.ball.position);

                
                if (distToBall < 1.5) {
                    
                    const impactDir = new THREE.Vector3().subVectors(this.ball.position, this.model.position).setY(0).normalize();
                    const finalKickDir = new THREE.Vector3().lerpVectors(slideDir, impactDir, 0.5).normalize();

                    this.ball.velocity.set(0, 0, 0); 
                    const impulse = finalKickDir.multiplyScalar(15); 
                    impulse.y = 3; 
                    this.ball.applyImpulse(impulse);
                }
            }
        }



        
        if (this.boosterTrail) {
            if (isBoosting) {
                
                const boostPos = this.model.position.clone().add(new THREE.Vector3(0, 0.6, -0.3).applyQuaternion(this.model.quaternion));
                this.boosterTrail.emit(boostPos, dir, deltaTime);
            }
            this.boosterTrail.update(deltaTime);
        }

        
        if ((moving && this.keys.run && Math.random() > 0.6) || (this.animator.isSliding && this.animator.slideTimer < 0.7 && Math.random() > 0.3)) {
            const burstDir = this.animator.isSliding ? new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y).normalize() : dir;
            this.physicsWorld.spawnBurst(this.model.position, burstDir);
        }
        this.physicsWorld.updateParticles(deltaTime);

        
        if (this.ball && this.ball.isLoaded && !this.action.isThrowingIn && !this.action.isTakingCorner && !this.animator.isSliding && !this.action.isHeading) {

            
            const angleToBall = Math.atan2(
                this.ball.position.x - this.model.position.x,
                this.ball.position.z - this.model.position.z
            );

            
            const diff = angleToBall - this.model.rotation.y;
            const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));

            
            this.model.rotation.y += shortestAngle * deltaTime * this.modelRotationSpeed;

        } else if ((moving || this.action.isThrowingIn || this.action.isTakingCorner || this.action.isTakingGoalKick) && !this.animator.isSliding) {
            
            this.model.rotation.y = THREE.MathUtils.lerp(
                this.model.rotation.y, this.yaw, deltaTime * this.modelRotationSpeed
            );
        }

        
        
        let targetOffset = this.cameraOffset; 

        
        if (this.action.isTakingCorner) {
            
            targetOffset = new THREE.Vector3(0, 15, 60);
        } else if (this.action.isTakingGoalKick) {
            
            targetOffset = new THREE.Vector3(0, 15, -12);
        }

        const offset = targetOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        this.camera.position.lerp(this.model.position.clone().add(offset), 0.1);

        this.cameraTarget.copy(this.model.position);
        this.cameraTarget.y += 1.5 + (this.pitch * 4);
        this.camera.lookAt(this.cameraTarget);

        
        let currentDribbleTouch = null;
        if (this.ball && this.ball.isLoaded && !this.action.isThrowingIn && !this.throwAnimPlaying) {

            
            if (this.headerCooldown > 0) this.headerCooldown -= deltaTime;

            const distanceToBall2D = new THREE.Vector2(this.model.position.x, this.model.position.z)
                .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
            const ballHeight = this.ball.position.y;

            
            const isBallHigh = ballHeight > 1.5 && ballHeight < 3.5; 

            
            const ballSpeed = this.ball.velocity.length();

            
            if (!this.action.isHeading && isBallHigh && distanceToBall2D < 3.5 && this.headerCooldown <= 0) {
                
                
                if (this.kickButtonHeld && this.action.chargingAction) {
                    const actionType = this.action.chargingAction; 
                    this.action.cancelCharge(this.passArrow);      
                    this.action.startHeader(this.ball, actionType);
                    this.kickButtonHeld = false;
                    this.headerCooldown = 1.2; 
                } 
                
                else if (distanceToBall2D < 2.5 && !this.action.chargingAction && ballSpeed > 2.0) {
                    this.action.startHeader(this.ball, 'control');
                    this.headerCooldown = 1.5; 
                }
            }

            
            let headerProgress = 0;
            if (this.action.isHeading) {
                headerProgress = this.action.updateHeader(deltaTime, this.ball, this.yaw, this.pitch);
                
                
                if (headerProgress < 0.42 && this.action.frozenBallPos) {
                    const targetPosXZ = new THREE.Vector3(this.action.frozenBallPos.x, this.model.position.y, this.action.frozenBallPos.z);
                    this.model.position.lerp(targetPosXZ, deltaTime * 12); 
                }

                
                let targetAngle = this.yaw; 
                
                if (this.action.headerType === 'shoot') {
                    const aimDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
                    const targetGoalX = aimDir.x > 0 ? 49.5 : -49.5; 
                    targetAngle = Math.atan2(targetGoalX - this.model.position.x, 0 - this.model.position.z);
                }

                
                const diff = targetAngle - this.model.rotation.y;
                const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));
                this.model.rotation.y += shortestAngle * deltaTime * 25;
            }
            
            
            if (!this.action.isTakingCorner && !this.action.isTakingGoalKick && !this.animator.isSliding && !this.action.isHeading) {
                const playerHeight = 1.8;
                const playerRadius = 0.45; 
                
                
                const closestY = Math.max(this.model.position.y, Math.min(this.model.position.y + playerHeight, this.ball.position.y));
                const closestPointOnPlayer = new THREE.Vector3(this.model.position.x, closestY, this.model.position.z);
                
                const distanceToBall3D = closestPointOnPlayer.distanceTo(this.ball.position);
                const minDistance = playerRadius + this.ball.radius;

                if (distanceToBall3D < minDistance) {
                    const pushDir = new THREE.Vector3().subVectors(this.ball.position, closestPointOnPlayer);
                    if (pushDir.lengthSq() > 0.001) {
                        pushDir.normalize();
                        if (pushDir.y > 0.5) {
                            pushDir.y = 0.2;
                            pushDir.x += Math.sign(pushDir.x || (Math.random() - 0.5)) * 1.5;
                            pushDir.z += Math.sign(pushDir.z || (Math.random() - 0.5)) * 1.5;
                            pushDir.normalize();
                        }
                    } else {
                        pushDir.set((Math.random() - 0.5), 0.2, (Math.random() - 0.5)).normalize(); 
                    }

                    
                    const overlap = minDistance - distanceToBall3D;
                    this.ball.position.addScaledVector(pushDir, overlap);

                    
                    const dot = this.ball.velocity.dot(pushDir);
                    if (dot < 0) {
                        const restitution = 0.3; 
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
                                const playerVel = moveVec.multiplyScalar(speed); 
                                
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

            const touchRadius = 1.2; 
            const controlRadius = 2.0; 
            const aimRadius = 3.0;

            
            if (distance < controlRadius && moving && !this.action.chargingAction && !this.action.isHeading && this.ball.velocity.lengthSq() < 600) {
                
                const idealPos = this.model.position.clone().add(
                    new THREE.Vector3(0, 0, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y)
                );
                idealPos.y = this.ball.position.y;
                
                const pullVec = new THREE.Vector3().subVectors(idealPos, this.ball.position);
                if (pullVec.length() > 0.1) {
                    
                    const magnetForce = (1 - (distance / controlRadius)) * 25 * deltaTime;
                    this.ball.velocity.add(pullVec.normalize().multiplyScalar(magnetForce));
                }
            }

            if (distance < touchRadius && !this.action.isTakingCorner && !this.action.isTakingGoalKick && !this.action.isHeading) {
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

                    isChargingAnim = null; 
                } else {
                    
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

                        if (wasTakingCorner) {
                            this.action.executeKick(this.ball, this.yaw, this.pitch, this.passArrow, this.cornerTargetPos);
                        } else {
                            this.action.executeKick(this.ball, this.yaw, this.pitch, this.passArrow, passTarget);
                        }
                        
                        if (passTarget && !wasTakingCorner && !wasTakingGoalKick) {
                            
                            document.dispatchEvent(new CustomEvent('passExecuted', { detail: { target: passTarget } }));
                        } else {
                            
                            if (wasTakingCorner) {
                                document.dispatchEvent(new CustomEvent('cornerKicked', { detail: { target: passTarget } }));
                            }
                            if (wasTakingGoalKick) {
                                document.dispatchEvent(new CustomEvent('goalKicked', { detail: { target: passTarget } }));
                            }
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

        
        if (this.action.chargingAction && !this.kickButtonHeld) {
            
        } else {
            this.action.updateCharge(deltaTime, this.passArrow);
        }

        if (this.throwAnimPlaying) {
            this.throwTimer += deltaTime;

            
            if (this.throwTimer >= 0.65 && !this.ballThrown) {
                this.action.executeThrow(this.ball, this.yaw, this.scene, this.targetReceiver);
                if (this.targetReceiver) {
                    document.dispatchEvent(new CustomEvent('passExecuted', { detail: { target: this.targetReceiver } }));
                    this.targetReceiver = null;
                }
                this.ballThrown = true;
            }

            
            if (this.throwTimer >= 1.35) {
                this.throwAnimPlaying = false;
                this.ballThrown = false;
            }
        }

        const chargeRatio = this.action.getChargeRatio();

        
        
        this.animator.animate(
            deltaTime,
            this.throwAnimPlaying,
            moving,
            isSprinting,
            this.action.isThrowingIn,
            isChargingAnim,
            chargeRatio,
            currentDribbleTouch,
            this.action.isHeading,  
            this.action.isHeading ? (this.action.headerTimer / this.action.headerDuration) : 0 
        );

    }
}
