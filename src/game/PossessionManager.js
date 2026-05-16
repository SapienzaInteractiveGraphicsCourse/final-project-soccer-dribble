// game/PossessionManager.js

export const MatchState = {
    HOME_POSSESSION: 'HOME_POSSESSION',
    AWAY_POSSESSION: 'AWAY_POSSESSION'
};

export class PossessionManager {
    constructor() {
        this.currentState = MatchState.HOME_POSSESSION;
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

        if (closestHomeDist <= closestAwayDist) {
            this.currentState = MatchState.HOME_POSSESSION;
        } else {
            this.currentState = MatchState.AWAY_POSSESSION;
        }
    }

    getState() {
        return this.currentState;
    }
}