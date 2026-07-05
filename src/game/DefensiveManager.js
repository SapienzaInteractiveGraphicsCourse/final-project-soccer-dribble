import * as THREE from 'three';

export class DefensiveManager {
    constructor() {
        this.assignments = new Map();
    }

    updateDefensiveAssignments(teammates = [], opponents = [], ball, attackDirX) {
        if (!teammates || teammates.length === 0 || !opponents || opponents.length === 0) return;

        const myGoalX = -49.5 * attackDirX; 
        const goalPos = new THREE.Vector3(myGoalX, 0, 0);

        
        teammates.forEach(t => {
            if (!t.id) t.id = Math.random().toString(36).substr(2, 9);
        });
        opponents.forEach(o => {
            if (!o.id) o.id = Math.random().toString(36).substr(2, 9);
        });

        
        const opponentScores = new Map();
        
        opponents.forEach(opp => {
            let score = 0;
            const oppPos = opp.model ? opp.model.position : opp.position;
            
            
            const distToGoal = oppPos.distanceTo(goalPos);
            score += Math.max(0, 100 - distToGoal) * 2.0;
            
            if (ball && ball.isLoaded) {
                
                const distToBall = oppPos.distanceTo(ball.position);
                score += Math.max(0, 80 - distToBall) * 1.5;

                
                const dirToGoal = new THREE.Vector3().subVectors(goalPos, ball.position).normalize();
                const dirToOpp = new THREE.Vector3().subVectors(oppPos, ball.position).normalize();
                const dot = dirToGoal.dot(dirToOpp);
                if (dot > 0.5) { 
                    score += 30; 
                }
            }

            
            if (opp._moveDir) {
                const dirToGoal = new THREE.Vector3().subVectors(goalPos, oppPos).normalize();
                const dotMove = opp._moveDir.dot(dirToGoal);
                if (dotMove > 0) {
                    score += dotMove * 25;
                }
            }
            
            opponentScores.set(opp.id, score);
        });

        let availableOpponents = [...opponents];
        
        
        teammates.forEach(bot => {
            let bestOpponent = null;
            let bestScore = -Infinity;

            availableOpponents.forEach(opp => {
                const oppPos = opp.model ? opp.model.position : opp.position;
                
                let score = opponentScores.get(opp.id);
                
                
                const distToOpp = bot.model.position.distanceTo(oppPos);
                score -= distToOpp * 3.5; 
                
                
                if (this.assignments.get(bot.id) === opp.id) {
                    score += 60; 
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestOpponent = opp;
                }
            });

            if (bestOpponent) {
                this.assignments.set(bot.id, bestOpponent.id);
                
                availableOpponents = availableOpponents.filter(o => o.id !== bestOpponent.id);
            } else {
                this.assignments.delete(bot.id);
            }
        });
    }

    getAssignedOpponent(botId, opponents) {
        const oppId = this.assignments.get(botId);
        if (oppId && opponents) {
            return opponents.find(o => o.id === oppId) || null;
        }
        return null;
    }
}

export const defensiveManager = new DefensiveManager();
