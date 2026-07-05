export class PlayerAnimator {
    constructor() {
        this.bones = {};
        this.baseRot = {};
        this.basePos = {};
        this.walkCycle = 0;
        this.idleTime = 0;
        this.throwTime = 0;
        this.isDribblingAnim = false;
        this.activeDribbleType = null;
        
        this.shootFollowThroughTimer = 0;
        this.wasChargingShoot = false;

        this.passFollowThroughTimer = 0;
        this.wasChargingPass = false;

        this.lastChargeRatio = 0;

        this.isSliding = false;
        this.slideTimer = 0;
    }
    initBones(model) {
        model.traverse((child) => {
            if (child.isMesh){
                const b = child.name.toLowerCase();
                
            }
            if (child.isBone) {
                const b = child.name.toLowerCase();


                const save = (key, bone) => { this.bones[key] = bone; };

                if (b.endsWith('hips')) save('hips', child);
                if (b.endsWith('spine1')) save('spine', child);
                if (b.endsWith('leftupleg')) save('leftUpLeg', child);
                if (b.endsWith('rightupleg')) save('rightUpLeg', child);
                if (b.endsWith('leftleg')) save('leftLeg', child);
                if (b.endsWith('rightleg')) save('rightLeg', child);
                if (b.endsWith('leftarm')) save('leftArm', child);
                if (b.endsWith('rightarm')) save('rightArm', child);
                if (b.endsWith('leftforearm')) save('leftForeArm', child);
                if (b.endsWith('rightforearm')) save('rightForeArm', child);
                if (b.endsWith('lefthand')) save('leftHand', child);
                if (b.endsWith('righthand')) save('rightHand', child);
                if (b.endsWith('lefthandthumb3')) save('leftThumb3', child);
                if (b.endsWith('righthandthumb3')) save('rightThumb3', child);
                if (b.endsWith('lefthandmiddle3')) save('leftMiddle3', child);
                if (b.endsWith('righthandmiddle3')) save('rightMiddle3', child);
                if (b.endsWith('leftfoot')) save('leftFoot', child);
                if (b.endsWith('rightfoot')) save('rightFoot', child);
                if (b.endsWith('head')) save('head', child);
                if (b.endsWith('neck')) save('neck', child);
                if (b.endsWith('chest')) save('chest', child);
                if (b.endsWith('back')) save('back', child);
                if (b.endsWith('leftshoulder')) save('leftShoulder', child)

            }
        });

        this.applyAPose();

        Object.keys(this.bones).forEach((k) => {
            this.baseRot[k] = this.bones[k].rotation.clone();
            this.basePos[k] = this.bones[k].position.clone();
        });
    }

    applyAPose() {
        if (this.bones.leftArm) this.bones.leftArm.rotation.x += 1.3;
        if (this.bones.rightArm) this.bones.rightArm.rotation.x += 1.3;
        if (this.bones.leftForeArm) this.bones.leftForeArm.rotation.z += 0.5;
        if (this.bones.rightForeArm) this.bones.rightForeArm.rotation.z -= 0.5;
    }

    triggerSlide() {
        if (!this.isSliding) {
            this.isSliding = true;
            this.slideTimer = 0;
        }
    }

    animate(deltaTime, isThrowingInAnim, moving, isRunning, isThrowingInState, chargingAction, chargeRatio, dribbleTouchType, isHeading, headerProgress) {
        if (!this.bones.leftUpLeg || !this.bones.leftArm) return;


        if (isHeading) {
            this.headerAnimation(headerProgress);
            return;
        }


        if (this.isSliding) {
            this.slideTimer += deltaTime;
            const duration = 1.0;
            if (this.slideTimer > duration) {
                this.isSliding = false;
                this.resetToBasePose();
            } else {
                this.slideAnimation(duration);
                return;
            }
        }


        if (dribbleTouchType) {
            this.isDribblingAnim = true;
            this.activeDribbleType = dribbleTouchType;
            this.dribbleAnimTimer = 0;
        }


        if (this.isDribblingAnim) {
            this.dribbleAnimTimer += deltaTime;


            const isRunDribble = this.activeDribbleType === 'run_push';
            const duration = isRunDribble ? 0.28 : 0.55;

            const p = Math.min(this.dribbleAnimTimer / duration, 1.0);

            const easeIn = (t) => t * t;
            const easeOut = (t) => 1 - (1 - t) * (1 - t);

            const snap = (t) => Math.pow(t, 0.4);

            let windup = 0, impact = 0, recovery = 0;

            if (isRunDribble) {

                if (p < 0.15) {
                    windup = easeIn(p / 0.15);
                } else if (p < 0.60) {
                    const sub = (p - 0.15) / 0.45;
                    windup = easeOut(1 - sub);
                    impact = snap(sub);
                } else {
                    const sub = (p - 0.60) / 0.40;
                    impact = easeOut(1 - sub);
                    recovery = easeIn(sub);
                }
            } else {

                if (p < 0.3) {
                    windup = easeIn(p / 0.3);
                } else if (p < 0.6) {
                    const sub = (p - 0.3) / 0.3;
                    windup = easeOut(1 - sub);
                    impact = easeIn(sub);
                } else {
                    const sub = (p - 0.6) / 0.4;
                    impact = easeOut(1 - sub);
                    recovery = easeIn(sub);
                }
            }

            this.resetToBasePose();




            if (this.bones.leftUpLeg) {
                this.bones.leftUpLeg.rotation.x =
                    this.baseRot.leftUpLeg.x + (windup * 0.12) + (impact * 0.08);
            }
            if (this.bones.leftLeg) {
                this.bones.leftLeg.rotation.x =
                    this.baseRot.leftLeg.x - (windup * 0.18) - (impact * 0.12);
            }
            if (this.bones.hips) {
                this.bones.hips.position.y =
                    this.basePos.hips.y - (impact * 0.04);
                this.bones.hips.rotation.x =
                    this.baseRot.hips.x + 0.08 + (windup * 0.06);
            }
            if (this.bones.spine) {
                this.bones.spine.rotation.x =
                    this.baseRot.spine.x + 0.12 + (windup * 0.08);
            }




            if (this.activeDribbleType === 'run_push') {


                if (this.bones.leftUpLeg) {
                    this.bones.leftUpLeg.rotation.x =
                        this.baseRot.leftUpLeg.x
                        + (windup * 0.18)
                        + (impact * 0.14);
                }
                if (this.bones.leftLeg) {
                    this.bones.leftLeg.rotation.x =
                        this.baseRot.leftLeg.x
                        - (windup * 0.28)
                        - (impact * 0.22);
                }


                if (this.bones.rightUpLeg) {
                    this.bones.rightUpLeg.rotation.x =
                        this.baseRot.rightUpLeg.x
                        + (windup * 0.5)
                        - (impact * 1.1)
                        + (recovery * 0.45);


                    this.bones.rightUpLeg.rotation.y =
                        this.baseRot.rightUpLeg.y + (impact * 0.15);
                }


                if (this.bones.rightLeg) {
                    this.bones.rightLeg.rotation.x =
                        this.baseRot.rightLeg.x
                        + (windup * 0.35)
                        - (impact * 0.35)
                        + (recovery * 0.1);
                }


                if (this.bones.rightFoot) {
                    this.bones.rightFoot.rotation.x =
                        this.baseRot.rightFoot.x
                        + (impact * 0.7)
                        + (recovery * 0.1);
                }


                if (this.bones.spine) {
                    this.bones.spine.rotation.x =
                        this.baseRot.spine.x
                        + 0.30
                        + (windup * 0.12)
                        - (recovery * 0.08);

                    this.bones.spine.rotation.y =
                        this.baseRot.spine.y
                        - (impact * 0.28)
                        + (recovery * 0.08);
                }


                if (this.bones.hips) {
                    this.bones.hips.position.y =
                        this.basePos.hips.y - (impact * 0.06);

                    this.bones.hips.rotation.z =
                        this.baseRot.hips.z - (impact * 0.14);

                    this.bones.hips.rotation.x =
                        this.baseRot.hips.x + 0.15 + (windup * 0.08);
                }


                if (this.bones.leftArm) {
                    this.bones.leftArm.rotation.z =
                        this.baseRot.leftArm.z
                        + (windup * 0.3)
                        + (impact * 0.9);
                }
                if (this.bones.rightArm) {
                    this.bones.rightArm.rotation.z =
                        this.baseRot.rightArm.z
                        - (windup * 0.3)
                        - (impact * 0.9);
                }
                if (this.bones.leftForeArm) {
                    this.bones.leftForeArm.rotation.z =
                        this.baseRot.leftForeArm.z + (impact * 0.4);
                }
                if (this.bones.rightForeArm) {
                    this.bones.rightForeArm.rotation.z =
                        this.baseRot.rightForeArm.z - (impact * 0.4);
                }




            } else if (this.activeDribbleType === 'right_inside') {
                if (this.bones.rightUpLeg) {
                    this.bones.rightUpLeg.rotation.x =
                        this.baseRot.rightUpLeg.x
                        - (windup * 0.3)
                        - (impact * 1.2)
                        + (recovery * 0.5);
                    this.bones.rightUpLeg.rotation.y =
                        this.baseRot.rightUpLeg.y
                        + (windup * 0.3)
                        + (impact * 0.7)
                        - (recovery * 0.4);
                }
                if (this.bones.rightLeg) {
                    this.bones.rightLeg.rotation.x =
                        this.baseRot.rightLeg.x
                        + (windup * 0.3)
                        - (impact * 0.15)
                        + (recovery * 0.1);
                }
                if (this.bones.rightFoot) {
                    this.bones.rightFoot.rotation.y =
                        this.baseRot.rightFoot.y + (impact * 1.0);
                    this.bones.rightFoot.rotation.x =
                        this.baseRot.rightFoot.x + (impact * 0.3);
                }
                if (this.bones.spine) {
                    this.bones.spine.rotation.y =
                        this.baseRot.spine.y - (impact * 0.3) + (recovery * 0.1);
                    this.bones.spine.rotation.z =
                        this.baseRot.spine.z - (impact * 0.08);
                }
                if (this.bones.hips) {
                    this.bones.hips.rotation.z =
                        this.baseRot.hips.z + (impact * 0.12);
                }
                if (this.bones.leftArm) {
                    this.bones.leftArm.rotation.z =
                        this.baseRot.leftArm.z + (impact * 0.45);
                    this.bones.leftArm.rotation.x =
                        this.baseRot.leftArm.x - (impact * 0.2);
                }
                if (this.bones.rightArm) {
                    this.bones.rightArm.rotation.z =
                        this.baseRot.rightArm.z - (impact * 0.25);
                }




            } else if (this.activeDribbleType === 'right_outside') {
                if (this.bones.rightUpLeg) {
                    this.bones.rightUpLeg.rotation.x =
                        this.baseRot.rightUpLeg.x
                        - (windup * 0.25)
                        - (impact * 1.1)
                        + (recovery * 0.45);
                    this.bones.rightUpLeg.rotation.y =
                        this.baseRot.rightUpLeg.y
                        - (windup * 0.2)
                        - (impact * 0.6)
                        + (recovery * 0.3);
                }
                if (this.bones.rightLeg) {
                    this.bones.rightLeg.rotation.x =
                        this.baseRot.rightLeg.x
                        + (windup * 0.2)
                        - (impact * 0.1)
                        + (recovery * 0.08);
                }
                if (this.bones.rightFoot) {
                    this.bones.rightFoot.rotation.y =
                        this.baseRot.rightFoot.y - (impact * 0.8);
                    this.bones.rightFoot.rotation.z =
                        this.baseRot.rightFoot.z - (impact * 0.4);
                    this.bones.rightFoot.rotation.x =
                        this.baseRot.rightFoot.x + (impact * 0.2);
                }
                if (this.bones.spine) {
                    this.bones.spine.rotation.y =
                        this.baseRot.spine.y + (impact * 0.2) - (recovery * 0.08);
                    this.bones.spine.rotation.z =
                        this.baseRot.spine.z + (impact * 0.06);
                }
                if (this.bones.hips) {
                    this.bones.hips.rotation.z =
                        this.baseRot.hips.z - (impact * 0.1);
                }
                if (this.bones.leftArm) {
                    this.bones.leftArm.rotation.z =
                        this.baseRot.leftArm.z + (impact * 0.3);
                }
                if (this.bones.rightArm) {
                    this.bones.rightArm.rotation.z =
                        this.baseRot.rightArm.z - (impact * 0.4);
                    this.bones.rightArm.rotation.x =
                        this.baseRot.rightArm.x + (impact * 0.15);
                }




            } else {
                if (this.bones.rightUpLeg) {
                    this.bones.rightUpLeg.rotation.x =
                        this.baseRot.rightUpLeg.x
                        - (windup * 0.3)
                        - (impact * 1.0)
                        + (recovery * 0.4);
                }
                if (this.bones.rightLeg) {
                    this.bones.rightLeg.rotation.x =
                        this.baseRot.rightLeg.x + (windup * 0.2) - (impact * 0.1);
                }
            }


            if (p >= 1.0) {
                this.isDribblingAnim = false;
                this.activeDribbleType = null;
            }

            return;
        }


        if (isThrowingInAnim) {
            this.throwTime += deltaTime;
            this.throwInAnimation();
        } else if (isThrowingInState) {
            this.throwTime = 0;
            this.throwInWaitPose();
        } else {
            this.throwTime = 0;
            if (chargingAction === 'shoot') {
                this.wasChargingShoot = true;
                this.shootFollowThroughTimer = 0;
                this.lastChargeRatio = chargeRatio;
                this.chargeShootAnimation(chargeRatio);
                return;
            }
            else if (chargingAction === 'pass') {
                this.wasChargingPass = true;
                this.passFollowThroughTimer = 0;
                this.lastChargeRatio = chargeRatio;
                this.chargePassAnimation(chargeRatio);
                return;
            }
            else if (this.wasChargingShoot) {

                this.shootFollowThroughTimer += deltaTime;
                if (this.shootFollowThroughTimer > 0.4) {
                    this.wasChargingShoot = false;
                    this.resetToBasePose();
                } else {
                    this.executeKickAnimation(this.shootFollowThroughTimer, this.lastChargeRatio);
                    return;
                }
            }
            else if (this.wasChargingPass) {

                this.passFollowThroughTimer += deltaTime;
                if (this.passFollowThroughTimer > 0.4) {
                    this.wasChargingPass = false;
                    this.resetToBasePose();
                } else {
                    this.executePassAnimation(this.passFollowThroughTimer, this.lastChargeRatio);
                    return;
                }
            }



            if (moving) {
                this.walkCycle += deltaTime * 6;
                if (isRunning) {
                    this.runAnimation();

                } else {
                    this.walkAnimation();
                }
            } else {
                this.idleTime += deltaTime;
                this.idleAnimation();
            }
        }
    }

    throwInWaitPose() {

        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x;
        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x;
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x;
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x;

        if (this.bones.hips) {
            this.bones.hips.position.y = this.basePos.hips.y;
            this.bones.hips.rotation.y = this.baseRot.hips.y;
        }
        if (this.bones.spine) {
            this.bones.spine.rotation.x = this.baseRot.spine.x;
        }


        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + 2.5;
        this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - 2.5;
        this.bones.leftForeArm.rotation.z = this.baseRot.leftForeArm.z + 1.6;
        this.bones.rightForeArm.rotation.z = this.baseRot.rightForeArm.z - 1.6;
    }


    throwInAnimation() {
        const t = this.throwTime;
        const speed = 3.5;



        const cycle = Math.min(t * speed, Math.PI * 1.5);

        let windup = 0;
        let followThrough = 0;

        if (cycle <= Math.PI) {

            windup = Math.sin(cycle);
        } else {


            followThrough = Math.abs(Math.sin(cycle));
        }


        if (this.bones.spine) {

            this.bones.spine.rotation.x = this.baseRot.spine.x - (windup * 0.4) + (followThrough * 0.5);
        }

        if (this.bones.hips) {

            this.bones.hips.position.y = this.basePos.hips.y - (windup * 0.08);
            this.bones.hips.rotation.y = this.baseRot.hips.y - (windup * 0.15) + (followThrough * 0.1);
            this.bones.hips.rotation.z = this.baseRot.hips.z;
        }





        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (windup * 0.7) + (followThrough * 0.8);


        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (windup * 1.0);


        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (windup * 0.1) + (followThrough * 0.1);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (windup * 0.15);



        const armRaise = windup * 2.8;
        const armThrow = followThrough * 1.8;

        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + armRaise - armThrow;
        this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - armRaise + armThrow;


        const elbowBend = windup * 1.6;
        const elbowStraighten = followThrough * 0.8;

        this.bones.leftForeArm.rotation.z = this.baseRot.leftForeArm.z + elbowBend - elbowStraighten;
        this.bones.rightForeArm.rotation.z = this.baseRot.rightForeArm.z - elbowBend + elbowStraighten;
    }

    walkAnimation() {
        const t = this.walkCycle;


        const stride = 0.65;
        const speed = 1.0;


        const sin = Math.sin(t * speed);
        const cos = Math.cos(t * speed);


        const sinOpp = Math.sin(t * speed + Math.PI);


        const micro = Math.sin(t * 3.5) * 0.01;


        const leftStep = sin;
        const rightStep = sinOpp;


        this.bones.leftUpLeg.rotation.x =
            this.baseRot.leftUpLeg.x + leftStep * stride;

        this.bones.rightUpLeg.rotation.x =
            this.baseRot.rightUpLeg.x + rightStep * stride;



        const leftKnee =
            Math.max(0, -leftStep) * 1.4 + Math.max(0, cos) * 0.15;

        const rightKnee =
            Math.max(0, -rightStep) * 1.4 + Math.max(0, -cos) * 0.15;

        this.bones.leftLeg.rotation.x =
            this.baseRot.leftLeg.x - leftKnee;

        this.bones.rightLeg.rotation.x =
            this.baseRot.rightLeg.x - rightKnee;


        if (this.bones.hips) {

            const bounce =
                Math.abs(sin) * 0.05;

            this.bones.hips.position.y =
                this.basePos.hips.y - bounce;


            this.bones.hips.position.z =
                (this.basePos.hips.z || 0) + cos * 0.02;


            this.bones.hips.rotation.z =
                this.baseRot.hips.z + sin * 0.08;


            this.bones.hips.rotation.x =
                (this.baseRot.hips.x || 0) + cos * 0.04;
        }


        if (this.bones.spine) {

            this.bones.spine.rotation.x =
                this.baseRot.spine.x + 0.06 + micro;


            this.bones.spine.rotation.y =
                this.baseRot.spine.y - sin * 0.15;


            this.bones.spine.rotation.z =
                this.baseRot.spine.z - sin * 0.03;
        }


        const armSwing = 0.6;

        this.bones.leftArm.rotation.z =
            this.baseRot.leftArm.z + rightStep * armSwing + micro;

        this.bones.rightArm.rotation.z =
            this.baseRot.rightArm.z + leftStep * armSwing - micro;


        this.bones.leftArm.rotation.z =
            this.baseRot.leftArm.z + 0.2 + sin * 0.05;

        this.bones.rightArm.rotation.z =
            this.baseRot.rightArm.z - 0.2 - sin * 0.05;


        const leftElbow =
            Math.max(0, -rightStep) * 0.4;

        const rightElbow =
            Math.max(0, -leftStep) * 0.4;

        this.bones.leftForeArm.rotation.z =
            this.baseRot.leftForeArm.z + 0.25 + leftElbow;

        this.bones.rightForeArm.rotation.z =
            this.baseRot.rightForeArm.z - 0.25 - rightElbow;



        if (this.bones.head) {
            this.bones.head.rotation.y =
                Math.sin(t * 0.5) * 0.03;

            this.bones.head.rotation.x =
                Math.sin(t * 0.8) * 0.02;
        }
    }

    runAnimation() {
        const t = this.walkCycle;
        const speed = 2;
        const swing = Math.sin(t * speed);
        const swingOpp = -swing;
        const stride = 1.3;

        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x + swing * stride;
        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x + swingOpp * stride;

        const kneeCurve = (x) => Math.pow(Math.max(0, x), 1.4);
        const leftKnee = kneeCurve(-swing) * 1.8;
        const rightKnee = kneeCurve(-swingOpp) * 1.8;

        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x - leftKnee;
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - rightKnee;

        if (this.bones.spine) {
            const forwardLean = 0.90;
            const torsoTwist = swing * 0.15;
            this.bones.spine.rotation.x = this.baseRot.spine.x + forwardLean;
            this.bones.spine.rotation.y = this.baseRot.spine.y + torsoTwist;
        }

        if (this.bones.hips) {
            const bounce = Math.abs(Math.sin(t * speed)) * 0.08;
            this.bones.hips.position.y = this.basePos.hips.y + bounce;
            this.bones.hips.rotation.z = this.baseRot.hips.z + swing * 0.05;
        }

        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + swingOpp * 1.2;
        this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - swing * 1.2;

        const elbowBent = 1.2;
        const elbowPump = 0.3;

        this.bones.leftForeArm.rotation.z = this.baseRot.leftForeArm.z + elbowBent + (Math.max(0, swingOpp) * elbowPump);
        this.bones.rightForeArm.rotation.z = this.baseRot.rightForeArm.z - elbowBent - (Math.max(0, swing) * elbowPump);
    }

    idleAnimation() {
        const t = this.idleTime;



        const breatheSin = Math.sin(t * 3.5);
        const organicSway = Math.cos(t * 1.5);


        if (this.bones.hips) {
            this.bones.hips.position.copy(this.basePos.hips);
            this.bones.hips.rotation.copy(this.baseRot.hips);
        }
        if (this.bones.spine) this.bones.spine.rotation.copy(this.baseRot.spine);
        if (this.bones.leftUpLeg) this.bones.leftUpLeg.rotation.copy(this.baseRot.leftUpLeg);
        if (this.bones.rightUpLeg) this.bones.rightUpLeg.rotation.copy(this.baseRot.rightUpLeg);
        if (this.bones.leftLeg) this.bones.leftLeg.rotation.copy(this.baseRot.leftLeg);
        if (this.bones.rightLeg) this.bones.rightLeg.rotation.copy(this.baseRot.rightLeg);
        if (this.bones.leftArm) this.bones.leftArm.rotation.copy(this.baseRot.leftArm);
        if (this.bones.rightArm) this.bones.rightArm.rotation.copy(this.baseRot.rightArm);
        if (this.bones.leftForeArm) this.bones.leftForeArm.rotation.copy(this.baseRot.leftForeArm);
        if (this.bones.rightForeArm) this.bones.rightForeArm.rotation.copy(this.baseRot.rightForeArm);


        const microBend = 0.08;
        if (this.bones.leftUpLeg) this.bones.leftUpLeg.rotation.x += microBend;
        if (this.bones.rightUpLeg) this.bones.rightUpLeg.rotation.x += microBend;
        if (this.bones.leftLeg) this.bones.leftLeg.rotation.x -= microBend;
        if (this.bones.rightLeg) this.bones.rightLeg.rotation.x -= microBend;


        if (this.bones.spine) {

            this.bones.spine.rotation.x += 0.15;


            this.bones.spine.rotation.x -= (breatheSin * 0.10);


            this.bones.spine.rotation.y += (organicSway * 0.04);
        }

        if (this.bones.leftArm && this.bones.rightArm) {


            this.bones.leftArm.rotation.z += 0.10 + (breatheSin * 0.07);
            this.bones.rightArm.rotation.z -= 0.10 + (breatheSin * 0.07);


            this.bones.leftArm.rotation.x -= (breatheSin * 0.06);
            this.bones.rightArm.rotation.x -= (breatheSin * 0.06);
        }


        if (this.bones.leftForeArm) this.bones.leftForeArm.rotation.z += 0.15;
        if (this.bones.rightForeArm) this.bones.rightForeArm.rotation.z -= 0.15;
    }




    chargePassAnimation(ratio) {

        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (ratio * 0.1);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (ratio * 0.15);


        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (ratio * 0.7);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (ratio * 0.9);


        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x + (ratio * 0.8);





        if (this.bones.rightFoot) {

            this.bones.rightFoot.rotation.y = this.baseRot.rightFoot.y + (ratio * 0.6);
            this.bones.rightFoot.rotation.z = this.baseRot.rightFoot.z - (ratio * 0.7);
        }


        this.bones.rightArm.rotation.x = this.baseRot.rightArm.x + (ratio * 0.4);


        if (this.bones.spine) {
            this.bones.spine.rotation.y = this.baseRot.spine.y + (ratio * 0.3);
            this.bones.spine.rotation.x = this.baseRot.spine.x + (ratio * 0.1);
        }
    }

    executePassAnimation(time, powerRatio) {
        const progress = time / 0.4;
        const fade = 1 - progress;

        let kickForward;
        if (progress < 0.25) {
            kickForward = progress / 0.25;
        } else {
            kickForward = 1 - ((progress - 0.25) / 0.75);
        }


        const intensity = 0.4 + (powerRatio * 0.4);



        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (kickForward * 1.0 * intensity);

        this.bones.rightUpLeg.rotation.y = this.baseRot.rightUpLeg.y + (fade * powerRatio * 0.8) + (kickForward * 0.4);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x;


        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (fade * powerRatio * 0.1);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (fade * powerRatio * 0.15);

        this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (fade * powerRatio * 1.0) + (kickForward * 0.3);
        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (fade * powerRatio * 0.3) + (kickForward * 0.1);
        this.bones.rightArm.rotation.x = this.baseRot.rightArm.x + (fade * powerRatio * 0.4);

        if (this.bones.spine) {
            this.bones.spine.rotation.y = this.baseRot.spine.y + (fade * powerRatio * 0.3) - (kickForward * 0.15 * intensity);
            this.bones.spine.rotation.x = this.baseRot.spine.x + (fade * powerRatio * 0.1) + (kickForward * 0.2 * intensity);
        }
    }

    chargeShootAnimation(ratio) {

        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (ratio * 0.15);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (ratio * 0.25);


        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x + (ratio * 1.0);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (ratio * 1.5);


        this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (ratio * 1.6);
        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (ratio * 0.6);


        this.bones.rightArm.rotation.z = this.baseRot.rightArm.z + (ratio * 0.8);


        if (this.bones.spine) {
            this.bones.spine.rotation.y = this.baseRot.spine.y + (ratio * 0.5);
            this.bones.spine.rotation.x = this.baseRot.spine.x + (ratio * 0.4);
        }
    }


    executeKickAnimation(time, powerRatio) {
        const progress = time / 0.4;


        const fade = 1 - progress;

        let kickForward;
        if (progress < 0.25) {
            kickForward = progress / 0.25;
        } else {
            kickForward = 1 - ((progress - 0.25) / 0.75);
        }

        const intensity = 0.5 + (powerRatio * 0.5);



        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (kickForward * 1.4 * intensity);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x;






        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (fade * powerRatio * 0.15);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (fade * powerRatio * 0.25);


        this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (fade * powerRatio * 1.6) + (kickForward * 0.5);
        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (fade * powerRatio * 0.6) + (kickForward * 0.2);
        this.bones.rightArm.rotation.x = this.baseRot.rightArm.x + (fade * powerRatio * 0.8);


        if (this.bones.spine) {
            this.bones.spine.rotation.y = this.baseRot.spine.y + (fade * powerRatio * 0.5) - (kickForward * 0.3 * intensity);
            this.bones.spine.rotation.x = this.baseRot.spine.x + (fade * powerRatio * 0.4) + (kickForward * 0.6 * intensity);
        }
    }


    cancelCharge() {
        this.wasChargingShoot = false;
        this.wasChargingPass = false;
        this.shootFollowThroughTimer = 0;
        this.passFollowThroughTimer = 0;
        this.resetToBasePose();
    }

    headerAnimation(progress) {
        this.resetToBasePose();


        const impactRatio = 0.42;


        const jumpCurve = Math.sin(progress * Math.PI);
        const jumpHeight = jumpCurve * 1.7;

        if (this.bones.hips) {
            this.bones.hips.position.y = this.basePos.hips.y + jumpHeight;
        }

        if (progress < impactRatio) {

            const windup = progress / impactRatio;

            if (this.bones.spine) this.bones.spine.rotation.x = this.baseRot.spine.x - (windup * 0.5);
            if (this.bones.head) this.bones.head.rotation.x = this.baseRot.head.x - (windup * 0.4);

            if (this.bones.leftUpLeg) this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (windup * 0.8);
            if (this.bones.rightUpLeg) this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (windup * 1.0);
            if (this.bones.leftLeg) this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x - (windup * 2);
            if (this.bones.rightLeg) this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (windup * 2);

            if (this.bones.leftArm) this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (windup * 1.2);
            if (this.bones.rightArm) this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - (windup * 1.2);

        } else {

            const recovery = (progress - impactRatio) / (1 - impactRatio);
            const impactSnap = 1 - recovery;

            if (this.bones.spine) this.bones.spine.rotation.x = this.baseRot.spine.x + (impactSnap * 0.6);
            if (this.bones.head) this.bones.head.rotation.x = this.baseRot.head.x + (impactSnap * 0.5);

            if (this.bones.leftUpLeg) this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (impactSnap * 0.5);
            if (this.bones.rightUpLeg) this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (impactSnap * 0.6);
            if (this.bones.leftLeg) this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (impactSnap * 0.5);
            if (this.bones.rightLeg) this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x + (impactSnap * 0.5);

            if (this.bones.leftArm) this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (impactSnap * 0.8);
            if (this.bones.rightArm) this.bones.rightArm.rotation.x = this.baseRot.rightArm.x - (impactSnap * 0.8);
        }
    }

    slideAnimation(duration) {
        const progress = Math.min(this.slideTimer / duration, 1.0);




        let currentAnim = 0;
        if (progress < 0.2) {
            currentAnim = progress / 0.2;
        } else if (progress < 0.7) {
            currentAnim = 1.0;
        } else {
            currentAnim = 1.0 - ((progress - 0.7) / 0.3);
        }


        const easeCurve = Math.sin(currentAnim * Math.PI / 2);

        this.resetToBasePose();

        if (this.bones.hips) {

            this.bones.hips.position.y = this.basePos.hips.y - (easeCurve * 1.15);

            this.bones.hips.rotation.z = this.baseRot.hips.z;
            this.bones.hips.rotation.x = this.baseRot.hips.x + (easeCurve * 0.5);
        }

        if (this.bones.spine) {

            this.bones.spine.rotation.x = this.baseRot.spine.x + (easeCurve * 0.4);
            this.bones.spine.rotation.z = this.baseRot.spine.z;
        }

        if (this.bones.rightUpLeg && this.bones.rightLeg) {

            this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (easeCurve * 1.3);
            this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x;
        }

        if (this.bones.leftUpLeg && this.bones.leftLeg) {

            this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x + (easeCurve * 0.5);
            this.bones.leftUpLeg.rotation.z = this.baseRot.leftUpLeg.z - (easeCurve * 0.5);
            this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x - (easeCurve * 2.0);
        }

        if (this.bones.leftArm && this.bones.rightArm) {

            this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (easeCurve * 1.2);
            this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - (easeCurve * 1.2);
            this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (easeCurve * 0.5);
            this.bones.rightArm.rotation.x = this.baseRot.rightArm.x - (easeCurve * 0.5);
        }
    }

    resetToBasePose() {
        if (this.bones.hips) {
            this.bones.hips.position.copy(this.basePos.hips);
            this.bones.hips.rotation.copy(this.baseRot.hips);
        }
        if (this.bones.spine) this.bones.spine.rotation.copy(this.baseRot.spine);
        if (this.bones.leftUpLeg) this.bones.leftUpLeg.rotation.copy(this.baseRot.leftUpLeg);
        if (this.bones.rightUpLeg) this.bones.rightUpLeg.rotation.copy(this.baseRot.rightUpLeg);
        if (this.bones.leftLeg) this.bones.leftLeg.rotation.copy(this.baseRot.leftLeg);
        if (this.bones.rightLeg) this.bones.rightLeg.rotation.copy(this.baseRot.rightLeg);
        if (this.bones.leftFoot) this.bones.leftFoot.rotation.copy(this.baseRot.leftFoot);
        if (this.bones.rightFoot) this.bones.rightFoot.rotation.copy(this.baseRot.rightFoot);
        if (this.bones.leftArm) this.bones.leftArm.rotation.copy(this.baseRot.leftArm);
        if (this.bones.rightArm) this.bones.rightArm.rotation.copy(this.baseRot.rightArm);
        if (this.bones.leftForeArm) this.bones.leftForeArm.rotation.copy(this.baseRot.leftForeArm);
        if (this.bones.rightForeArm) this.bones.rightForeArm.rotation.copy(this.baseRot.rightForeArm);
    }
}
