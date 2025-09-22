import express from 'express';
import path from 'path';
import { DatabaseService } from '../database/database-service';
import { TradingAgent } from '../agents/trading-agent';
import { PortfolioManager } from '../portfolio/portfolio-manager';
import { DataCollector } from '../market-data/data-collector';

export class DashboardServer {
    private app: express.Application;
    private databaseService: DatabaseService;
    private tradingAgent?: TradingAgent;
    private portfolioManager?: PortfolioManager;
    private dataCollector?: DataCollector;
    private currentStats: any = {};
    private lastUpdate: Date = new Date();

    constructor(databaseService: DatabaseService) {
        this.app = express();
        this.databaseService = databaseService;
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeStats();
    }

    public setTradingAgent(agent: TradingAgent) {
        this.tradingAgent = agent;
    }

    public setPortfolioManager(manager: PortfolioManager) {
        this.portfolioManager = manager;
    }

    public setDataCollector(collector: DataCollector) {
        this.dataCollector = collector;
    }

    private setupMiddleware() {
        // Enable CORS for dashboard access
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });

        // Serve static files (dashboard UI)
        this.app.use(express.static(path.join(__dirname, '../../public')));
        this.app.use(express.json());
    }

    private setupRoutes() {
        // Main dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../public/dashboard.html'));
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

    private async initializeStats() {
        try {
            // Initialize current stats from database
            const trades = await this.databaseService.getTrades();
            const performance = await this.databaseService.getPerformance();
            
            this.currentStats = {
                totalTrades: trades.length,
                activeTrades: trades.filter((t: any) => t.status === 'PENDING').length,
                totalPnL: performance.reduce((sum: number, p: any) => sum + (p.totalPnL || 0), 0),
                winRate: this.calculateWinRate(trades),
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to initialize dashboard stats:', error);
        }
    }

    private async getStatus(req: express.Request, res: express.Response) {
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
        } catch (error) {
            res.status(500).json({ error: 'Failed to get status' });
        }
    }

    private async getStats(req: express.Request, res: express.Response) {
        try {
            const trades = await this.databaseService.getTrades();
            const performance = await this.databaseService.getPerformance();
            
            // Get active orders from OrderManager if available
            let activeOrdersCount = 0;
            if (this.tradingAgent) {
                try {
                    // Access the order manager through trading agent to get real-time active orders
                    const orderManager = (this.tradingAgent as any).orderManager;
                    if (orderManager && orderManager.getActiveOrders) {
                        activeOrdersCount = orderManager.getActiveOrders().length;
                    } else if (orderManager && orderManager.getTradingStats) {
                        const tradingStats = orderManager.getTradingStats();
                        activeOrdersCount = tradingStats.activeOrders || 0;
                    }
                } catch (orderError) {
                    console.warn('Could not get active orders from OrderManager:', orderError);
                    // Fallback to database pending trades
                    activeOrdersCount = trades.filter((t: any) => t.status === 'PENDING').length;
                }
            } else {
                // Fallback to database pending trades
                activeOrdersCount = trades.filter((t: any) => t.status === 'PENDING').length;
            }
            
            const stats = {
                totalTrades: trades.length,
                activeTrades: activeOrdersCount,
                completedTrades: trades.filter((t: any) => t.status === 'FILLED').length,
                totalVolume: trades.reduce((sum: number, t: any) => sum + (parseFloat(t.quantity) * parseFloat(t.price)), 0),
                totalPnL: performance.reduce((sum: number, p: any) => sum + (p.totalPnL || 0), 0),
                winRate: this.calculateWinRate(trades),
                averageHoldTime: this.calculateAverageHoldTime(trades),
                bestTrade: this.getBestTrade(trades),
                worstTrade: this.getWorstTrade(trades),
                dailyPnL: this.getDailyPnL(performance),
                lastUpdate: new Date().toISOString()
            };
            
            this.currentStats = stats;
            res.json(stats);
        } catch (error) {
            console.error('Failed to get stats:', error);
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    }

    private async getTrades(req: express.Request, res: express.Response) {
        try {
            const limit = parseInt(req.query.limit as string) || 50;
            const trades = await this.databaseService.getTrades();
            
            // Get active orders from OrderManager if available
            let activeOrders: any[] = [];
            if (this.tradingAgent) {
                try {
                    const orderManager = (this.tradingAgent as any).orderManager;
                    if (orderManager && orderManager.listOrders) {
                        const allOrders = orderManager.listOrders();
                        activeOrders = allOrders
                            .filter((order: any) => order.status === 'PENDING' || order.status === 'NEW')
                            .map((order: any) => ({
                                ...order,
                                timestamp: order.timestamp || new Date().toISOString(),
                                pnl: 0, // Active orders don't have P&L yet
                                duration: 'Active'
                            }));
                    }
                } catch (orderError) {
                    console.warn('Could not get active orders for trades display:', orderError);
                }
            }
            
            // Combine completed trades and active orders
            const allTrades = [...trades, ...activeOrders];
            
            // Sort by timestamp descending and limit
            const recentTrades = allTrades
                .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, limit)
                .map((trade: any) => ({
                    ...trade,
                    pnl: trade.pnl || this.calculateTradePnL(trade),
                    duration: trade.duration || this.calculateTradeDuration(trade)
                }));
            
            res.json(recentTrades);
        } catch (error) {
            console.error('Failed to get trades:', error);
            res.status(500).json({ error: 'Failed to get trades' });
        }
    }

    private async getPerformance(req: express.Request, res: express.Response) {
        try {
            const performance = await this.databaseService.getPerformance();
            const days = parseInt(req.query.days as string) || 30;
            
            // Get performance data for the last N days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const recentPerformance = performance
                .filter((p: any) => new Date(p.timestamp) >= cutoffDate)
                .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            const chartData = this.formatPerformanceChartData(recentPerformance);
            
            res.json({
                performance: recentPerformance,
                chartData,
                summary: {
                    totalPnL: recentPerformance.reduce((sum: number, p: any) => sum + (p.totalPnL || 0), 0),
                    totalTrades: recentPerformance.length,
                    avgDaily: recentPerformance.reduce((sum: number, p: any) => sum + (p.totalPnL || 0), 0) / days,
                    maxDrawdown: this.calculateMaxDrawdown(recentPerformance)
                }
            });
        } catch (error) {
            console.error('Failed to get performance:', error);
            res.status(500).json({ error: 'Failed to get performance data' });
        }
    }

    private async getMLPredictions(req: express.Request, res: express.Response) {
        try {
            // This would integrate with your ML prediction system
            const predictions = {
                BTCUSDT: { side: 'BUY', confidence: 0.65, lastUpdate: new Date().toISOString() },
                ETHUSDT: { side: 'SELL', confidence: 0.70, lastUpdate: new Date().toISOString() },
                ADAUSDT: { side: 'BUY', confidence: 0.55, lastUpdate: new Date().toISOString() },
                SOLUSDT: { side: 'SELL', confidence: 0.60, lastUpdate: new Date().toISOString() }
            };
            
            res.json(predictions);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get ML predictions' });
        }
    }

    private async getLiveData(req: express.Request, res: express.Response) {
        try {
            // Get real-time market data from data collector
            let liveData: any = {
                prices: {},
                timestamp: new Date().toISOString()
            };

            if (this.dataCollector) {
                try {
                    const marketSnapshot = this.dataCollector.getMarketSnapshot();
                    
                    // Convert market snapshot to dashboard format
                    for (const [symbol, data] of marketSnapshot.symbols) {
                        if (data.close && data.volume) {
                            // Calculate 24h change from available data
                            const change24h = data.features?.price_change_24h || 
                                            ((data.close - (data.open || data.close)) / (data.open || data.close) * 100);
                            
                            liveData.prices[symbol] = {
                                price: data.close,
                                change24h: parseFloat(change24h.toFixed(2)),
                                volume: data.volume
                            };
                        }
                    }
                } catch (dataError) {
                    console.warn('Could not get live market data from DataCollector:', dataError);
                }
            }
            
            // Fallback to static data if no real data available
            if (Object.keys(liveData.prices).length === 0) {
                liveData.prices = {
                    BTCUSDT: { price: 43250.50, change24h: 2.5, volume: 1250000 },
                    ETHUSDT: { price: 4187.73, change24h: -1.2, volume: 850000 },
                    ADAUSDT: { price: 0.8193, change24h: 0.8, volume: 45000000 },
                    SOLUSDT: { price: 145.25, change24h: 3.1, volume: 12000000 }
                };
            }
            
            res.json(liveData);
        } catch (error) {
            console.error('Failed to get live data:', error);
            res.status(500).json({ error: 'Failed to get live data' });
        }
    }

    private async getPortfolio(req: express.Request, res: express.Response) {
        try {
            let portfolio: any = {
                totalValue: 10000.00,
                cash: 8500.00,
                positions: [],
                allocation: {},
                lastUpdate: new Date().toISOString()
            };

            if (this.portfolioManager) {
                try {
                    // Get real portfolio data
                    const cash = this.portfolioManager.getBalance();
                    const portfolioData = await this.portfolioManager.getPortfolio();
                    
                    // Calculate total value
                    let totalValue = portfolioData.totalValue || cash;
                    
                    // Process positions
                    const portfolioPositions = [];
                    const allocation: any = { Cash: cash };
                    
                    for (const [symbol, quantity] of Object.entries(portfolioData.positions)) {
                        if (quantity > 0) {
                            const currentPrice = this.dataCollector?.getCurrentPrice(symbol) || 0;
                            const value = quantity * currentPrice;
                            // For PnL calculation, we'd need entry price from position data
                            const pnl = 0; // TODO: Get actual PnL from position tracking
                            
                            portfolioPositions.push({
                                symbol: symbol,
                                quantity: quantity,
                                value: parseFloat(value.toFixed(2)),
                                pnl: parseFloat(pnl.toFixed(2))
                            });
                            
                            const baseAsset = symbol.replace('USDT', '');
                            allocation[baseAsset] = parseFloat(((value / totalValue) * 100).toFixed(1));
                        }
                    }
                    
                    // Update cash allocation percentage
                    allocation.Cash = parseFloat(((cash / totalValue) * 100).toFixed(1));
                    
                    portfolio = {
                        totalValue: parseFloat(totalValue.toFixed(2)),
                        cash: parseFloat(cash.toFixed(2)),
                        positions: portfolioPositions,
                        allocation,
                        lastUpdate: new Date().toISOString()
                    };
                    
                } catch (portfolioError) {
                    console.warn('Could not get live portfolio data:', portfolioError);
                    // Keep default portfolio data as fallback
                }
            }
            
            res.json(portfolio);
        } catch (error) {
            console.error('Failed to get portfolio data:', error);
            res.status(500).json({ error: 'Failed to get portfolio data' });
        }
    }

    // Helper methods
    private calculateWinRate(trades: any[]): number {
        const completedTrades = trades.filter(t => t.status === 'closed');
        if (completedTrades.length === 0) return 0;
        
        const winningTrades = completedTrades.filter(t => parseFloat(t.pnl || '0') > 0);
        return (winningTrades.length / completedTrades.length) * 100;
    }

    private calculateAverageHoldTime(trades: any[]): number {
        const completedTrades = trades.filter((t: any) => t.status === 'FILLED' && t.exit_time);
        if (completedTrades.length === 0) return 0;
        
        const totalHoldTime = completedTrades.reduce((sum: number, trade: any) => {
            const entry = new Date(trade.timestamp).getTime();
            const exit = new Date(trade.exit_time).getTime();
            return sum + (exit - entry);
        }, 0);
        
        return totalHoldTime / completedTrades.length / (1000 * 60 * 60); // hours
    }

    private getBestTrade(trades: any[]): any {
        return trades.reduce((best: any, trade: any) => {
            const pnl = parseFloat(trade.pnl || '0');
            const bestPnl = parseFloat(best?.pnl || '0');
            return pnl > bestPnl ? trade : best;
        }, null);
    }

    private getWorstTrade(trades: any[]): any {
        return trades.reduce((worst: any, trade: any) => {
            const pnl = parseFloat(trade.pnl || '0');
            const worstPnl = parseFloat(worst?.pnl || '0');
            return pnl < worstPnl ? trade : worst;
        }, null);
    }

    private getDailyPnL(performance: any[]): number {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return performance
            .filter((p: any) => new Date(p.timestamp) >= today)
            .reduce((sum: number, p: any) => sum + (p.realized_pnl || 0), 0);
    }

    private calculateTradePnL(trade: any): number {
        if (trade.status === 'closed' && trade.exit_price) {
            const entry = parseFloat(trade.price);
            const exit = parseFloat(trade.exit_price);
            const quantity = parseFloat(trade.quantity);
            
            if (trade.side === 'BUY') {
                return (exit - entry) * quantity;
            } else {
                return (entry - exit) * quantity;
            }
        }
        return 0;
    }

    private calculateTradeDuration(trade: any): string {
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

    private formatPerformanceChartData(performance: any[]): any[] {
        let cumulativePnL = 0;
        return performance.map((p: any) => {
            cumulativePnL += p.realized_pnl || 0;
            return {
                timestamp: p.timestamp,
                pnl: p.realized_pnl || 0,
                cumulativePnL,
                winRate: p.win_rate || 0
            };
        });
    }

    private calculateMaxDrawdown(performance: any[]): number {
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

    public updateStats(newStats: any) {
        this.currentStats = { ...this.currentStats, ...newStats };
        this.lastUpdate = new Date();
    }

    public start(port: number = 3000): Promise<void> {
        return new Promise((resolve) => {
            this.app.listen(port, () => {
                console.log(`📊 Dashboard server running on port ${port}`);
                
                // Show correct URL based on environment
                if (process.env.NODE_ENV === 'production' && process.env.HEROKU_APP_NAME) {
                    console.log(`🌐 Dashboard URL: https://${process.env.HEROKU_APP_NAME}.herokuapp.com/`);
                } else if (process.env.NODE_ENV === 'production') {
                    console.log(`🌐 Dashboard URL: https://crypto-trading-bot-eu-5203693af432.herokuapp.com/`);
                } else {
                    console.log(`🌐 Dashboard URL: http://localhost:${port}`);
                }
                
                resolve();
            });
        });
    }

    public getApp(): express.Application {
        return this.app;
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const port = process.env.PORT || 3000;
    
    // Initialize database service
    const dbService = new DatabaseService();
    const dashboard = new DashboardServer(dbService);
    dashboard.start(Number(port)).catch(console.error);
}