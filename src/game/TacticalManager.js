import * as THREE from 'three';

export class TacticalManager {
    constructor() {
        this.lanes = {
            LEFT: 14,
            CENTER: 0,
            RIGHT: -14
        };
        this.assignments = new Map();
    }

    // Aggiunto default = [] per teammates
    updateOffensiveLanes(player, teammates = [], ball, attackDirX) {
        if (!player || !teammates || teammates.length === 0) return;

        const playerFutureZ = (player && player.model) ? 
            player.model.position.z + (player.velocity ? player.velocity.z * 1.0 : 0) : 0;

        let playerLane = 'CENTER';
        if (playerFutureZ > 7) playerLane = 'LEFT';
        else if (playerFutureZ < -7) playerLane = 'RIGHT';

        const availableLanes = Object.keys(this.lanes).filter(lane => lane !== playerLane);
        const unassignedBots = [...teammates]; // Ora è sicuro perché teammates è un array garantito

        unassignedBots.forEach(bot => {
            if (!bot.id) bot.id = Math.random().toString(36).substr(2, 9);
            
            let bestLane = null;
            let bestScore = -Infinity;

            availableLanes.forEach(laneName => {
                const laneZ = this.lanes[laneName];
                let score = 0;

                const distZ = Math.abs(bot.model.position.z - laneZ);
                score -= distZ * 5; 

                if (this.assignments.get(bot.id) === laneName) {
                    score += 50; 
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestLane = laneName;
                }
            });

            if (bestLane) {
                this.assignments.set(bot.id, bestLane);
                const index = availableLanes.indexOf(bestLane);
                if (index > -1) availableLanes.splice(index, 1);
            }
        });
    }

    getAssignedLaneZ(botId) {
        const laneName = this.assignments.get(botId);
        return laneName ? this.lanes[laneName] : 0;
    }
}

export const tacticalManager = new TacticalManager();