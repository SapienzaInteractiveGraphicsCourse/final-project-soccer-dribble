// entities/GoalKeeper.js
import * as THREE from 'three';
import { modelManager } from '../core/ModelLoader.js';
import { GoalKeeperAnimator } from '../animation-action/GoalKeeperAnimation.js';
import { PlayerAction } from '../animation-action/PlayerAction.js';

export class GoalKeeper {
    constructor(scene, ball, team, startPos, startYaw) {
        this.scene = scene;
        this.ball = ball;
        this.team = team; // 'home' (Rossi) o 'away' (Blu)
        this.startPos = startPos.clone();
        this.yaw = startYaw;
        this.model = null;
        this.isSwappedOut = false;
        this.animator = new GoalKeeperAnimator(); // Torniamo al tuo animatore base
        this.action = new PlayerAction();

        this.isTakingGoalKick = false;
        this.goalKickTimer = 0;
        this.targetReceiver = null;

        // --- FISICA ---
        // Raggio della Hitbox sferica del portiere
        this.hitboxRadius = 1.5;

        // --- CACHE VETTORI (OTTIMIZZAZIONE) ---
        this._p1 = new THREE.Vector3();
        this._p0 = new THREE.Vector3();
        this._gkCenter = new THREE.Vector3();

        this.loadGLB();
    }

    loadGLB() {
        modelManager.load('/models/player.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(1.5, 1.5, 1.5);
            this.model.position.copy(this.startPos);
            this.model.rotation.y = this.yaw;

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;

                    // Maglia personalizzata per i Portieri!
                    if (child.name === 'Ch38_Shirt') {
                        child.material = child.material.clone();
                        // Verde per i Rossi (home), Giallo per i Blu (away)
                        child.material.color.setHex(this.team === 'home' ? 0x00ff00 : 0xffff00);
                    }
                }
            });

            this.animator.initBones(this.model);
            this.scene.add(this.model);
        });
    }

    startGoalKick(receiver = null) {
        this.isTakingGoalKick = true;
        this.goalKickTimer = 0;
        this.targetReceiver = receiver;
        this.ball.isHeld = true; 
        this.ball.velocity.set(0,0,0);
    }

    update(deltaTime, activePlayerModel) {
        if (!this.model) return;

        if (this.model === activePlayerModel) return;

        if (this.isSwappedOut) return;

        // --- LOGICA RIMESSA DAL FONDO (Goal Kick) ---
        if (this.isTakingGoalKick) {
            this.goalKickTimer += deltaTime;

            let futurePos = null;
            if (this.targetReceiver && this.targetReceiver.model) {
                futurePos = this.targetReceiver.model.position.clone();
                // Prevediamo dove si troverà il giocatore basandoci sulla sua corsa
                if (this.targetReceiver.isReceivingGoalKick && this.targetReceiver.goalKickRunDir) {
                    futurePos.x += this.targetReceiver.goalKickRunDir * 10 * 0.8; 
                }
                this.yaw = Math.atan2(
                    futurePos.x - this.model.position.x,
                    futurePos.z - this.model.position.z
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

            if (this.goalKickTimer >= waitTime && this.goalKickTimer < kickTime) {
                if (!this.action.chargingAction) this.action.startCharge('pass');
                this.action.updateCharge(deltaTime, null);
            }

            if (this.goalKickTimer >= kickTime && this.action.chargingAction) {
                this.ball.isHeld = false;
                let fakeTarget = futurePos ? { model: { position: futurePos } } : null;
                this.action.executeKick(this.ball, this.yaw, -0.2, null, fakeTarget);
                this.targetReceiver = null;
            }

            if (this.goalKickTimer >= endTime) {
                this.isTakingGoalKick = false;
                this.animator.resetToBasePose();
            }

            let chargingAnim = (this.goalKickTimer >= waitTime && this.goalKickTimer < kickTime) ? 'pass' : null;
            this.animator.animate(deltaTime, false, false, false, false, chargingAnim, this.action.getChargeRatio());
            return;
        }

        // --- IA DEL PORTIERE ---
        // 1. Calcola la linea di porta
        const goalLineX = this.team === 'home' ? -48.5 : 48.5;

        // 2. Segui la palla sull'asse Z
        const targetZ = THREE.MathUtils.clamp(this.ball.position.z, -3.5, 3.5);

        // 3. Muoviti dolcemente verso la palla sulla linea
        this.model.position.x = goalLineX;
        this.model.position.z = THREE.MathUtils.lerp(this.model.position.z, targetZ, deltaTime * 2.5);

        // 4. Guarda sempre la palla
        this.yaw = Math.atan2(this.ball.position.x - this.model.position.x, this.ball.position.z - this.model.position.z);
        this.model.rotation.y = this.yaw;

        this.checkReaction();

        // --- CONTROLLO COLLISIONI (FISICA REALE) ---
        this.checkCollision(deltaTime);

        // 5. Riproduci l'animazione di movimento base
        const speed = Math.abs(this.model.position.z - targetZ);
        this.animator.animate(deltaTime, false, false, false, false, null, 0);
    }

    checkCollision(deltaTime) {
        if (!this.model || !this.ball || !this.ball.mesh) return;

        const goalLineX = this.team === 'home' ? -48.5 : 48.5;
        const pushDirX = this.team === 'home' ? 1 : -1;

        // P0 (pos. precedente) e P1 (pos. attuale)
        this._p1.copy(this.ball.position);
        this._p0.copy(this.ball.velocity).multiplyScalar(deltaTime);
        this._p0.copy(this._p1).sub(this._p0);

        // 1. HA SUPERATO LA LINEA IN QUESTO FRAME?
        const crossedLine = (this.team === 'home' && this._p0.x >= goalLineX && this._p1.x <= goalLineX) ||
            (this.team === 'away' && this._p0.x <= goalLineX && this._p1.x >= goalLineX);

        // 2. COLLISIONE CLASSICA (Palla addosso al corpo)
        this._gkCenter.set(this.model.position.x, this.model.position.y + 1.2, this.model.position.z);
        const classicCollision = this._p1.distanceTo(this._gkCenter) < (this.hitboxRadius + this.ball.radius);

        if (crossedLine || classicCollision) {

            let zIntercept = this._p1.z;
            let yIntercept = this._p1.y;

            // Se ha attraversato la linea, calcoliamo il punto esatto di intersezione con una proporzione matematica
            if (crossedLine && Math.abs(this._p1.x - this._p0.x) > 0.001) {
                const t = (goalLineX - this._p0.x) / (this._p1.x - this._p0.x);
                zIntercept = this._p0.z + t * (this._p1.z - this._p0.z);
                yIntercept = this._p0.y + t * (this._p1.y - this._p0.y);
            }

            // IL RAGGIO D'AZIONE DEL PORTIERE (Diving Reach)
            // Un portiere in tuffo può parare palloni fino a 3 metri di lato e 2.5 in alto.

            // --- NERF: RAGGIO D'AZIONE RIDOTTO ---
            // Ora i tiri molto angolati o alti hanno più chance di entrare
            const reachZ = 2.5; // Prima era 3.2
            const reachY = 2.1; // Prima era 2.5

            const isWithinReach = Math.abs(zIntercept - this.model.position.z) <= reachZ &&
                Math.abs(yIntercept - this.model.position.y) <= reachY;

            const isThreat = (this.team === 'home' && this.ball.velocity.x < 0) ||
                (this.team === 'away' && this.ball.velocity.x > 0);

            // SE IL PORTIERE CI ARRIVA FISICAMENTE
            if (isThreat && (isWithinReach || classicCollision)) {

                // --- NERF: CALCOLO VELOCITÀ E PROBABILITÀ DI ERRORE ---
                const ballSpeed = this.ball.velocity.length();
                let saveChance = 1.0; // 100% per i tiri lenti (< 20)

                // Se il tiro è normale ma forte, 20% di chance di non trattenerla
                if (ballSpeed > 20) saveChance = 0.8;

                // Se il tiro è un missile (es. Super Tiro), ha solo il 25% di chance di pararlo!
                if (ballSpeed > 40) saveChance = 0.25;

                // Estraiamo il "dado" per vedere se la para
                if (Math.random() <= saveChance) {
                    console.log("PARATA EFFETTUATA!");

                    // --- FIX ASSOLUTO PER I GOL FANTASMA ---
                    // Riportiamo fisicamente la palla fuori dalla porta (1.5 metri davanti)
                    this.ball.position.x = goalLineX + (pushDirX * 1.5);
                    this.ball.position.z = zIntercept; // La allineiamo dove è stata parata

                    // IMPORTANTE: Annulliamo eventuali flag di gol o rimessa che si sono attivati per sbaglio!
                    this.ball.isGoal = false;
                    this.ball.isOutBaseline = false;

                    // --- FISICA RESPINTA BRUSCA ---
                    this.ball.velocity.x = Math.abs(this.ball.velocity.x) * pushDirX * 0.6;
                    this.ball.velocity.y = Math.abs(this.ball.velocity.y) * 0.5 + 2.0;
                    this.ball.velocity.z *= 0.5;

                    // Se non era già partito il tuffo dai riflessi, forziamolo ora!
                    if (!this.animator.isSaving) {
                        let side;
                        if (this.team === 'home') {
                            side = zIntercept > this.model.position.z ? 'right' : 'left';
                        } else {
                            side = zIntercept > this.model.position.z ? 'left' : 'right';
                        }
                        this.animator.triggerSave(side);
                    }
                }
            }
        }
    }
    checkReaction() {
        // Se si sta già tuffando, o non c'è la palla, esci
        if (!this.model || !this.ball || this.animator.isSaving) return;

        // Se la palla va troppo piano, non c'è bisogno di tuffarsi in anticipo
        if (this.ball.velocity.lengthSq() < 10) return;

        // Calcola a che distanza si trova la palla
        const distanceToBall = this.model.position.distanceTo(this.ball.position);

        // Controlla se la palla sta effettivamente andando verso la porta
        const isApproachingHome = this.team === 'home' && this.ball.velocity.x < 0;
        const isApproachingAway = this.team === 'away' && this.ball.velocity.x > 0;

        // Se la palla è a meno di 12 metri di distanza e sta arrivando...
        if (distanceToBall < 12 && (isApproachingHome || isApproachingAway)) {

            // 1. Calcoliamo la linea di porta del portiere
            const goalLineX = this.team === 'home' ? -48.5 : 48.5;

            // 2. Prevediamo dove arriverà la palla!
            // Tempo stimato = Spazio / Velocità
            const timeToGoal = (goalLineX - this.ball.position.x) / this.ball.velocity.x;

            // Z Prevista = Posizione Z attuale + (Velocità Z * Tempo stimato)
            const predictedZ = this.ball.position.z + (this.ball.velocity.z * timeToGoal);

            // --- FIX DIREZIONE ---
            let side = 'left';
            if (this.team === 'home') {
                // Home guarda verso +X. La sua destra è verso +Z.
                // Ora confrontiamo la Z prevista, non la Z attuale!
                side = predictedZ > this.model.position.z ? 'right' : 'left';
            } else {
                // Away guarda verso -X. La sua destra è verso -Z.
                side = predictedZ > this.model.position.z ? 'left' : 'right';
            }

            this.animator.triggerSave(side);
        }
    }
}