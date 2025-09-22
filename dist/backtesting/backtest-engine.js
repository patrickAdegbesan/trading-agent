"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestEngine = void 0;
const indicators_1 = require("../market-data/indicators");
const risk_manager_1 = require("../portfolio/risk-manager");
class BacktestEngine {
    constructor(strategy, config, riskManager) {
        this.strategy = strategy;
        this.config = config;
        this.indicators = new indicators_1.TechnicalIndicators();
        this.riskManager = riskManager || new risk_manager_1.RiskManager(config.initialCapital);
    }
    /**
     * Run walk-forward backtest
     */
    async runBacktest(exchangeConnector) {
        console.log(`🔄 Starting walk-forward backtest from ${this.config.startDate} to ${this.config.endDate}`);
        const results = {
            totalReturn: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            winRate: 0,
            totalTrades: 0,
            avgTradeReturn: 0,
            profitFactor: 0,
            calmarRatio: 0,
            trades: [],
            equityCurve: [],
            monthlyReturns: []
        };
        for (const symbol of this.config.symbols) {
            console.log(`📊 Backtesting ${symbol}...`);
            // Get historical data
            const historicalData = await this.getHistoricalData(exchangeConnector, symbol);
            // Run walk-forward analysis
            const symbolResults = await this.runWalkForwardAnalysis(symbol, historicalData);
            // Combine results
            this.combineResults(results, symbolResults);
        }
        // Calculate final metrics
        this.calculateFinalMetrics(results);
        console.log(`✅ Backtest completed. Total trades: ${results.totalTrades}, Win rate: ${(results.winRate * 100).toFixed(2)}%`);
        return results;
    }
    async getHistoricalData(exchangeConnector, symbol) {
        try {
            // Get data from start date to end date
            const klines = await exchangeConnector.getKlines(symbol, '1m', 10000); // Adjust limit as needed
            return klines.map(k => ({
                open: parseFloat(k.open),
                high: parseFloat(k.high),
                low: parseFloat(k.low),
                close: parseFloat(k.close),
                volume: parseFloat(k.volume),
                timestamp: k.openTime
            }));
        }
        catch (error) {
            console.error(`Failed to get historical data for ${symbol}:`, error);
            return [];
        }
    }
    async runWalkForwardAnalysis(symbol, data) {
        const trades = [];
        const equityCurve = [];
        let currentCapital = this.config.initialCapital;
        let maxCapital = currentCapital;
        let position = null;
        // Generate features for all data points
        const features = this.indicators.getHistoricalFeatures(symbol, data);
        // Walk-forward windows
        const trainingSize = this.config.trainingPeriod * 1440; // Convert days to minutes
        const testSize = this.config.walkForwardPeriod * 1440;
        for (let i = trainingSize; i < features.length - testSize; i += testSize) {
            // Training window: use past data to "train" (not applicable for simple strategies)
            const trainingWindow = features.slice(i - trainingSize, i);
            // Testing window: generate signals and simulate trading
            const testingWindow = features.slice(i, i + testSize);
            for (let j = 1; j < testingWindow.length; j++) {
                const currentFeatures = testingWindow.slice(0, j + 1);
                const currentFeature = currentFeatures[currentFeatures.length - 1];
                // Generate signals
                const signals = this.strategy.generateSignals(currentFeatures);
                if (signals.length > 0) {
                    const signal = signals[0]; // Take first signal
                    // Risk assessment
                    const riskAssessment = this.riskManager.assessTradeRisk(signal, currentFeature.price);
                    if (riskAssessment.approved && riskAssessment.positionSize > 0) {
                        // Close existing position if opposite signal
                        if (position && position.side !== signal.side) {
                            const closeTrade = this.closePosition(position, currentFeature, currentCapital);
                            if (closeTrade) {
                                trades.push(closeTrade);
                                currentCapital += closeTrade.pnl;
                            }
                            position = null;
                        }
                        // Open new position if none exists
                        if (!position) {
                            position = this.openPosition(signal, riskAssessment.positionSize, currentFeature);
                        }
                    }
                }
                // Update equity curve
                const unrealizedPnL = position ? this.calculateUnrealizedPnL(position, currentFeature.price) : 0;
                const equity = currentCapital + unrealizedPnL;
                maxCapital = Math.max(maxCapital, equity);
                equityCurve.push({
                    timestamp: currentFeature.timestamp,
                    equity,
                    drawdown: (maxCapital - equity) / maxCapital
                });
            }
        }
        // Close final position if exists
        if (position && features.length > 0) {
            const finalFeature = features[features.length - 1];
            const closeTrade = this.closePosition(position, finalFeature, currentCapital);
            if (closeTrade) {
                trades.push(closeTrade);
                currentCapital += closeTrade.pnl;
            }
        }
        return {
            trades,
            equityCurve,
            totalReturn: (currentCapital - this.config.initialCapital) / this.config.initialCapital
        };
    }
    openPosition(signal, positionSize, feature) {
        const slippageAdjustment = signal.side === 'BUY' ?
            (1 + this.config.slippage) : (1 - this.config.slippage);
        const entryPrice = feature.price * slippageAdjustment;
        return {
            quantity: positionSize,
            entryPrice,
            entryTime: feature.timestamp,
            side: signal.side
        };
    }
    closePosition(position, feature, capital) {
        const slippageAdjustment = position.side === 'BUY' ?
            (1 - this.config.slippage) : (1 + this.config.slippage);
        const exitPrice = feature.price * slippageAdjustment;
        // Calculate P&L
        const pnlPerUnit = position.side === 'BUY' ?
            (exitPrice - position.entryPrice) : (position.entryPrice - exitPrice);
        const grossPnL = pnlPerUnit * position.quantity;
        const commission = (position.entryPrice + exitPrice) * position.quantity * this.config.commission / 2;
        const slippageCost = Math.abs(feature.price - exitPrice) * position.quantity;
        const netPnL = grossPnL - commission - slippageCost;
        return {
            symbol: feature.symbol,
            entryTime: position.entryTime,
            exitTime: feature.timestamp,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: position.quantity,
            side: position.side,
            pnl: netPnL,
            commission,
            slippage: slippageCost,
            duration: feature.timestamp - position.entryTime,
            maxFavorableExcursion: 0, // Could be calculated with more detailed tracking
            maxAdverseExcursion: 0
        };
    }
    calculateUnrealizedPnL(position, currentPrice) {
        const pnlPerUnit = position.side === 'BUY' ?
            (currentPrice - position.entryPrice) : (position.entryPrice - currentPrice);
        return pnlPerUnit * position.quantity;
    }
    combineResults(main, additional) {
        if (additional.trades) {
            main.trades.push(...additional.trades);
        }
        if (additional.equityCurve) {
            main.equityCurve.push(...additional.equityCurve);
        }
    }
    calculateFinalMetrics(results) {
        const trades = results.trades;
        if (trades.length === 0) {
            return;
        }
        // Basic metrics
        results.totalTrades = trades.length;
        const winningTrades = trades.filter(t => t.pnl > 0);
        results.winRate = winningTrades.length / trades.length;
        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        results.totalReturn = totalPnL / this.config.initialCapital;
        results.avgTradeReturn = totalPnL / trades.length;
        // Profit factor
        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + Math.abs(t.pnl), 0);
        results.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        // Max drawdown
        results.maxDrawdown = results.equityCurve.reduce((max, point) => Math.max(max, point.drawdown), 0);
        // Sharpe ratio (simplified - using trade returns)
        const returns = trades.map(t => t.pnl / this.config.initialCapital);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const returnVariance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const returnStd = Math.sqrt(returnVariance);
        results.sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;
        // Calmar ratio
        results.calmarRatio = results.maxDrawdown > 0 ? results.totalReturn / results.maxDrawdown : 0;
    }
    /**
     * Generate detailed backtest report
     */
    generateReport(results) {
        return `
📊 BACKTEST RESULTS SUMMARY
==========================

💰 Performance Metrics:
• Total Return: ${(results.totalReturn * 100).toFixed(2)}%
• Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}
• Maximum Drawdown: ${(results.maxDrawdown * 100).toFixed(2)}%
• Calmar Ratio: ${results.calmarRatio.toFixed(2)}

📈 Trading Statistics:
• Total Trades: ${results.totalTrades}
• Win Rate: ${(results.winRate * 100).toFixed(2)}%
• Average Trade Return: ${(results.avgTradeReturn * 100).toFixed(4)}%
• Profit Factor: ${results.profitFactor.toFixed(2)}

💡 Key Insights:
${this.generateInsights(results)}
`;
    }
    generateInsights(results) {
        const insights = [];
        if (results.winRate > 0.6) {
            insights.push("• High win rate indicates good signal quality");
        }
        if (results.sharpeRatio > 1.5) {
            insights.push("• Excellent risk-adjusted returns");
        }
        else if (results.sharpeRatio < 0.5) {
            insights.push("• Poor risk-adjusted returns - strategy needs improvement");
        }
        if (results.maxDrawdown > 0.2) {
            insights.push("• High drawdown - consider reducing position sizes or improving risk management");
        }
        if (results.profitFactor > 2) {
            insights.push("• Strong profit factor indicates effective strategy");
        }
        return insights.length > 0 ? insights.join('\n') : "• Strategy shows mixed results - further optimization recommended";
    }
}
exports.BacktestEngine = BacktestEngine;
//# sourceMappingURL=backtest-engine.js.map