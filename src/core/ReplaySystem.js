import * as THREE from 'three';

export class ReplaySystem {
    constructor(maxSeconds = 7, fps = 60) {
        this.maxFrames = maxSeconds * fps;
        this.buffer = [];
        this.isRecording = true;
        this.isPlaying = false;
        this.currentFrame = 0;
    }

    // Estrae in modo sicuro posizione, rotazione e STATO OSSA
    _extractState(entity) {
        if (!entity || !entity.model) return null;

        const state = {
            pos: entity.model.position.clone(),
            rot: entity.model.quaternion.clone(),
            bones: {}
        };

        // Salviamo lo stato di tutte le singole ossa animate manualmente
        if (entity.animator && entity.animator.bones) {
            for (const [boneName, bone] of Object.entries(entity.animator.bones)) {
                state.bones[boneName] = {
                    pos: bone.position.clone(),
                    rot: bone.quaternion.clone()
                };
            }
        }

        return state;
    }

    // Applica posizione, rotazione e STATO OSSA
    _applyState(entity, state) {
        if (!entity || !entity.model || !state) return;
        
        // Applica i trasform globali
        entity.model.position.copy(state.pos);
        entity.model.quaternion.copy(state.rot);

        // Applica i trasform delle singole ossa
        if (state.bones && entity.animator && entity.animator.bones) {
            for (const [boneName, boneState] of Object.entries(state.bones)) {
                const bone = entity.animator.bones[boneName];
                if (bone) {
                    bone.position.copy(boneState.pos);
                    bone.quaternion.copy(boneState.rot);
                }
            }
        }
    }
    record(entities) {
        if (!this.isRecording) return;

        const frame = {
            ball: {
                pos: entities.ball.position.clone(),
                rot: entities.ball.mesh.quaternion.clone()
            },
            player: this._extractState(entities.player),
            teammates: entities.teammates.map(t => this._extractState(t)),
            bots: entities.bots.map(b => this._extractState(b)),
            homeGK: this._extractState(entities.homeGK),
            awayGK: this._extractState(entities.awayGK),
            referee: this._extractState(entities.referee)
        };

        this.buffer.push(frame);
        if (this.buffer.length > this.maxFrames) {
            this.buffer.shift(); // Rimuove il frame più vecchio
        }
    }

    startPlayback() {
        if (this.buffer.length === 0) return;
        this.isRecording = false;
        this.isPlaying = true;
        this.currentFrame = 0;
    }

    play(entities, camera) {
        if (!this.isPlaying || this.currentFrame >= this.buffer.length) {
            this.stopPlayback();
            return false; // Replay terminato
        }

        const frame = this.buffer[this.currentFrame];

        // Applica stato palla
        entities.ball.position.copy(frame.ball.pos);
        if (entities.ball.mesh) {
            entities.ball.mesh.position.copy(frame.ball.pos);
            entities.ball.mesh.quaternion.copy(frame.ball.rot);
        }

        // Applica stato giocatori
        this._applyState(entities.player, frame.player);
        this._applyState(entities.homeGK, frame.homeGK);
        this._applyState(entities.awayGK, frame.awayGK);
        this._applyState(entities.referee, frame.referee);
        entities.teammates.forEach((t, i) => this._applyState(t, frame.teammates[i]));
        entities.bots.forEach((b, i) => this._applyState(b, frame.bots[i]));

        // Telecamera Cinematica "TV" per il Replay
        const targetCamPos = new THREE.Vector3(frame.ball.pos.x, 15, frame.ball.pos.z + 25);
        camera.position.lerp(targetCamPos, 0.05); // Movimento fluido
        camera.lookAt(frame.ball.pos);

        this.currentFrame++;
        return true; // Replay in corso
    }

    stopPlayback() {
        this.isPlaying = false;
        this.isRecording = true;
        this.buffer = [];
        this.currentFrame = 0;
    }
}