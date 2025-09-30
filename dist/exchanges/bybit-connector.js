"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitConnector = void 0;
const events_1 = require("events");
const bybit_api_1 = require("bybit-api");
const winston_1 = __importDefault(require("winston"));
const bybit_rate_limiter_1 = require("./bybit-rate-limiter");
class BybitConnector extends events_1.EventEmitter {
    constructor(apiKey, apiSecret, testnet = true) {
        super();
        this.client = new bybit_api_1.RestClientV5({
            key: apiKey,
            secret: apiSecret,
            testnet,
        });
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({ filename: 'logs/exchange.log' })
            ]
        });
        this.rateLimiter = new bybit_rate_limiter_1.BybitRateLimiter();
    }
    async placeOrder(order) {
        try {
            // Check rate limit for order placement
            await this.rateLimiter.checkRateLimit('placeOrder', 'apiKey');
            const result = await this.client.submitOrder({
                category: 'linear',
                symbol: order.symbol,
                side: order.side,
                orderType: order.type,
                qty: order.qty.toString(),
                price: order.price ? order.price.toString() : undefined,
                timeInForce: order.timeInForce || 'GTC',
                reduceOnly: false,
                closeOnTrigger: false,
            });
            this.logger.info('Bybit order placed', { order, result });
            return result;
        }
        catch (err) {
            this.logger.error('Bybit order error', { order, err });
            throw err;
        }
    }
    async getBalance() {
        try {
            await this.rateLimiter.checkRateLimit('general', 'apiKey');
            const result = await this.client.getWalletBalance({ accountType: 'UNIFIED' });
            this.logger.info('Bybit balance fetched', { result });
            return result;
        }
        catch (err) {
            this.logger.error('Bybit balance error', { err });
            throw err;
        }
    }
    async getTicker(symbol) {
        await this.rateLimiter.checkRateLimit('general', 'ip');
        const result = await this.client.getTickers({ category: 'linear', symbol });
        // Bybit returns an array of tickers
        const ticker = result.result.list && result.result.list[0];
        return {
            symbol: ticker.symbol,
            lastPrice: ticker.lastPrice,
            volume: ticker.volume24h
        };
    }
    async getServerTime() {
        await this.rateLimiter.checkRateLimit('general', 'ip');
        const result = await this.client.getServerTime();
        return result.result.timeSecond;
    }
    async connect() {
        try {
            // Test connection by getting server time
            await this.getServerTime();
            // Test API access by getting wallet balance
            await this.getBalance();
            this.logger.info('Successfully connected to Bybit');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to connect to Bybit', { error });
            return false;
        }
    }
    async getPositions() {
        try {
            await this.rateLimiter.checkRateLimit('position', 'apiKey');
            const result = await this.client.getPositionInfo({
                category: 'linear',
                settleCoin: 'USDT'
            });
            const positions = Array.isArray(result.result) ? result.result.map((pos) => ({
                symbol: pos.symbol,
                entryPrice: parseFloat(pos.entryPrice),
                currentPrice: parseFloat(pos.markPrice),
                size: parseFloat(pos.size),
                side: pos.side,
                unrealizedPnL: parseFloat(pos.unrealisedPnl)
            })) : [];
            return positions;
        }
        catch (error) {
            this.logger.error('Failed to get positions', { error });
            throw error;
        }
    }
    async setLeverage(params) {
        try {
            await this.rateLimiter.checkRateLimit('trading', 'apiKey');
            // Bybit V5 API requires both buyLeverage and sellLeverage
            const result = await this.client.setLeverage({
                category: params.category,
                symbol: params.symbol,
                buyLeverage: params.leverage,
                sellLeverage: params.leverage
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to set leverage', { error });
            throw error;
        }
    }
    async setMarginMode(params) {
        try {
            await this.rateLimiter.checkRateLimit('trading', 'apiKey');
            const result = await this.client.switchIsolatedMargin({
                category: params.category,
                symbol: params.symbol,
                tradeMode: params.marginMode === 'ISOLATED_MARGIN' ? 1 : 0,
                buyLeverage: "10", // Default leverage
                sellLeverage: "10" // Default leverage
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to set margin mode', { error });
            throw error;
        }
    }
    async cancelOrder(symbol, orderId) {
        await this.rateLimiter.checkRateLimit('trading', 'apiKey');
        return await this.client.cancelOrder({ category: 'linear', symbol, orderId });
    }
    async getKlines(symbol, interval, limit = 500) {
        try {
            // Map interval to Bybit format
            const intervalMap = {
                '1m': '1',
                '3m': '3',
                '5m': '5',
                '15m': '15',
                '30m': '30',
                '1h': '60',
                '2h': '120',
                '4h': '240',
                '6h': '360',
                '12h': '720',
                '1d': 'D',
                '1w': 'W',
                '1M': 'M'
            };
            const bybitInterval = intervalMap[interval] || '1';
            // Check rate limit for klines request (uses general category)
            await this.rateLimiter.checkRateLimit('general', 'ip');
            const result = await this.client.getKline({
                category: 'spot',
                symbol,
                interval: bybitInterval, // TODO: Fix type cast
                limit
            });
            if (!result?.result?.list) {
                throw new Error('Invalid response format from Bybit API');
            }
            // Bybit returns data in reverse chronological order and different format
            // Convert interval to milliseconds
            const getIntervalMs = (interval) => {
                const value = parseInt(interval);
                if (interval.endsWith('m'))
                    return value * 60 * 1000;
                if (interval.endsWith('h'))
                    return value * 60 * 60 * 1000;
                if (interval.endsWith('d'))
                    return value * 24 * 60 * 60 * 1000;
                if (interval.endsWith('w'))
                    return value * 7 * 24 * 60 * 60 * 1000;
                if (interval.endsWith('M'))
                    return value * 30 * 24 * 60 * 60 * 1000;
                return value * 60 * 1000; // Default to minutes
            };
            const intervalMs = getIntervalMs(interval);
            return result.result.list.map((k) => ({
                symbol,
                openTime: Number(k[0]),
                closeTime: Number(k[0]) + intervalMs,
                open: k[1],
                high: k[2],
                low: k[3],
                close: k[4],
                volume: k[5],
                trades: parseInt(k[6]) || 0
            })).reverse();
        }
        catch (error) {
            this.logger.error('Failed to get klines from Bybit', {
                error: error.message,
                symbol,
                interval
            });
            throw error;
        }
    }
}
exports.BybitConnector = BybitConnector;
//# sourceMappingURL=bybit-connector.js.map