"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictionEngine = void 0;
class PredictionEngine {
    constructor(databaseService) {
        this.modelPerformance = new Map();
        this.confidenceAdjustment = new Map(); // Symbol-specific confidence adjustments
        this.recentPredictionAccuracy = new Map(); // Track recent prediction accuracy
        this.databaseService = databaseService;
        this.initializeConfidenceTracking();
    }
    initializeConfidenceTracking() {
        // Initialize confidence tracking for major trading pairs
        const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'];
        symbols.forEach(symbol => {
            this.confidenceAdjustment.set(symbol, 1.0); // Start with neutral adjustment
            this.recentPredictionAccuracy.set(symbol, []);
        });
    }
    /**
     * Generate intelligent trading signals using ML-enhanced predictions
     */
    generateSignal(input) {
        try {
            // Calculate technical indicators-based signal
            const technicalSignal = this.calculateTechnicalSignal(input);
            // Apply ML-enhanced confidence scoring
            const mlEnhancedConfidence = this.calculateMLConfidence(input.symbol, technicalSignal.confidence);
            // Apply dynamic position sizing based on recent performance
            const dynamicConfidence = this.applyPerformanceAdjustment(input.symbol, mlEnhancedConfidence);
            // Generate final signal
            const signal = {
                symbol: input.symbol,
                side: technicalSignal.side,
                confidence: Math.max(0.1, Math.min(0.95, dynamicConfidence)), // Clamp between 0.1-0.95
                price: input.currentPrice,
                timestamp: Date.now(),
                expectedReturn: this.estimateExpectedReturn(input),
                winProbability: this.estimateWinProbability(input.symbol, technicalSignal.side),
                stopLoss: this.calculateDynamicStopLoss(input),
                takeProfit: this.calculateDynamicTakeProfit(input),
                metadata: {
                    technicalConfidence: technicalSignal.confidence,
                    mlAdjustment: mlEnhancedConfidence / technicalSignal.confidence,
                    performanceAdjustment: dynamicConfidence / mlEnhancedConfidence,
                    recentAccuracy: this.getRecentAccuracy(input.symbol)
                }
            };
            // Only return signal if confidence is above minimum threshold
            if (signal.confidence >= 0.6) {
                this.logPrediction(signal);
                return signal;
            }
            return null;
        }
        catch (error) {
            console.error('❌ Prediction generation failed:', error);
            return null;
        }
    }
    /**
     * Calculate technical indicators-based trading signal
     */
    calculateTechnicalSignal(input) {
        let bullishSignals = 0;
        let bearishSignals = 0;
        let signalStrength = 0;
        const { indicators, priceHistory, currentPrice } = input;
        // RSI Analysis
        if (indicators.rsi !== undefined) {
            if (indicators.rsi < 30) {
                bullishSignals += 2; // Strong oversold signal
                signalStrength += 0.3;
            }
            else if (indicators.rsi < 40) {
                bullishSignals += 1; // Mild oversold
                signalStrength += 0.15;
            }
            else if (indicators.rsi > 70) {
                bearishSignals += 2; // Strong overbought signal
                signalStrength += 0.3;
            }
            else if (indicators.rsi > 60) {
                bearishSignals += 1; // Mild overbought
                signalStrength += 0.15;
            }
        }
        // MACD Analysis
        if (indicators.macd) {
            const { macd, signal, histogram } = indicators.macd;
            if (macd > signal && histogram > 0) {
                bullishSignals += 1;
                signalStrength += 0.2;
            }
            else if (macd < signal && histogram < 0) {
                bearishSignals += 1;
                signalStrength += 0.2;
            }
        }
        // Moving Average Analysis
        if (indicators.ma20 && indicators.ma50) {
            if (currentPrice > indicators.ma20 && indicators.ma20 > indicators.ma50) {
                bullishSignals += 1;
                signalStrength += 0.15;
            }
            else if (currentPrice < indicators.ma20 && indicators.ma20 < indicators.ma50) {
                bearishSignals += 1;
                signalStrength += 0.15;
            }
        }
        // Bollinger Bands Analysis
        if (indicators.bollinger) {
            const { upper, middle, lower } = indicators.bollinger;
            if (currentPrice <= lower) {
                bullishSignals += 1; // Price at lower band - potential bounce
                signalStrength += 0.2;
            }
            else if (currentPrice >= upper) {
                bearishSignals += 1; // Price at upper band - potential reversal
                signalStrength += 0.2;
            }
        }
        // Price momentum analysis
        if (priceHistory.length >= 5) {
            const recentPrices = priceHistory.slice(-5);
            const momentum = (currentPrice - recentPrices[0]) / recentPrices[0];
            if (momentum > 0.02) { // 2% upward momentum
                bullishSignals += 1;
                signalStrength += 0.1;
            }
            else if (momentum < -0.02) { // 2% downward momentum
                bearishSignals += 1;
                signalStrength += 0.1;
            }
        }
        // Determine signal direction and confidence
        const netBullish = bullishSignals - bearishSignals;
        const side = netBullish > 0 ? 'BUY' : 'SELL';
        const confidence = Math.min(0.9, Math.max(0.3, signalStrength + Math.abs(netBullish) * 0.1));
        return { side, confidence };
    }
    /**
     * Apply ML-enhanced confidence scoring based on historical performance
     */
    calculateMLConfidence(symbol, baseConfidence) {
        if (!this.databaseService) {
            return baseConfidence;
        }
        try {
            // Get recent trade history for this symbol
            const recentTrades = this.databaseService.getTradeHistory(symbol, 50);
            if (recentTrades.length < 5) {
                return baseConfidence; // Not enough data
            }
            // Calculate historical success rate
            const successfulTrades = recentTrades.filter(trade => trade.pnl !== undefined && trade.pnl > 0);
            const successRate = successfulTrades.length / recentTrades.length;
            // Calculate average confidence vs actual performance correlation
            let confidenceAccuracySum = 0;
            let validTradesCount = 0;
            recentTrades.forEach(trade => {
                if (trade.pnl !== undefined && trade.confidence) {
                    const wasSuccessful = trade.pnl > 0 ? 1 : 0;
                    const expectedSuccess = trade.confidence;
                    const accuracyDiff = Math.abs(wasSuccessful - expectedSuccess);
                    confidenceAccuracySum += (1 - accuracyDiff); // Higher value = better accuracy
                    validTradesCount++;
                }
            });
            const avgAccuracy = validTradesCount > 0 ? confidenceAccuracySum / validTradesCount : 0.5;
            // Adjust confidence based on historical performance
            let adjustment = 1.0;
            if (successRate > 0.6) {
                adjustment = 1.1; // Boost confidence for historically successful symbol
            }
            else if (successRate < 0.4) {
                adjustment = 0.8; // Reduce confidence for historically unsuccessful symbol
            }
            // Further adjust based on confidence accuracy
            if (avgAccuracy > 0.7) {
                adjustment *= 1.05; // Our confidence estimates are accurate
            }
            else if (avgAccuracy < 0.5) {
                adjustment *= 0.9; // Our confidence estimates are poor
            }
            const adjustedConfidence = baseConfidence * adjustment;
            // Store the adjustment for tracking
            this.confidenceAdjustment.set(symbol, adjustment);
            return adjustedConfidence;
        }
        catch (error) {
            console.warn(`⚠️ ML confidence calculation failed for ${symbol}:`, error);
            return baseConfidence;
        }
    }
    /**
     * Apply performance-based adjustments to confidence
     */
    applyPerformanceAdjustment(symbol, confidence) {
        const recentAccuracy = this.recentPredictionAccuracy.get(symbol) || [];
        if (recentAccuracy.length < 3) {
            return confidence; // Not enough recent data
        }
        // Calculate recent performance trend
        const recentAvg = recentAccuracy.slice(-10).reduce((sum, acc) => sum + acc, 0) / Math.min(10, recentAccuracy.length);
        let performanceMultiplier = 1.0;
        if (recentAvg > 0.7) {
            performanceMultiplier = 1.15; // Recent predictions have been very accurate
        }
        else if (recentAvg > 0.6) {
            performanceMultiplier = 1.05; // Recent predictions have been good
        }
        else if (recentAvg < 0.4) {
            performanceMultiplier = 0.85; // Recent predictions have been poor
        }
        else if (recentAvg < 0.3) {
            performanceMultiplier = 0.7; // Recent predictions have been very poor
        }
        return confidence * performanceMultiplier;
    }
    /**
     * Estimate expected return based on historical data and market conditions
     */
    estimateExpectedReturn(input) {
        if (!this.databaseService) {
            return 0.025; // Default 2.5% expected return
        }
        try {
            const recentTrades = this.databaseService.getTradeHistory(input.symbol, 20);
            if (recentTrades.length === 0) {
                return 0.025;
            }
            // Calculate average return from recent trades
            const tradesWithPnL = recentTrades.filter(trade => trade.pnl !== undefined);
            if (tradesWithPnL.length === 0) {
                return 0.025;
            }
            const avgPnLPercent = tradesWithPnL.reduce((sum, trade) => {
                const returnPercent = (trade.pnl || 0) / (trade.quantity * trade.price);
                return sum + returnPercent;
            }, 0) / tradesWithPnL.length;
            // Clamp between reasonable bounds
            return Math.max(-0.1, Math.min(0.1, avgPnLPercent));
        }
        catch (error) {
            console.warn(`⚠️ Expected return calculation failed for ${input.symbol}:`, error);
            return 0.025;
        }
    }
    /**
     * Estimate win probability based on historical performance
     */
    estimateWinProbability(symbol, side) {
        if (!this.databaseService) {
            return 0.55; // Default 55% win probability
        }
        try {
            const recentTrades = this.databaseService.getTradeHistory(symbol, 30);
            const sameSideTrades = recentTrades.filter(trade => trade.side === side && trade.pnl !== undefined);
            if (sameSideTrades.length < 3) {
                return 0.55; // Default if not enough data
            }
            const winningTrades = sameSideTrades.filter(trade => (trade.pnl || 0) > 0);
            const winRate = winningTrades.length / sameSideTrades.length;
            // Apply some smoothing to avoid extreme values
            const smoothedWinRate = 0.55 * 0.3 + winRate * 0.7;
            // Clamp between reasonable bounds
            return Math.max(0.2, Math.min(0.8, smoothedWinRate));
        }
        catch (error) {
            console.warn(`⚠️ Win probability calculation failed for ${symbol}:`, error);
            return 0.55;
        }
    }
    /**
     * Calculate dynamic stop loss based on volatility and recent performance
     */
    calculateDynamicStopLoss(input) {
        const { currentPrice, priceHistory } = input;
        // Calculate recent volatility
        let volatility = 0.02; // Default 2%
        if (priceHistory.length >= 10) {
            const recentPrices = priceHistory.slice(-10);
            const returns = recentPrices.slice(1).map((price, i) => Math.log(price / recentPrices[i]));
            const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
            volatility = Math.sqrt(variance) * 2; // 2 standard deviations
        }
        // Dynamic stop loss: 1.5x to 3x recent volatility
        const stopLossPercent = Math.max(0.015, Math.min(0.05, volatility * 2));
        return currentPrice * (1 - stopLossPercent);
    }
    /**
     * Calculate dynamic take profit based on risk-reward ratio and confidence
     */
    calculateDynamicTakeProfit(input) {
        const { currentPrice } = input;
        // Base take profit at 3-5% depending on confidence and expected return
        const expectedReturn = this.estimateExpectedReturn(input);
        const takeProfitPercent = Math.max(0.025, Math.min(0.08, Math.abs(expectedReturn) * 2.5));
        return currentPrice * (1 + takeProfitPercent);
    }
    /**
     * Update model performance based on actual trade results
     */
    updatePerformanceMetrics(symbol, predictedSuccess, actualSuccess) {
        const accuracy = predictedSuccess === actualSuccess ? 1 : 0;
        // Update recent accuracy tracking
        const recentAccuracy = this.recentPredictionAccuracy.get(symbol) || [];
        recentAccuracy.push(accuracy);
        // Keep only last 50 predictions
        if (recentAccuracy.length > 50) {
            recentAccuracy.shift();
        }
        this.recentPredictionAccuracy.set(symbol, recentAccuracy);
        console.log(`📊 Updated ML performance for ${symbol}: Recent accuracy: ${this.getRecentAccuracy(symbol).toFixed(3)}`);
    }
    /**
     * Get recent prediction accuracy for a symbol
     */
    getRecentAccuracy(symbol) {
        const recentAccuracy = this.recentPredictionAccuracy.get(symbol) || [];
        if (recentAccuracy.length === 0) {
            return 0.5; // Default
        }
        return recentAccuracy.reduce((sum, acc) => sum + acc, 0) / recentAccuracy.length;
    }
    /**
     * Log prediction for later evaluation
     */
    logPrediction(signal) {
        console.log(`🧠 ML Prediction for ${signal.symbol}:`, {
            side: signal.side,
            confidence: signal.confidence.toFixed(3),
            winProbability: signal.winProbability?.toFixed(3),
            expectedReturn: signal.expectedReturn ? (signal.expectedReturn * 100).toFixed(2) + '%' : 'N/A',
            mlAdjustment: signal.metadata?.mlAdjustment?.toFixed(3) || 'N/A',
            recentAccuracy: signal.metadata?.recentAccuracy?.toFixed(3) || 'N/A'
        });
    }
    /**
     * Set database service for historical data access
     */
    setDatabaseService(databaseService) {
        this.databaseService = databaseService;
    }
    /**
     * Get model performance statistics
     */
    getPerformanceStats() {
        const stats = {};
        for (const [symbol, accuracy] of this.recentPredictionAccuracy.entries()) {
            const avgAccuracy = accuracy.length > 0 ?
                accuracy.reduce((sum, acc) => sum + acc, 0) / accuracy.length : 0;
            stats[symbol] = {
                recentAccuracy: avgAccuracy,
                predictionCount: accuracy.length,
                confidenceAdjustment: this.confidenceAdjustment.get(symbol) || 1.0
            };
        }
        return stats;
    }
}
exports.PredictionEngine = PredictionEngine;
//# sourceMappingURL=prediction-engine.js.map