// game/PossessionManager.js

export const MatchState = {
    HOME_POSSESSION: 'HOME_POSSESSION',
    AWAY_POSSESSION: 'AWAY_POSSESSION',
    FREE_BALL: 'FREE_BALL'
};

export class PossessionManager {
    constructor() {
        this.currentState = MatchState.FREE_BALL;
        // Distanza massima (in unità di Three.js) per considerare la palla "al piede" di un giocatore
        this.possessionThreshold = 1.5; 
    }

    update(ball, player, teammates, bots) {
        if (!ball || !ball.isLoaded) return;

        let closestHomeDist = Infinity;
        let closestAwayDist = Infinity;

        // 1. Distanza del Player (Team Home)
        if (player && player.model) {
            closestHomeDist = Math.min(closestHomeDist, player.model.position.distanceTo(ball.position));
        }

        // 2. Distanze dei Teammates (Team Home)
        if (teammates && teammates.length > 0) {
            teammates.forEach(t => {
                if (t.model) {
                    closestHomeDist = Math.min(closestHomeDist, t.model.position.distanceTo(ball.position));
                }
            });
        }

        // 3. Distanze dei Bots (Team Away)
        if (bots && bots.length > 0) {
            bots.forEach(b => {
                if (b.model) {
                    closestAwayDist = Math.min(closestAwayDist, b.model.position.distanceTo(ball.position));
                }
            });
        }

        // 4. Valutazione e assegnazione dello stato
        if (closestHomeDist <= this.possessionThreshold && closestHomeDist < closestAwayDist) {
            this.currentState = MatchState.HOME_POSSESSION;
        } else if (closestAwayDist <= this.possessionThreshold && closestAwayDist < closestHomeDist) {
            this.currentState = MatchState.AWAY_POSSESSION;
        } else {
            // Se nessuno è abbastanza vicino, la palla è libera (es. lancio lungo, rimpallo)
            this.currentState = MatchState.FREE_BALL;
        }
    }

    getState() {
        return this.currentState;
    }
}