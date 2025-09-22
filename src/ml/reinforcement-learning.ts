export class ReinforcementLearning {
    private qTable: { [key: string]: { [key: string]: number } };
    private learningRate: number;
    private discountFactor: number;
    private explorationRate: number;

    constructor(learningRate: number, discountFactor: number, explorationRate: number) {
        this.qTable = {};
        this.learningRate = learningRate;
        this.discountFactor = discountFactor;
        this.explorationRate = explorationRate;
    }

    public sampleExperience(state: string, action: string, reward: number, nextState: string): void {
        const currentQ = this.getQValue(state, action);
        const maxNextQ = this.getMaxQValue(nextState);
        const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
        this.setQValue(state, action, newQ);
    }

    private getQValue(state: string, action: string): number {
        if (!this.qTable[state]) {
            this.qTable[state] = {};
        }
        return this.qTable[state][action] || 0;
    }

    private getMaxQValue(state: string): number {
        if (!this.qTable[state]) {
            return 0;
        }
        return Math.max(...Object.values(this.qTable[state]));
    }

    private setQValue(state: string, action: string, value: number): void {
        if (!this.qTable[state]) {
            this.qTable[state] = {};
        }
        this.qTable[state][action] = value;
    }

    public chooseAction(state: string, possibleActions: string[]): string {
        if (Math.random() < this.explorationRate) {
            return possibleActions[Math.floor(Math.random() * possibleActions.length)];
        }
        return possibleActions.reduce((bestAction, action) => {
            return this.getQValue(state, action) > this.getQValue(state, bestAction) ? action : bestAction;
        });
    }

    public updateExplorationRate(newRate: number): void {
        this.explorationRate = newRate;
    }
}