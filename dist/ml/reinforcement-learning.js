"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReinforcementLearning = void 0;
class ReinforcementLearning {
    constructor(learningRate, discountFactor, explorationRate) {
        this.qTable = {};
        this.learningRate = learningRate;
        this.discountFactor = discountFactor;
        this.explorationRate = explorationRate;
    }
    sampleExperience(state, action, reward, nextState) {
        const currentQ = this.getQValue(state, action);
        const maxNextQ = this.getMaxQValue(nextState);
        const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
        this.setQValue(state, action, newQ);
    }
    getQValue(state, action) {
        if (!this.qTable[state]) {
            this.qTable[state] = {};
        }
        return this.qTable[state][action] || 0;
    }
    getMaxQValue(state) {
        if (!this.qTable[state]) {
            return 0;
        }
        return Math.max(...Object.values(this.qTable[state]));
    }
    setQValue(state, action, value) {
        if (!this.qTable[state]) {
            this.qTable[state] = {};
        }
        this.qTable[state][action] = value;
    }
    chooseAction(state, possibleActions) {
        if (Math.random() < this.explorationRate) {
            return possibleActions[Math.floor(Math.random() * possibleActions.length)];
        }
        return possibleActions.reduce((bestAction, action) => {
            return this.getQValue(state, action) > this.getQValue(state, bestAction) ? action : bestAction;
        });
    }
    updateExplorationRate(newRate) {
        this.explorationRate = newRate;
    }
}
exports.ReinforcementLearning = ReinforcementLearning;
//# sourceMappingURL=reinforcement-learning.js.map