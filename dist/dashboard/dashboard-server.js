"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardServer = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const database_service_1 = require("../database/database-service");
class DashboardServer {
    constructor(databaseService) {
        this.currentStats = {};
        this.lastUpdate = new Date();
        this.app = (0, express_1.default)();
        this.databaseService = databaseService;
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeStats();
    }
    setTradingAgent(agent) {
        this.tradingAgent = agent;
    }
    setPortfolioManager(manager) {
        this.portfolioManager = manager;
    }
    setDataCollector(collector) {
        this.dataCollector = collector;
    }
    setupMiddleware() {
        // Enable CORS for dashboard access
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        // Serve static files (dashboard UI)
        this.app.use(express_1.default.static(path_1.default.join(__dirname, '../../public')));
        this.app.use(express_1.default.json());
    }
    setupRoutes() {
        // Main dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path_1.default.join(__dirname, '../../public/dashboard.html'));
        });
        // API Routes
        this.app.get('/api/status', this.getStatus.bind(this));
        this.app.get('/api/stats', this.getStats.bind(this));
        this.app.get('/api/trades', this.getTrades.bind(this));
        this.app.get('/api/performance', this.getPerformance.bind(this));
        this.app.get('/api/ml-predictions', this.getMLPredictions.bind(this));
        this.app.get('/api/live-data', this.getLiveData.bind(this));
        this.app.get('/api/portfolio', this.getPortfolio.bind(this));
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });
    }
    async initializeStats() {
        try {
            // Initialize current stats from database
            const trades = await this.databaseService.getTrades();
            const performance = await this.databaseService.getPerformance();
            this.currentStats = {
                totalTrades: trades.length,
                activeTrades: trades.filter((t) => t.status === 'PENDING').length,
                totalPnL: performance.reduce((sum, p) => sum + (p.totalPnL || 0), 0),
                winRate: this.calculateWinRate(trades),
                lastUpdate: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Failed to initialize dashboard stats:', error);
        }
    }
    async getStatus(req, res) {
        try {
            const status = {
                botStatus: 'running',
                uptime: Math.floor(process.uptime()),
                lastUpdate: this.lastUpdate.toISOString(),
                environment: process.env.NODE_ENV || 'development',
                tradingPairs: process.env.TRADING_PAIRS?.split(',') || [],
                isConnected: true,
                version: '1.0.0'
            };
            res.json(status);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to get status' });
        }
    }
    async getStats(req, res) {
        try {
            const trades = await this.databaseService.getTrades();
            const performance = await this.databaseService.getPerformance();
            const stats = {
                totalTrades: trades.length,
                activeTrades: trades.filter((t) => t.status === 'PENDING').length,
                completedTrades: trades.filter((t) => t.status === 'FILLED').length,
                totalVolume: trades.reduce((sum, t) => sum + (parseFloat(t.quantity) * parseFloat(t.price)), 0),
                totalPnL: performance.reduce((sum, p) => sum + (p.totalPnL || 0), 0),
                winRate: this.calculateWinRate(trades),
                averageHoldTime: this.calculateAverageHoldTime(trades),
                bestTrade: this.getBestTrade(trades),
                worstTrade: this.getWorstTrade(trades),
                dailyPnL: this.getDailyPnL(performance),
                lastUpdate: new Date().toISOString()
            };
            this.currentStats = stats;
            res.json(stats);
        }
        catch (error) {
            console.error('Failed to get stats:', error);
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    }
    async getTrades(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const trades = await this.databaseService.getTrades();
            // Sort by timestamp descending and limit
            const recentTrades = trades
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, limit)
                .map((trade) => ({
                ...trade,
                pnl: this.calculateTradePnL(trade),
                duration: this.calculateTradeDuration(trade)
            }));
            res.json(recentTrades);
        }
        catch (error) {
            console.error('Failed to get trades:', error);
            res.status(500).json({ error: 'Failed to get trades' });
        }
    }
    async getPerformance(req, res) {
        try {
            const performance = await this.databaseService.getPerformance();
            const days = parseInt(req.query.days) || 30;
            // Get performance data for the last N days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const recentPerformance = performance
                .filter((p) => new Date(p.timestamp) >= cutoffDate)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const chartData = this.formatPerformanceChartData(recentPerformance);
            res.json({
                performance: recentPerformance,
                chartData,
                summary: {
                    totalPnL: recentPerformance.reduce((sum, p) => sum + (p.totalPnL || 0), 0),
                    totalTrades: recentPerformance.length,
                    avgDaily: recentPerformance.reduce((sum, p) => sum + (p.totalPnL || 0), 0) / days,
                    maxDrawdown: this.calculateMaxDrawdown(recentPerformance)
                }
            });
        }
        catch (error) {
            console.error('Failed to get performance:', error);
            res.status(500).json({ error: 'Failed to get performance data' });
        }
    }
    async getMLPredictions(req, res) {
        try {
            // This would integrate with your ML prediction system
            const predictions = {
                BTCUSDT: { side: 'BUY', confidence: 0.65, lastUpdate: new Date().toISOString() },
                ETHUSDT: { side: 'SELL', confidence: 0.70, lastUpdate: new Date().toISOString() },
                ADAUSDT: { side: 'BUY', confidence: 0.55, lastUpdate: new Date().toISOString() },
                SOLUSDT: { side: 'SELL', confidence: 0.60, lastUpdate: new Date().toISOString() }
            };
            res.json(predictions);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to get ML predictions' });
        }
    }
    async getLiveData(req, res) {
        try {
            // Real-time market data
            const liveData = {
                prices: {
                    BTCUSDT: { price: 43250.50, change24h: 2.5, volume: 1250000 },
                    ETHUSDT: { price: 4187.73, change24h: -1.2, volume: 850000 },
                    ADAUSDT: { price: 0.8193, change24h: 0.8, volume: 45000000 },
                    SOLUSDT: { price: 145.25, change24h: 3.1, volume: 12000000 }
                },
                timestamp: new Date().toISOString()
            };
            res.json(liveData);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to get live data' });
        }
    }
    async getPortfolio(req, res) {
        try {
            // Portfolio information
            const portfolio = {
                totalValue: 10000.00,
                cash: 8500.00,
                positions: [
                    { symbol: 'BTCUSDT', quantity: 0.0347, value: 1500.00, pnl: 45.50 },
                    { symbol: 'ETHUSDT', quantity: 0.0, value: 0.00, pnl: 0.00 }
                ],
                allocation: {
                    BTC: 15.0,
                    ETH: 0.0,
                    Cash: 85.0
                },
                lastUpdate: new Date().toISOString()
            };
            res.json(portfolio);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to get portfolio data' });
        }
    }
    // Helper methods
    calculateWinRate(trades) {
        const completedTrades = trades.filter(t => t.status === 'closed');
        if (completedTrades.length === 0)
            return 0;
        const winningTrades = completedTrades.filter(t => parseFloat(t.pnl || '0') > 0);
        return (winningTrades.length / completedTrades.length) * 100;
    }
    calculateAverageHoldTime(trades) {
        const completedTrades = trades.filter((t) => t.status === 'FILLED' && t.exit_time);
        if (completedTrades.length === 0)
            return 0;
        const totalHoldTime = completedTrades.reduce((sum, trade) => {
            const entry = new Date(trade.timestamp).getTime();
            const exit = new Date(trade.exit_time).getTime();
            return sum + (exit - entry);
        }, 0);
        return totalHoldTime / completedTrades.length / (1000 * 60 * 60); // hours
    }
    getBestTrade(trades) {
        return trades.reduce((best, trade) => {
            const pnl = parseFloat(trade.pnl || '0');
            const bestPnl = parseFloat(best?.pnl || '0');
            return pnl > bestPnl ? trade : best;
        }, null);
    }
    getWorstTrade(trades) {
        return trades.reduce((worst, trade) => {
            const pnl = parseFloat(trade.pnl || '0');
            const worstPnl = parseFloat(worst?.pnl || '0');
            return pnl < worstPnl ? trade : worst;
        }, null);
    }
    getDailyPnL(performance) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return performance
            .filter((p) => new Date(p.timestamp) >= today)
            .reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    }
    calculateTradePnL(trade) {
        if (trade.status === 'closed' && trade.exit_price) {
            const entry = parseFloat(trade.price);
            const exit = parseFloat(trade.exit_price);
            const quantity = parseFloat(trade.quantity);
            if (trade.side === 'BUY') {
                return (exit - entry) * quantity;
            }
            else {
                return (entry - exit) * quantity;
            }
        }
        return 0;
    }
    calculateTradeDuration(trade) {
        if (trade.exit_time) {
            const entry = new Date(trade.timestamp);
            const exit = new Date(trade.exit_time);
            const duration = exit.getTime() - entry.getTime();
            const hours = Math.floor(duration / (1000 * 60 * 60));
            const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m`;
        }
        return 'Active';
    }
    formatPerformanceChartData(performance) {
        let cumulativePnL = 0;
        return performance.map((p) => {
            cumulativePnL += p.realized_pnl || 0;
            return {
                timestamp: p.timestamp,
                pnl: p.realized_pnl || 0,
                cumulativePnL,
                winRate: p.win_rate || 0
            };
        });
    }
    calculateMaxDrawdown(performance) {
        let peak = 0;
        let maxDrawdown = 0;
        let cumulativePnL = 0;
        for (const p of performance) {
            cumulativePnL += p.realized_pnl || 0;
            if (cumulativePnL > peak) {
                peak = cumulativePnL;
            }
            const drawdown = peak - cumulativePnL;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }
    updateStats(newStats) {
        this.currentStats = { ...this.currentStats, ...newStats };
        this.lastUpdate = new Date();
    }
    start(port = 3000) {
        return new Promise((resolve) => {
            this.app.listen(port, () => {
                console.log(`📊 Dashboard server running on port ${port}`);
                // Show correct URL based on environment
                if (process.env.NODE_ENV === 'production' && process.env.HEROKU_APP_NAME) {
                    console.log(`🌐 Dashboard URL: https://${process.env.HEROKU_APP_NAME}.herokuapp.com/`);
                }
                else if (process.env.NODE_ENV === 'production') {
                    console.log(`🌐 Dashboard URL: https://crypto-trading-bot-eu-5203693af432.herokuapp.com/`);
                }
                else {
                    console.log(`🌐 Dashboard URL: http://localhost:${port}`);
                }
                resolve();
            });
        });
    }
    getApp() {
        return this.app;
    }
}
exports.DashboardServer = DashboardServer;
// Start the server if this file is run directly
if (require.main === module) {
    const port = process.env.PORT || 3000;
    // Initialize database service
    const dbService = new database_service_1.DatabaseService();
    const dashboard = new DashboardServer(dbService);
    dashboard.start(Number(port)).catch(console.error);
}
//# sourceMappingURL=dashboard-server.js.map