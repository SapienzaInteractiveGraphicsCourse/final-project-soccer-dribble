
import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { PlayerAnimator } from '../animation-action/PlayerAnimation.js';
import { PlayerAction } from '../animation-action/PlayerAction.js';
import { TacticalManager } from '../game/TacticalManager.js';

const botTacticalManager = new TacticalManager();

export class Opponent {
    constructor(scene, ball, startPos, startYaw) {
        this.id = Math.random().toString(36).substr(2, 9); 
        this.scene = scene;
        this.ball = ball;
        this.startPos = startPos;
        this.yaw = startYaw;
        this.model = null;

        this.animator = new PlayerAnimator();
        this.action = new PlayerAction();

        this.targetReceiver = null;
        
        
        this.possessionState = 'DRIBBLE';
        this.passCooldownTimer = 0;
        this.receiveLockTimer = 0;
        this.chosenReceiver = null;
        this.wasPossessingBall = false;

        
        this.isThrowingIn = false;
        this.throwInTimer = 0;
        this.isReceivingThrowIn = false;
        this.throwInSupportPos = new THREE.Vector3();

        
        this.isTakingCorner = false;
        this.cornerTimer = 0;
        this.isReceivingCorner = false;
        this.cornerSupportPos = new THREE.Vector3();
        this.cornerTargetGoalX = 0; 

        
        this.isReceivingGoalKick = false;
        this.goalKickRunDir = 1;

        
        this.isTakingKickOff = false;
        this.kickOffTimer = 0;

        
        this.isWaitingInArea = false;

        
        this._idealPos = new THREE.Vector3();
        this._moveDir = new THREE.Vector3();
        this._dirToBall = new THREE.Vector3();
        
        
        this._teammateSeparation = new THREE.Vector3();
        this._avoidanceVector = new THREE.Vector3();
        this._pushAway = new THREE.Vector3();

        this.loadGLB();
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
                        child.material.color.setHex(0x0000ff); 
                    }
                }
            });
            
            this.animator.initBones(this.model);
            this.scene.add(this.model);
        });
    }

    update(deltaTime, isMatchStarted = true, matchState = 'HOME_POSSESSION', defendDirX = 1, opponents = [], bots = []) {
        if (!this.model) return;
        
        
        this.model.rotation.x = 0;
        this.model.rotation.z = 0;
        
        
        if (this.isThrowingIn) {
            let receiverReady = true;

            if (this.targetReceiver && this.targetReceiver.model) {
                 this.yaw = Math.atan2(
                     this.targetReceiver.model.position.x - this.model.position.x,
                     this.targetReceiver.model.position.z - this.model.position.z
                 );
                 const currentRot = this.model.rotation.y;
                 let diff = this.yaw - currentRot;
                 while (diff < -Math.PI) diff += Math.PI * 2;
                 while (diff > Math.PI) diff -= Math.PI * 2;
                 this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);

                 
                 if (this.targetReceiver.isMoving) {
                     receiverReady = false;
                 }
            }

            
            if (!receiverReady && this.throwInTimer >= 0.9) {
                this.throwInTimer += deltaTime * 0.02; 
            } else {
                this.throwInTimer += deltaTime;
            }

            const waitTime = 1.0;
            const releaseTime = waitTime + 0.55;
            const endTime = releaseTime + 0.4;

            let isThrowingInAnim = false;
            let isThrowingInState = true;

            if (this.throwInTimer >= waitTime) {
                isThrowingInState = false;
                isThrowingInAnim = true;

                if (this.throwInTimer >= releaseTime && this.ball.isHeld) {
                    let throwYaw = this.yaw; 
                    this.action.executeThrow(this.ball, throwYaw, this.scene, this.targetReceiver);

                    if (this.targetReceiver) {
                        this.targetReceiver.isReceivingThrowIn = false;
                        this.targetReceiver = null;
                    }
                }
            }

            if (this.throwInTimer >= endTime) {
                this.isThrowingIn = false;
                isThrowingInAnim = false;
                this.animator.resetToBasePose();
            }

            this.animator.animate(deltaTime, isThrowingInAnim, false, false, isThrowingInState, null, 0);
            return; 
        }

        
        if (this.isReceivingThrowIn && !this.isThrowingIn) {
            if (!this.ball.isHeld) {
                this.isReceivingThrowIn = false;
            } else {
                const distToSupport = this.model.position.distanceTo(this.throwInSupportPos);
                if (distToSupport > 0.5) {
                    this.isMoving = true;
                    
                    if (this.isRunning) {
                        this.isRunning = distToSupport > 3;
                    } else {
                        this.isRunning = distToSupport > 5;
                    }
                    this._moveDir.subVectors(this.throwInSupportPos, this.model.position);
                    this._moveDir.y = 0;
                    this._moveDir.normalize();
                    const speed = this.isRunning ? 9 : 5;
                    this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                } else {
                    this.isMoving = false;
                    this.isRunning = false;
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
                
                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                return;
            }
        }

        
        if (this.isTakingCorner) {
            this.cornerTimer += deltaTime;

            if (this.targetReceiver && this.targetReceiver.model) {
                this.yaw = Math.atan2(
                    this.targetReceiver.model.position.x - this.model.position.x,
                    this.targetReceiver.model.position.z - this.model.position.z
                );
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
            }

            const waitTime = 1.2;
            
            const kickTime = waitTime + 0.35;
            const endTime = kickTime + 0.4;

            if (this.cornerTimer >= waitTime && this.cornerTimer < kickTime) {
                if (!this.action.chargingAction) {
                    this.action.startCharge('pass');
                }
                this.action.updateCharge(deltaTime, null);
            }

            if (this.cornerTimer >= kickTime && this.action.chargingAction) {
                
                let fakeTarget = null;
                if (this.targetReceiver && this.targetReceiver.model) {
                    
                    const errorX = (Math.random() - 0.5) * 4;
                    const errorZ = (Math.random() - 0.5) * 4;
                    const destPos = new THREE.Vector3(
                        this.targetReceiver.model.position.x + errorX,
                        0,
                        this.targetReceiver.model.position.z + errorZ
                    );
                    fakeTarget = {
                        model: { position: destPos }
                    };
                    
                    this.targetReceiver.cornerCrossTarget = destPos;
                }
                
                
                this.action.executeKick(this.ball, this.yaw, 0, null, fakeTarget, true);

                if (this.targetReceiver) {
                    this.targetReceiver = null;
                }
            }

            if (this.cornerTimer >= endTime) {
                this.isTakingCorner = false;
                this.animator.resetToBasePose();
            }

            let chargingAnim = (this.cornerTimer >= waitTime && this.cornerTimer < kickTime) ? 'pass' : null;
            let chargeRatio = this.action.getChargeRatio();
            this.animator.animate(deltaTime, false, false, false, false, chargingAnim, chargeRatio);
            return;
        }

        
        if (this.isReceivingCorner && !this.isTakingCorner) {
            
            
            if (this.ball.velocity.lengthSq() < 1.0) {
                const distToSupport = this.model.position.distanceTo(this.cornerSupportPos);
                if (distToSupport > 0.5) {
                    this.isMoving = true;
                    
                    if (this.isRunning) {
                        this.isRunning = distToSupport > 3;
                    } else {
                        this.isRunning = distToSupport > 5;
                    }
                    this._moveDir.subVectors(this.cornerSupportPos, this.model.position);
                    this._moveDir.y = 0;
                    this._moveDir.normalize();
                    const speed = this.isRunning ? 9 : 5;
                    this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                } else {
                    this.isMoving = false;
                    this.isRunning = false;
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
            } 
            
            else {
                const distanceToBall3D = this.model.position.distanceTo(this.ball.position);

                
                let targetPointXZ = (this.cornerCrossTarget && this.ball.position.y > 4.0) 
                                    ? this.cornerCrossTarget 
                                    : this.ball.position;
                                    
                const distToTargetXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                     .distanceTo(new THREE.Vector2(targetPointXZ.x, targetPointXZ.z));

                if (distToTargetXZ > 0.5) {
                    this.isMoving = true;
                    this.isRunning = true;
                    this._moveDir.set(targetPointXZ.x - this.model.position.x, 0, targetPointXZ.z - this.model.position.z).normalize();
                    this.model.position.addScaledVector(this._moveDir, 12 * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                } else {
                    this.isMoving = false;
                    this.isRunning = false;
                    this.yaw = Math.atan2(this.cornerTargetGoalX - this.model.position.x, 0 - this.model.position.z);
                }

                
                if (distanceToBall3D < 6.0) {
                    this.yaw = Math.atan2(this.cornerTargetGoalX - this.model.position.x, 0 - this.model.position.z);
                    
                    if (!this.action.chargingAction) {
                        this.action.startCharge('shoot');
                    }
                    
                    this.action.updateCharge(deltaTime * 3, null); 
                }

                
                const distToBallXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                     .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
                                     
                if (distToBallXZ < 2.5 && this.ball.position.y < 3.0) {
                    
                    this.yaw = Math.atan2(this.cornerTargetGoalX - this.model.position.x, 0 - this.model.position.z);
                    
                    
                    if (this.action.kickPower < this.action.shootMaxPower * 0.7) {
                        this.action.kickPower = this.action.shootMaxPower * 0.85;
                    }
                    
                    
                    const shotError = (Math.random() - 0.5) * 0.35;
                    this.action.executeKick(this.ball, this.yaw + shotError, -0.1, null, null, true);
                    
                    
                    this.isReceivingCorner = false;
                    this.cornerCrossTarget = null;
                }
            }

            
            let chargingAnim = this.action.chargingAction;
            let chargeRatio = this.action.getChargeRatio();
            this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, chargingAnim, chargeRatio);

            const currentRot = this.model.rotation.y;
            let diff = this.yaw - currentRot;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
            return;
        }

        
        if (this.isReceivingGoalKick) {
            const distToBallXZ = new THREE.Vector2(this.model.position.x, this.model.position.z)
                                 .distanceTo(new THREE.Vector2(this.ball.position.x, this.ball.position.z));
            
            const isBallOutArea = Math.abs(this.ball.position.x) < 33; 
            const isBallKicked = !this.ball.isHeld && this.ball.velocity.lengthSq() > 5.0;

            
            if (distToBallXZ < 3.0 || (isBallKicked && isBallOutArea && this.ball.position.y <= this.ball.radius + 0.2)) {
                this.isReceivingGoalKick = false;
            } else {
                this.isMoving = true;
                this.isRunning = true;
                this._moveDir.set(this.goalKickRunDir, 0, 0); 
                this.model.position.addScaledVector(this._moveDir, 10 * deltaTime);
                this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
            }

            if (this.isReceivingGoalKick) {
                this.model.position.x = THREE.MathUtils.clamp(this.model.position.x, -48, 48);
                this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                this.handleCollisions();
                return;
            }
        }
        
        
        if (this.isTakingKickOff) {
            this.kickOffTimer += deltaTime;

            if (this.targetReceiver && this.targetReceiver.model) {
                this.yaw = Math.atan2(
                    this.targetReceiver.model.position.x - this.model.position.x,
                    this.targetReceiver.model.position.z - this.model.position.z
                );
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
            }

            const waitTime = 1.0;
            const kickTime = waitTime + 0.35;
            const endTime = kickTime + 0.4;

            if (this.kickOffTimer >= waitTime && this.kickOffTimer < kickTime) {
                if (!this.action.chargingAction) {
                    this.action.startCharge('pass');
                }
                this.action.updateCharge(deltaTime, null);
            }

            if (this.kickOffTimer >= kickTime && this.action.chargingAction) {
                let passTarget = this.targetReceiver;
                this.action.executeKick(this.ball, this.yaw, 0, null, passTarget, true);
                this.targetReceiver = null;
            }

            if (this.kickOffTimer >= endTime) {
                this.isTakingKickOff = false;
                this.animator.resetToBasePose();
            }

            let chargingAnim = (this.kickOffTimer >= waitTime && this.kickOffTimer < kickTime) ? 'pass' : null;
            let chargeRatio = this.action.getChargeRatio();
            this.animator.animate(deltaTime, false, false, false, false, chargingAnim, chargeRatio);
            return;
        }

        
        
        
        

        
        if (this.isWaitingInArea) {
            
            if (this.ball && !this.ball.isHeld && this.ball.velocity.lengthSq() > 2.0) {
                this.isWaitingInArea = false;
            } else {
                
                this.isMoving = false;
                this.isRunning = false;
                if (this.ball && this.ball.isLoaded) {
                    this._dirToBall.subVectors(this.ball.position, this.model.position);
                    this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
                }
                this.animator.animate(deltaTime, false, false, false, false, null, 0);
                const currentRot = this.model.rotation.y;
                let diff = this.yaw - currentRot;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
                return;
            }
        }

        if (!isMatchStarted) {
            if (this.ball && this.ball.isLoaded) {
                this._dirToBall.subVectors(this.ball.position, this.model.position);
                this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
            }
            this.animator.animate(deltaTime, false, false, false, false, null, 0);
            return; 
        }

        switch (matchState) {
            case 'HOME_POSSESSION':
                this.executeDefendBehavior(deltaTime, defendDirX, opponents, bots);
                break;

            case 'AWAY_POSSESSION':
                
                this.executeAttackBehavior(deltaTime, defendDirX, bots, opponents); 
                break;
        }

        let chargingAnim = this.action && this.action.chargingAction ? this.action.chargingAction : null;
        let chargeRatio = this.action ? this.action.getChargeRatio() : 0;
        this.animator.animate(deltaTime, false, this.isMoving, this.isRunning, false, chargingAnim, chargeRatio);

        const currentRot = this.model.rotation.y;
        const targetRot = this.yaw;
        
        let diff = targetRot - currentRot;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        this.model.rotation.y += diff * Math.min(10 * deltaTime, 1);
        this.handleCollisions();
    }

    executeDefendBehavior(deltaTime, defendDirX, opponents, bots) {
        if (!this.ball || !this.ball.isLoaded) return;
        const myGoalX = 49.5 * defendDirX; 
        const goalPos = new THREE.Vector3(myGoalX, 0, 0);

        let targetOpponent = null;
        const myIndex = bots.indexOf(this);
        if (myIndex !== -1 && opponents[myIndex]) {
            targetOpponent = opponents[myIndex];
        }

        if (targetOpponent) {
            const oppPos = targetOpponent.model ? targetOpponent.model.position : targetOpponent.position;
            this._idealPos.lerpVectors(oppPos, goalPos, 0.1); 
        } else {
            this._idealPos.copy(this.startPos);
        }

        if (bots && bots.length > 0) {
            const avoidanceRadius = 1.5; 
            bots.forEach(otherBot => {
                if (otherBot !== this && otherBot.model) {
                    const dist = this.model.position.distanceTo(otherBot.model.position);
                    if (dist < avoidanceRadius && dist > 0.01) {
                        const pushAway = new THREE.Vector3().subVectors(this.model.position, otherBot.model.position);
                        pushAway.y = 0;
                        pushAway.normalize().multiplyScalar((avoidanceRadius - dist) * 0.8);
                        this._idealPos.add(pushAway);
                    }
                }
            });
        }

        this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
        this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

        const distToIdeal = this.model.position.distanceTo(this._idealPos);

        
        let shouldMove;
        if (this.isMoving) {
            shouldMove = distToIdeal > 0.5; 
        } else {
            shouldMove = distToIdeal > 1.5; 
        }

        if (shouldMove) {
            this.isMoving = true;
            this._moveDir.subVectors(this._idealPos, this.model.position);
            this._moveDir.y = 0;
            this._moveDir.normalize();
            
            if (this.isRunning) {
                this.isRunning = distToIdeal > 3;
            } else {
                this.isRunning = distToIdeal > 5;
            }
            const speed = this.isRunning ? 11 : 7;
            this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
        } else {
            this.isMoving = false;
            this.isRunning = false;
        }

        this._dirToBall.subVectors(this.ball.position, this.model.position);
        this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);
    }

    executeAttackBehavior(deltaTime, defendDirX, bots, opponents) {
        if (!this.ball || !this.ball.isLoaded) return;
        
        
        if (this.passCooldownTimer > 0) this.passCooldownTimer -= deltaTime;
        if (this.receiveLockTimer > 0) this.receiveLockTimer -= deltaTime;

        const attackGoalX = -49.5 * defendDirX;
        const targetGoalPos = new THREE.Vector3(attackGoalX, 0, 0);
        const attackDirX = attackGoalX > 0 ? 1 : -1;
        
        
        let ballCarrier = null;
        let isClosest = true;
        const myDistToBall = this.model.position.distanceTo(this.ball.position);
        let minDist = Infinity;
        
        if (bots && bots.length > 0) {
            bots.forEach(otherBot => {
                if (otherBot && otherBot.model) {
                    const dist = otherBot.model.position.distanceTo(this.ball.position);
                    if (dist < minDist) {
                        minDist = dist;
                        ballCarrier = otherBot;
                    }
                    if (otherBot !== this && dist < myDistToBall) {
                        isClosest = false;
                    }
                }
            });
            if (!ballCarrier) ballCarrier = this;
        } else {
            ballCarrier = this;
        }

        
        const otherBots = bots.filter(b => b !== ballCarrier);
        
        botTacticalManager.updateOffensiveLanes(ballCarrier, otherBots, this.ball, attackDirX);

        
        if (isClosest) {
            if (myDistToBall < 1.5) {
                this.isMoving = true;
                this.isRunning = true;
                
                
                if (!this.wasPossessingBall) {
                    this.wasPossessingBall = true;
                    this.possessionState = 'RECEIVING';
                    this.receiveLockTimer = 0.5; 
                    this.chosenReceiver = null;
                }

                if (this.possessionState === 'RECEIVING') {
                    if (this.receiveLockTimer <= 0) {
                        this.possessionState = 'DRIBBLE';
                    }
                }

                if (this.possessionState === 'DRIBBLE') {
                    const distToGoal = this.model.position.distanceTo(targetGoalPos);
                    
                    if (distToGoal < 25) {
                        this.possessionState = 'SHOOT';
                    } else if (this.passCooldownTimer <= 0) {
                        let opponentNear = false;
                        let closestOppDist = Infinity;
                        
                        if (opponents && opponents.length > 0) {
                            for (let opp of opponents) {
                                const oppPos = opp.model ? opp.model.position : opp.position;
                                if (oppPos) {
                                    const dist = this.model.position.distanceTo(oppPos);
                                    if (dist < closestOppDist) closestOppDist = dist;
                                    if (dist < 6.0) { 
                                        opponentNear = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (opponentNear && bots.length > 1) {
                            console.log(`Opponent ${this.id} under pressure (dist: ${closestOppDist.toFixed(2)}). Searching for receiver...`);

                            let bestScore = -Infinity;
                            let bestReceiver = null;

                            bots.forEach(ally => {
                                if (ally !== this && ally.model) {
                                    const allyPos = ally.model.position;
                                    let score = 0;
                                    
                                    
                                    const distToGoalAlly = allyPos.distanceTo(targetGoalPos);
                                    score += (100 - distToGoalAlly);

                                    
                                    let minOppDist = Infinity;
                                    opponents.forEach(opp => {
                                        const oppPos = opp.model ? opp.model.position : opp.position;
                                        if (oppPos) {
                                            const d = allyPos.distanceTo(oppPos);
                                            if (d < minOppDist) minOppDist = d;
                                        }
                                    });
                                    if (minOppDist !== Infinity) {
                                        score += (minOppDist * 2);
                                    }

                                    
                                    const isForward = (allyPos.x - this.model.position.x) * attackDirX > 0;
                                    if (isForward) score += 20;

                                    if (score > bestScore) {
                                        bestScore = score;
                                        bestReceiver = ally;
                                    }
                                }
                            });

                            if (bestReceiver) {
                                console.log(`Opponent ${this.id} selected receiver ${bestReceiver.id}. Transitioning to PASS state.`);
                                this.chosenReceiver = bestReceiver;
                                this.possessionState = 'PASS';
                            }
                        }
                    }
                }

                if (this.possessionState !== 'PASS') {
                    this._moveDir.subVectors(targetGoalPos, this.model.position);
                    this._moveDir.y = 0;
                    
                    if (this._moveDir.lengthSq() > 0.001) {
                        this._moveDir.normalize();
                        this.model.position.addScaledVector(this._moveDir, 12 * deltaTime);
                        this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                    }

                    this.action.dribble(this.ball, this.yaw, this.isRunning, false, { forward: true, backward: false, left: false, right: false }, deltaTime);
                }

                if (this.possessionState === 'SHOOT') {
                    console.log(`Opponent ${this.id} is SHOOTING!`);
                    if (this.action.chargingAction !== 'shoot') {
                        this.action.startCharge('shoot');
                    }
                    this.action.updateCharge(deltaTime * 2.5, null); 
                    
                    if (this.action.kickPower >= this.action.shootMaxPower * 0.85) {
                        const shotError = (Math.random() - 0.5) * 0.2;
                        this.action.executeKick(this.ball, this.yaw + shotError, -0.15, null, null, true);
                        this.possessionState = 'DRIBBLE';
                        this.wasPossessingBall = false;
                    }
                } else if (this.possessionState === 'PASS') {
                    if (this.chosenReceiver) {
                        this.yaw = Math.atan2(
                            this.chosenReceiver.model.position.x - this.model.position.x,
                            this.chosenReceiver.model.position.z - this.model.position.z
                        );

                        if (this.action.chargingAction !== 'pass') {
                            console.log(`Opponent ${this.id} starts charging pass!`);
                            this.action.startCharge('pass');
                        }
                        this.action.updateCharge(deltaTime * 15.0, null); 
                        
                        if (this.action.kickPower >= this.action.passMaxPower * 0.5) {
                            console.log(`Opponent ${this.id} KICKS pass!`);
                            this.action.executeKick(this.ball, this.yaw, 0, null, this.chosenReceiver, true);
                            this.passCooldownTimer = 1.5;
                            this.possessionState = 'DRIBBLE';
                            this.chosenReceiver = null;
                            this.wasPossessingBall = false;
                        }
                    } else {
                        this.possessionState = 'DRIBBLE';
                        if (this.action.chargingAction === 'pass') {
                            this.action.cancelCharge(null);
                        }
                    }
                }

            } else {
                this.isMoving = true;
                this.isRunning = true;

                this._moveDir.subVectors(this.ball.position, this.model.position);
                this._moveDir.y = 0;
                if (this._moveDir.lengthSq() > 0.001) {
                    this._moveDir.normalize();
                    this.model.position.addScaledVector(this._moveDir, 11 * deltaTime);
                    this.yaw = Math.atan2(this._moveDir.x, this._moveDir.z);
                }
                
                if (this.action.chargingAction) {
                    this.action.cancelCharge(null);
                }
            }
        } else {
            
            this.wasPossessingBall = false;
            this.possessionState = 'DRIBBLE';
            this.chosenReceiver = null;
            
            this._idealPos.set(0, 0, 0);

            
            const laneZ = botTacticalManager.getAssignedLaneZ(this.id);

            
            const isBallNearGoal = (attackDirX === 1 && this.ball.position.x > 30) ||
                                   (attackDirX === -1 && this.ball.position.x < -30);

            if (isBallNearGoal) {
                let targetZ = laneZ * 0.5; 
                let targetX = this.ball.position.x + (attackDirX * 4); 
                
                const maxDepth = 40; 
                targetX = attackDirX === 1 ? Math.min(targetX, maxDepth) : Math.max(targetX, -maxDepth);

                this._idealPos.x = targetX;
                this._idealPos.z = targetZ; 
            } else {
                this._idealPos.x = this.ball.position.x + (attackDirX * 10); 
                this._idealPos.z = laneZ; 
            }

            
            const teamSeparationRadius = 6.0;
            this._teammateSeparation.set(0, 0, 0);
            let forceMoveAway = false;

            bots.forEach(ally => {
                if (ally !== this && ally.model) {
                    const dist = this.model.position.distanceTo(ally.model.position);
                    if (dist < teamSeparationRadius) {
                        const push = new THREE.Vector3().subVectors(this.model.position, ally.model.position);
                        push.y = 0;
                        push.normalize().multiplyScalar((teamSeparationRadius - dist) * 1.5); 
                        this._teammateSeparation.add(push);
                        forceMoveAway = true;
                    }
                }
            });
            this._idealPos.add(this._teammateSeparation);

            
            const avoidanceRadius = 15.0; 
            this._avoidanceVector.set(0, 0, 0);
            
            if (opponents && opponents.length > 0) {
                opponents.forEach(opp => {
                    if (opp && opp.model) {
                        const dist = this.model.position.distanceTo(opp.model.position);
                        if (dist < avoidanceRadius) {
                            this._pushAway.subVectors(this.model.position, opp.model.position);
                            this._pushAway.y = 0;
                            this._pushAway.normalize();

                            const dirToIdeal = new THREE.Vector3(this._idealPos.x - this.model.position.x, 0, this._idealPos.z - this.model.position.z).normalize();
                            const evasionBlend = Math.min(dist / avoidanceRadius, 1.0); 
                            
                            const escapeDir = new THREE.Vector3().lerpVectors(this._pushAway, dirToIdeal, evasionBlend).normalize();
                            escapeDir.multiplyScalar((avoidanceRadius - dist) * 1.2);
                            this._avoidanceVector.add(escapeDir);
                        }
                    }
                });
            }
            this._idealPos.add(this._avoidanceVector);

            
            this._idealPos.x = THREE.MathUtils.clamp(this._idealPos.x, -47, 47);
            this._idealPos.z = THREE.MathUtils.clamp(this._idealPos.z, -29, 29);

            
            const distToIdeal = this.model.position.distanceTo(this._idealPos);
            
            let shouldMove = forceMoveAway || (this.isMoving ? (distToIdeal > 0.8) : (distToIdeal > 2.0));

            if (shouldMove) {
                this.isMoving = true;
                this._moveDir.subVectors(this._idealPos, this.model.position);
                this._moveDir.y = 0;
                this._moveDir.normalize();

                this.isRunning = this.isRunning ? (distToIdeal > 4.5) : (distToIdeal > 7);
                const speed = this.isRunning ? 11 : 7;
                this.model.position.addScaledVector(this._moveDir, speed * deltaTime);
            } else {
                this.isMoving = false;
                this.isRunning = false;
            }

            
            this._dirToBall.subVectors(this.ball.position, this.model.position);
            this.yaw = Math.atan2(this._dirToBall.x, this._dirToBall.z);

            if (this.action.chargingAction) {
                this.action.cancelCharge(null);
            }
        }
    }

    handleCollisions() {
        if (this.ball && this.ball.isLoaded) {
            const playerHeight = 1.8;
            const playerRadius = 0.35; 
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

                    if (this.isMoving && this._moveDir) {
                        const speed = this.isRunning ? 12 : 6;
                        const playerVel = this._moveDir.clone().multiplyScalar(speed);
                        const impactVel = playerVel.dot(pushDir);
                        if (impactVel > 0) {
                            this.ball.velocity.add(pushDir.multiplyScalar(impactVel * 0.4));
                        }
                    }
                }
            }
        }
    }

    startKickOff(receiver = null) {
        this.isTakingKickOff = true;
        this.kickOffTimer = 0;
        this.targetReceiver = receiver;
        this.isMoving = false;
        this.isRunning = false;
        if (this.ball) {
            this.ball.velocity.set(0, 0, 0);
        }
    }

    startThrowIn(receiver = null) {
        this.isThrowingIn = true;
        this.throwInTimer = 0;
        this.targetReceiver = receiver;
        this.isMoving = false;
        this.isRunning = false;
        const rightHand = this.animator.bones.rightHand;
        this.action.startThrowIn(this.ball, rightHand);
    }

    setReceiveThrowInTarget(throwerPos, side) {
        this.isReceivingThrowIn = true;
        this.throwInSupportPos.set(
            throwerPos.x + (Math.random() * 4 - 2), 
            0,
            throwerPos.z - (side * 6) 
        );
    }

    startCorner(receiver = null) {
        this.isTakingCorner = true;
        this.cornerTimer = 0;
        this.targetReceiver = receiver;
        this.isMoving = false;
        this.isRunning = false;
        this.action.startCorner(this.ball);
    }

    setReceiveCornerTarget(kickerPos, ballX, ballZ) {
        this.isReceivingCorner = true;
        this.cornerTargetGoalX = ballX > 0 ? 48.5 : -48.5; 
        this.cornerCrossTarget = null;
        
        const dirX = ballX > 0 ? -1 : 1;

        
        this.cornerSupportPos.set(
            ballX + (dirX * (11 + Math.random() * 3)), 
            0,
            (Math.random() * 8 - 4) 
        );
    }

    setReceiveGoalKickTarget(dirX) {
        this.isReceivingGoalKick = true;
        this.goalKickRunDir = dirX;
    }
}