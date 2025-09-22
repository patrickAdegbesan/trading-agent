import { describe, expect, it, beforeEach } from '@jest/globals';
import { AdaptiveStrategy } from '../../src/strategies/adaptive-strategy';
import { BaseStrategy } from '../../src/strategies/base-strategy';

describe('AdaptiveStrategy', () => {
    let strategy: AdaptiveStrategy;

    beforeEach(() => {
        strategy = new AdaptiveStrategy();
    });

    it('should generate signals based on market conditions', () => {
        const marketData = { /* mock market data */ };
        const signals = strategy.generateSignals(marketData);
        expect(signals).toBeDefined();
        // Add more specific assertions based on expected signal output
    });

    it('should evaluate performance correctly', () => {
        const mockTrades = [
            { entryPrice: 100, exitPrice: 110 },
            { entryPrice: 100, exitPrice: 90 },
            { entryPrice: 100, exitPrice: 105 }
        ];
        const performance = strategy.evaluatePerformance(mockTrades);
        expect(performance).toBeDefined();
        expect(performance.totalTrades).toBe(3);
        expect(performance.winningTrades).toBe(2);
        expect(performance.losingTrades).toBe(1);
        expect(performance.winRate).toBe(2/3);
    });
});

describe('BaseStrategy', () => {
    let baseStrategy: BaseStrategy;

    beforeEach(() => {
        baseStrategy = new BaseStrategy();
    });

    it('should have a method to generate signals', () => {
        expect(typeof baseStrategy.generateSignals).toBe('function');
    });

    it('should have a method to evaluate performance', () => {
        expect(typeof baseStrategy.evaluatePerformance).toBe('function');
    });
});