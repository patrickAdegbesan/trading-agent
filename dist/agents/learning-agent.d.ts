export declare class LearningAgent {
    private model;
    private policy;
    constructor(initialModel: any, initialPolicy: any);
    retrainModel(newData: any): void;
    private trainModel;
    updatePolicy(newPolicy: any): void;
    getModel(): any;
    getPolicy(): any;
}
//# sourceMappingURL=learning-agent.d.ts.map