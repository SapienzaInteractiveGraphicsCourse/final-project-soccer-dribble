// game/PossessionManager.js

export const MatchState = {
    HOME_POSSESSION: 'HOME_POSSESSION',
    AWAY_POSSESSION: 'AWAY_POSSESSION',
    FREE_BALL: 'FREE_BALL'
};

export class PossessionManager {
    constructor() {
        this.currentState = MatchState.FREE_BALL;
        this.possessionThreshold = 4.0; 
        
        // NUOVO: Sistema di tolleranza (Delay)
        this.freeBallTimer = 0;
        this.freeBallDelay = 1; // Secondi di volo della palla prima di dichiararla "libera"
    }

    update(ball, player, teammates, bots, deltaTime) {
        if (!ball || !ball.isLoaded) return;

        let closestHomeDist = Infinity;
        let closestAwayDist = Infinity;

        // 1. Distanza del Player
        if (player && player.model) {
            closestHomeDist = Math.min(closestHomeDist, player.model.position.distanceTo(ball.position));
        }

        // 2. Distanze dei Teammates
        if (teammates && teammates.length > 0) {
            teammates.forEach(t => {
                if (t.model) {
                    closestHomeDist = Math.min(closestHomeDist, t.model.position.distanceTo(ball.position));
                }
            });
        }

        // 3. Distanze dei Bots
        if (bots && bots.length > 0) {
            bots.forEach(b => {
                if (b.model) {
                    closestAwayDist = Math.min(closestAwayDist, b.model.position.distanceTo(ball.position));
                }
            });
        }

        const absoluteClosestDist = Math.min(closestHomeDist, closestAwayDist);

        // --- NUOVA LOGICA CON TIMER ---
        if (absoluteClosestDist > this.possessionThreshold) {
            // La palla è lontana, ma non cambiamo subito stato. Incrementiamo il timer.
            this.freeBallTimer += deltaTime;
            
            // Cambia in FREE_BALL solo se la palla ha volato da sola per più di 0.6 secondi
            if (this.freeBallTimer >= this.freeBallDelay) {
                this.currentState = MatchState.FREE_BALL;
            }
        } else {
            // Appena qualcuno tocca o si avvicina alla palla, il timer si azzera istantaneamente
            this.freeBallTimer = 0;
            
            if (closestHomeDist < closestAwayDist) {
                this.currentState = MatchState.HOME_POSSESSION;
            } else {
                this.currentState = MatchState.AWAY_POSSESSION;
            }
        }
    }

    getState() {
        return this.currentState;
    }
}