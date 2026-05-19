// PlayerAction.js
import * as THREE from 'three';

export class PlayerAction {
    constructor() {
        this.isThrowingIn = false;
        this.isTakingCorner = false;
        this.chargingAction = null;
        this.kickPower = 0;

        // --- PARAMETRI POTENZA REALISTICI (Metri al secondo) ---
        this.passBasePower = 8;
        this.passMaxPower = 24;
        this.passChargeSpeed = 35;

        this.shootBasePower = 25;
        this.shootMaxPower = 55;  // 36 m/s = ~130 km/h (Tiro potentissimo)
        this.shootChargeSpeed = 60;
        this.hasSuperShot = false;
        this.hasElectricShot = false;

        // --- AUDIO ---
        this.kickSound = new Audio('../../public/sound/kick.mp3'); // Assicurati che kick.mp3 sia nella cartella "public" (o root)
        this.kickSound.volume = 1.0; // 1.0 è il volume massimo per l'elemento Audio HTML5
    }
    // --- RIMESSA LATERALE ---
    startThrowIn(ball, rightHandBone) {
        this.isThrowingIn = true;

        if (ball && ball.isLoaded) {
            ball.velocity.set(0, 0, 0);
            ball.isHeld = true;

            // Attacchiamo la palla all'osso della mano
            if (rightHandBone && ball.mesh) {
                rightHandBone.attach(ball.mesh);
                ball.mesh.position.set(0.30, 30, 0.0);
                ball.mesh.rotation.set(0, 0, 0);
            }
        }
    }

    executeThrow(ball, yaw, scene) {
        this.isThrowingIn = false;

        if (ball && ball.isLoaded) {
            const throwDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
            const worldPos = new THREE.Vector3();
            ball.mesh.getWorldPosition(worldPos);

            // Spingiamo la palla avanti per evitare collisioni col corpo
            worldPos.addScaledVector(throwDir, 0.8);
            const safeX = 49.5 - 0.5;
            const safeZ = 30.5 - 0.5;
            worldPos.x = Math.max(-safeX, Math.min(safeX, worldPos.x));
            worldPos.z = Math.max(-safeZ, Math.min(safeZ, worldPos.z));

            // Sganciamo la palla e riattiviamo la fisica
            scene.attach(ball.mesh);
            ball.isHeld = false;
            ball.position.copy(worldPos);
            ball.velocity.set(0, 0, 0);

            const throwForceForward = 14; // Diminuita per una rimessa più controllabile
            const throwForceUpward = 6;   // Abbassato anche lo slancio verticale
            const impulse = new THREE.Vector3(
                throwDir.x * throwForceForward, throwForceUpward, throwDir.z * throwForceForward
            );

            ball.applyImpulse(impulse);
        }
    }

    // --- CARICAMENTO TIRO/PASSAGGIO ---
    startCharge(type) {
        this.chargingAction = type;
        this.kickPower = type === 'pass' ? this.passBasePower : this.shootBasePower;
    }

    updateCharge(deltaTime, passArrow) {
        if (!this.chargingAction) {
            // Se non stiamo caricando, resettiamo la grafica della freccia
            if (passArrow && passArrow.material) {
                passArrow.material.color.setHex(0xccffff);
                passArrow.material.emissiveIntensity = 0.5;
                // --- NUOVO: Resetta la lunghezza ---
                if (passArrow.setChargeLevel) passArrow.setChargeLevel(0);
            }
            return;
        }

        let maxPow = this.chargingAction === 'pass' ? this.passMaxPower : this.shootMaxPower;
        let basePow = this.chargingAction === 'pass' ? this.passBasePower : this.shootBasePower;
        let chargeSpd = this.chargingAction === 'pass' ? this.passChargeSpeed : this.shootChargeSpeed;

        // Aumentiamo la potenza
        this.kickPower += chargeSpd * deltaTime;
        if (this.kickPower > maxPow) this.kickPower = maxPow;

        // Aggiorniamo dinamicamente il colore e la lunghezza della freccia
        if (passArrow && passArrow.material) {
            const chargeRatio = (this.kickPower - basePow) / (maxPow - basePow);
            const startColor = new THREE.Color(0xccffff);
            const endColor = new THREE.Color(0xff2200); // Rosso per massima potenza

            passArrow.material.color.lerpColors(startColor, endColor, chargeRatio);

            // --- NUOVO: Passiamo la percentuale alla freccia per farla allungare ---
            if (passArrow.setChargeLevel) passArrow.setChargeLevel(chargeRatio);
        }
    }

    // Aggiungi questo metodo in PlayerAction.js
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
    executeKick(ball, yaw, pitch, passArrow, passTarget = null) {
        if (!ball || !ball.isLoaded || !this.chargingAction) return;

        // Calcoliamo la direzione base
        let kickDir = new THREE.Vector3(0, 0, 1);
        kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        kickDir.normalize();

        // --- NUOVO: SE PASSI LA PALLA, PERDI I BONUS ---
        if (this.chargingAction === 'pass' && (this.hasSuperShot || this.hasElectricShot)) {
            this.hasSuperShot = false; // Addio bonus
            this.hasElectricShot = false;
            if (window.fireTrailEffect) window.fireTrailEffect.deactivate(); // Spegni il fuoco
        }

        // --- GESTIONE PASSAGGIO PRECISO CON PARABOLA ---
        if (this.chargingAction === 'pass' && passTarget && passTarget.model) {
            const targetPos = passTarget.model.position;
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
            
            if (chargeRatio < 0.1) {
                // Rasoterra perfetto (minimo 10 di forza per non fermarsi a 1 metro)
                V_xz = Math.max(10, distanceToTarget * 2.4); 
                V_y = 0;
            } else {
                // Passaggio con parabola (più carico = più alto)
                const parabolaFactor = (chargeRatio - 0.1) / 0.9;
                const maxHeight = 1.0 + (parabolaFactor * 7.0); 
                
                V_y = Math.sqrt(2 * 12.0 * maxHeight); // Inversione della formula dell'altezza massima
                const flightTime = (2 * V_y) / 12.0;
                
                const dragCompensation = 1 + (distanceToTarget * 0.015);
                V_xz = (distanceToTarget / flightTime) * dragCompensation;
            }
            
            V_xz = Math.min(V_xz, 45); // Limite di sicurezza per evitare velocità incontrollabili
            
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
            
            return; // Terminiamo l'esecuzione qui se è un passaggio
        }

        // --- SISTEMA INTELLIGENTE DI TRAIETTORIA (Solo per i Tiri) ---
        if (this.chargingAction === 'shoot') {
            // 1. Capiamo verso quale porta sta tirando (Guardando la direzione X del vettore)
            const targetGoalX = kickDir.x > 0 ? 48.5 : -48.5;

            // 2. Calcoliamo la distanza tra la palla e la porta
            const distanceToGoal = Math.abs(targetGoalX - ball.position.x);

            // 3. Se stiamo tirando da lontano, forziamo l'angolo (pitch) ad alzarsi
            // in modo che la fisica dell'aria crei quella parabola a scendere perfetta.
            // (L'utente non deve mirare perfettamente in alto col mouse, lo fa il gioco in proporzione)
            if (distanceToGoal > 15) {
                // Da 15m in su, l'angolo varia da 15° a 30° (in radianti: da 0.26 a 0.52)
                const distanceFactor = Math.min((distanceToGoal - 15) / 25, 1.0); // Normalizza da 0 a 1 fino a 40 metri

                // Più il tiro è carico, più lo teniamo teso. Un tiro debole da lontano si alza a palombella.
                const powerRatio = (this.kickPower - this.shootBasePower) / (this.shootMaxPower - this.shootBasePower);

                // Calcolo pitch ottimizzato: 
                const optimalPitch = 0.20 + (distanceFactor * 0.25) - (powerRatio * 0.1);

                // Sovrascriviamo l'angolo verticale (assumendo che verso l'alto sia negativo nel tuo sistema di rotazione asse X)
                pitch = -optimalPitch;
            } else {
                // Tiro ravvicinato, diamo solo un pelo di elevazione per non rasoterrare sempre
                pitch = -0.1 - (pitch * 0.5);
            }
        }

        // --- PARABOLA ALZATA PER I CALCI D'ANGOLO ---
        if (this.isTakingCorner) {
            pitch -= 0.35; // Forza un angolo di tiro molto più alto per effettuare un cross in area
        }

        // Riapplichiamo l'angolo calcolato al vettore di direzione
        kickDir = new THREE.Vector3(0, 0, 1);
        kickDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
        kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        kickDir.normalize();

        // --- LOGICA SUPER TIRO / TIRO ELETTRICO ---
        let finalPower = this.kickPower;
        let isSuperShotActive = false;

        // --- POTENZA MAGGIORATA PER IL CALCIO D'ANGOLO ---
        if (this.isTakingCorner) {
            finalPower *= 1.2; // Aumenta la potenza del 60% per garantire che il cross arrivi in mezzo all'area
        }

        if (this.chargingAction === 'shoot' && (this.hasSuperShot || this.hasElectricShot)) {
            finalPower *= 2.5;
            isSuperShotActive = true;
            
            if (this.hasElectricShot) {
                ball.triggerElectricEffect();
            }

            this.hasSuperShot = false;
            this.hasElectricShot = false;
            document.dispatchEvent(new CustomEvent('bonusCleared'));
            kickDir.y = Math.min(kickDir.y, 0.04);
            kickDir.normalize();

            // --- SPEGNI LA SCIA DOPO IL TIRO ---
            if (window.fireTrailEffect) {
                setTimeout(() => {
                    window.fireTrailEffect.deactivate();
                }, 2000);
            }

            // --- RIMUOVI L'EFFETTO GLOW DAL GIOCATORE ---
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

        // --- EFFETTO MAGNUS (TIRO A GIRO SUL SECONDO PALO) ---
        ball.spin = 0; // Resetta l'effetto ad ogni tocco per un tiro dritto per dritto

        if (this.chargingAction === 'shoot' && !isSuperShotActive) {
            const targetGoalDirX = kickDir.x > 0 ? 1 : -1;
            const targetGoalX = targetGoalDirX > 0 ? 48.5 : -48.5;
            const distanceToGoal = Math.abs(targetGoalX - ball.position.x);

            // Condizione: posizione angolata (abs(Z) > 6) e mira incrociata verso il secondo palo
            const isAimingAtFarPost = (ball.position.z > 6 && kickDir.z < -0.05) || (ball.position.z < -6 && kickDir.z > 0.05);

            // Attivazione: da distanza media-corta (8-35 metri) a prescindere dalla potenza
            if (distanceToGoal > 8 && distanceToGoal < 35 && isAimingAtFarPost) {
                const curveIntensity = 2.0; // Intensità ESAGERATA (oltre le leggi della fisica)
                ball.spin = curveIntensity * targetGoalDirX * Math.sign(ball.position.z); // Tolto il segno meno per curvare verso la porta
                
                // --- TRUCCO PER COLPIRE IL BERSAGLIO ---
                // Calcoliamo il tempo di volo stimato (moltiplicato per 0.8 per compensare il forte attrito dell'aria)
                const flightTime = distanceToGoal / (finalPower * 0.8);
                
                // In una traiettoria aerodinamica, l'angolo per compensare la curva è esattamente 
                // la metà della rotazione totale moltiplicata per il tempo di volo. Usiamo 0.55 per via dell'attrito.
                const aimCompensation = 0.55 * ball.spin * flightTime; 
                
                // Sfalsiamo la mira verso l'esterno: la curva la riporterà proprio sul mirino verde!
                kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), aimCompensation);

                // Manteniamo una traiettoria fissa "laser": 0.15 era un pallonetto, 0.06 rasoterra. 
                // 0.11 è perfetto per viaggiare dritto a mezz'aria senza mai toccare terra e perdere l'effetto!
                kickDir.y = 0.20;
                kickDir.normalize();
                
                // --- EFFETTO SLOW MOTION ---
                document.dispatchEvent(new CustomEvent('triggerSlowMotion', { detail: { duration: 1.0, scale: 0.25 } }));
            }
        }

        // Applichiamo l'impulso fisico
        const impulse = kickDir.multiplyScalar(finalPower);
        ball.velocity.set(0, 0, 0);
        ball.applyImpulse(impulse);

        // --- RIPRODUCI SUONO KICK ---
        if (this.kickSound) {
            this.kickSound.currentTime = 0; // Resetta l'audio all'inizio (permette tiri/passaggi in rapida successione)
            this.kickSound.play().catch(e => console.warn("Autoplay audio bloccato dal browser:", e));
        }

        // Effetto WOW: scatta se hai il super tiro O se carichi un tiro normale oltre l'85%
        if (this.chargingAction === 'shoot') {
            if (isSuperShotActive || this.kickPower >= this.shootMaxPower * 0.85) {
                ball.triggerPowerEffect();
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
    }

    // --- DRIBBLING REALISTICO ---
    // --- DRIBBLING REALISTICO ---
    dribble(ball, yaw, isRunning, isBoosting, keys, deltaTime) {
        if (!ball || !ball.isLoaded) return null;

        // Inizializza il cooldown se non esiste
        if (this.dribbleCooldown === undefined) this.dribbleCooldown = 0;
        this.dribbleCooldown -= deltaTime;

        // Determiniamo il vettore di movimento del giocatore
        let moveX = 0;
        let moveZ = 0;
        if (keys.forward) moveZ = 1;
        if (keys.backward) moveZ = -1;
        if (keys.left) moveX = -1;
        if (keys.right) moveX = 1;

        if (moveX === 0 && moveZ === 0) return null; // Fermo, non dribbla

        // Tipo di animazione
        let touchType = 'straight';
        if (isRunning || isBoosting) {
            touchType = 'run_push'; 
        } else {
            if (keys.right) touchType = 'right_outside';
            if (keys.left) touchType = 'right_inside';
        }

        // Se il cooldown non è finito, non tocchiamo la palla
        if (this.dribbleCooldown > 0) return null;

        const lookDirection = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
        const rightDirection = new THREE.Vector3().crossVectors(lookDirection, new THREE.Vector3(0, 1, 0)).normalize();

        // Vettore di spinta finale basato sui tasti premuti
        const pushDirection = new THREE.Vector3()
            .addScaledVector(lookDirection, moveZ)
            .addScaledVector(rightDirection, moveX)
            .normalize();

        // --- VALORI BASE (Camminata) ---
        let maxDribbleSpeed = 8;
        let pushForce = 8;
        let touchInterval = 0.5;

        // Se ci stiamo muovendo lateralmente (A o D), diamo un impulso leggermente maggiore per allontanare la palla dai piedi
        if (Math.abs(moveX) > 0 && moveZ === 0) {
            pushForce += 3;
        }

        // --- VALORI DINAMICI IN BASE ALLO STATO ---
        if (isBoosting) {
            maxDribbleSpeed = 30; // La palla può viaggiare molto veloce
            pushForce = 35;       // SPINTA FORTISSIMA (Palla lunga)
            touchInterval = 0.65; // Cooldown più lungo: deve rincorrere la palla
            if (Math.abs(moveX) > 0) pushForce += 5; // Spinta extra laterale col boost
        } else if (isRunning) {
            maxDribbleSpeed = 18;
            pushForce = 20;       // Spinta normale da corsa
            touchInterval = 0.35; // Tocchi ravvicinati
            if (Math.abs(moveX) > 0) pushForce += 4; // Più spinta laterale in corsa
        }

        // Applichiamo il tocco alla palla
        if (ball.velocity.length() < maxDribbleSpeed) {
            // Fermiamo un attimo la palla per evitare che sfugga via (controllo)
            ball.velocity.multiplyScalar(0.7);
            
            // Applichiamo la botta
            ball.applyImpulse(pushDirection.multiplyScalar(pushForce));

            // Resettiamo il timer del passo
            this.dribbleCooldown = touchInterval;
        }

        return touchType; 
    }
    // --- NUOVO: Annulla il caricamento se si esce dal raggio ---
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