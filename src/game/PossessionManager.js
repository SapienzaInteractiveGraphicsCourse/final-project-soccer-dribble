// game/PossessionManager.js

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
     * Da chiamare quando un Teammate (o il Player) tocca la palla.
     */
    setHomePossession() {
        this.currentState = MatchState.HOME_POSSESSION;
    }

    update(ball, player, teammates, bots, deltaTime) {
        if (!ball || !ball.isLoaded) return;

        // Il possesso viene gestito esclusivamente tramite eventi:
        // - setAwayPossession() per assegnare il possesso ad AWAY
        // - setHomePossession() per ripristinare il possesso a HOME
        //
        // Qui controlliamo SOLO se un giocatore HOME (Player o Teammate) tocca la palla,
        // in tal caso il possesso torna immediatamente a HOME.

        if (this.currentState !== MatchState.HOME_POSSESSION) {
            const touchRadius = 1.2; // Raggio di contatto con la palla

            // 1. Controlla il Player
            if (player && player.model) {
                const distPlayer = player.model.position.distanceTo(ball.position);
                if (distPlayer < touchRadius) {
                    this.currentState = MatchState.HOME_POSSESSION;
                    return;
                }
            }

            // 2. Controlla i Teammates
            if (teammates && teammates.length > 0) {
                for (let i = 0; i < teammates.length; i++) {
                    const t = teammates[i];
                    if (t.model) {
                        const dist = t.model.position.distanceTo(ball.position);
                        if (dist < touchRadius) {
                            this.currentState = MatchState.HOME_POSSESSION;
                            return;
                        }
                    }
                }
            }
        }
    }

    getState() {
        return this.currentState;
    }
}