import { describe, expect, jest, beforeEach, test } from '@jest/globals';
import { TradingAgent } from '../../src/agents/trading-agent';
import { TradingSignal, TradeResult, Portfolio } from '../../src/types';

// Mock dependencies
jest.mock('../../src/ml/prediction-engine');
jest.mock('../../src/portfolio/portfolio-manager');
jest.mock('../../src/exchanges/order-manager');
jest.mock('../../src/portfolio/risk-manager');

describe('TradingAgent', () => {
    let tradingAgent: TradingAgent;
    let mockPredictionEngine: any;
    let mockPortfolioManager: any;
    let mockOrderManager: any;
    let mockRiskManager: any;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create mock instances
        mockPredictionEngine = {
            generateSignal: jest.fn()
        };

        mockPortfolioManager = {
            getPortfolio: jest.fn(),
            updateAfterTrade: jest.fn(),
            closeAllPositions: jest.fn(),
            getBalance: jest.fn(),
            updateMetrics: jest.fn(),
            on: jest.fn(),
            emit: jest.fn(),
            removeAllListeners: jest.fn()
        };

        mockOrderManager = {
            submitOrder: jest.fn(),
            getActiveOrders: jest.fn(),
            cancelOrder: jest.fn(),
            on: jest.fn(),
            emit: jest.fn(),
            removeAllListeners: jest.fn()
        };

        mockRiskManager = {
            evaluatePosition: jest.fn(),
            assessTradeRisk: jest.fn(),
            on: jest.fn(),
            emit: jest.fn(),
            removeAllListeners: jest.fn()
        };

        // Set up default return values
        mockPredictionEngine.generateSignal.mockResolvedValue(null);
        mockPortfolioManager.getPortfolio.mockResolvedValue({ totalValue: 10000, positions: {} });
        mockPortfolioManager.updateAfterTrade.mockResolvedValue(undefined);
        mockPortfolioManager.closeAllPositions.mockResolvedValue(undefined);
        mockPortfolioManager.getBalance.mockReturnValue(10000);
        mockPortfolioManager.updateMetrics.mockResolvedValue(undefined);
        
        mockOrderManager.submitOrder.mockResolvedValue({ success: true, orderId: 'test' });
        mockOrderManager.getActiveOrders.mockResolvedValue([]);
        mockOrderManager.cancelOrder.mockResolvedValue(undefined);
        
        mockRiskManager.evaluatePosition.mockResolvedValue(0.1);
        mockRiskManager.assessTradeRisk.mockReturnValue({
            approved: true,
            positionSize: 0.1,
            riskScore: 50
        });

        // Initialize trading agent with mocks
        tradingAgent = new TradingAgent(
            mockPredictionEngine,
            mockPortfolioManager,
            mockOrderManager,
            mockRiskManager
        );
    });

    describe('Trade Execution', () => {
        const mockSignal: TradingSignal = {
            symbol: 'BTCUSDT',
            side: 'BUY',
            confidence: 0.85,
            price: 50000,
            timestamp: Date.now(),
            quantity: 0.1
        };

        const mockTradeResult: TradeResult = {
            success: true,
            orderId: 'test_order_1',
            details: {
                symbol: 'BTCUSDT',
                side: 'BUY',
                quantity: 0.1,
                price: 50000,
                type: 'LIMIT',
                timestamp: Date.now()
            }
        };

        test('should execute trade successfully with valid signal', async () => {
            mockOrderManager.submitOrder.mockResolvedValue(mockTradeResult);
            mockRiskManager.evaluatePosition.mockResolvedValue(0.1);
            mockPortfolioManager.getPortfolio.mockResolvedValue({
                totalValue: 100000,
                positions: {}
            });

            const result = await tradingAgent.executeTrade(mockSignal);

            expect(result.success).toBe(true);
            expect(mockOrderManager.submitOrder).toHaveBeenCalled();
            expect(mockPortfolioManager.updateAfterTrade).toHaveBeenCalled();
        });

        test('should handle trade execution failure gracefully', async () => {
            const errorMessage = 'Insufficient funds';
            mockOrderManager.submitOrder.mockRejectedValue(new Error(errorMessage));

            const result = await tradingAgent.executeTrade(mockSignal);

            expect(result.success).toBe(false);
            expect(result.reason).toContain(errorMessage);
            expect(mockPortfolioManager.updateAfterTrade).not.toHaveBeenCalled();
        });

        test('should reject trades with insufficient confidence', async () => {
            const lowConfidenceSignal: TradingSignal = {
                ...mockSignal,
                confidence: 0.3
            };

            const result = await tradingAgent.executeTrade(lowConfidenceSignal);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('confidence');
            expect(mockOrderManager.submitOrder).not.toHaveBeenCalled();
        });
    });

    describe('Emergency Controls', () => {
        test('should execute emergency stop successfully', async () => {
            const mockActiveOrders = [
                { id: 'order1', symbol: 'BTCUSDT', status: 'PENDING', quantity: 0.1, price: 50000 },
                { id: 'order2', symbol: 'ETHUSDT', status: 'PENDING', quantity: 1.0, price: 3000 }
            ];

            mockOrderManager.getActiveOrders.mockResolvedValueOnce(mockActiveOrders);
            mockOrderManager.cancelOrder.mockResolvedValue(undefined);
            
            await tradingAgent.emergencyStop();

            expect(mockOrderManager.cancelOrder).toHaveBeenCalledTimes(2);
            expect(mockOrderManager.cancelOrder).toHaveBeenCalledWith('order1', 'BTCUSDT');
            expect(mockOrderManager.cancelOrder).toHaveBeenCalledWith('order2', 'ETHUSDT');
        });

        test('should handle errors during emergency stop', async () => {
            mockOrderManager.getActiveOrders.mockRejectedValueOnce(new Error('Network error'));
            
            await expect(tradingAgent.emergencyStop()).rejects.toThrow('Network error');
        });
    });

    describe('Trading Loop', () => {
        test('should start and stop trading loop correctly', () => {
            // Start trading
            tradingAgent.setActive(true);
            expect(tradingAgent['isActive']).toBe(true);

            // Stop trading
            tradingAgent.setActive(false);
            expect(tradingAgent['isActive']).toBe(false);
        });

        test('should handle errors in trading loop gracefully', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockPredictionEngine.generateSignal.mockRejectedValue(new Error('Prediction failed'));

            tradingAgent.setActive(true);
            await tradingAgent.run();

            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('Event Handling', () => {
        const mockSignal: TradingSignal = {
            symbol: 'BTCUSDT',
            side: 'BUY',
            confidence: 0.85,
            price: 50000,
            quantity: 0.1,
            timestamp: Date.now()
        };

        const mockTradeResult: TradeResult = {
            success: true,
            orderId: 'test_order_1',
            details: {
                symbol: 'BTCUSDT',
                side: 'BUY',
                quantity: 0.1,
                price: 50000,
                type: 'LIMIT',
                timestamp: Date.now()
            }
        };

        test('should emit trade events correctly', async () => {
            const eventSpy = jest.spyOn(tradingAgent as any, 'emit');
            
            mockOrderManager.submitOrder.mockResolvedValue(mockTradeResult);
            mockRiskManager.evaluatePosition.mockResolvedValue(0.1);
            mockPortfolioManager.getPortfolio.mockResolvedValue({
                totalValue: 100000,
                positions: {}
            });

            await tradingAgent.executeTrade(mockSignal);

            expect(eventSpy).toHaveBeenCalledWith('trade', expect.any(Object));
            eventSpy.mockRestore();
        });

        test('should emit error events on failure', async () => {
            const eventSpy = jest.spyOn(tradingAgent as any, 'emit');
            mockOrderManager.submitOrder.mockRejectedValue(new Error('Order failed'));

            await tradingAgent.executeTrade(mockSignal);

            expect(eventSpy).toHaveBeenCalledWith('error', expect.any(Object));
            eventSpy.mockRestore();
        });
    });
});