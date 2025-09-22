export declare class ReinforcementLearning {
    private qTable;
    private learningRate;
    private discountFactor;
    private explorationRate;
    constructor(learningRate: number, discountFactor: number, explorationRate: number);
    sampleExperience(state: string, action: string, reward: number, nextState: string): void;
    private getQValue;
    private getMaxQValue;
    private setQValue;
    chooseAction(state: string, possibleActions: string[]): string;
    updateExplorationRate(newRate: number): void;
}
//# sourceMappingURL=reinforcement-learning.d.ts.map