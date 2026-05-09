export class GoalKeeperAnimator {
    constructor() {
        this.bones = {};
        this.baseRot = {};
        this.basePos = {};
        this.idleTime = 0;

        // Variabili per la parata semplice
        this.isSaving = false;
        this.saveTimer = 0;
        this.saveSide = 'left';

        // --- VARIABILI AGGIUNTE PER TIRO E PASSAGGIO ---
        this.wasChargingShoot = false;
        this.wasChargingPass = false;
        this.shootFollowThroughTimer = 0;
        this.passFollowThroughTimer = 0;
        this.lastChargeRatio = 0;
    }

    initBones(model) {
        model.traverse((child) => {
            if (child.isBone) {
                const b = child.name.toLowerCase();
                const save = (key, bone) => { this.bones[key] = bone; };

                if (b.endsWith('spine1')) save('spine', child);
                if (b.endsWith('leftarm')) save('leftArm', child);
                if (b.endsWith('rightarm')) save('rightArm', child);
                if (b.endsWith('leftforearm')) save('leftForeArm', child);
                if (b.endsWith('rightforearm')) save('rightForeArm', child);
                if (b.endsWith('hips')) save('hips', child);

                // --- OSSA AGGIUNTE PER LE GAMBE ---
                if (b.endsWith('leftupleg')) save('leftUpLeg', child);
                if (b.endsWith('rightupleg')) save('rightUpLeg', child);
                if (b.endsWith('leftleg')) save('leftLeg', child);
                if (b.endsWith('rightleg')) save('rightLeg', child);
                if (b.endsWith('leftfoot')) save('leftFoot', child);
                if (b.endsWith('rightfoot')) save('rightFoot', child);
            }
        });

        if (this.bones.leftArm) this.bones.leftArm.rotation.x += 1.3;
        if (this.bones.rightArm) this.bones.rightArm.rotation.x += 1.3;

        Object.keys(this.bones).forEach((k) => {
            this.baseRot[k] = this.bones[k].rotation.clone();
            this.basePos[k] = this.bones[k].position.clone();
        });
    }

    triggerSave(side) {
        if (!this.isSaving) {
            this.isSaving = true;
            this.saveTimer = 0;
            this.saveSide = side;
        }
    }

    // --- AGGIORNATA LA FIRMA DI ANIMATE PER RICEVERE I COMANDI ---
    animate(deltaTime, isThrowingInAnim, moving, isRunning, isThrowingInState, chargingAction, chargeRatio) {
        if (!this.bones.hips) return;

        // 1. LA PARATA HA LA PRECEDENZA
        if (this.isSaving) {
            this.saveTimer += deltaTime;
            
            // Aumentiamo leggermente la durata a 1.2 secondi per dargli 
            // il tempo di tuffarsi e rialzarsi con calma
            const duration = 1.2; 

            if (this.saveTimer > duration) {
                // IL RITORNO IN PIEDI: spegne la parata e resetta lo scheletro
                this.isSaving = false;
                this.resetToBasePose(); 
            } else {
                this.saveAnimation(duration);
            }
            return;
        }

        // 2. LOGICA TIRO E PASSAGGIO
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

        // 3. STATO DI ATTESA
        this.idleTime += deltaTime;
        this.idleAnimation();
    }
    saveAnimation(duration) {
        // Usiamo Math.min per fare in modo che progress si blocchi a 1.0.
        // Così, anche se il timer continua ad andare avanti, l'animazione si ferma a terra.
        const progress = Math.min(this.saveTimer / duration, 1.0);

        // Curva "ease-out": scatta veloce all'inizio e rallenta verso la fine
        const easeOut = 1 - Math.pow(1 - progress, 3);

        // Curva a "parabola" per il salto: sale a 1 a metà tuffo e torna a 0 alla fine
        const jumpArc = Math.sin(progress * Math.PI);

        // dir: 1 per la sinistra, -1 per la destra (o viceversa in base a come lo hai orientato)
        const dir = this.saveSide === 'left' ? -1 : 1;

        // --- 1. IL VOLO (Spostamento del bacino) ---
        if (this.bones.hips) {
            // Si lancia orizzontalmente sull'asse Z
            const diveDistance = 2.5;
            this.bones.hips.position.z = this.basePos.hips.z + (easeOut * diveDistance * dir);

            // Salta e poi cade. 
            // Sottraiamo (-0.8 * progress) alla fine per far sprofondare un po' il bacino
            // in modo che il modello sembri spiaccicato a terra e non in piedi.
            const jumpHeight = 1.2;
            this.bones.hips.position.y = this.basePos.hips.y + (jumpArc * jumpHeight) - (progress * 0.8);

            // Ruota il bacino di quasi 90 gradi per stendersi lateralmente in volo
            this.bones.hips.rotation.z = this.baseRot.hips.z + (easeOut * (Math.PI / 2.2) * dir);

            // Inclina il busto leggermente in avanti
            this.bones.hips.rotation.x = this.baseRot.hips.x + (easeOut * 0.4);
        }

        // --- 2. BRACCIA STESE ---
        if (this.bones.leftArm && this.bones.rightArm) {
            if (dir === -1) { // Tuffo a Sinistra
                this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + (easeOut * 2.5);
                this.bones.rightArm.rotation.z = this.baseRot.rightArm.z + (easeOut * 1.5);
                this.bones.leftArm.rotation.x = this.baseRot.leftArm.x - (easeOut * 1.2);
            } else { // Tuffo a Destra
                this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - (easeOut * 2.5);
                this.bones.leftArm.rotation.z = this.baseRot.leftArm.z - (easeOut * 1.5);
                this.bones.rightArm.rotation.x = this.baseRot.rightArm.x - (easeOut * 1.2);
            }
        }

        // --- 3. GAMBE (Una spinge, l'altra si stende) ---
        if (this.bones.leftUpLeg && this.bones.rightUpLeg && this.bones.leftLeg && this.bones.rightLeg) {
            if (dir === -1) {
                this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x - (easeOut * 1.0);
                this.bones.rightLeg.rotation.x = this.baseRot.rightLeg.x + (easeOut * 1.2);
                this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x;
            } else {
                this.bones.leftUpLeg.rotation.x = this.baseRot.leftUpLeg.x - (easeOut * 1.0);
                this.bones.leftLeg.rotation.x = this.baseRot.leftLeg.x + (easeOut * 1.2);
                this.bones.rightUpLeg.rotation.x = this.baseRot.rightUpLeg.x;
            }
        }
        
    }

    idleAnimation() {
        this.resetToBasePose();
        const breathe = Math.sin(this.idleTime * 4) * 0.05;
        if (this.bones.spine) this.bones.spine.rotation.x = this.baseRot.spine.x - breathe;
        if (this.bones.leftArm) this.bones.leftArm.rotation.z = this.baseRot.leftArm.z + breathe;
        if (this.bones.rightArm) this.bones.rightArm.rotation.z = this.baseRot.rightArm.z - breathe;
    }

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
        if (!this.bones.leftUpLeg) return;
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
        if (!this.bones.leftUpLeg) return;
        const progress = time / 0.4;
        const fade = 1 - progress;

        let kickForward = progress < 0.25 ? progress / 0.25 : 1 - ((progress - 0.25) / 0.75);
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