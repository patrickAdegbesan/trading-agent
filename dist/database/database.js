"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
class Database extends events_1.EventEmitter {
    constructor(dbPath = './data') {
        super();
        this.trades = new Map();
        this.positions = new Map();
        this.marketData = new Map();
        this.performanceHistory = [];
        this.isInitialized = false;
        this.dbPath = path_1.default.resolve(dbPath);
    }
    async initialize() {
        try {
            // Create data directory if it doesn't exist
            await promises_1.default.mkdir(this.dbPath, { recursive: true });
            // Load existing data
            await this.loadData();
            this.isInitialized = true;
            this.emit('connected');
            console.log('📊 Database initialized successfully');
        }
        catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }
    async loadData() {
        try {
            // Load trades
            const tradesPath = path_1.default.join(this.dbPath, 'trades.json');
            if (await this.fileExists(tradesPath)) {
                const tradesData = await promises_1.default.readFile(tradesPath, 'utf8');
                const trades = JSON.parse(tradesData);
                this.trades = new Map(Object.entries(trades));
                console.log(`📈 Loaded ${this.trades.size} trade records`);
            }
            // Load positions
            const positionsPath = path_1.default.join(this.dbPath, 'positions.json');
            if (await this.fileExists(positionsPath)) {
                const positionsData = await promises_1.default.readFile(positionsPath, 'utf8');
                const positions = JSON.parse(positionsData);
                this.positions = new Map(Object.entries(positions));
                console.log(`💼 Loaded ${this.positions.size} position records`);
            }
            // Load performance history
            const performancePath = path_1.default.join(this.dbPath, 'performance.json');
            if (await this.fileExists(performancePath)) {
                const performanceData = await promises_1.default.readFile(performancePath, 'utf8');
                this.performanceHistory = JSON.parse(performanceData);
                console.log(`📊 Loaded ${this.performanceHistory.length} performance records`);
            }
        }
        catch (error) {
            console.warn('Some data files could not be loaded (this is normal for first run):', error);
        }
    }
    async fileExists(path) {
        try {
            await promises_1.default.access(path);
            return true;
        }
        catch {
            return false;
        }
    }
    // Trade operations
    async saveTrade(trade) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        this.trades.set(trade.id, trade);
        await this.persistTrades();
        this.emit('tradeAdded', trade);
    }
    async updateTrade(id, updates) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        const existingTrade = this.trades.get(id);
        if (!existingTrade)
            throw new Error(`Trade ${id} not found`);
        const updatedTrade = { ...existingTrade, ...updates };
        this.trades.set(id, updatedTrade);
        await this.persistTrades();
        this.emit('tradeUpdated', updatedTrade);
    }
    getTrade(id) {
        return this.trades.get(id);
    }
    getAllTrades() {
        return Array.from(this.trades.values()).sort((a, b) => b.timestamp - a.timestamp);
    }
    getTradesBySymbol(symbol) {
        return this.getAllTrades().filter(trade => trade.symbol === symbol);
    }
    getTradesInRange(startTime, endTime) {
        return this.getAllTrades().filter(trade => trade.timestamp >= startTime && trade.timestamp <= endTime);
    }
    // Position operations
    async savePosition(position) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        this.positions.set(position.id, position);
        await this.persistPositions();
        this.emit('positionAdded', position);
    }
    async updatePosition(id, updates) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        const existingPosition = this.positions.get(id);
        if (!existingPosition)
            throw new Error(`Position ${id} not found`);
        const updatedPosition = { ...existingPosition, ...updates };
        this.positions.set(id, updatedPosition);
        await this.persistPositions();
        this.emit('positionUpdated', updatedPosition);
    }
    getPosition(id) {
        return this.positions.get(id);
    }
    getAllPositions() {
        return Array.from(this.positions.values());
    }
    getOpenPositions() {
        return this.getAllPositions().filter(position => position.size !== 0);
    }
    // Performance metrics
    async savePerformanceMetrics(metrics) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        this.performanceHistory.push(metrics);
        await this.persistPerformance();
        this.emit('performanceUpdated', metrics);
    }
    getLatestPerformance() {
        return this.performanceHistory[this.performanceHistory.length - 1];
    }
    getPerformanceHistory() {
        return [...this.performanceHistory];
    }
    async calculateAndSavePerformanceMetrics() {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        const trades = this.getAllTrades();
        const positions = this.getAllPositions();
        let totalPnL = 0;
        let totalTrades = trades.length;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalWinAmount = 0;
        let totalLossAmount = 0;
        // Calculate P&L from closed trades
        for (const trade of trades) {
            if (trade.status === 'FILLED' && trade.executedPrice !== undefined) {
                // For simplicity, assume each trade has some profit/loss
                // In real implementation, you'd calculate based on entry/exit prices
                const pnl = trade.side === 'BUY' ?
                    (trade.executedPrice - trade.price) * trade.quantity :
                    (trade.price - trade.executedPrice) * trade.quantity;
                totalPnL += pnl;
                if (pnl > 0) {
                    winningTrades++;
                    totalWinAmount += pnl;
                }
                else if (pnl < 0) {
                    losingTrades++;
                    totalLossAmount += Math.abs(pnl);
                }
            }
        }
        // Calculate open positions P&L (this is simplified)
        for (const position of positions) {
            if (position.size !== 0) {
                // This would require current market price to calculate unrealized P&L
                // For now, we'll skip unrealized P&L
            }
        }
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const averageWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
        const averageLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;
        const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 0;
        // Calculate max drawdown (simplified)
        let maxDrawdown = 0;
        let maxDrawdownPercent = 0;
        let runningPnL = 0;
        let peak = 0;
        for (const trade of trades) {
            if (trade.status === 'FILLED' && trade.executedPrice !== undefined) {
                const tradePnL = trade.side === 'BUY' ?
                    (trade.executedPrice - trade.price) * trade.quantity :
                    (trade.price - trade.executedPrice) * trade.quantity;
                runningPnL += tradePnL;
                if (runningPnL > peak) {
                    peak = runningPnL;
                }
                const drawdown = peak - runningPnL;
                if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                    maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
                }
            }
        }
        // Calculate Sharpe ratio (simplified - would need risk-free rate and return standard deviation)
        const sharpeRatio = 0; // Placeholder
        const metrics = {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate: Math.round(winRate * 100) / 100,
            totalPnL: Math.round(totalPnL * 100) / 100,
            maxDrawdown: Math.round(maxDrawdown * 100) / 100,
            maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
            sharpeRatio: Math.round(sharpeRatio * 100) / 100,
            averageWin: Math.round(averageWin * 100) / 100,
            averageLoss: Math.round(averageLoss * 100) / 100,
            profitFactor: Math.round(profitFactor * 100) / 100,
            timestamp: Date.now()
        };
        await this.savePerformanceMetrics(metrics);
        console.log(`💰 Calculated performance: ${totalTrades} trades, ${totalPnL.toFixed(2)} PnL, ${winRate.toFixed(1)}% win rate`);
        return metrics;
    }
    // Market data operations
    async saveMarketData(data) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        if (!this.marketData.has(data.symbol)) {
            this.marketData.set(data.symbol, []);
        }
        const symbolData = this.marketData.get(data.symbol);
        symbolData.push(data);
        // Keep only last 10000 records per symbol to manage memory
        if (symbolData.length > 10000) {
            symbolData.splice(0, symbolData.length - 10000);
        }
        // Persist market data less frequently (every 100 records)
        if (symbolData.length % 100 === 0) {
            await this.persistMarketData();
        }
    }
    getMarketData(symbol, limit) {
        const data = this.marketData.get(symbol) || [];
        return limit ? data.slice(-limit) : data;
    }
    // Analytics methods
    calculateProfitLoss() {
        const trades = this.getAllTrades();
        const positions = this.getAllPositions();
        const realizedPnL = trades
            .filter(trade => trade.status === 'FILLED' && trade.pnl !== undefined)
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const unrealizedPnL = positions
            .reduce((sum, position) => sum + position.unrealizedPnL, 0);
        return {
            totalPnL: realizedPnL + unrealizedPnL,
            realizedPnL,
            unrealizedPnL
        };
    }
    calculateWinRate() {
        const filledTrades = this.getAllTrades().filter(trade => trade.status === 'FILLED');
        if (filledTrades.length === 0)
            return 0;
        const winningTrades = filledTrades.filter(trade => (trade.pnl || 0) > 0);
        return winningTrades.length / filledTrades.length;
    }
    // Persistence methods
    async persistTrades() {
        const tradesPath = path_1.default.join(this.dbPath, 'trades.json');
        const tradesObj = Object.fromEntries(this.trades);
        await promises_1.default.writeFile(tradesPath, JSON.stringify(tradesObj, null, 2));
    }
    async persistPositions() {
        const positionsPath = path_1.default.join(this.dbPath, 'positions.json');
        const positionsObj = Object.fromEntries(this.positions);
        await promises_1.default.writeFile(positionsPath, JSON.stringify(positionsObj, null, 2));
    }
    async persistPerformance() {
        const performancePath = path_1.default.join(this.dbPath, 'performance.json');
        await promises_1.default.writeFile(performancePath, JSON.stringify(this.performanceHistory, null, 2));
    }
    async persistMarketData() {
        // Save market data in separate files per symbol to avoid large files
        for (const [symbol, data] of this.marketData.entries()) {
            const marketDataPath = path_1.default.join(this.dbPath, `market_${symbol.toLowerCase()}.json`);
            await promises_1.default.writeFile(marketDataPath, JSON.stringify(data, null, 2));
        }
    }
    async close() {
        if (!this.isInitialized)
            return;
        // Persist all data before closing
        await Promise.all([
            this.persistTrades(),
            this.persistPositions(),
            this.persistPerformance(),
            this.persistMarketData()
        ]);
        this.isInitialized = false;
        this.emit('disconnected');
        console.log('📊 Database connection closed');
    }
}
exports.Database = Database;
//# sourceMappingURL=database.js.map