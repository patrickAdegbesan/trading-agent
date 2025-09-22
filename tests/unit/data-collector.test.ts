import { describe, expect, jest, beforeEach, test, beforeAll, afterAll, afterEach } from '@jest/globals';
import { DataCollector } from '../../src/market-data/data-collector';
import { ExchangeConnector, KlineData, TickerData } from '../../src/exchanges/exchange-connector';
import { EventEmitter } from 'events';
import winston from 'winston';

// Create mock class
class MockExchangeConnector extends EventEmitter {
    client = {};
    futuresClient = {};
    wsConnections = new Map();
    logger = winston.createLogger({
        level: 'info',
        transports: [new winston.transports.Console()]
    });
    isConnected = true;
    apiKey = 'key';
    apiSecret = 'secret';
    testnet = true;
    rateLimitCount = 0;
    rateLimitReset = 0;

    isConnectedToExchange = jest.fn<() => boolean>().mockReturnValue(true);
    connect = jest.fn<() => Promise<void>>().mockResolvedValue(void 0);
    disconnect = jest.fn<() => Promise<void>>().mockResolvedValue(void 0);
    subscribeToKlines = jest.fn<(symbol: string, interval: string) => void>();
    subscribeToTicker = jest.fn<(symbol: string) => void>();
    getKlines = jest.fn<(symbol: string, interval: string, limit?: number) => Promise<KlineData[]>>()
        .mockResolvedValue([{
            symbol: 'BTCUSDT',
            openTime: Date.now(),
            closeTime: Date.now() + 60000,
            open: '50000',
            high: '51000',
            low: '49000',
            close: '50500',
            volume: '100',
            trades: 100
        }]);
    getTickerData = jest.fn<(symbol: string) => Promise<TickerData | null>>()
        .mockResolvedValue({
            symbol: 'BTCUSDT',
            price: '50000',
            change: '1000',
            changePercent: '2',
            volume: '100',
            quoteVolume: '5000000'
        });
    healthCheck = jest.fn<() => Promise<{ status: string; latency: number }>>()
        .mockResolvedValue({
            status: 'healthy',
            latency: 100
        });
        
    // Implement required interface methods
    getTickerPrice = jest.fn<(symbol: string) => Promise<TickerData>>()
        .mockResolvedValue({
            symbol: 'BTCUSDT',
            price: '50000',
            change: '1000',
            changePercent: '2',
            volume: '100',
            quoteVolume: '5000000'
        });

    placeOrder = jest.fn<(data: any) => Promise<any>>()
        .mockResolvedValue({
            orderId: 1,
            symbol: 'BTCUSDT',
            status: 'FILLED'
        });

    placeOCOOrder = jest.fn<(symbol: string, side: string, quantity: string, price: string, stopPrice: string, stopLimitPrice: string) => Promise<any>>()
        .mockResolvedValue({
            orderListId: 1,
            symbol: 'BTCUSDT',
            status: 'FILLED'
        });

    cancelOrder = jest.fn<(symbol: string, orderId: number) => Promise<any>>()
        .mockResolvedValue({
            orderId: 1,
            symbol: 'BTCUSDT',
            status: 'CANCELED'
        });

    getOpenOrders = jest.fn<(symbol?: string) => Promise<any[]>>()
        .mockResolvedValue([]);

    getAccountInfo = jest.fn<() => Promise<any>>()
        .mockResolvedValue({
            accountType: 'SPOT',
            canTrade: true,
            balances: []
        });

    checkRateLimit = jest.fn<() => void>();
}

// Mock ExchangeConnector
jest.mock('../../src/exchanges/exchange-connector', () => ({
    ExchangeConnector: jest.fn().mockImplementation(() => new MockExchangeConnector())
}));

describe('DataCollector', () => {
    let dataCollector: DataCollector;
    let mockExchangeConnector: jest.Mocked<ExchangeConnector>;
    const originalSetInterval = global.setInterval;
    const originalSetTimeout = global.setTimeout;

    beforeAll(() => {
        // Mock timers to avoid dangling timers
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
        global.setInterval = originalSetInterval;
        global.setTimeout = originalSetTimeout;
    });

    beforeEach(() => {
        // Create mock ExchangeConnector instance
        mockExchangeConnector = new MockExchangeConnector() as unknown as jest.Mocked<ExchangeConnector>;
        
        // Create data collector instance with test symbols
        dataCollector = new DataCollector(mockExchangeConnector, ['BTCUSDT']);
    });

    afterEach(async () => {
        // Clean up any active data collection
        await dataCollector?.stopCollection();
        jest.clearAllMocks();
    });

    test('should start collection successfully', async () => {
        await dataCollector.startCollection();
        expect(mockExchangeConnector.isConnectedToExchange).toHaveBeenCalled();
        expect(mockExchangeConnector.subscribeToKlines).toHaveBeenCalledWith('BTCUSDT', '1m');
        expect(mockExchangeConnector.subscribeToTicker).toHaveBeenCalledWith('BTCUSDT');
        expect(dataCollector.isCollectingData()).toBe(true);
    });

    test('should handle market data updates', () => {
        // Simulate kline data
        const mockKlineData: KlineData = {
            symbol: 'BTCUSDT',
            openTime: Date.now(),
            closeTime: Date.now() + 60000,
            open: '50000',
            high: '51000',
            low: '49000',
            close: '50500',
            volume: '100',
            trades: 100
        };

        mockExchangeConnector.emit('kline', mockKlineData);

        // Check current price is updated
        expect(dataCollector.getCurrentPrice('BTCUSDT')).toBe(50500);

        // Get latest data point
        const latestData = dataCollector.getLatestData('BTCUSDT');
        expect(latestData).toBeDefined();
        expect(latestData?.close).toBe(50500);
    });

    test('should store historical data correctly', () => {
        // Simulate multiple kline updates
        const times = [1000, 2000, 3000];
        const prices = [50000, 51000, 52000];

        times.forEach((time, index) => {
            mockExchangeConnector.emit('kline', {
                symbol: 'BTCUSDT',
                openTime: time,
                closeTime: time + 60000,
                open: prices[index].toString(),
                high: (prices[index] + 100).toString(),
                low: (prices[index] - 100).toString(),
                close: prices[index].toString(),
                volume: '100',
                trades: 100
            });
        });

        // Get historical data
        const history = dataCollector.getHistoricalData('BTCUSDT');
        expect(history.length).toBe(3);
        expect(history[2].close).toBe(52000); // Latest price
    });

    test('should stop collection properly', async () => {
        await dataCollector.startCollection();
        await dataCollector.stopCollection();

        expect(mockExchangeConnector.disconnect).toHaveBeenCalled();
        expect(dataCollector.isCollectingData()).toBe(false);
    });

    test('should handle error conditions', async () => {
        // Test connection failure
        mockExchangeConnector.isConnectedToExchange.mockReturnValueOnce(false);
        
        await expect(dataCollector.startCollection()).rejects.toThrow(
            'Exchange must be connected before starting data collection'
        );

        // Test invalid kline data
        mockExchangeConnector.emit('kline', {
            symbol: 'BTCUSDT',
            openTime: Date.now(),
            closeTime: Date.now() + 60000,
            open: 'invalid',
            high: '51000',
            low: '49000',
            close: '50500',
            volume: '100',
            trades: 100
        } as KlineData);

        // Current price should not be updated with invalid data
        expect(dataCollector.getCurrentPrice('BTCUSDT')).toBeUndefined();
    });

    test('should provide market snapshot', () => {
        // Simulate market data
        mockExchangeConnector.emit('kline', {
            symbol: 'BTCUSDT',
            openTime: Date.now(),
            closeTime: Date.now() + 60000,
            open: '50000',
            high: '51000',
            low: '49000',
            close: '50500',
            volume: '100',
            trades: 100
        });

        const snapshot = dataCollector.getMarketSnapshot();
        expect(snapshot.symbols.has('BTCUSDT')).toBe(true);
        expect(snapshot.symbols.get('BTCUSDT')?.close).toBe(50500);
    });

    test('should handle missing buffers and null/empty values', () => {
        // Test getLatestData with non-existent symbol
        expect(dataCollector.getLatestData('NONEXISTENT')).toBeUndefined();

        // Test getHistoricalData with non-existent symbol
        expect(dataCollector.getHistoricalData('NONEXISTENT')).toEqual([]);

        // Test getCurrentPrice with non-existent symbol
        expect(dataCollector.getCurrentPrice('NONEXISTENT')).toBeUndefined();
    });

    test('should handle buffer operations', () => {
        // Clear all buffers
        dataCollector.clearBuffers();

        // Check buffer stats after clearing
        const stats = dataCollector.getBufferStats();
        expect(stats.get('BTCUSDT')).toBeDefined();
        expect(stats.get('BTCUSDT')!.size).toBe(0);
        expect(stats.get('BTCUSDT')!.lastUpdate).toBe(0);

        // Get all current prices when empty
        const prices = dataCollector.getAllCurrentPrices();
        expect(prices.size).toBe(0);
    });

    test('should handle reconnection attempts', () => {
        // Simulate WebSocket error
        mockExchangeConnector.emit('wsError', { streamName: 'BTCUSDT@kline_1m', error: new Error('Connection lost') });

        // Check that reconnection is attempted
        expect(mockExchangeConnector.subscribeToKlines).toHaveBeenCalled();
        expect(mockExchangeConnector.subscribeToTicker).toHaveBeenCalled();
    });

    test('should handle invalid kline data', () => {
        // Simulate kline data with missing fields
        mockExchangeConnector.emit('kline', {
            symbol: 'BTCUSDT',
            openTime: Date.now(),
            closeTime: Date.now() + 60000
        } as KlineData);

        // Simulate kline data with extreme price movement
        mockExchangeConnector.emit('kline', {
            symbol: 'BTCUSDT',
            openTime: Date.now(),
            closeTime: Date.now() + 60000,
            open: '50000',
            high: '100000', // 100% increase
            low: '49000',
            close: '100000',
            volume: '100',
            trades: 100
        });

        // Simulate kline data with inconsistent OHLC values
        mockExchangeConnector.emit('kline', {
            symbol: 'BTCUSDT',
            openTime: Date.now(),
            closeTime: Date.now() + 60000,
            open: '50000',
            high: '49000', // High less than open
            low: '48000',
            close: '48500',
            volume: '100',
            trades: 100
        });

        // None of these should update the current price
        expect(dataCollector.getCurrentPrice('BTCUSDT')).toBeUndefined();
    });
});