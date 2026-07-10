
import * as THREE from 'three';

export class PlayerAction {
    constructor() {
        this.isThrowingIn = false;
        this.isTakingCorner = false;
        this.isTakingGoalKick = false;
        this.chargingAction = null;
        this.kickPower = 0;


        this.passBasePower = 8;
        this.passMaxPower = 24;
        this.passChargeSpeed = 35;


        this.isHeading = false;
        this.headerTimer = 0;
        this.headerDuration = 0.55;
        this.headerImpactTime = 0.23;
        this.headerType = null;
        this.frozenBallPos = null;
        this.headerHitExecuted = false;

        this.shootBasePower = 18;
        this.shootMaxPower = 50;
        this.shootChargeSpeed = 60;
        this.hasSuperShot = false;
        this.hasElectricShot = false;


        this.kickSound = new Audio(`${import.meta.env.BASE_URL}sound/kick.mp3`);
    }

    startThrowIn(ball, rightHandBone) {
        this.isThrowingIn = true;

        if (ball && ball.isLoaded) {
            ball.velocity.set(0, 0, 0);
            ball.isHeld = true;


            if (rightHandBone && ball.mesh) {
                rightHandBone.attach(ball.mesh);
                ball.mesh.position.set(0.30, 30, 0.0);
                ball.mesh.rotation.set(0, 0, 0);
            }
        }
    }


    startHeader(ball, type) {
        this.isHeading = true;
        this.headerTimer = 0;
        this.headerType = type;
        this.headerHitExecuted = false;

        if (ball && ball.isLoaded) {
            ball.velocity.set(0, 0, 0);
            this.frozenBallPos = ball.position.clone();
        }
    }

    updateHeader(deltaTime, ball, yaw, pitch) {
        if (!this.isHeading) return 0;

        this.headerTimer += deltaTime;

        
        if (ball && this.frozenBallPos && !this.headerHitExecuted && this.headerTimer < this.headerImpactTime) {
            ball.position.copy(this.frozenBallPos);
            ball.velocity.set(0, 0, 0);
        }

        
        if (!this.headerHitExecuted && this.headerTimer >= this.headerImpactTime && (this.headerTimer - deltaTime) < this.headerImpactTime) {
            this.executeHeaderHit(ball, yaw, pitch);
            this.headerHitExecuted = true;
        }

        
        if (this.headerTimer >= this.headerDuration) {
            this.isHeading = false;
            this.frozenBallPos = null;
            this.headerHitExecuted = false;
        }

        return this.headerTimer / this.headerDuration; 
    }

    executeHeaderHit(ball, yaw, pitch) {
        if (!ball || !ball.isLoaded) return;

        let power = 0;
        let kickDir = new THREE.Vector3(0, 0, 1);

        
        if (this.headerType === 'shoot') {
            power = 35;
            pitch = -0.15; 
        } else if (this.headerType === 'pass') {
            power = 18;
            pitch = 0.1; 
        } else {
            
            power = 7;
            pitch = -0.4;
        }

        kickDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
        kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        kickDir.normalize();

       
        ball.velocity.set(0, 0, 0);
        ball.applyImpulse(kickDir.multiplyScalar(power));

    }

    executeThrow(ball, yaw, scene, targetReceiver = null) {
        this.isThrowingIn = false;

        if (ball && ball.isLoaded) {
            const throwDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
            const worldPos = new THREE.Vector3();
            ball.mesh.getWorldPosition(worldPos);

            
            worldPos.addScaledVector(throwDir, 0.8);
            const safeX = 49.5 - 0.5;
            const safeZ = 30.5 - 0.5;
            worldPos.x = Math.max(-safeX, Math.min(safeX, worldPos.x));
            worldPos.z = Math.max(-safeZ, Math.min(safeZ, worldPos.z));

            
            scene.attach(ball.mesh);
            ball.isHeld = false;
            ball.position.copy(worldPos);
            ball.velocity.set(0, 0, 0);

            let throwForceForward = 14;
            let throwForceUpward = 6;

            
            if (targetReceiver && targetReceiver.model) {
                const targetPos = targetReceiver.model.position;
                const distance = new THREE.Vector2(worldPos.x, worldPos.z).distanceTo(new THREE.Vector2(targetPos.x, targetPos.z));
                throwForceForward = Math.max(8, distance * 1.6);
                throwForceUpward = Math.min(6, distance * 0.4 + 2);
            }

            const impulse = new THREE.Vector3(
                throwDir.x * throwForceForward, throwForceUpward, throwDir.z * throwForceForward
            );

            ball.applyImpulse(impulse);
        }
    }


    startCharge(type) {
        this.chargingAction = type;
        this.kickPower = type === 'pass' ? this.passBasePower : this.shootBasePower;
    }

    updateCharge(deltaTime, passArrow) {
        if (!this.chargingAction) {

            if (passArrow && passArrow.material) {
                passArrow.material.color.setHex(0xccffff);
                passArrow.material.emissiveIntensity = 0.5;

                if (passArrow.setChargeLevel) passArrow.setChargeLevel(0);
            }
            return;
        }

        let maxPow = this.chargingAction === 'pass' ? this.passMaxPower : this.shootMaxPower;
        let basePow = this.chargingAction === 'pass' ? this.passBasePower : this.shootBasePower;
        let chargeSpd = this.chargingAction === 'pass' ? this.passChargeSpeed : this.shootChargeSpeed;


        this.kickPower += chargeSpd * deltaTime;
        if (this.kickPower > maxPow) this.kickPower = maxPow;


        if (passArrow && passArrow.material) {
            const chargeRatio = (this.kickPower - basePow) / (maxPow - basePow);
            const startColor = new THREE.Color(0xccffff);
            const endColor = new THREE.Color(0xff2200);

            passArrow.material.color.lerpColors(startColor, endColor, chargeRatio);


            if (passArrow.setChargeLevel) passArrow.setChargeLevel(chargeRatio);
        }
    }


    getChargeRatio() {
        if (!this.chargingAction) return 0;
        const base = this.chargingAction === 'pass' ? this.passBasePower : this.shootBasePower;
        const max = this.chargingAction === 'pass' ? this.passMaxPower : this.shootMaxPower;
        return Math.max(0, Math.min(1, (this.kickPower - base) / (max - base)));
    }

    startCorner(ball) {
        this.isTakingCorner = true;
        if (ball) {
            ball.velocity.set(0, 0, 0);
        }
    }
    startGoalKick(ball) {
        this.isTakingGoalKick = true;
        if (ball) {
            ball.velocity.set(0, 0, 0);
        }
    }

    executeKick(ball, yaw, pitch, passArrow, passTarget = null, isBot = false) {
        if (!ball || !ball.isLoaded || !this.chargingAction) return;


        let kickDir = new THREE.Vector3(0, 0, 1);
        kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        kickDir.normalize();


        if (this.chargingAction === 'pass' && (this.hasSuperShot || this.hasElectricShot)) {
            this.hasSuperShot = false;
            this.hasElectricShot = false;
            if (window.fireTrailEffect) window.fireTrailEffect.deactivate();
        }


        if (this.chargingAction === 'pass' && passTarget) {
            let targetPos;
            
            if (this.isTakingCorner && passTarget.clone) {
                targetPos = passTarget.clone(); 
            } else if (this.isTakingCorner && passTarget.model) {
                targetPos = passTarget.model.position.clone(); 
            } else if (passTarget.model) {
                targetPos = passTarget.model.position.clone();
                if (passTarget.isReceivingGoalKick && passTarget.goalKickRunDir) {
                    targetPos.x += passTarget.goalKickRunDir * 10 * 0.8;
                }
            } else {
                return;
            }

            const distanceToTarget = new THREE.Vector2(ball.position.x, ball.position.z).distanceTo(new THREE.Vector2(targetPos.x, targetPos.z));

            const chargeRatio = this.getChargeRatio();

            let passDir = new THREE.Vector3().subVectors(targetPos, ball.position);
            passDir.y = 0;
            if (passDir.lengthSq() < 0.001) {
                passDir.set(0, 0, 1);
            } else {
                passDir.normalize();
            }

            let V_xz, V_y;

            if (this.isTakingCorner) {
                const maxHeight = 15.0; 
                V_y = Math.sqrt(2 * 12.0 * maxHeight);
                const flightTime = (2 * V_y) / 12.0;
                const dragCompensation = 1 + (distanceToTarget * 0.015);
                V_xz = (distanceToTarget / flightTime) * dragCompensation;
            } else {
                if (pitch <= 0.20) {
                    const baseSpeed = Math.max(25, distanceToTarget * 3.5);
                    V_xz = baseSpeed * (1.0 + chargeRatio * 2.0);
                    V_y = 0;
                } else {
                    const pitchFactor = Math.min(1.0, (pitch - 0.20) / (Math.PI / 4));
                    const maxHeight = 1.0 + (pitchFactor * 4.5);
                    V_y = Math.sqrt(2 * 12.0 * maxHeight);
                    const flightTime = (2 * V_y) / 12.0;
                    const dragCompensation = 1 + (distanceToTarget * 0.015);
                    V_xz = (distanceToTarget / flightTime) * dragCompensation;
                }
            }

            V_xz = Math.min(V_xz, 90);

            const impulse = new THREE.Vector3(passDir.x * V_xz, V_y, passDir.z * V_xz);

            ball.velocity.set(0, 0, 0);
            ball.applyImpulse(impulse);
            ball.spin = 0;

            if (this.kickSound) {
                this.kickSound.currentTime = 0;
                this.kickSound.play().catch(e => console.warn("Autoplay audio bloccato dal browser:", e));
            }

            if (passArrow) {
                passArrow.visible = false;
                if (passArrow.material) passArrow.material.color.setHex(0xccffff);
            }

            this.chargingAction = null;
            this.kickPower = 0;
            if (this.isTakingCorner) this.isTakingCorner = false;
            if (this.isTakingGoalKick) this.isTakingGoalKick = false;

            return;
        }


        if (this.chargingAction === 'shoot') {

            const targetGoalX = kickDir.x > 0 ? 48.5 : -48.5;


            const distanceToGoal = Math.abs(targetGoalX - ball.position.x);




            if (distanceToGoal > 15) {

                const distanceFactor = Math.min((distanceToGoal - 15) / 25, 1.0);


                const powerRatio = (this.kickPower - this.shootBasePower) / (this.shootMaxPower - this.shootBasePower);


                const optimalPitch = 0.20 + (distanceFactor * 0.25) - (powerRatio * 0.1);


                pitch = -optimalPitch;
            } else {

                pitch = -0.1 - (pitch * 0.5);
            }
        }


        if (this.isTakingCorner) {
            pitch -= 0.35;
        }


        kickDir = new THREE.Vector3(0, 0, 1);
        kickDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
        kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        kickDir.normalize();


        let finalPower = this.kickPower;
        let isSuperShotActive = false;


        if (this.isTakingCorner) {
            finalPower *= 1.2;
        }


        if (this.isTakingGoalKick) {
            finalPower *= 0.75;
        }

        if (this.chargingAction === 'shoot' && (this.hasSuperShot || this.hasElectricShot)) {
            finalPower *= 2.5;
            isSuperShotActive = true;

            if (this.hasElectricShot && !isBot) {
                ball.triggerElectricEffect();
            }

            this.hasSuperShot = false;
            this.hasElectricShot = false;
            if (!isBot) document.dispatchEvent(new CustomEvent('bonusCleared'));
            kickDir.y = Math.min(kickDir.y, 0.04);
            kickDir.normalize();


            if (window.fireTrailEffect) {
                setTimeout(() => {
                    window.fireTrailEffect.deactivate();
                }, 2000);
            }


            if (this.glowingModel) {
                this.glowingModel.traverse((child) => {
                    if (child.isMesh && child.material && child.userData.originalEmissive) {
                        child.material.emissive.copy(child.userData.originalEmissive);
                        child.material.emissiveIntensity = 1.0;
                        delete child.userData.originalEmissive;
                    }
                });
                this.glowingModel = null;
            }
        }


        ball.spin = 0;

        if (this.chargingAction === 'shoot' && !isSuperShotActive) {
            const targetGoalDirX = kickDir.x > 0 ? 1 : -1;
            const targetGoalX = targetGoalDirX > 0 ? 48.5 : -48.5;
            const distanceToGoal = Math.abs(targetGoalX - ball.position.x);


            const isAimingAtFarPost = (ball.position.z > 6 && kickDir.z < -0.05) || (ball.position.z < -6 && kickDir.z > 0.05);


            if (distanceToGoal > 8 && distanceToGoal < 35 && isAimingAtFarPost) {
                const curveIntensity = 2.0;
                ball.spin = curveIntensity * targetGoalDirX * Math.sign(ball.position.z);



                const flightTime = distanceToGoal / (finalPower * 0.8);



                const aimCompensation = 0.55 * ball.spin * flightTime;


                kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), aimCompensation);



                kickDir.y = 0.20;
                kickDir.normalize();


                if (!isBot) {
                    document.dispatchEvent(new CustomEvent('triggerSlowMotion', { detail: { duration: 1.0, scale: 0.25 } }));
                }
            }
        }


        const impulse = kickDir.multiplyScalar(finalPower);
        ball.velocity.set(0, 0, 0);
        ball.applyImpulse(impulse);


        if (this.kickSound) {
            this.kickSound.currentTime = 0;
            this.kickSound.play().catch(e => console.warn("Autoplay audio bloccato dal browser:", e));
        }


        if (this.chargingAction === 'shoot') {
            if (isSuperShotActive || this.kickPower >= this.shootMaxPower * 0.85) {
                if (!isBot) {
                    ball.triggerPowerEffect();
                }
            }
        }
        if (passArrow) {
            passArrow.visible = false;
            if (passArrow.material) passArrow.material.color.setHex(0xccffff);
        }

        this.chargingAction = null;
        this.kickPower = 0;

        if (this.isTakingCorner) {
            this.isTakingCorner = false;
        }
        if (this.isTakingGoalKick) {
            this.isTakingGoalKick = false;
        }
    }



    dribble(ball, yaw, isRunning, isBoosting, keys, deltaTime) {
        if (!ball || !ball.isLoaded) return null;


        if (this.dribbleCooldown === undefined) this.dribbleCooldown = 0;
        this.dribbleCooldown -= deltaTime;


        let moveX = 0;
        let moveZ = 0;
        if (keys.forward) moveZ = 1;
        if (keys.backward) moveZ = -1;
        if (keys.left) moveX = -1;
        if (keys.right) moveX = 1;

        if (moveX === 0 && moveZ === 0) return null;


        let touchType = 'straight';
        if (isRunning || isBoosting) {
            touchType = 'run_push';
        } else {
            if (keys.right) touchType = 'right_outside';
            if (keys.left) touchType = 'right_inside';
        }


        if (this.dribbleCooldown > 0) return null;

        const lookDirection = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
        const rightDirection = new THREE.Vector3().crossVectors(lookDirection, new THREE.Vector3(0, 1, 0)).normalize();


        const pushDirection = new THREE.Vector3()
            .addScaledVector(lookDirection, moveZ)
            .addScaledVector(rightDirection, moveX)
            .normalize();


        let maxDribbleSpeed = 8;
        let pushForce = 8;
        let touchInterval = 0.5;


        if (Math.abs(moveX) > 0 && moveZ === 0) {
            pushForce += 3;
        }


        if (isBoosting) {
            maxDribbleSpeed = 30;
            pushForce = 35;
            touchInterval = 0.65;
            if (Math.abs(moveX) > 0) pushForce += 5;
        } else if (isRunning) {
            maxDribbleSpeed = 18;
            pushForce = 20;
            touchInterval = 0.35;
            if (Math.abs(moveX) > 0) pushForce += 4;
        }


        if (ball.velocity.length() < maxDribbleSpeed) {

            ball.velocity.multiplyScalar(0.7);


            ball.applyImpulse(pushDirection.multiplyScalar(pushForce));


            this.dribbleCooldown = touchInterval;
        }

        return touchType;
    }

    cancelCharge(passArrow) {
        this.chargingAction = null;
        this.kickPower = 0;

        if (passArrow) {
            passArrow.visible = false;
            if (passArrow.material) passArrow.material.color.setHex(0xccffff);
            if (passArrow.setChargeLevel) passArrow.setChargeLevel(0);
        }
    }

}