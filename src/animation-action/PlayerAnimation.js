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
        // ---VARIABILI PER IL TIRO ---
        this.shootFollowThroughTimer = 0;
        this.wasChargingShoot = false;

        // ---VARIABILI PASSAGGIO ---
        this.passFollowThroughTimer = 0;
        this.wasChargingPass = false;

        this.lastChargeRatio = 0;

        // --- VARIABILI SCIVOLATA ---
        this.isSliding = false;
        this.slideTimer = 0;
    }
    initBones(model) {
        model.traverse((child) => {
            if (child.isMesh){
                const b = child.name.toLowerCase();
                //console.log(b);
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

        // --- ESECUZIONE COLPO DI TESTA (Ha priorità massima come la scivolata) ---
        if (isHeading) {
            this.headerAnimation(headerProgress);
            return;
        }

        // --- ESECUZIONE SCIVOLATA ---
        if (this.isSliding) {
            this.slideTimer += deltaTime;
            const duration = 1.0; // Durata totale della scivolata
            if (this.slideTimer > duration) {
                this.isSliding = false;
                this.resetToBasePose();
            } else {
                this.slideAnimation(duration);
                return; // Blocca le altre animazioni (corsa, camminata)
            }
        }

        // --- TRIGGER DRIBBLE ---
        if (dribbleTouchType) {
            this.isDribblingAnim = true;
            this.activeDribbleType = dribbleTouchType;
            this.dribbleAnimTimer = 0;
        }

        // --- ESECUZIONE DRIBBLING ---
        if (this.isDribblingAnim) {
            this.dribbleAnimTimer += deltaTime;

            // DURATA DINAMICA: corsa = esplosiva, camminata = fluida
            const isRunDribble = this.activeDribbleType === 'run_push';
            const duration = isRunDribble ? 0.28 : 0.55;

            const p = Math.min(this.dribbleAnimTimer / duration, 1.0);

            const easeIn = (t) => t * t;
            const easeOut = (t) => 1 - (1 - t) * (1 - t);
            // Curva "expulsiva" per la corsa: scatta rapidissimo poi sfuma
            const snap = (t) => Math.pow(t, 0.4); // arriva al picco subito

            let windup = 0, impact = 0, recovery = 0;

            if (isRunDribble) {
                // Per la corsa: windup cortissimo (15%), impatto lungo (45%), recovery rapido (40%)
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
                // Camminata: 3 fasi bilanciate come prima
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

            // =====================================================
            // ANATOMIA BASE condivisa
            // =====================================================
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

            // =====================================================
            // RUN_PUSH: sprint con tocco esplosivo
            // =====================================================
            if (this.activeDribbleType === 'run_push') {

                // Gamba d'appoggio sinistra: piegata forte — assorbe tutto il peso
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

                // COSCIA DESTRA: scatto violentissimo in avanti
                if (this.bones.rightUpLeg) {
                    this.bones.rightUpLeg.rotation.x =
                        this.baseRot.rightUpLeg.x
                        + (windup * 0.5)           // carica indietro
                        - (impact * 1.1)           // SCATTA in avanti (era 1.6)
                        + (recovery * 0.45);

                    // Piccola rotazione esterna — il calciatore "apre" il fianco
                    this.bones.rightUpLeg.rotation.y =
                        this.baseRot.rightUpLeg.y + (impact * 0.15);
                }

                // GINOCCHIO: quasi esteso al momento del contatto (punta in avanti)
                if (this.bones.rightLeg) {
                    this.bones.rightLeg.rotation.x =
                        this.baseRot.rightLeg.x
                        + (windup * 0.35)          // si carica piegandosi
                        - (impact * 0.35)          // si distende nell'impatto
                        + (recovery * 0.1);
                }

                // PIEDE: snap deciso verso la palla — punta giù nell'impatto
                if (this.bones.rightFoot) {
                    this.bones.rightFoot.rotation.x =
                        this.baseRot.rightFoot.x
                        + (impact * 0.7)
                        + (recovery * 0.1);
                }

                // BUSTO: lean aggressivo in avanti + counter-rotation spalle
                if (this.bones.spine) {
                    this.bones.spine.rotation.x =
                        this.baseRot.spine.x
                        + 0.30                     // sempre piegato da sprinter
                        + (windup * 0.12)
                        - (recovery * 0.08);

                    this.bones.spine.rotation.y =
                        this.baseRot.spine.y
                        - (impact * 0.28)          // counter-rotation forte
                        + (recovery * 0.08);
                }

                // BACINO: ruota con il passo + abbassamento nell'impatto
                if (this.bones.hips) {
                    this.bones.hips.position.y =
                        this.basePos.hips.y - (impact * 0.06);

                    this.bones.hips.rotation.z =
                        this.baseRot.hips.z - (impact * 0.14);

                    this.bones.hips.rotation.x =
                        this.baseRot.hips.x + 0.15 + (windup * 0.08);
                }

                // BRACCIA: pompa aggressiva come uno sprinter
                if (this.bones.leftArm) {
                    this.bones.leftArm.rotation.z =
                        this.baseRot.leftArm.z
                        + (windup * 0.3)
                        + (impact * 0.9);          // braccio sinistro avanza forte
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

                // =====================================================
                // TOCCO INTERNO (walking — invariato)
                // =====================================================
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

                // =====================================================
                // TOCCO ESTERNO (walking — invariato)
                // =====================================================
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

                // =====================================================
                // FALLBACK
                // =====================================================
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

            // --- FINE ANIMAZIONE ---
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
                return; // Blocca la camminata mentre carichi
            }
            else if (chargingAction === 'pass') {
                this.wasChargingPass = true;
                this.passFollowThroughTimer = 0;
                this.lastChargeRatio = chargeRatio;
                this.chargePassAnimation(chargeRatio);
                return; // Blocca la camminata mentre carichi
            }
            else if (this.wasChargingShoot) {
                // Rilascio Tiro
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
                // Rilascio Passaggio
                this.passFollowThroughTimer += deltaTime;
                if (this.passFollowThroughTimer > 0.4) {
                    this.wasChargingPass = false;
                    this.resetToBasePose();
                } else {
                    this.executePassAnimation(this.passFollowThroughTimer, this.lastChargeRatio);
                    return;
                }
            }
            // -------------------------------------

            // Movimento normale
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
        // Gambe e bacino in posizione neutra e solida
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

        // Braccia piegate all'indietro per reggere la palla sulla nuca
        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + 2.5;
        this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - 2.5;
        this.bones.leftForeArm.rotation.z = this.baseRot.leftForeArm.z + 1.6;
        this.bones.rightForeArm.rotation.z = this.baseRot.rightForeArm.z - 1.6;
    }


    throwInAnimation() {
        const t = this.throwTime;
        const speed = 3.5; // Regola questo valore per rendere il lancio più o meno veloce

        // Calcoliamo a che punto del ciclo di lancio ci troviamo.
        // Limitiamo a Math.PI * 1.5 per far fermare il corpo nella posa finale di follow-through.
        const cycle = Math.min(t * speed, Math.PI * 1.5);

        let windup = 0;        // Variabile per la fase 1 (Caricamento)
        let followThrough = 0; // Variabile per la fase 2 (Lancio)

        if (cycle <= Math.PI) {
            // Da 0 a PI, il seno va da 0 -> 1 -> 0. Crea un movimento morbido all'indietro.
            windup = Math.sin(cycle);
        } else {
            // Da PI a 1.5*PI, il seno diventa negativo. Usiamo Math.abs per avere un valore da 0 -> 1.
            // Crea lo scatto brusco in avanti.
            followThrough = Math.abs(Math.sin(cycle));
        }

        // --- 1. MOVIMENTO BUSTO E BACINO ---
        if (this.bones.spine) {
            // Busto va indietro nel windup (-0.4) e scatta avanti nel follow-through (+0.5)
            this.bones.spine.rotation.x = this.baseRot.spine.x - (windup * 0.4) + (followThrough * 0.5);
        }

        if (this.bones.hips) {
            // Il bacino si abbassa leggermente per caricare il peso e ruota per assecondare la gamba
            this.bones.hips.position.y = this.basePos.hips.y - (windup * 0.08);
            this.bones.hips.rotation.y = this.baseRot.hips.y - (windup * 0.15) + (followThrough * 0.1);
            this.bones.hips.rotation.z = this.baseRot.hips.z;
        }

        // --- 2. MOVIMENTO GAMBE ---
        // WINDUP (fase 1): sposta la gamba all'indietro
        // FOLLOW-THROUGH (fase 2): sposta la gamba in avanti

        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (windup * 0.7) + (followThrough * 0.8);

        // Piega il ginocchio destro per accumulare spinta mentre va indietro
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (windup * 1.0);

        // Gamba sinistra: fa da perno fisso (piegata leggermente per l'equilibrio)
        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (windup * 0.1) + (followThrough * 0.1);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (windup * 0.15);

        // --- 3. MOVIMENTO BRACCIA ---
        // Portano la palla forte dietro la testa, per poi scagliare
        const armRaise = windup * 2.8;     // Sollevamento massiccio indietro
        const armThrow = followThrough * 1.8; // Discesa forte in avanti

        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + armRaise - armThrow;
        this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - armRaise + armThrow;

        // Avambracci: si piegano forte dietro la nuca (windup) e si distendono (followThrough)
        const elbowBend = windup * 1.6;
        const elbowStraighten = followThrough * 0.8;

        this.bones.leftForeArm.rotation.z = this.baseRot.leftForeArm.z + elbowBend - elbowStraighten;
        this.bones.rightForeArm.rotation.z = this.baseRot.rightForeArm.z - elbowBend + elbowStraighten;
    }

    walkAnimation() {
        const t = this.walkCycle;

        // --- PARAMETRI BASE ---
        const stride = 0.65;
        const speed = 1.0;

        // Onde principali
        const sin = Math.sin(t * speed);
        const cos = Math.cos(t * speed);

        // Controfase
        const sinOpp = Math.sin(t * speed + Math.PI);

        // Micro variazioni (rompono effetto robot)
        const micro = Math.sin(t * 3.5) * 0.01;

        // Curve più naturali per il passo (non lineari)
        const leftStep = sin;
        const rightStep = sinOpp;

        // === 1. GAMBE (CICLO COMPLETO: avanti → contatto → spinta) ===
        this.bones.leftUpLeg.rotation.x =
            this.baseRot.leftUpLeg.x + leftStep * stride;

        this.bones.rightUpLeg.rotation.x =
            this.baseRot.rightUpLeg.x + rightStep * stride;

        // === 2. GINOCCHIA (più realistiche) ===
        // piega forte quando la gamba è in avanti (fase di recupero)
        const leftKnee =
            Math.max(0, -leftStep) * 1.4 + Math.max(0, cos) * 0.15;

        const rightKnee =
            Math.max(0, -rightStep) * 1.4 + Math.max(0, -cos) * 0.15;

        this.bones.leftLeg.rotation.x =
            this.baseRot.leftLeg.x - leftKnee;

        this.bones.rightLeg.rotation.x =
            this.baseRot.rightLeg.x - rightKnee;

        // === 3. BACINO (LA PARTE PIÙ IMPORTANTE) ===
        if (this.bones.hips) {
            // movimento verticale realistico (non simmetrico)
            const bounce =
                Math.abs(sin) * 0.05; // più naturale della cos

            this.bones.hips.position.y =
                this.basePos.hips.y - bounce;

            // spinta in avanti (quando piede dietro)
            this.bones.hips.position.z =
                (this.basePos.hips.z || 0) + cos * 0.02;

            // sway laterale (peso sulla gamba d'appoggio)
            this.bones.hips.rotation.z =
                this.baseRot.hips.z + sin * 0.08;

            // leggera rotazione avanti/indietro
            this.bones.hips.rotation.x =
                (this.baseRot.hips.x || 0) + cos * 0.04;
        }

        // === 4. BUSTO (contro-rotazione naturale) ===
        if (this.bones.spine) {
            // sempre leggermente in avanti
            this.bones.spine.rotation.x =
                this.baseRot.spine.x + 0.06 + micro;

            // controfase rispetto al bacino → SUPER importante
            this.bones.spine.rotation.y =
                this.baseRot.spine.y - sin * 0.15;

            // stabilizzazione
            this.bones.spine.rotation.z =
                this.baseRot.spine.z - sin * 0.03;
        }

        // === 5. BRACCIA (molto più naturali) ===
        const armSwing = 0.6;

        this.bones.leftArm.rotation.z =
            this.baseRot.leftArm.z + rightStep * armSwing + micro;

        this.bones.rightArm.rotation.z =
            this.baseRot.rightArm.z + leftStep * armSwing - micro;

        // apertura naturale (non rigide)
        this.bones.leftArm.rotation.z =
            this.baseRot.leftArm.z + 0.2 + sin * 0.05;

        this.bones.rightArm.rotation.z =
            this.baseRot.rightArm.z - 0.2 - sin * 0.05;

        // === 6. GOMITI (dinamici) ===
        const leftElbow =
            Math.max(0, -rightStep) * 0.4;

        const rightElbow =
            Math.max(0, -leftStep) * 0.4;

        this.bones.leftForeArm.rotation.z =
            this.baseRot.leftForeArm.z + 0.25 + leftElbow;

        this.bones.rightForeArm.rotation.z =
            this.baseRot.rightForeArm.z - 0.25 - rightElbow;

        // === 7. DETTAGLI FINALI (REALISMO) ===
        // piccola instabilità umana
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

        // Respiro veloce e molto affannoso
        // Aumentato leggermente il ritmo (3.5) per dare senso di fatica
        const breatheSin = Math.sin(t * 3.5);
        const organicSway = Math.cos(t * 1.5); // Oscillazione secondaria per non sembrare finti

        // --- 1. HARD RESET TOTALE (Gambe sempre piantate a terra) ---
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

        // --- 2. POSA "READY" FISSA ---
        const microBend = 0.08;
        if (this.bones.leftUpLeg) this.bones.leftUpLeg.rotation.x += microBend;
        if (this.bones.rightUpLeg) this.bones.rightUpLeg.rotation.x += microBend;
        if (this.bones.leftLeg) this.bones.leftLeg.rotation.x -= microBend;
        if (this.bones.rightLeg) this.bones.rightLeg.rotation.x -= microBend;

        // --- 3. EFFETTO RESPIRO ACCENTUATO (Solo petto e spalle) ---
        if (this.bones.spine) {
            // Inclinazione base un po' curva (tipica di chi cerca aria)
            this.bones.spine.rotation.x += 0.15;

            // IL FIATONE: Prima era 0.02, ora è 0.10! Il petto fa un'escursione enorme
            this.bones.spine.rotation.x -= (breatheSin * 0.10);

            // Leggero dondolio del busto per sembrare vivi e affaticati
            this.bones.spine.rotation.y += (organicSway * 0.04);
        }

        if (this.bones.leftArm && this.bones.rightArm) {
            // Le braccia si allargano (Z) in sincrono col petto che si gonfia. 
            // Moltiplicatore alzato da 0.015 a 0.07!
            this.bones.leftArm.rotation.z += 0.10 + (breatheSin * 0.07);
            this.bones.rightArm.rotation.z -= 0.10 + (breatheSin * 0.07);

            // Aggiunta la rotazione X alle braccia: simula le spalle che vanno su e giù
            this.bones.leftArm.rotation.x -= (breatheSin * 0.06);
            this.bones.rightArm.rotation.x -= (breatheSin * 0.06);
        }

        // Avambracci leggermente a penzoloni
        if (this.bones.leftForeArm) this.bones.leftForeArm.rotation.z += 0.15;
        if (this.bones.rightForeArm) this.bones.rightForeArm.rotation.z -= 0.15;
    }


    // --- METODI PER IL PASSAGGIO (DI PIATTO) ---

    chargePassAnimation(ratio) {
        // 1. Piegamento gamba d'appoggio (più morbido del tiro)
        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (ratio * 0.1);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (ratio * 0.15);

        // 2. Caricamento gamba destra 
        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (ratio * 0.7);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (ratio * 0.9);

        // IL DETTAGLIO: Rotazione verso l'esterno dell'anca per aprire il piatto del piede (asse Y)
        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x + (ratio * 0.8);

        // IL DETTAGLIO ANCA: Rotazione verso l'esterno dell'anca


        // --- NUOVO: IL DETTAGLIO PIEDE (PIATTO) ---
        if (this.bones.rightFoot) {
            // Apre la punta del piede verso l'esterno (Y) e blocca la caviglia a martello (Z)
            this.bones.rightFoot.rotation.y = this.baseRot.rightFoot.y + (ratio * 0.6);
            this.bones.rightFoot.rotation.z = this.baseRot.rightFoot.z - (ratio * 0.7);
        }

        // 3. Le braccia bilanciano il corpo (movimento più contenuto rispetto al tiro
        this.bones.rightArm.rotation.x = this.baseRot.rightArm.x + (ratio * 0.4);

        // 4. Busto ruota per assecondare l'apertura della gamba
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

        // Il passaggio è leggermente meno "violento" del tiro
        const intensity = 0.4 + (powerRatio * 0.4);

        // --- 1. GAMBA CHE PASSA ---
        // Scatta in avanti (X) 
        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (kickForward * 1.0 * intensity);
        // MANTIENE la rotazione esterna (Y) durante il calcio per colpire di piatto, poi sfuma
        this.bones.rightUpLeg.rotation.y = this.baseRot.rightUpLeg.y + (fade * powerRatio * 0.8) + (kickForward * 0.4);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x;

        // --- 2. RIENTRO MORBIDO DEL RESTO DEL CORPO ---
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
        // 1. Piegamento sulla gamba d'appoggio
        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (ratio * 0.15);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (ratio * 0.25);

        // 2. Caricamento gamba destra (INVERTITI I SEGNI: ora va indietro con il +)
        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x + (ratio * 1.0);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (ratio * 1.5);

        // 3. Braccio sinistro si alza forte
        this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (ratio * 1.6);
        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (ratio * 0.6);

        // 4. Braccio destro va indietro
        this.bones.rightArm.rotation.z = this.baseRot.rightArm.z + (ratio * 0.8);

        // 5. Busto ruota e si inclina
        if (this.bones.spine) {
            this.bones.spine.rotation.y = this.baseRot.spine.y + (ratio * 0.5);
            this.bones.spine.rotation.x = this.baseRot.spine.x + (ratio * 0.4);
        }
    }


    executeKickAnimation(time, powerRatio) {
        const progress = time / 0.4;

        // NUOVO: Questo valore va da 1 a 0 e serve a svanire la posa di caricamento dolcemente
        const fade = 1 - progress;

        let kickForward;
        if (progress < 0.25) {
            kickForward = progress / 0.25;
        } else {
            kickForward = 1 - ((progress - 0.25) / 0.75);
        }

        const intensity = 0.5 + (powerRatio * 0.5);

        // --- 1. GAMBA CHE CALCIA ---
        // (Visto che il + andava indietro, ora usiamo il - per scagliare in avanti)
        this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (kickForward * 1.4 * intensity);
        this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x;

        // --- 2. RIENTRO MORBIDO DEL RESTO DEL CORPO (Il fix per non restare storti) ---
        // Moltiplichiamo per 'fade' in modo che a fine animazione (progress=1, fade=0) 
        // tutte le ossa siano matematicamente tornate alla posa originale.

        // Gamba d'appoggio
        this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (fade * powerRatio * 0.15);
        this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (fade * powerRatio * 0.25);

        // Braccia
        this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (fade * powerRatio * 1.6) + (kickForward * 0.5);
        this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (fade * powerRatio * 0.6) + (kickForward * 0.2);
        this.bones.rightArm.rotation.x = this.baseRot.rightArm.x + (fade * powerRatio * 0.8);

        // Busto
        if (this.bones.spine) {
            this.bones.spine.rotation.y = this.baseRot.spine.y + (fade * powerRatio * 0.5) - (kickForward * 0.3 * intensity);
            this.bones.spine.rotation.x = this.baseRot.spine.x + (fade * powerRatio * 0.4) + (kickForward * 0.6 * intensity);
        }
    }

    // --- NUOVO: Abortisce l'animazione di carica senza far partire il calcio ---
    cancelCharge() {
        this.wasChargingShoot = false;
        this.wasChargingPass = false;
        this.shootFollowThroughTimer = 0;
        this.passFollowThroughTimer = 0;
        this.resetToBasePose(); // Riporta il corpo dritto
    }
    // ANIMAZIONE COLPO DI TESTA
    headerAnimation(progress) {
        this.resetToBasePose();

        // Ora l'impatto fisico avviene al 42% dell'animazione
        const impactRatio = 0.42;

        // Parabola del salto (0 -> 1 -> 0)
        const jumpCurve = Math.sin(progress * Math.PI);
        const jumpHeight = jumpCurve * 1.7; // Alziamo leggermente l'elevazione

        if (this.bones.hips) {
            this.bones.hips.position.y = this.basePos.hips.y + jumpHeight;
        }

        if (progress < impactRatio) {
            // FASE 1: Caricamento esplosivo
            const windup = progress / impactRatio; // Va da 0 a 1

            if (this.bones.spine) this.bones.spine.rotation.x = this.baseRot.spine.x - (windup * 0.5);
            if (this.bones.head) this.bones.head.rotation.x = this.baseRot.head.x - (windup * 0.4);

            if (this.bones.leftUpLeg) this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (windup * 0.8);
            if (this.bones.rightUpLeg) this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (windup * 1.0);
            if (this.bones.leftLeg) this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x - (windup * 2);
            if (this.bones.rightLeg) this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x - (windup * 2);

            if (this.bones.leftArm) this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (windup * 1.2);
            if (this.bones.rightArm) this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - (windup * 1.2);

        } else {
            // FASE 2: Frustata e Atterraggio
            const recovery = (progress - impactRatio) / (1 - impactRatio);
            const impactSnap = 1 - recovery; // Da 1 a 0

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

        // Fase 1: Scende a terra (0.0 - 0.2)
        // Fase 2: Scivola steso (0.2 - 0.7)
        // Fase 3: Si rialza (0.7 - 1.0)
        let currentAnim = 0;
        if (progress < 0.2) {
            currentAnim = progress / 0.2;
        } else if (progress < 0.7) {
            currentAnim = 1.0;
        } else {
            currentAnim = 1.0 - ((progress - 0.7) / 0.3);
        }

        // Curva morbida per un movimento più naturale
        const easeCurve = Math.sin(currentAnim * Math.PI / 2);

        this.resetToBasePose();

        if (this.bones.hips) {
            // Abbassa il bacino a terra (1.15 è abbastanza per toccare l'erba senza sprofondare)
            this.bones.hips.position.y = this.basePos.hips.y - (easeCurve * 1.15);
            // Mantieni il corpo dritto frontale, inclinato solo all'indietro
            this.bones.hips.rotation.z = this.baseRot.hips.z;
            this.bones.hips.rotation.x = this.baseRot.hips.x + (easeCurve * 0.5);
        }

        if (this.bones.spine) {
            // Inclina il busto all'indietro per bilanciare il corpo, senza torsioni strane
            this.bones.spine.rotation.x = this.baseRot.spine.x + (easeCurve * 0.4);
            this.bones.spine.rotation.z = this.baseRot.spine.z;
        }

        if (this.bones.rightUpLeg && this.bones.rightLeg) {
            // Gamba destra stesa dritta e tesa in avanti
            this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (easeCurve * 1.3);
            this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x;
        }

        if (this.bones.leftUpLeg && this.bones.leftLeg) {
            // Gamba sinistra piegata morbidamente sotto il corpo
            this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x + (easeCurve * 0.5);
            this.bones.leftUpLeg.rotation.z = this.baseRot.leftUpLeg.z - (easeCurve * 0.5);
            this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x - (easeCurve * 2.0);
        }

        if (this.bones.leftArm && this.bones.rightArm) {
            // Braccia larghe per mantenere l'equilibrio durante lo scivolamento
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
