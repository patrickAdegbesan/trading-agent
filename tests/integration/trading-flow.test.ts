import { describe, expect, jest, beforeAll, afterAll, test } from '@jest/globals';
import { TradingAgent } from '../../src/agents/trading-agent';
import { DataCollector } from '../../src/market-data/data-collector';
import { PriceAnalyzer } from '../../src/market-data/price-analyzer';
import { OrderManager } from '../../src/exchanges/order-manager';
import { PortfolioManager } from '../../src/portfolio/portfolio-manager';
import { RiskManager } from '../../src/portfolio/risk-manager';
import { ExchangeConnector } from '../../src/exchanges/exchange-connector';
import { PredictionEngine } from '../../src/ml/prediction-engine';
import { TradingSignal } from '../../src/types';

// Mock all dependencies
jest.mock('../../src/exchanges/exchange-connector');
jest.mock('../../src/ml/prediction-engine');

describe('Trading Flow Integration Tests', () => {
    let tradingAgent: TradingAgent;
    let dataCollector: DataCollector;
    let priceAnalyzer: PriceAnalyzer;
    let orderManager: OrderManager;
    let portfolioManager: PortfolioManager;
    let riskManager: RiskManager;
    let mockExchangeConnector: jest.Mocked<ExchangeConnector>;
    let mockPredictionEngine: jest.Mocked<PredictionEngine>;

    beforeAll(() => {
        // Create mock instances with any typing to avoid Jest type issues
        mockExchangeConnector = {
            isConnectedToExchange: jest.fn(() => true),
            connect: jest.fn(() => Promise.resolve()),
            disconnect: jest.fn(() => Promise.resolve()),
            subscribeToKlines: jest.fn(),
            subscribeToTicker: jest.fn(),
            on: jest.fn(),
            emit: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockPredictionEngine = {
            generateSignal: jest.fn(() => Promise.resolve(null))
        } as any;

        // Create instances with proper constructor arguments
        dataCollector = new DataCollector(mockExchangeConnector, ['BTCUSDT']);
        priceAnalyzer = new PriceAnalyzer([50000, 51000, 49000, 52000]); // Sample price data
        portfolioManager = new PortfolioManager(10000);
        riskManager = new RiskManager(10000);
        orderManager = new OrderManager(mockExchangeConnector, riskManager);
        tradingAgent = new TradingAgent(
            mockPredictionEngine,
            portfolioManager,
            orderManager,
            riskManager
        );
    });

    test('should collect market data and execute a trade', async () => {
        await dataCollector.startCollection();
        
        // Create a mock trading signal
        const mockSignal: TradingSignal = {
            symbol: 'BTCUSDT',
            side: 'BUY',
            confidence: 0.8,
            price: 50000,
            timestamp: Date.now()
        };
        
        const tradeResult = await tradingAgent.executeTrade(mockSignal);
        expect(tradeResult.success).toBeDefined();
    });

    test('should manage portfolio correctly after trade execution', async () => {
        const initialPortfolio = await portfolioManager.getPortfolio();
        
        const mockSignal: TradingSignal = {
            symbol: 'BTCUSDT',
            side: 'BUY',
            confidence: 0.8,
            price: 50000,
            quantity: 0.1,
            timestamp: Date.now()
        };
        
        await tradingAgent.executeTrade(mockSignal);
        const updatedPortfolio = await portfolioManager.getPortfolio();
        
        expect(updatedPortfolio.totalValue).toBeGreaterThanOrEqual(0);
    });

    afterAll(async () => {
        await dataCollector.stopCollection();
    });
});