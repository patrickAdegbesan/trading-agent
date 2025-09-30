"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeConnector = void 0;
const binance_api_node_1 = __importDefault(require("binance-api-node"));
const events_1 = require("events");
const winston_1 = __importDefault(require("winston"));
const reconnecting_websocket_1 = __importDefault(require("reconnecting-websocket"));
const ws_1 = __importDefault(require("ws"));
const bybit_connector_1 = require("./bybit-connector");
const settings_1 = require("../config/settings");
class ExchangeConnector extends events_1.EventEmitter {
    constructor(apiKey, apiSecret, testnet = true) {
        super();
        this.wsConnections = new Map();
        this.isConnected = false;
        this.rateLimitCount = 0;
        this.rateLimitReset = 0;
        this.priceCache = new Map();
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.testnet = testnet;
        this.isUsingBybit = settings_1.settings.exchange === 'bybit';
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({ filename: 'logs/exchange.log' })
            ]
        });
        if (this.isUsingBybit) {
            this.bybitConnector = new bybit_connector_1.BybitConnector(settings_1.settings.bybit.apiKey, settings_1.settings.bybit.apiSecret, testnet);
        }
    }
    async connect() {
        try {
            if (settings_1.settings.exchange === 'bybit') {
                this.logger.info('Connecting to Bybit API...', { testnet: this.testnet });
                if (!this.bybitConnector) {
                    this.bybitConnector = new bybit_connector_1.BybitConnector(this.apiKey, this.apiSecret, this.testnet);
                }
                const success = await this.bybitConnector.connect();
                if (!success) {
                    throw new Error('Failed to connect to Bybit');
                }
                this.isConnected = true;
                this.logger.info('Successfully connected to Bybit');
                this.emit('connected');
            }
            else {
                // Binance connection
                this.logger.info('Connecting to Binance API...', { testnet: this.testnet });
                this.client = (0, binance_api_node_1.default)({
                    apiKey: this.apiKey,
                    apiSecret: this.apiSecret,
                    httpBase: this.testnet ? 'https://testnet.binance.vision' : undefined,
                    wsBase: this.testnet ? 'wss://stream.testnet.binance.vision' : undefined,
                });
                const serverTime = await this.client.time();
                const accountInfo = await this.client.accountInfo();
                this.isConnected = true;
                this.logger.info('Successfully connected to Binance', {
                    serverTime,
                    accountType: accountInfo.accountType,
                    canTrade: accountInfo.canTrade
                });
                this.emit('connected');
            }
        }
        catch (error) {
            this.logger.error(`Failed to connect to ${settings_1.settings.exchange}`, { error: error.message });
            this.emit('error', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            this.logger.info('Disconnecting from Binance...');
            // Close all WebSocket connections
            for (const [symbol, ws] of this.wsConnections) {
                ws.close();
                this.logger.debug(`Closed WebSocket for ${symbol}`);
            }
            this.wsConnections.clear();
            this.isConnected = false;
            this.emit('disconnected');
            this.logger.info('Disconnected from Binance');
        }
        catch (error) {
            this.logger.error('Error during disconnect', { error: error.message });
            throw error;
        }
    }
    isConnectedToExchange() {
        return this.isConnected;
    }
    // Market data methods
    async getTickerPrice(symbol) {
        try {
            // Use the improved getTickerData method with retry logic
            const tickerData = await this.getTickerData(symbol);
            if (!tickerData) {
                throw new Error(`No ticker data available for ${symbol}`);
            }
            return tickerData;
        }
        catch (error) {
            this.logger.error(`Failed to get ticker for ${symbol}`, { error: error.message });
            throw error;
        }
    }
    async getKlines(symbol, interval, limit = 500) {
        try {
            if (this.isUsingBybit && this.bybitConnector) {
                // Convert interval to Bybit format (e.g., '1m' to '1')
                const bybitInterval = interval.replace('m', '');
                const klines = await this.bybitConnector.getKlines(symbol, bybitInterval, limit);
                return klines;
            }
            else if (this.client) {
                const klines = await this.client.candles({ symbol, interval, limit });
                return klines.map((k) => ({
                    symbol,
                    openTime: k.openTime,
                    closeTime: k.closeTime,
                    open: k.open,
                    high: k.high,
                    low: k.low,
                    close: k.close,
                    volume: k.volume,
                    trades: k.count
                }));
            }
            else {
                throw new Error('No exchange client configured');
            }
        }
        catch (error) {
            this.logger.error(`Failed to get klines for ${symbol}`, { error: error.message });
            throw error;
        }
    }
    // Data retrieval methods
    async getTickerData(symbol) {
        try {
            if (this.isUsingBybit && this.bybitConnector) {
                const ticker = await this.bybitConnector.getTicker(symbol);
                return {
                    symbol: ticker.symbol,
                    lastPrice: ticker.lastPrice,
                    change: '0', // Bybit doesn't provide these directly
                    changePercent: '0',
                    volume: ticker.volume
                };
            }
            this.checkRateLimit();
            // Add retry logic for ticker data fetching
            let lastError;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    // Use 24hr ticker stats which is more reliable on testnet
                    const ticker = await this.client.dailyStats({ symbol });
                    return {
                        symbol: ticker.symbol,
                        price: ticker.lastPrice,
                        change: ticker.priceChange,
                        changePercent: ticker.priceChangePercent,
                        volume: ticker.volume,
                        quoteVolume: ticker.quoteVolume
                    };
                }
                catch (error) {
                    lastError = error;
                    this.logger.warn(`Attempt ${attempt} failed for ticker data ${symbol}`, {
                        error: error.message
                    });
                    // Wait before retry (exponential backoff)
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }
            // If all retries failed, try alternative method
            try {
                const price = await this.client.prices({ symbol });
                if (price && price[symbol]) {
                    this.logger.info(`Fallback to price-only data for ${symbol}`);
                    return {
                        symbol,
                        price: price[symbol],
                        change: '0',
                        changePercent: '0',
                        volume: '0',
                        quoteVolume: '0'
                    };
                }
            }
            catch (fallbackError) {
                this.logger.warn(`Fallback price fetch also failed for ${symbol}`, {
                    error: fallbackError.message
                });
            }
            throw lastError;
        }
        catch (error) {
            this.logger.error(`Failed to get ticker data for ${symbol}`, { error: error.message });
            return null;
        }
    }
    // Trading methods
    async placeOrder(orderData) {
        if (settings_1.settings.exchange === 'bybit' && this.bybitConnector) {
            // Map OrderData to BybitOrderData
            const bybitOrder = {
                symbol: orderData.symbol,
                side: orderData.side === 'BUY' ? 'Buy' : 'Sell',
                type: orderData.type === 'MARKET' ? 'Market' : 'Limit',
                qty: Number(orderData.quantity),
                price: orderData.price ? Number(orderData.price) : undefined,
                timeInForce: orderData.timeInForce,
            };
            return await this.bybitConnector.placeOrder(bybitOrder);
        }
        try {
            this.checkRateLimit();
            const order = await this.client.order(orderData);
            this.logger.info('Order placed successfully', {
                orderId: order.orderId,
                symbol: orderData.symbol,
                side: orderData.side,
                type: orderData.type,
                quantity: orderData.quantity
            });
            this.emit('orderPlaced', order);
            return order;
        }
        catch (error) {
            this.logger.error('Failed to place order', {
                error: error.message,
                orderData
            });
            this.emit('orderError', { error, orderData });
            throw error;
        }
    }
    async placeOCOOrder(symbol, side, quantity, price, stopPrice, stopLimitPrice) {
        try {
            this.checkRateLimit();
            const order = await this.client.orderOco({
                symbol,
                side,
                quantity,
                price,
                stopPrice,
                stopLimitPrice,
                stopLimitTimeInForce: 'GTC'
            });
            this.logger.info('OCO Order placed successfully', {
                orderListId: order.orderListId,
                symbol,
                side,
                quantity
            });
            this.emit('ocoOrderPlaced', order);
            return order;
        }
        catch (error) {
            this.logger.error('Failed to place OCO order', { error: error.message });
            throw error;
        }
    }
    async cancelOrder(symbol, orderId) {
        try {
            const result = await this.client.cancelOrder({ symbol, orderId });
            this.logger.info('Order cancelled', { symbol, orderId });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to cancel order', {
                error: error.message,
                symbol,
                orderId
            });
            throw error;
        }
    }
    async getOpenOrders(symbol) {
        try {
            const orders = await this.client.openOrders(symbol ? { symbol } : {});
            return orders;
        }
        catch (error) {
            this.logger.error('Failed to get open orders', { error: error.message });
            throw error;
        }
    }
    async getAccountInfo() {
        try {
            const account = await this.client.accountInfo();
            return account;
        }
        catch (error) {
            this.logger.error('Failed to get account info', { error: error.message });
            throw error;
        }
    }
    async getBalance() {
        if (settings_1.settings.exchange === 'bybit' && this.bybitConnector) {
            return await this.bybitConnector.getBalance();
        }
        try {
            const account = await this.client.accountInfo();
            return account.balances;
        }
        catch (error) {
            this.logger.error('Failed to get balance', { error: error.message });
            throw error;
        }
    }
    async getPositions() {
        if (this.isUsingBybit && this.bybitConnector) {
            try {
                const positions = await this.bybitConnector.getPositions();
                return positions.map((pos) => ({
                    symbol: pos.symbol,
                    positionAmt: pos.size,
                    entryPrice: pos.entryPrice,
                    markPrice: pos.markPrice,
                    unRealizedProfit: pos.unrealizedPnL,
                    leverage: pos.leverage,
                    marginType: pos.marginMode === 'ISOLATED_MARGIN' ? 'isolated' : 'cross',
                    isolatedMargin: pos.isolatedMargin,
                    liquidationPrice: pos.liqPrice,
                    percentage: ((pos.markPrice - pos.entryPrice) / pos.entryPrice * 100).toString()
                }));
            }
            catch (error) {
                this.logger.error('Failed to get Bybit positions', { error: error.message });
                throw error;
            }
        }
        else {
            try {
                const positions = await this.client.futuresPositionRisk();
                return positions.map((pos) => ({
                    symbol: pos.symbol,
                    positionAmt: parseFloat(pos.positionAmt),
                    entryPrice: parseFloat(pos.entryPrice),
                    markPrice: parseFloat(pos.markPrice),
                    unRealizedProfit: parseFloat(pos.unRealizedProfit),
                    leverage: pos.leverage,
                    marginType: pos.marginType,
                    isolatedMargin: 0,
                    liquidationPrice: 0,
                    percentage: ((parseFloat(pos.markPrice) - parseFloat(pos.entryPrice)) / parseFloat(pos.entryPrice) * 100).toString()
                }));
            }
            catch (error) {
                this.logger.error('Failed to get positions', { error: error.message });
                throw error;
            }
        }
    }
    async setLeverage(symbol, leverage) {
        if (this.isUsingBybit && this.bybitConnector) {
            try {
                await this.bybitConnector.setLeverage({
                    symbol,
                    leverage: leverage.toString(),
                    category: 'linear'
                });
            }
            catch (error) {
                this.logger.error('Failed to set Bybit leverage', { error: error.message });
                throw error;
            }
        }
        else {
            try {
                await this.client.futuresLeverage({
                    symbol: symbol,
                    leverage: leverage
                });
            }
            catch (error) {
                this.logger.error('Failed to set Binance leverage', { error: error.message });
                throw error;
            }
        }
    }
    async setMarginType(symbol, marginType) {
        if (this.isUsingBybit && this.bybitConnector) {
            try {
                await this.bybitConnector.setMarginMode({
                    symbol,
                    marginMode: marginType === 'ISOLATED' ? 'ISOLATED_MARGIN' : 'REGULAR_MARGIN',
                    category: 'linear'
                });
            }
            catch (error) {
                this.logger.error('Failed to set Bybit margin type', { error: error.message });
                throw error;
            }
        }
        else {
            try {
                await this.client.futuresMarginType({
                    symbol: symbol,
                    marginType: marginType
                });
            }
            catch (error) {
                this.logger.error('Failed to set Binance margin type', { error: error.message });
                throw error;
            }
        }
    }
    // WebSocket methods for real-time data - SAFELY RE-ENABLED
    subscribeToTicker(symbol) {
        const streamName = `${symbol.toLowerCase()}@ticker`;
        this.subscribeToStream(streamName, (data) => {
            const tickerData = {
                symbol: data.s,
                price: data.c,
                change: data.P,
                changePercent: data.p,
                volume: data.v,
                quoteVolume: data.q
            };
            this.emit('ticker', tickerData);
        });
    }
    subscribeToKlines(symbol, interval) {
        const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
        this.subscribeToStream(streamName, (data) => {
            const kline = data.k;
            const klineData = {
                symbol: kline.s,
                openTime: kline.t,
                closeTime: kline.T,
                open: kline.o,
                high: kline.h,
                low: kline.l,
                close: kline.c,
                volume: kline.v,
                trades: kline.n
            };
            this.emit('kline', klineData);
        });
    }
    subscribeToStream(streamName, callback) {
        if (this.wsConnections.has(streamName)) {
            this.logger.warn(`Already subscribed to ${streamName}`);
            return;
        }
        // Use correct testnet WebSocket endpoints (updated 2025 format)
        const wsUrl = this.testnet
            ? `wss://stream.testnet.binance.vision/ws/${streamName}` // Correct testnet format
            : `wss://stream.binance.com/ws/${streamName}`; // Production format
        const ws = new reconnecting_websocket_1.default(wsUrl, [], {
            WebSocket: ws_1.default,
            connectionTimeout: 30000, // Increased timeout to 30 seconds for reliability
            maxRetries: 3, // Reduced retries to avoid rate limits
            maxReconnectionDelay: 60000, // Longer delay between reconnections
            minReconnectionDelay: 5000, // Start with 5 seconds delay
        });
        // Add error handler to prevent unhandled events
        ws.onerror = (error) => {
            this.logger.warn(`WebSocket error for ${streamName} (handled gracefully)`, {
                error: error?.message || 'Connection error'
            });
            // Don't re-emit to prevent unhandled error events
        };
        ws.onopen = () => {
            this.logger.info(`WebSocket connected: ${streamName}`);
            // No subscription message needed for individual stream endpoints
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data.toString());
                callback(data);
            }
            catch (error) {
                this.logger.error(`Failed to parse WebSocket message for ${streamName}`, {
                    error: error.message
                });
            }
        };
        ws.onclose = (event) => {
            this.logger.info(`WebSocket closed: ${streamName} (code: ${event?.code || 'unknown'})`);
        };
        // Additional error prevention for the underlying WebSocket
        ws.addEventListener('error', (error) => {
            // Silently handle to prevent crashes
            this.logger.debug(`WebSocket addEventListener error for ${streamName}`, {
                error: error?.message || 'Unknown error'
            });
        });
        this.wsConnections.set(streamName, ws);
    }
    /**
     * Get order status from exchange
     */
    async getOrder(symbol, orderId) {
        try {
            this.checkRateLimit();
            const order = await this.client.getOrder({
                symbol: symbol,
                orderId: orderId.toString()
            });
            this.logger.info(`Order status retrieved: ${symbol} ${orderId}`, {
                status: order.status,
                executedQty: order.executedQty,
                price: order.price
            });
            return {
                orderId: order.orderId,
                symbol: order.symbol,
                status: order.status,
                side: order.side,
                type: order.type,
                quantity: order.origQty,
                executedQty: order.executedQty,
                price: order.price,
                stopPrice: order.stopPrice,
                time: order.time,
                updateTime: order.updateTime
            };
        }
        catch (error) {
            this.logger.error(`Failed to get order ${orderId} for ${symbol}`, {
                error: error.message
            });
            throw error;
        }
    }
    checkRateLimit() {
        const now = Date.now();
        // Reset rate limit counter if needed (Binance resets every minute)
        if (now > this.rateLimitReset) {
            this.rateLimitCount = 0;
            this.rateLimitReset = now + 60000; // Reset in 1 minute
        }
        // Binance allows 1200 requests per minute for spot trading
        if (this.rateLimitCount >= 1100) { // Leave some buffer
            const waitTime = this.rateLimitReset - now;
            this.logger.warn(`Rate limit approaching, waiting ${waitTime}ms`);
            throw new Error(`Rate limit exceeded, wait ${waitTime}ms`);
        }
        this.rateLimitCount++;
    }
    // Health check method
    async healthCheck() {
        const start = Date.now();
        try {
            await this.client.ping();
            const latency = Date.now() - start;
            return { status: 'healthy', latency };
        }
        catch (error) {
            return { status: 'unhealthy', latency: Date.now() - start };
        }
    }
    getCurrentPrice(symbol) {
        // Placeholder implementation for fetching the current price of a symbol
        const priceData = this.priceCache.get(symbol);
        return priceData ? priceData.currentPrice : 0;
    }
}
exports.ExchangeConnector = ExchangeConnector;
//# sourceMappingURL=exchange-connector.js.map