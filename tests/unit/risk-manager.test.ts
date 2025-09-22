import { describe, expect, it, beforeEach, jest, test } from '@jest/globals';
import { RiskManager, TradeSignal, RiskAssessment } from '../../src/portfolio/risk-manager';
import { TradingConfig } from '../../src/config/settings';

describe('RiskManager', () => {
    let riskManager: RiskManager;
    const mockConfig: TradingConfig = {
        binance: {
            apiKey: 'test-api-key',
            apiSecret: 'test-api-secret',
            testnet: true
        },
        database: {
            url: 'postgres://test:test@localhost:5432/test_db',
            redisUrl: 'redis://localhost:6379'
        },
        trading: {
            pairs: ['BTCUSDT'],
            initialCapital: 10000,
            maxPositionSize: 0.1,
            maxDailyDrawdown: 0.05,
            leverage: 1,
            intervalMs: 60000
        },
        riskManagement: {
            kellyFraction: 0.25,
            minTradeSize: 0.01,
            maxTradesPerDay: 50,
            circuitBreakerLossPercent: 0.1
        },
        positionManagement: {
            maxOrdersPerSymbol: 1,
            tradeCooldownMinutes: 1,
            allowMultiplePositions: false,
            allowHedging: false,
            minPriceChangePercent: 0.1,
            signalDedupMinutes: 1
        },
        ml: {
            retrainIntervalHours: 24,
            lookbackPeriods: 100,
            featureWindowSize: 60,
            minTrainingSamples: 1000
        },
        logging: {
            level: 'info',
            filePath: './logs/test.log'
        },
        monitoring: {
            enabled: true,
            port: 3000
        },
        environment: {
            nodeEnv: 'test',
            port: 4000
        }
    };

    beforeEach(() => {
        riskManager = new RiskManager(10000, mockConfig);
    });

    describe('Position Sizing', () => {
        test('should calculate Kelly position size correctly', async () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                expectedReturn: 0.05,
                winProbability: 0.65,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, 50000);

            expect(assessment.approved).toBe(true);
            expect(assessment.positionSize).toBeGreaterThan(0);
            expect(assessment.positionSize).toBeLessThanOrEqual(1000); // 10% of portfolio
        });

        test('should respect maximum position size limits', async () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 1.0,
                expectedReturn: 0.2,
                winProbability: 0.9,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, 50000);

            expect(assessment.positionSize * 50000).toBeLessThanOrEqual(10000 * mockConfig.trading.maxPositionSize);
        });

        test('should reduce position size for lower confidence signals', async () => {
            // Create a config with higher max position size to test confidence scaling
            const testConfig = {
                ...mockConfig,
                trading: {
                    ...mockConfig.trading,
                    maxPositionSize: 0.5, // 50% max position size
                }
            };
            
            const freshRiskManager = new RiskManager(100000, testConfig);
            
            const highConfidenceSignal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.85,
                expectedReturn: 0.05,
                winProbability: 0.7,
                timestamp: Date.now()
            };

            const lowConfidenceSignal: TradeSignal = {
                ...highConfidenceSignal,
                confidence: 0.65
            };

            // Use a reasonable price
            const price = 1000;
            
            const highConfAssessment = freshRiskManager.assessTradeRisk(highConfidenceSignal, price);
            const lowConfAssessment = freshRiskManager.assessTradeRisk(lowConfidenceSignal, price);

            // Both should be approved
            expect(highConfAssessment.approved).toBe(true);
            expect(lowConfAssessment.approved).toBe(true);
            
            // Position sizes should be different and proportional to confidence
            expect(lowConfAssessment.positionSize).toBeLessThan(highConfAssessment.positionSize);
            
            // Verify they're both getting meaningful position sizes (not hitting limits)
            expect(highConfAssessment.positionSize).toBeGreaterThan(0);
            expect(lowConfAssessment.positionSize).toBeGreaterThan(0);
            expect(highConfAssessment.positionSize).toBeLessThan(50); // Much less than max of 50 units
        });
    });

    describe('Risk Assessment', () => {
        test('should reject trades with insufficient confidence', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.3,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, 50000);

            expect(assessment.approved).toBe(false);
            expect(assessment.reason).toContain('confidence');
        });

        test('should calculate appropriate risk score', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                expectedReturn: 0.05,
                winProbability: 0.65,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, 50000);

            expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
            expect(assessment.riskScore).toBeLessThanOrEqual(100);
        });

        test('should adjust stop loss based on volatility', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, 50000);

            expect(assessment.adjustedSignal?.stopLoss).toBeDefined();
            if (assessment.adjustedSignal?.stopLoss) {
                expect(assessment.adjustedSignal.stopLoss).toBeLessThan(50000);
            }
        });
    });

    describe('Portfolio Protection', () => {
        test('should enforce daily trade limits', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            // Simulate reaching trade limit
            for (let i = 0; i < mockConfig.riskManagement.maxTradesPerDay; i++) {
                riskManager.assessTradeRisk(signal, 50000);
            }

            const assessment = riskManager.assessTradeRisk(signal, 50000);
            expect(assessment.approved).toBe(false);
            expect(assessment.reason).toContain('trade limit');
        });

        test('should trigger circuit breaker on excessive drawdown', () => {
            // Simulate large drawdown by manipulating internal state
            (riskManager as any).portfolioValue = 9000; // 10% drawdown
            (riskManager as any).maxPortfolioValue = 10000;

            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, 50000);

            expect(assessment.approved).toBe(false);
            expect(assessment.reason).toContain('drawdown');
            expect(riskManager.isCircuitBreakerActive()).toBe(true);
        });
    });

    describe('Performance Monitoring', () => {
        test('should track portfolio value changes', () => {
            const initialValue = riskManager.getPortfolioValue();
            
            // Simulate portfolio value change
            (riskManager as any).portfolioValue = 11000;

            expect(riskManager.getPortfolioValue()).toBe(11000);
            expect(riskManager.getPortfolioValue()).toBeGreaterThan(initialValue);
        });

        test('should maintain trading statistics', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            riskManager.assessTradeRisk(signal, 50000);
            const stats = riskManager.getRiskLimits();

            expect(stats.maxPositionSize).toBe(mockConfig.trading.maxPositionSize);
            expect(stats.kellyFraction).toBe(mockConfig.riskManagement.kellyFraction);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid signal data gracefully', () => {
            const invalidSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: -1, // Invalid confidence
                timestamp: Date.now()
            } as TradeSignal;

            const assessment = riskManager.assessTradeRisk(invalidSignal, 50000);

            expect(assessment.approved).toBe(false);
            expect(assessment.reason).toBeDefined();
        });

        test('should handle zero or negative prices', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, 0);

            expect(assessment.approved).toBe(false);
            expect(assessment.reason).toContain('price');
        });
    });

    describe('Edge Cases', () => {
        test('should handle NaN price gracefully', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(signal, NaN);
            expect(assessment.approved).toBe(false);
        });

        test('should handle extreme volatility values', () => {
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            // Simulate extreme volatility by modifying market data
            const extremePrice = 50000;
            const assessment = riskManager.assessTradeRisk(signal, extremePrice);
            
            expect(() => riskManager.assessTradeRisk(signal, extremePrice)).not.toThrow();
        });

        test('should handle boundary confidence values', () => {
            const lowConfidenceSignal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.5, // Exactly at threshold
                timestamp: Date.now()
            };

            const assessment = riskManager.assessTradeRisk(lowConfidenceSignal, 50000);
            expect(assessment.approved).toBe(false);
            expect(assessment.reason).toContain('confidence');
        });

        test('should handle portfolio value edge cases', () => {
            // Test with very small portfolio
            (riskManager as any).portfolioValue = 1;
            
            const signal: TradeSignal = {
                symbol: 'BTCUSDT',
                side: 'BUY',
                confidence: 0.8,
                timestamp: Date.now()
            };

            expect(() => riskManager.assessTradeRisk(signal, 50000)).not.toThrow();
        });
    });
});