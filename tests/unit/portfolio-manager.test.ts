import { describe, expect, jest, beforeEach, test } from '@jest/globals';
import { PortfolioManager } from '../../src/portfolio/portfolio-manager';

// Define the trade interface that PortfolioManager expects
interface TradeData {
    symbol: string;
    quantity: number;
    price: number;
    timestamp: number;
}

describe('PortfolioManager', () => {
    let portfolioManager: PortfolioManager;
    const initialCash = 10000;

    beforeEach(() => {
        portfolioManager = new PortfolioManager(initialCash);
    });

    describe('Portfolio Operations', () => {
        test('should initialize with correct cash balance', () => {
            expect(portfolioManager.getBalance()).toBe(initialCash);
        });

        test('should return correct portfolio structure', async () => {
            const portfolio = await portfolioManager.getPortfolio();
            expect(portfolio).toHaveProperty('totalValue');
            expect(portfolio).toHaveProperty('positions');
            expect(portfolio.totalValue).toBe(initialCash);
            expect(Object.keys(portfolio.positions).length).toBe(0);
        });

        test('should update position after trade', async () => {
            const trade: TradeData = {
                symbol: 'BTCUSDT',
                quantity: 0.1,
                price: 50000,
                timestamp: Date.now()
            };

            await portfolioManager.updateAfterTrade(trade);
            const portfolio = await portfolioManager.getPortfolio();
            
            expect(portfolio.positions['BTCUSDT']).toBe(0.1);
        });

        test('should accumulate positions correctly', async () => {
            const trades: TradeData[] = [
                {
                    symbol: 'BTCUSDT',
                    quantity: 0.1,
                    price: 50000,
                    timestamp: Date.now()
                },
                {
                    symbol: 'BTCUSDT',
                    quantity: 0.2,
                    price: 51000,
                    timestamp: Date.now()
                }
            ];

            await portfolioManager.updateAfterTrade(trades[0]);
            await portfolioManager.updateAfterTrade(trades[1]);
            
            const portfolio = await portfolioManager.getPortfolio();
            expect(Number(portfolio.positions['BTCUSDT'].toFixed(8))).toBe(0.3);
        });

        test('should handle selling trades correctly', async () => {
            const trades: TradeData[] = [
                {
                    symbol: 'BTCUSDT',
                    quantity: 0.3,
                    price: 50000,
                    timestamp: Date.now()
                },
                {
                    symbol: 'BTCUSDT',
                    quantity: -0.1, // Selling 0.1 BTC
                    price: 51000,
                    timestamp: Date.now()
                }
            ];

            await portfolioManager.updateAfterTrade(trades[0]);
            await portfolioManager.updateAfterTrade(trades[1]);
            
            const portfolio = await portfolioManager.getPortfolio();
            expect(Number(portfolio.positions['BTCUSDT'].toFixed(8))).toBe(0.2);
        });
    });

    describe('Position Management', () => {
        test('should close all positions', async () => {
            const trade: TradeData = {
                symbol: 'BTCUSDT',
                quantity: 0.1,
                price: 50000,
                timestamp: Date.now()
            };

            await portfolioManager.updateAfterTrade(trade);
            await portfolioManager.closeAllPositions();
            
            const portfolio = await portfolioManager.getPortfolio();
            expect(Object.keys(portfolio.positions).length).toBe(0);
        });

        test('should update metrics correctly', async () => {
            const trade: TradeData = {
                symbol: 'BTCUSDT',
                quantity: 0.1,
                price: 50000,
                timestamp: Date.now()
            };

            await portfolioManager.updateAfterTrade(trade);
            await portfolioManager.updateMetrics();
            
            const portfolio = await portfolioManager.getPortfolio();
            expect(portfolio.totalValue).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid trade data', async () => {
            const invalidTrade: TradeData = {
                symbol: '',
                quantity: 0,
                price: -1,
                timestamp: Date.now()
            };

            await expect(portfolioManager.updateAfterTrade(invalidTrade))
                .rejects
                .toThrow();
        });

        test('should handle undefined trade data', async () => {
            const undefinedTrade = {
                symbol: 'BTCUSDT',
                quantity: undefined as unknown as number,
                price: 50000,
                timestamp: Date.now()
            } as TradeData;

            await expect(portfolioManager.updateAfterTrade(undefinedTrade))
                .rejects
                .toThrow();
        });
    });

    describe('Event Emission', () => {
        test('should emit position update event', async () => {
            const mockCallback = jest.fn();
            portfolioManager.on('positionUpdate', mockCallback);

            const trade: TradeData = {
                symbol: 'BTCUSDT',
                quantity: 0.1,
                price: 50000,
                timestamp: Date.now()
            };

            await portfolioManager.updateAfterTrade(trade);
            expect(mockCallback).toHaveBeenCalled();
        });

        test('should emit metrics update event', async () => {
            const mockCallback = jest.fn();
            portfolioManager.on('metricsUpdate', mockCallback);

            const trade: TradeData = {
                symbol: 'BTCUSDT',
                quantity: 0.1,
                price: 50000,
                timestamp: Date.now()
            };

            await portfolioManager.updateAfterTrade(trade);
            await portfolioManager.updateMetrics();
            expect(mockCallback).toHaveBeenCalled();
        });
    });
});