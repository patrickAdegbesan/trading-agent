"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load paper trading environment if the file exists
const paperTradingEnvPath = path_1.default.join(__dirname, '..', '.env.paper-trading');
if (fs_1.default.existsSync(paperTradingEnvPath)) {
    console.log('🔍 Detected .env.paper-trading file, loading paper trading configuration...');
    dotenv_1.default.config({ path: paperTradingEnvPath });
    console.log('✅ Paper trading environment loaded');
}
const trading_agent_1 = require("./agents/trading-agent");
const learning_agent_1 = require("./agents/learning-agent");
const data_collector_1 = require("./market-data/data-collector");
const prediction_engine_1 = require("./ml/prediction-engine");
const exchange_connector_1 = require("./exchanges/exchange-connector");
const order_manager_1 = require("./exchanges/order-manager");
const portfolio_manager_1 = require("./portfolio/portfolio-manager");
const risk_manager_1 = require("./portfolio/risk-manager");
const database_service_1 = require("./database/database-service");
const settings_1 = require("./config/settings");
const dashboard_server_1 = require("./dashboard/dashboard-server");
// Import Redis service for background caching (optional)
const redis_service_1 = require("./cache/redis-service");
// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    // Don't exit, just log the error
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    // Don't exit, just log the error
});
async function main() {
    try {
        console.log('🚀 Starting Crypto Trading Agent...');
        // Cache to track last processed market data to avoid duplicate predictions
        const lastProcessedData = new Map();
        const MIN_PRICE_CHANGE_PERCENT = 0.1; // Only process if price changed by at least 0.1%
        const MIN_TIME_BETWEEN_PREDICTIONS = 30000; // Minimum 30 seconds between predictions
        // Initialize Redis cache service
        // Optional: Initialize Redis cache (non-blocking)
        console.log('🔗 Connecting to Redis cache...');
        try {
            await redis_service_1.redisService.connect();
            console.log('✅ Redis cache connected successfully');
        }
        catch (error) {
            console.warn('⚠️ Redis cache connection failed, continuing without caching:', error instanceof Error ? error.message : String(error));
        }
        // Initialize database service first
        const databaseService = new database_service_1.DatabaseService('./trading_data');
        await databaseService.initialize();
        // Initialize core components with proper parameters
        const exchangeConnector = new exchange_connector_1.ExchangeConnector(settings_1.settings.binance.apiKey, settings_1.settings.binance.apiSecret, settings_1.settings.binance.testnet);
        // Create data collector (keep synchronous interface)
        const dataCollector = new data_collector_1.DataCollector(exchangeConnector, settings_1.settings.trading.pairs);
        const portfolioManager = new portfolio_manager_1.PortfolioManager(settings_1.settings.trading.initialCapital);
        const riskManager = new risk_manager_1.RiskManager(settings_1.settings.trading.initialCapital, settings_1.settings);
        const orderManager = new order_manager_1.OrderManager(exchangeConnector, riskManager);
        // Create prediction engine (keep synchronous interface)
        const predictionEngine = new prediction_engine_1.PredictionEngine(databaseService);
        // Initialize agents
        const tradingAgent = new trading_agent_1.TradingAgent(predictionEngine, portfolioManager, orderManager, riskManager);
        const learningAgent = new learning_agent_1.LearningAgent(null, null);
        // Connect database to trading components
        setupDatabaseIntegration(databaseService, tradingAgent, dataCollector, orderManager);
        // TRADING SYSTEM RESTORED WITH SAFEGUARDS
        console.log('� Starting production trading system...');
        // Connect to exchange and start data collection
        console.log('📡 Connecting to exchange...');
        await exchangeConnector.connect();
        console.log('📊 Starting data collection...');
        await dataCollector.startCollection();
        console.log('✅ System initialized successfully!');
        // Initialize Redis health monitoring
        console.log('🔧 Setting up Redis health monitoring...');
        setInterval(async () => {
            try {
                const health = await redis_service_1.redisService.healthCheck();
                if (!health.connected) {
                    console.warn('⚠️ Redis health check failed:', health.error);
                    console.log('🔄 Attempting Redis reconnection...');
                    const reconnected = await redis_service_1.redisService.reconnect();
                    if (reconnected) {
                        console.log('✅ Redis reconnected successfully');
                    }
                    else {
                        console.warn('❌ Redis reconnection failed - continuing with fallback mode');
                    }
                }
                else if (health.latency && health.latency > 100) {
                    console.warn(`⚠️ Redis latency high: ${health.latency}ms`);
                }
            }
            catch (error) {
                console.warn('Redis health monitoring error:', error.message);
            }
        }, 60000); // Check every minute
        // Initialize trading dashboard
        console.log('🖥️ Starting comprehensive trading dashboard...');
        const dashboardServer = new dashboard_server_1.DashboardServer(databaseService);
        dashboardServer.setTradingAgent(tradingAgent);
        dashboardServer.setPortfolioManager(portfolioManager);
        dashboardServer.setDataCollector(dataCollector);
        // Start dashboard on the port specified by Heroku (or default 3000)
        const port = process.env.PORT || 3000;
        await dashboardServer.start(Number(port));
        console.log(`🌐 Dashboard server started on port ${port}`);
        console.log('🔄 Starting trading loop with LIVE TRADE EXECUTION...');
        // IMPORTANT: Enable live trading (set to false for signal-only mode)
        const ENABLE_LIVE_TRADING = true; // Enabled for paper trading on testnet
        tradingAgent.setActive(ENABLE_LIVE_TRADING);
        if (ENABLE_LIVE_TRADING) {
            console.log('🚨 LIVE TRADING ENABLED - Real trades will be executed on Binance Testnet!');
        }
        else {
            console.log('📊 SIGNAL-ONLY MODE - No actual trades will be placed');
        }
        // Main trading loop with enhanced ML integration
        setInterval(async () => {
            try {
                // Get latest market data
                const marketSnapshot = dataCollector.getMarketSnapshot();
                // Execute trades for each symbol with enhanced ML predictions
                for (const [symbol, data] of marketSnapshot.symbols) {
                    if (data.features && Object.keys(data.features).length > 10) { // Ensure we have indicators
                        // 🔍 CHECK FOR DATA CHANGES - Avoid duplicate predictions
                        const now = Date.now();
                        const lastData = lastProcessedData.get(symbol);
                        if (lastData) {
                            const priceChange = Math.abs(data.close - lastData.price) / lastData.price * 100;
                            const timeSinceLastPrediction = now - lastData.timestamp;
                            // Skip if price hasn't changed enough AND not enough time has passed
                            if (priceChange < MIN_PRICE_CHANGE_PERCENT && timeSinceLastPrediction < MIN_TIME_BETWEEN_PREDICTIONS) {
                                continue; // Skip this iteration - no significant change
                            }
                        }
                        // Update cache with current data
                        lastProcessedData.set(symbol, {
                            price: data.close,
                            timestamp: now,
                            volume: data.volume
                        });
                        // Get historical data for ML analysis
                        const marketDataBuffer = dataCollector.getHistoricalData(symbol, 50);
                        const priceHistory = marketDataBuffer.length > 0 ? marketDataBuffer.map(d => d.close) : [data.close];
                        // Prepare enhanced ML input
                        const predictionInput = {
                            symbol: symbol,
                            currentPrice: data.close,
                            priceHistory: priceHistory,
                            volume: data.volume,
                            indicators: {
                                rsi: data.features.rsi,
                                macd: data.features.macd && data.features.macd_signal && data.features.macd_histogram ? {
                                    macd: data.features.macd,
                                    signal: data.features.macd_signal,
                                    histogram: data.features.macd_histogram
                                } : undefined,
                                bollinger: data.features.bb_upper && data.features.bb_middle && data.features.bb_lower ? {
                                    upper: data.features.bb_upper,
                                    middle: data.features.bb_middle,
                                    lower: data.features.bb_lower
                                } : undefined,
                                ma20: data.features.sma20,
                                ma50: data.features.sma50
                            },
                            marketData: marketDataBuffer
                        };
                        if (ENABLE_LIVE_TRADING) {
                            // LIVE TRADING: Execute trades with ML predictions
                            const mlSignal = predictionEngine.generateSignal(predictionInput);
                            const minConfidence = parseFloat(process.env.MIN_CONFIDENCE || '45') / 100;
                            if (mlSignal && mlSignal.confidence > minConfidence) {
                                console.log(`🧠 Enhanced ML Signal for ${symbol}:`, {
                                    side: mlSignal.side,
                                    confidence: (mlSignal.confidence * 100).toFixed(1) + '%',
                                    winProbability: mlSignal.winProbability ? (mlSignal.winProbability * 100).toFixed(1) + '%' : 'N/A',
                                    expectedReturn: mlSignal.expectedReturn ? (mlSignal.expectedReturn * 100).toFixed(2) + '%' : 'N/A',
                                    mlInsights: mlSignal.metadata
                                });
                                // Execute trade with ML signal
                                const tradeResult = await tradingAgent.executeTrade(mlSignal);
                                // Trade result logging is handled in trading agent
                                if (tradeResult && !tradeResult.success) {
                                    console.log(`⚠️ ML trade rejected for ${symbol}: ${tradeResult.reason}`);
                                }
                            }
                        }
                        else {
                            // SIGNAL-ONLY MODE: Enhanced ML signal logging
                            const mlSignal = predictionEngine.generateSignal(predictionInput);
                            if (mlSignal && mlSignal.confidence > 0.4) {
                                console.log(`📊 Enhanced ML Signal for ${symbol}:`, {
                                    side: mlSignal.side,
                                    confidence: (mlSignal.confidence * 100).toFixed(1) + '%',
                                    winProbability: mlSignal.winProbability ? (mlSignal.winProbability * 100).toFixed(1) + '%' : 'N/A',
                                    expectedReturn: mlSignal.expectedReturn ? (mlSignal.expectedReturn * 100).toFixed(2) + '%' : 'N/A',
                                    price: data.close,
                                    mlInsights: mlSignal.metadata,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    }
                }
                // Check and update order status every few loops
                if (Math.random() < 0.3) { // ~30% chance to check orders
                    await checkAndUpdateOrderStatus(orderManager, portfolioManager, exchangeConnector);
                }
                // Print enhanced statistics every 10 loops
                if (Math.random() < 0.1) { // ~10% chance
                    const stats = orderManager.getTradingStats();
                    const mlStats = predictionEngine.getPerformanceStats();
                    console.log('📈 Enhanced Stats:', { tradingStats: stats, mlPerformance: mlStats });
                }
            }
            catch (error) {
                console.error('⚠️ Error in enhanced ML trading loop:', error?.message || error);
                // Continue execution - don't crash on single loop errors
            }
        }, settings_1.settings.trading.intervalMs);
        // Learning loop (runs less frequently) - RESTORED
        setInterval(async () => {
            try {
                console.log('🧠 Running learning update...');
                // TODO: Implement learning agent when ready
                // learningAgent.retrainModel();
            }
            catch (error) {
                console.error('⚠️ Error in learning loop:', error?.message || error);
                // Continue execution - don't crash on learning errors
            }
        }, settings_1.settings.ml.retrainIntervalHours * 60 * 60 * 1000);
    }
    catch (error) {
        console.error('❌ Failed to start trading agent:', error);
        process.exit(1);
    }
}
// Database integration setup
function setupDatabaseIntegration(databaseService, tradingAgent, dataCollector, orderManager) {
    console.log('🔗 Setting up database integration...');
    // Listen for trade executions and record them
    tradingAgent.on('tradeExecuted', async (tradeResult) => {
        try {
            const tradeId = await databaseService.recordTradeExecution({
                orderId: tradeResult.orderId,
                symbol: tradeResult.symbol,
                side: tradeResult.side,
                size: tradeResult.size,
                price: tradeResult.price,
                executedPrice: tradeResult.executedPrice,
                stopLoss: tradeResult.stopLoss,
                takeProfit: tradeResult.takeProfit,
                confidence: tradeResult.confidence,
                riskScore: tradeResult.riskScore,
                status: 'FILLED'
            });
            console.log(`📝 Trade recorded in database: ${tradeId}`);
        }
        catch (error) {
            console.error('❌ Failed to record trade in database:', error);
        }
    });
    // Listen for market data and store historical data
    dataCollector.on('kline', async (klineData) => {
        try {
            await databaseService.saveMarketData(klineData.symbol, klineData);
        }
        catch (error) {
            console.warn('⚠️ Failed to save market data:', error);
        }
    });
    // Periodically calculate and save performance metrics
    setInterval(async () => {
        try {
            const metrics = await databaseService.calculateAndSavePerformanceMetrics();
            console.log(`📊 Performance metrics updated: Win Rate: ${(metrics.winRate * 100).toFixed(1)}%, Total PnL: ${metrics.totalPnL.toFixed(2)}`);
        }
        catch (error) {
            console.warn('⚠️ Failed to update performance metrics:', error);
        }
    }, 60000); // Every minute
    // Show database statistics every 5 minutes
    setInterval(() => {
        const stats = databaseService.getStatistics();
        console.log('📈 Database Stats:', {
            trades: `${stats.filledTrades}/${stats.totalTrades}`,
            positions: stats.openPositions,
            pnl: `${stats.totalPnL.toFixed(2)}`,
            winRate: `${(stats.winRate * 100).toFixed(1)}%`
        });
    }, 300000); // Every 5 minutes
}
/**
 * Check and update order status for pending orders
 */
async function checkAndUpdateOrderStatus(orderManager, portfolioManager, exchangeConnector) {
    try {
        const activeOrders = orderManager.getActiveOrders();
        for (const order of activeOrders) {
            if (order.status === 'SUBMITTED' && order.exchangeOrderId) {
                try {
                    // Check order status with exchange
                    const exchangeOrder = await exchangeConnector.getOrder(order.symbol, order.exchangeOrderId);
                    if (exchangeOrder && exchangeOrder.status === 'FILLED') {
                        console.log(`✅ Order filled: ${order.symbol} ${order.side} ${order.quantity} @ ${exchangeOrder.price || order.price}`);
                        // Update order status
                        order.status = 'FILLED';
                        order.executedPrice = exchangeOrder.price || order.price;
                        order.executedQuantity = exchangeOrder.executedQty || order.quantity;
                        // Update portfolio with filled position
                        const tradeQuantity = order.side === 'BUY' ? order.quantity : -order.quantity;
                        await portfolioManager.updateAfterTrade({
                            symbol: order.symbol,
                            quantity: tradeQuantity,
                            price: order.executedPrice,
                            timestamp: Date.now()
                        });
                        console.log(`📊 Portfolio updated for ${order.symbol}: ${tradeQuantity > 0 ? 'Added' : 'Reduced'} ${Math.abs(tradeQuantity)} units`);
                        // Emit trade event for database recording
                        orderManager.emit('tradeExecuted', {
                            success: true,
                            orderId: order.id,
                            symbol: order.symbol,
                            side: order.side,
                            quantity: order.executedQuantity,
                            executedPrice: order.executedPrice,
                            timestamp: Date.now(),
                            status: 'FILLED'
                        });
                    }
                }
                catch (error) {
                    console.warn(`⚠️ Error checking order status for ${order.id}:`, error.message);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ Error in order status monitoring:', error.message);
    }
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    process.exit(0);
});
main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map