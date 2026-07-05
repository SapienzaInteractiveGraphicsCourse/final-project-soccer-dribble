import * as THREE from 'three';


export class MatchManager {
    constructor(camera, ball, player, teammates, bots, homeGK, awayGK, uiManager) {
        this.camera = camera;
        this.ball = ball;
        this.player = player;
        this.teammates = teammates;
        this.bots = bots;
        this.homeGK = homeGK;
        this.awayGK = awayGK;
        this.uiManager = uiManager;

        
        this.possessionManager = null;

        
        this.isGameStarted = false;
        this.gameMode = 'match';
        this.currentFormation = null;
        this.playerTeam = 'home';
        this.lastTouchedTeam = 'home';
        this.kickOffTeam = 'home';
        this.homeScore = 0;
        this.awayScore = 0;
        this.isCelebrating = false;

        this.isControllingGK = false;
        this.controlledGK = null;

        
        this.currentT1 = teammates[0];
        this.currentT2 = teammates[1];
        this.currentO1 = bots[0];
        this.currentO2 = bots[1];
        this.currentO3 = bots[2];

        
        this.player.teammates = [this.currentT1, this.currentT2];

        this.setupInputHandling();
        this.setupSetPieceEvents();
        this.setupPassEvent();
        this.setupAutoSwitchEvent(); 

        
        this.bgMusic = new Audio(`${import.meta.env.BASE_URL}sound/confusion.mp3`);
        this.bgMusic.loop = true; 
        this.bgMusic.volume = 0.4; 
    }

    setupAutoSwitchEvent() {
        document.addEventListener('autoSwitchRequested', (e) => {
            
            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return;
            if (this.isControllingGK) return;

            const targetTeammate = e.detail.target;
            if (targetTeammate && targetTeammate.model) {
                this.switchCharacter(targetTeammate);
            }
        });
    }

    setupSetPieceEvents() {
        document.addEventListener('cornerKicked', (e) => {
            if (!this.ball.mesh || !this.currentT1.model || !this.currentT2.model) return;

            
            
            this.restoreGoalkeeper();

            
            let targetTeammate = e.detail ? e.detail.target : null;
            if (!targetTeammate) {
                const distT1 = this.currentT1.model.position.distanceTo(this.ball.position);
                const distT2 = this.currentT2.model.position.distanceTo(this.ball.position);
                targetTeammate = distT1 < distT2 ? this.currentT1 : this.currentT2;
            }
            this.switchCharacter(targetTeammate);
        });

        document.addEventListener('goalKicked', (e) => {
            if (!this.ball.mesh || !this.currentT1.model || !this.currentT2.model) return;

            this.restoreGoalkeeper();

            let targetTeammate = e.detail ? e.detail.target : null;
            if (!targetTeammate) {
                const distT1 = this.currentT1.model.position.distanceTo(this.ball.position);
                const distT2 = this.currentT2.model.position.distanceTo(this.ball.position);
                targetTeammate = distT1 < distT2 ? this.currentT1 : this.currentT2;
            }
            this.switchCharacter(targetTeammate);
        });
    }

    setupPassEvent() {
        document.addEventListener('passExecuted', (e) => {
            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return;
            const targetTeammate = e.detail.target;
            if (targetTeammate && targetTeammate.model) {
                this.switchCharacter(targetTeammate);
            }
        });
    }

    setupInputHandling() {
        document.addEventListener('keydown', (e) => {
            const isGameActive = this.player.controls.isLocked || (this.player.isTouchDevice && document.getElementById('touch-controls').style.display !== 'none');
            if (!isGameActive) return;

            
            if (e.code === 'KeyR' && (this.gameMode === 'penalty' || this.gameMode === 'freekick')) {
                this.startGame(this.gameMode);
                this.uiManager.showInGameMessage("BALL REPOSITIONED");
            }

            if (e.code === 'KeyE') {
                if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return; 
                if (this.isControllingGK) return; 
                if (this.player.action.isTakingCorner || this.player.action.isTakingGoalKick) return; 
                if (!this.ball.mesh || !this.currentT1.model || !this.currentT2.model) return;

                const distT1 = this.currentT1.model.position.distanceTo(this.ball.position);
                const distT2 = this.currentT2.model.position.distanceTo(this.ball.position);
                this.switchCharacter(distT1 < distT2 ? this.currentT1 : this.currentT2);
            }
            else if (e.code === 'KeyT') {
                if (this.gameMode === 'penalty' || this.gameMode === 'freekick') return; 
                if (this.isControllingGK) return; 
                if (this.player.action.isTakingCorner || this.player.action.isTakingGoalKick) return; 
                if (this.player && this.player.animator) {
                    this.player.animator.triggerSlide();
                }
            }
        });
    }

    switchCharacter(teammate) {
        if (!this.player.model || !teammate.model) return;
        document.dispatchEvent(new CustomEvent('bonusCleared'));
        
        if (this.player.action && (this.player.action.hasSuperShot || this.player.action.hasElectricShot)) {
            this.player.action.hasSuperShot = false;
            this.player.action.hasElectricShot = false;

            
            if (this.player.action.glowingModel) {
                this.player.action.glowingModel.traverse((child) => {
                    if (child.isMesh && child.material && child.userData.originalEmissive) {
                        child.material.emissive.copy(child.userData.originalEmissive);
                        child.material.emissiveIntensity = 1.0;
                        delete child.userData.originalEmissive;
                    }
                });
                this.player.action.glowingModel = null;
            }

            
            if (window.fireTrailEffect) {
                window.fireTrailEffect.deactivate();
            }
        }


        this.player.action.chargingAction = null;
        this.player.action.isThrowingIn = false;
        
        
        this.player.throwAnimPlaying = false;
        this.player.ballThrown = false;
        this.player.throwTimer = 0;

        this.player.animator.cancelCharge();
        teammate.animator.cancelCharge();

        const tempModel = this.player.model;
        this.player.model = teammate.model;
        teammate.model = tempModel;

        const tempStamina = this.player.stamina;
        this.player.stamina = teammate.stamina;
        teammate.stamina = tempStamina;

        const tempName = this.player.playerName;
        this.player.playerName = teammate.playerName;
        teammate.playerName = tempName;

        const tempAvatar = this.player.avatar;
        this.player.avatar = teammate.avatar;
        teammate.avatar = tempAvatar;


        const tempAnimator = this.player.animator;
        this.player.animator = teammate.animator;
        teammate.animator = tempAnimator;

        const tempYaw = this.player.yaw;
        this.player.yaw = teammate.yaw;
        teammate.yaw = tempYaw;

        if (teammate.boost === undefined) {
            teammate.boost = 0;
        }

        
        const tempBoost = this.player.boost;
        this.player.boost = teammate.boost;
        teammate.boost = tempBoost;

        if (this.ball && this.ball.mesh) {
            const targetYaw = Math.atan2(
                this.ball.position.x - this.player.model.position.x,
                this.ball.position.z - this.player.model.position.z
            );
            this.player.yaw = targetYaw;
            this.player.model.rotation.y = targetYaw;
        }

        const offset = this.player.cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
        this.camera.position.copy(this.player.model.position.clone().add(offset));

        const cameraTarget = this.player.model.position.clone();
        cameraTarget.y += 1.5;
        this.camera.lookAt(cameraTarget);
    }


    startGame(mode) {
        this.gameMode = mode;
        
        
        if (this.bgMusic && this.bgMusic.paused) {
            this.bgMusic.play().catch(() => {});
        }
        this.player.isTraining = (mode === 'penalty' || mode === 'freekick'); 

        if (mode === '2-1' || mode === '1-2') {
            this.currentFormation = mode;
            this.resetKickOff();
        } else if (mode === 'penalty') {
            this.setupPenalty();
            this.uiManager.showInGameMessage("TRAINING PENALTY<br><span style='font-size:20px'>Press 'R' to reposition</span>");
        } else if (mode === 'freekick') {
            this.setupFreeKick();
            this.uiManager.showInGameMessage("TRAINING FREEKICK<br><span style='font-size:20px'>Press 'R' to reposition</span>");
        }

        
        const offset = this.player.cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
        this.camera.position.copy(this.player.model.position.clone().add(offset));
        const cameraTarget = this.player.model.position.clone();
        cameraTarget.y += 1.5;
        this.camera.lookAt(cameraTarget);
    }

    setupPenalty() {
        this.playerTeam = 'home';
        this.homeScore = 0;
        this.awayScore = 0;

        
        this.ball.position.set(37.5, this.ball.radius, 0);
        this.ball.velocity.set(0, 0, 0);
        this.ball.isGoal = false;
        this.ball.isOut = false;
        this.ball.isOutBaseline = false;
        this.ball.isElectricShot = false;
        this.ball.isPowerShot = false;
        this.ball.spin = 0;

        if (this.player.model) {
            this.player.model.position.set(34, 0, 0);
            const targetYaw = Math.PI / 2; 
            this.player.model.rotation.y = targetYaw;
            this.player.yaw = targetYaw;
        }

        
        [this.currentT1, this.currentT2, this.currentO1, this.currentO2, this.currentO3].forEach(npc => {
            if (npc.model) npc.model.position.set(0, -100, 0);
        });

        
        if (this.awayGK.model) {
            this.awayGK.model.position.set(48.5, 0, 0);
            this.awayGK.model.rotation.y = 3 / 2 * Math.PI;
            this.awayGK.yaw = 3 / 2 * Math.PI;
            this.awayGK.isSwappedOut = false;
        }
        if (this.homeGK.model) { this.homeGK.model.position.set(-48.5, -100, 0); }
    }

    setupFreeKick() {
        this.playerTeam = 'home';
        this.homeScore = 0;
        this.awayScore = 0;

        
        const ballX = 25.0;
        const ballZ = -12.0;
        this.ball.position.set(ballX, this.ball.radius, ballZ);
        this.ball.velocity.set(0, 0, 0);
        this.ball.isGoal = false;
        this.ball.isOut = false;
        this.ball.isOutBaseline = false;
        this.ball.isElectricShot = false;
        this.ball.isPowerShot = false;
        this.ball.spin = 0;

        if (this.player.model) {
            this.player.model.position.set(21.0, 0, ballZ - 2.0);
            const targetYaw = Math.atan2(48.5 - 21.0, 0 - (ballZ - 2.0));
            this.player.model.rotation.y = targetYaw;
            this.player.yaw = targetYaw;
        }

        
        if (this.currentO1.model) { this.currentO1.model.position.set(34, 0, -6); this.currentO1.model.rotation.y = 3 / 2 * Math.PI; }
        if (this.currentO2.model) { this.currentO2.model.position.set(34, 0, -7.5); this.currentO2.model.rotation.y = 3 / 2 * Math.PI; }
        if (this.currentO3.model) { this.currentO3.model.position.set(34, 0, -9); this.currentO3.model.rotation.y = 3 / 2 * Math.PI; }

        [this.currentT1, this.currentT2].forEach(npc => {
            if (npc.model) npc.model.position.set(0, -100, 0);
        });

        if (this.awayGK.model) {
            this.awayGK.model.position.set(48.5, 0, 0);
            this.awayGK.model.rotation.y = 3 / 2 * Math.PI;
            this.awayGK.yaw = 3 / 2 * Math.PI;
            this.awayGK.isSwappedOut = false;
        }
        if (this.homeGK.model) { this.homeGK.model.position.set(-48.5, -100, 0); }
    }

    resetKickOff() {
        this.ball.position.set(0, this.ball.radius, 0);
        this.ball.velocity.set(0, 0, 0);
        this.ball.isGoal = false;
        this.ball.isOut = false;
        this.ball.isOutBaseline = false;
        this.ball.isElectricShot = false;
        this.ball.isPowerShot = false;
        this.ball.spin = 0;

        if (this.currentFormation === '2-1' || this.currentFormation === '1-2') {
            if (this.kickOffTeam === 'home') {
                if (this.player.model) {
                    this.player.model.position.set(-1.5, 0, 0);
                    this.player.yaw = Math.PI / 2;
                    this.player.model.rotation.y = Math.PI / 2;
                }
                if (this.currentT1.model) { this.currentT1.model.position.set(-15, 0, 15); }
                if (this.currentT2.model) { this.currentT2.model.position.set(-15, 0, -15); }

                if (this.currentO1.model) { this.currentO1.model.position.set(10.5, 0, 0); this.currentO1.model.rotation.y = 3 / 2 * Math.PI; this.currentO1.yaw = 3 / 2 * Math.PI; }
                if (this.currentO2.model) { this.currentO2.model.position.set(20, 0, -15); this.currentO2.model.rotation.y = 3 / 2 * Math.PI; this.currentO2.yaw = 3 / 2 * Math.PI; }
                if (this.currentO3.model) { this.currentO3.model.position.set(20, 0, 15); this.currentO3.model.rotation.y = 3 / 2 * Math.PI; this.currentO3.yaw = 3 / 2 * Math.PI; }
            } else {
                
                
                if (this.possessionManager) this.possessionManager.setAwayPossession();

                if (this.player.model) {
                    this.player.model.position.set(-10.5, 0, 0);
                    this.player.yaw = Math.PI / 2;
                    this.player.model.rotation.y = Math.PI / 2;
                }
                if (this.currentT1.model) { this.currentT1.model.position.set(-20, 0, 15); }
                if (this.currentT2.model) { this.currentT2.model.position.set(-20, 0, -15); }

                if (this.currentO1.model) { 
                    this.currentO1.model.position.set(1.5, 0, 0); 
                    this.currentO1.model.rotation.y = 3 / 2 * Math.PI; 
                    this.currentO1.yaw = 3 / 2 * Math.PI;
                    this.currentO1.startKickOff(this.currentO2); 
                }
                if (this.currentO2.model) { this.currentO2.model.position.set(15, 0, -15); this.currentO2.model.rotation.y = 3 / 2 * Math.PI; this.currentO2.yaw = 3 / 2 * Math.PI; }
                if (this.currentO3.model) { this.currentO3.model.position.set(15, 0, 15); this.currentO3.model.rotation.y = 3 / 2 * Math.PI; this.currentO3.yaw = 3 / 2 * Math.PI; }
            }

            if (this.homeGK.model) {
                this.homeGK.model.position.set(-48.5, 0, 0);
                this.homeGK.model.rotation.y = Math.PI / 2;
                this.homeGK.yaw = Math.PI / 2;
            }
            if (this.awayGK.model) {
                this.awayGK.model.position.set(48.5, 0, 0);
                this.awayGK.model.rotation.y = 3 / 2 * Math.PI;
                this.awayGK.yaw = 3 / 2 * Math.PI;
            }
        }
    }

    updateRules() {
        
        
        if (!this.ball.isHeld) {
            const trackingRadius = 1.3; 
            const playerHeight = 1.8;   
            let closestDist = Infinity;
            let closestEntity = null;

            
            const allParticipants = [
                this.player, this.currentT1, this.currentT2,
                this.currentO1, this.currentO2, this.currentO3,
                this.homeGK, this.awayGK
            ];

            
            
            
            for (let ent of allParticipants) {
                if (ent && ent.model) {
                    const isHeading = ent.action && ent.action.isHeading;
                    const effectiveHeight = isHeading ? 4.0 : playerHeight;
                    const effectiveRadius = isHeading ? 4.0 : trackingRadius;

                    const closestY = Math.max(ent.model.position.y, Math.min(ent.model.position.y + effectiveHeight, this.ball.position.y));
                    const dx = ent.model.position.x - this.ball.position.x;
                    const dy = closestY - this.ball.position.y;
                    const dz = ent.model.position.z - this.ball.position.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (dist <= effectiveRadius && dist < closestDist) {
                        closestDist = dist;
                        closestEntity = ent;
                    }
                }
            }

            
            if (closestEntity) {
                
                const isMyTeam = (closestEntity === this.player || closestEntity === this.currentT1 || closestEntity === this.currentT2);
                this.lastTouchedTeam = isMyTeam ? this.playerTeam : (this.playerTeam === 'home' ? 'away' : 'home');

                
                if (window.fireTrailEffect) {
                    if (closestEntity === this.player && this.player.action.hasSuperShot) {
                        if (!window.fireTrailEffect.isActive || window.fireTrailEffect.mode !== 'fire') {
                            window.fireTrailEffect.activate(this.ball, 'fire');
                        }
                    } else if (closestEntity === this.player && this.player.action.hasElectricShot) {
                        if (!window.fireTrailEffect.isActive || window.fireTrailEffect.mode !== 'electric') {
                            window.fireTrailEffect.activate(this.ball, 'electric');
                        }
                    }
                    
                    else {
                        if (window.fireTrailEffect.isActive) {
                            window.fireTrailEffect.deactivate();
                        }
                    }
                }
            }
        }

        
        if (this.ball.isGoal && !this.isCelebrating) {
            this.isCelebrating = true;
            if (this.ball.position.x > 0) {
                this.homeScore++;
                this.kickOffTeam = 'away';
                this.uiManager.showInGameMessage(this.playerTeam === 'home' ? "⚽ GOOOAAALLL!!! ⚽" : "🤦‍♂️ GOAL CONCEDED 🤦‍♂️");
            } else {
                this.awayScore++;
                this.kickOffTeam = 'home';
                this.uiManager.showInGameMessage(this.playerTeam === 'away' ? "⚽ GOOOAAALLL!!! ⚽" : "🤦‍♂️ GOAL CONCEDED 🤦‍♂️");
            }

            
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('triggerReplay'));
            }, 3000);
        }

        
        if (this.ball.isOutBaseline && !this.isCelebrating) {
            this.ball.isOutBaseline = false;
            this.ball.isElectricShot = false;
            this.ball.isPowerShot = false;
            this.ball.spin = 0;

            
            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') {
                this.uiManager.showInGameMessage("TRY AGAIN!<br><span style='font-size:20px'>Press 'R' to reposition</span>");
                setTimeout(() => { this.startGame(this.gameMode); }, 1500);
                return;
            }

            const fieldEndX = 49.5;
            const fieldEndZ = 30.5;

            const isRightSide = this.ball.position.x > 0;
            const isTopCorner = this.ball.position.z > 0;
            const defendingTeam = isRightSide ? 'away' : 'home';
            const isCornerKick = this.lastTouchedTeam === defendingTeam;
            const attackingTeam = isCornerKick ? (defendingTeam === 'home' ? 'away' : 'home') : defendingTeam;

            let subHappened = false;
            if (window.executePendingSubstitutions) {
                subHappened = window.executePendingSubstitutions();
            }

            const ballX = isCornerKick ? (isRightSide ? fieldEndX : -fieldEndX) : (isRightSide ? 44.0 : -44.0);
            
            const ballZ = isCornerKick ? (isTopCorner ? fieldEndZ : -fieldEndZ) : 0;
            const targetFocusX = isRightSide ? 40 : -40;
            const targetYaw = Math.atan2(targetFocusX - ballX, 0 - ballZ);

            this.ball.position.set(ballX, this.ball.radius, ballZ);
            this.ball.velocity.set(0, 0, 0);
            if (this.ball.mesh) {
                this.ball.mesh.position.copy(this.ball.position);
            }

            let activeSetPieceNPC = null;

            if (attackingTeam === this.playerTeam) {
                if (!isCornerKick) {
                    const activeGK = this.homeGK;
                    this.switchCharacter(activeGK);

                    this.isControllingGK = true;
                    this.controlledGK = activeGK;
                    this.controlledGK.isSwappedOut = true;
                } else {
                    this.restoreGoalkeeper();
                }

                this.player.model.position.set(ballX - Math.sin(targetYaw) * 1.0, 0, ballZ - Math.cos(targetYaw) * 1.0);
                this.player.yaw = targetYaw;
                this.player.model.rotation.y = targetYaw;

                if (isCornerKick) {
                    this.player.action.startCorner(this.ball);
                }
                else {
                    this.player.action.startGoalKick(this.ball);
                }
            } else {
                this.restoreGoalkeeper();

                
                if (this.possessionManager) this.possessionManager.setAwayPossession();

                if (isCornerKick) {
                    let closestBot = null;
                    let secondClosestBot = null;
                    let minDist1 = Infinity;
                    let minDist2 = Infinity;

                    
                    [this.currentO1, this.currentO2, this.currentO3].forEach(bot => {
                        if (bot && bot.model) {
                            const dist = bot.model.position.distanceTo(new THREE.Vector3(ballX, 0, ballZ));
                            if (dist < minDist1) {
                                minDist2 = minDist1;
                                secondClosestBot = closestBot;
                                
                                minDist1 = dist;
                                closestBot = bot;
                            } else if (dist < minDist2) {
                                minDist2 = dist;
                                secondClosestBot = bot;
                            }
                        }
                    });

                    const kickerBot = closestBot;
                    const receiverBot = secondClosestBot;

                    
                    kickerBot.model.position.set(ballX - Math.sin(targetYaw) * 1.0, 0, ballZ - Math.cos(targetYaw) * 1.0);
                    kickerBot.yaw = targetYaw;
                    kickerBot.model.rotation.y = targetYaw;
                    
                    
                    kickerBot.startCorner(receiverBot);
                    
                    if (receiverBot) {
                        receiverBot.setReceiveCornerTarget(kickerBot.model.position, ballX, ballZ);
                    }
                    
                    activeSetPieceNPC = kickerBot;
                } else {
                    const botGK = this.awayGK;
                    botGK.model.position.set(ballX - Math.sin(targetYaw) * 1.0, 0, ballZ - Math.cos(targetYaw) * 1.0);
                    botGK.yaw = targetYaw;
                    botGK.model.rotation.y = targetYaw;

                    botGK.startGoalKick(null); 
                    activeSetPieceNPC = botGK;
                }
            }

            const allNPCs = [this.currentT1, this.currentT2, this.currentO1, this.currentO2, this.currentO3];
            if (this.isControllingGK && this.controlledGK) {
                allNPCs.push(this.controlledGK);
            }

            allNPCs.forEach(npc => {
                if (npc.model && npc !== activeSetPieceNPC) {
                    let randX, randZ;
                    if (isCornerKick) {
                        randX = targetFocusX + (Math.random() * 8 - 4);
                        randZ = (Math.random() * 16 - 8);
                    } else {
                        
                        const startX = isRightSide ? 30 : -30;
                        randX = startX + (Math.random() * 8 - 4);
                        randZ = (Math.random() * 20 - 10);
                    }
                    npc.model.position.set(randX, 0, randZ);
                    npc.model.rotation.y = Math.atan2(ballX - randX, ballZ - randZ);
                    
                    if (npc.isReceivingGoalKick !== undefined) npc.isReceivingGoalKick = false;

                    
                    if (isCornerKick && npc.isWaitingInArea !== undefined) {
                        npc.isWaitingInArea = true;
                    }
                }
            });

            
            if (!isCornerKick) {
                const runDir = isRightSide ? -1 : 1; 
                
                if (attackingTeam === this.playerTeam) {
                    [this.currentT1, this.currentT2].forEach(bot => {
                        if (bot && bot.model && bot.setReceiveGoalKickTarget) bot.setReceiveGoalKickTarget(runDir);
                    });
                } else {
                    const receivers = [this.currentO1, this.currentO2, this.currentO3].filter(b => b && b.model);
                    if (receivers.length > 0) {
                        receivers.forEach(r => r.setReceiveGoalKickTarget(runDir));
                        if (activeSetPieceNPC && activeSetPieceNPC.startGoalKick) activeSetPieceNPC.targetReceiver = receivers[0];
                    }
                }
            } else {
                
                if (attackingTeam === this.playerTeam) {
                    [this.currentT1, this.currentT2].forEach(teammate => {
                        if (teammate && teammate.model && teammate.setReceiveCornerTarget) {
                            teammate.setReceiveCornerTarget(ballX, ballZ);
                        }
                    });
                }
            }

            const teamName = attackingTeam === 'home' ? 'ROSSA' : 'BLU';
            if (!subHappened) {
                this.uiManager.showInGameMessage(isCornerKick ? `CORNER KICK: ${teamName}` : `GOAL KICK: TEAM ${teamName}`);
            }
        } else {
            
            const allBots = [this.currentO1, this.currentO2, this.currentO3, this.currentT1, this.currentT2];
            const isAnyBotThrowingIn = allBots.some(bot => bot && bot.isThrowingIn);

            
            if (this.ball.isOut && !this.player.isThrowingIn && !isAnyBotThrowingIn && !this.ball.isGoal) {
                this.ball.isOut = false;
            this.ball.isElectricShot = false;
            this.ball.isPowerShot = false;
            this.ball.spin = 0;
            

            if (this.gameMode === 'penalty' || this.gameMode === 'freekick') {
                this.uiManager.showInGameMessage("RITENTA!<br><span style='font-size:20px'>Premi 'R' per riposizionare</span>");
                setTimeout(() => { this.startGame(this.gameMode); }, 1500);
                return;
            }

            let subHappened = false;
            if (window.executePendingSubstitutions) {
                subHappened = window.executePendingSubstitutions();
            }

            this.restoreGoalkeeper(); 
            const throwInTeam = this.lastTouchedTeam === 'home' ? 'away' : 'home';

            const side = this.ball.position.z > 0 ? 1 : -1;
            const outOfBoundsOffset = 1.5;

            if (throwInTeam === this.playerTeam) {
                this.player.model.position.set(this.ball.position.x, 0, this.ball.position.z + (outOfBoundsOffset * side));
                this.player.yaw = side > 0 ? Math.PI : 0;
                this.player.startThrowIn();

                
                let closestTeammate = null;
                let minDistT = Infinity;
                this.teammates.forEach(t => {
                    if (t && t.model) {
                        const dist = t.model.position.distanceTo(this.player.model.position);
                        if (dist < minDistT) {
                            minDistT = dist;
                            closestTeammate = t;
                        }
                    }
                });
                if (closestTeammate) {
                    this.player.targetReceiver = closestTeammate;
                    closestTeammate.setReceiveThrowInTarget(this.player.model.position, side);
                }

                if (!subHappened) this.uiManager.showInGameMessage("THROW-IN: HOME");
            } else {
                
                
                if (this.possessionManager) this.possessionManager.setAwayPossession();

                
                let closestBot = null;
                let secondClosestBot = null;
                let minDist1 = Infinity;
                let minDist2 = Infinity;

                [this.currentO1, this.currentO2, this.currentO3].forEach(bot => {
                    if (bot && bot.model) {
                        const dist = bot.model.position.distanceTo(new THREE.Vector3(this.ball.position.x, 0, this.ball.position.z));
                        if (dist < minDist1) {
                            
                            minDist2 = minDist1;
                            secondClosestBot = closestBot; 
                            
                            
                            minDist1 = dist;
                            closestBot = bot; 
                        } else if (dist < minDist2) {
                            
                            minDist2 = dist;
                            secondClosestBot = bot; 
                        }
                    }
                });

                const throwerBot = closestBot;
                const receiverBot = secondClosestBot;

                throwerBot.model.position.set(this.ball.position.x, 0, this.ball.position.z + (outOfBoundsOffset * side));
                const botYaw = side > 0 ? Math.PI : 0;
                throwerBot.yaw = botYaw;
                throwerBot.model.rotation.y = botYaw;

                
                throwerBot.startThrowIn(receiverBot);
                
                
                if (receiverBot) {
                    receiverBot.setReceiveThrowInTarget(throwerBot.model.position, side);
                }
                

                if (!subHappened) {
                    this.uiManager.showInGameMessage("THROW-IN: AWAY");
                }
            }
        }
        }
    }

    restoreGoalkeeper() {
        if (this.isControllingGK && this.controlledGK) {
            this.controlledGK.isSwappedOut = false; 

            
            
            
            this.player.animator.cancelCharge();

            this.switchCharacter(this.controlledGK); 
            this.isControllingGK = false;
            this.controlledGK = null;
        }
    }

    resetAfterGoal() {
        this.restoreGoalkeeper();
        if (window.executePendingSubstitutions) window.executePendingSubstitutions();

        if (this.gameMode === 'penalty' || this.gameMode === 'freekick') {
            this.startGame(this.gameMode); 
        } else {
            this.resetKickOff();

            
            const offset = this.player.cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
            this.camera.position.copy(this.player.model.position.clone().add(offset));
            const cameraTarget = this.player.model.position.clone();
            cameraTarget.y += 1.5;
            this.camera.lookAt(cameraTarget);
        }

        this.isCelebrating = false;
    }
}