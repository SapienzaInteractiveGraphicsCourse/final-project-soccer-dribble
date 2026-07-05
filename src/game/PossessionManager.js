

export const MatchState = {
    HOME_POSSESSION: 'HOME_POSSESSION',
    AWAY_POSSESSION: 'AWAY_POSSESSION'
};

export class PossessionManager {
    constructor() {
        this.currentState = MatchState.HOME_POSSESSION;
    }

    /**
     * Imposta il possesso su AWAY_POSSESSION.
     * Da chiamare SOLO nei seguenti casi:
     * - HOME ha segnato un goal (calcio d'inizio AWAY)
     * - Rimessa laterale affidata ad AWAY
     * - Calcio d'angolo affidato ad AWAY
     * - Rimessa dal fondo affidata ad AWAY
     */
    setAwayPossession() {
        this.currentState = MatchState.AWAY_POSSESSION;
    }

    /**
     * Ripristina il possesso a HOME_POSSESSION.
     * Da chiamare quando il Player (giocatore controllato dall'umano) tocca la palla.
     */
    setHomePossession() {
        this.currentState = MatchState.HOME_POSSESSION;
    }

    update(ball, player, teammates, bots, deltaTime) {
        if (!ball || !ball.isLoaded) return;

        
        
        

        if (this.currentState !== MatchState.HOME_POSSESSION) {
            const touchRadius = 1.2; 

            
            if (player && player.model) {
                
                if (player.action && (player.action.isThrowingIn || player.action.isTakingCorner || player.action.isTakingGoalKick)) {
                    this.currentState = MatchState.HOME_POSSESSION;
                    return;
                }

                const distPlayer = player.model.position.distanceTo(ball.position);
                if (distPlayer < touchRadius) {
                    this.currentState = MatchState.HOME_POSSESSION;
                    return;
                }
            }
        }
    }

    getState() {
        return this.currentState;
    }
}