"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const database_1 = require("./database");
const events_1 = require("events");
class DatabaseService extends events_1.EventEmitter {
    constructor(dbPath) {
        super();
        this.isConnected = false;
        this.db = new database_1.Database(dbPath);
        // Forward database events
        this.db.on('connected', () => {
            this.isConnected = true;
            this.emit('connected');
        });
        this.db.on('disconnected', () => {
            this.isConnected = false;
            this.emit('disconnected');
        });
    }
    async initialize() {
        await this.db.initialize();
        console.log('🗄️ Database service initialized');
    }
    async close() {
        await this.db.close();
        console.log('🗄️ Database service closed');
    }
    // Trade management
    async recordTradeExecution(result) {
        const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const trade = {
            id: tradeId,
            timestamp: Date.now(),
            symbol: result.symbol,
            side: result.side,
            type: 'MARKET', // Most trades are market orders for now
            quantity: result.size,
            price: result.price,
            executedPrice: result.executedPrice || result.price,
            orderId: result.orderId,
            status: result.status,
            stopLoss: result.stopLoss,
            takeProfit: result.takeProfit,
            confidence: result.confidence,
            riskScore: result.riskScore,
            strategy: 'adaptive_strategy' // Default strategy name
        };
        await this.db.saveTrade(trade);
        console.log(`📝 Recorded trade execution: ${tradeId} - ${result.symbol} ${result.side} ${result.size}`);
        return tradeId;
    }
    async updateTradeStatus(tradeId, status, pnl) {
        const updates = { status };
        if (pnl !== undefined) {
            updates.pnl = pnl;
        }
        await this.db.updateTrade(tradeId, updates);
        console.log(`🔄 Updated trade ${tradeId}: ${status}${pnl !== undefined ? ` (PnL: ${pnl})` : ''}`);
    }
    // Position tracking
    async updatePosition(symbol, currentPrice, trades) {
        const positionId = `pos_${symbol}`;
        let position = this.db.getPosition(positionId);
        // Calculate position size and PnL from trades
        let totalSize = 0;
        let totalCost = 0;
        let realizedPnL = 0;
        for (const tradeId of trades) {
            const trade = this.db.getTrade(tradeId);
            if (trade && trade.status === 'FILLED') {
                const sizeChange = trade.side === 'BUY' ? trade.quantity : -trade.quantity;
                totalSize += sizeChange;
                totalCost += sizeChange * (trade.executedPrice || trade.price);
                if (trade.pnl) {
                    realizedPnL += trade.pnl;
                }
            }
        }
        const entryPrice = totalSize !== 0 ? totalCost / totalSize : 0;
        const unrealizedPnL = totalSize * (currentPrice - entryPrice);
        const positionRecord = {
            id: positionId,
            symbol,
            side: totalSize > 0 ? 'LONG' : 'SHORT',
            size: Math.abs(totalSize),
            entryPrice,
            currentPrice,
            unrealizedPnL,
            realizedPnL,
            timestamp: Date.now(),
            trades
        };
        if (position) {
            await this.db.updatePosition(positionId, positionRecord);
        }
        else {
            await this.db.savePosition(positionRecord);
        }
    }
    // Market data storage
    async saveMarketData(symbol, klineData) {
        const marketData = {
            id: `${symbol}_${klineData.openTime}`,
            symbol,
            timestamp: klineData.openTime,
            open: parseFloat(klineData.open),
            high: parseFloat(klineData.high),
            low: parseFloat(klineData.low),
            close: parseFloat(klineData.close),
            volume: parseFloat(klineData.volume)
        };
        await this.db.saveMarketData(marketData);
    }
    // Analytics and reporting
    async calculateAndSavePerformanceMetrics() {
        const trades = this.db.getAllTrades().filter(t => t.status === 'FILLED');
        const pnlData = this.db.calculateProfitLoss();
        const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
        const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
        const metrics = {
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate: this.db.calculateWinRate(),
            totalPnL: pnlData.totalPnL,
            maxDrawdown: this.calculateMaxDrawdown(trades),
            maxDrawdownPercent: this.calculateMaxDrawdownPercent(trades),
            sharpeRatio: this.calculateSharpeRatio(trades),
            averageWin: winningTrades.length > 0 ?
                winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0,
            averageLoss: losingTrades.length > 0 ?
                Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)) / losingTrades.length : 0,
            profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
            timestamp: Date.now()
        };
        await this.db.savePerformanceMetrics(metrics);
        return metrics;
    }
    calculateMaxDrawdown(trades) {
        let maxDrawdown = 0;
        let peak = 0;
        let currentBalance = 0;
        for (const trade of trades.sort((a, b) => a.timestamp - b.timestamp)) {
            currentBalance += trade.pnl || 0;
            if (currentBalance > peak) {
                peak = currentBalance;
            }
            const drawdown = peak - currentBalance;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }
    calculateMaxDrawdownPercent(trades) {
        // Simplified calculation - would need initial capital for accurate percentage
        const maxDrawdown = this.calculateMaxDrawdown(trades);
        const initialCapital = 10000; // From settings
        return maxDrawdown / initialCapital;
    }
    calculateSharpeRatio(trades) {
        if (trades.length < 2)
            return 0;
        const returns = trades.map(t => t.pnl || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
        const stdDev = Math.sqrt(variance);
        return stdDev > 0 ? avgReturn / stdDev : 0;
    }
    calculateProfitFactor(winningTrades, losingTrades) {
        const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
        return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    }
    // Query methods for analysis and ML training
    getTradeHistory(symbol, limit) {
        let trades = this.db.getAllTrades().filter(t => t.status === 'FILLED');
        if (symbol) {
            trades = trades.filter(t => t.symbol === symbol);
        }
        if (limit) {
            trades = trades.slice(0, limit);
        }
        return trades;
    }
    getPositionHistory() {
        return this.db.getAllPositions();
    }
    getPerformanceHistory() {
        return this.db.getPerformanceHistory();
    }
    getMarketDataForTraining(symbol, limit = 1000) {
        return this.db.getMarketData(symbol, limit);
    }
    // Health check
    isHealthy() {
        return this.isConnected;
    }
    // Methods for dashboard API compatibility
    async getTrades(symbol, limit) {
        return this.getTradeHistory(symbol, limit);
    }
    async getPerformance() {
        return this.getPerformanceHistory();
    }
    // Statistics for dashboard
    getStatistics() {
        const trades = this.db.getAllTrades();
        const positions = this.db.getAllPositions();
        const performance = this.db.getLatestPerformance();
        const pnlData = this.db.calculateProfitLoss();
        return {
            totalTrades: trades.length,
            activeTrades: trades.filter(t => t.status === 'PENDING').length,
            filledTrades: trades.filter(t => t.status === 'FILLED').length,
            failedTrades: trades.filter(t => t.status === 'FAILED').length,
            totalPositions: positions.length,
            openPositions: this.db.getOpenPositions().length,
            totalPnL: pnlData.totalPnL,
            realizedPnL: pnlData.realizedPnL,
            unrealizedPnL: pnlData.unrealizedPnL,
            winRate: this.db.calculateWinRate(),
            lastPerformanceUpdate: performance?.timestamp
        };
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=database-service.js.map