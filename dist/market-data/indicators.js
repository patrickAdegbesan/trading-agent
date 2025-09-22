"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnicalIndicators = void 0;
exports.calculateMA = calculateMA;
exports.calculateMACD = calculateMACD;
function calculateMA(data, period) {
    const ma = [];
    for (let i = 0; i <= data.length - period; i++) {
        const slice = data.slice(i, i + period);
        const average = slice.reduce((sum, value) => sum + value, 0) / period;
        ma.push(average);
    }
    return ma;
}
const technicalindicators_1 = require("technicalindicators");
const lodash_1 = __importDefault(require("lodash"));
class TechnicalIndicators {
    constructor() {
        this.candleBuffer = new Map();
        this.maxBufferSize = 500; // Keep last 500 candles for calculations
    }
    /**
     * Add new candle data and calculate all indicators
     */
    addCandle(symbol, candle) {
        // Initialize buffer for symbol if not exists
        if (!this.candleBuffer.has(symbol)) {
            this.candleBuffer.set(symbol, []);
        }
        const candles = this.candleBuffer.get(symbol);
        candles.push(candle);
        // Keep buffer size manageable
        if (candles.length > this.maxBufferSize) {
            candles.shift();
        }
        // Calculate all indicators
        return this.calculateFeatures(symbol, candles);
    }
    /**
     * Calculate complete feature vector from candle data
     */
    calculateFeatures(symbol, candles) {
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const opens = candles.map(c => c.open);
        const volumes = candles.map(c => c.volume);
        const currentCandle = candles[candles.length - 1];
        const indicators = {};
        // Only calculate if we have enough data
        if (candles.length < 20) {
            // Not enough data for indicators yet - this is normal during startup
            return {
                timestamp: currentCandle.timestamp,
                symbol,
                price: currentCandle.close,
                volume: currentCandle.volume,
                ...indicators
            };
        }
        // Validate price data
        const invalidPrices = closes.filter(price => !isFinite(price) || price <= 0);
        if (invalidPrices.length > 0) {
            console.error(`Invalid price data for ${symbol}: ${invalidPrices.length} invalid prices out of ${closes.length}`);
        }
        try {
            // Moving Averages
            if (candles.length >= 20) {
                const sma20Values = technicalindicators_1.SMA.calculate({ period: 20, values: closes });
                indicators.sma20 = sma20Values[sma20Values.length - 1];
            }
            if (candles.length >= 50) {
                const sma50Values = technicalindicators_1.SMA.calculate({ period: 50, values: closes });
                indicators.sma50 = sma50Values[sma50Values.length - 1];
                const ema50Values = technicalindicators_1.EMA.calculate({ period: 50, values: closes });
                indicators.ema50 = ema50Values[ema50Values.length - 1];
            }
            if (candles.length >= 200) {
                const sma200Values = technicalindicators_1.SMA.calculate({ period: 200, values: closes });
                indicators.sma200 = sma200Values[sma200Values.length - 1];
            }
            // EMA for MACD
            if (candles.length >= 26) {
                try {
                    const ema12Values = technicalindicators_1.EMA.calculate({ period: 12, values: closes });
                    const ema26Values = technicalindicators_1.EMA.calculate({ period: 26, values: closes });
                    if (ema12Values.length > 0 && ema26Values.length > 0) {
                        indicators.ema12 = ema12Values[ema12Values.length - 1];
                        indicators.ema26 = ema26Values[ema26Values.length - 1];
                    }
                    else {
                        console.warn(`Empty EMA arrays for ${symbol}: ema12=${ema12Values.length}, ema26=${ema26Values.length}, closes=${closes.length}`);
                    }
                }
                catch (error) {
                    console.error(`Error calculating EMA for ${symbol}:`, error);
                }
            }
            // RSI
            if (candles.length >= 14) {
                try {
                    const rsiValues = technicalindicators_1.RSI.calculate({ period: 14, values: closes });
                    if (rsiValues.length > 0) {
                        const rsi = rsiValues[rsiValues.length - 1];
                        indicators.rsi = rsi;
                        indicators.rsi_signal = rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral';
                        indicators.rsi_normalized = rsi / 100;
                    }
                    else {
                        console.warn(`Empty RSI array for ${symbol}: rsi=${rsiValues.length}, closes=${closes.length}`);
                    }
                }
                catch (error) {
                    console.error(`Error calculating RSI for ${symbol}:`, error);
                }
            }
            // MACD
            if (candles.length >= 26) {
                const macdValues = technicalindicators_1.MACD.calculate({
                    fastPeriod: 12,
                    slowPeriod: 26,
                    signalPeriod: 9,
                    values: closes,
                    SimpleMAOscillator: false,
                    SimpleMASignal: false
                });
                if (macdValues.length > 0) {
                    const macd = macdValues[macdValues.length - 1];
                    indicators.macd = macd.MACD;
                    indicators.macd_signal = macd.signal;
                    indicators.macd_histogram = macd.histogram;
                    if (macd.MACD !== undefined && macd.signal !== undefined) {
                        indicators.macd_trend = macd.MACD > macd.signal ? 'bullish' : 'bearish';
                    }
                }
            }
            // Bollinger Bands
            if (candles.length >= 20) {
                const bbValues = technicalindicators_1.BollingerBands.calculate({
                    period: 20,
                    stdDev: 2,
                    values: closes
                });
                if (bbValues.length > 0) {
                    const bb = bbValues[bbValues.length - 1];
                    indicators.bb_upper = bb.upper;
                    indicators.bb_middle = bb.middle;
                    indicators.bb_lower = bb.lower;
                    indicators.bb_width = bb.upper - bb.lower;
                    // Position within bands (0 = lower band, 1 = upper band)
                    const priceRange = bb.upper - bb.lower;
                    indicators.bb_position = priceRange > 0 ?
                        (currentCandle.close - bb.lower) / priceRange : 0.5;
                }
            }
            // ATR (Average True Range)
            if (candles.length >= 14) {
                const atrValues = technicalindicators_1.ATR.calculate({
                    period: 14,
                    high: highs,
                    low: lows,
                    close: closes
                });
                indicators.atr = atrValues[atrValues.length - 1];
            }
            // Stochastic
            if (candles.length >= 14) {
                const stochValues = technicalindicators_1.Stochastic.calculate({
                    high: highs,
                    low: lows,
                    close: closes,
                    period: 14,
                    signalPeriod: 3
                });
                if (stochValues.length > 0) {
                    const stoch = stochValues[stochValues.length - 1];
                    indicators.stoch_k = stoch.k;
                    indicators.stoch_d = stoch.d;
                }
            }
            // Williams %R
            if (candles.length >= 14) {
                const williamsValues = technicalindicators_1.WilliamsR.calculate({
                    high: highs,
                    low: lows,
                    close: closes,
                    period: 14
                });
                indicators.williams_r = williamsValues[williamsValues.length - 1];
            }
            // Volume indicators
            if (candles.length >= 20) {
                const volumeSmaValues = technicalindicators_1.SMA.calculate({ period: 20, values: volumes });
                indicators.volume_sma = volumeSmaValues[volumeSmaValues.length - 1];
                indicators.volume_ratio = currentCandle.volume / indicators.volume_sma;
                indicators.volume_normalized = Math.min(indicators.volume_ratio, 3) / 3; // Cap at 3x
            }
            // Price changes and volatility
            indicators.price_change_1h = this.calculatePriceChange(closes, 1);
            indicators.price_change_4h = this.calculatePriceChange(closes, 4);
            indicators.price_change_24h = this.calculatePriceChange(closes, 24);
            indicators.volatility_1h = this.calculateVolatility(closes.slice(-4), 4);
            indicators.volatility_24h = this.calculateVolatility(closes.slice(-24), 24);
            // Support/Resistance (Pivot Points)
            if (candles.length >= 3) {
                const pivotData = this.calculatePivotPoints(candles[candles.length - 2].high, candles[candles.length - 2].low, candles[candles.length - 2].close);
                Object.assign(indicators, pivotData);
            }
        }
        catch (error) {
            console.error(`Error calculating indicators for ${symbol}:`, error);
        }
        // Create enhanced feature vector
        return this.createFeatureVector(symbol, currentCandle, candles, indicators);
    }
    calculatePriceChange(prices, periods) {
        if (prices.length < periods + 1)
            return 0;
        const current = prices[prices.length - 1];
        const previous = prices[prices.length - 1 - periods];
        return ((current - previous) / previous) * 100;
    }
    calculateVolatility(prices, periods) {
        if (prices.length < 2)
            return 0;
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(periods) * 100; // Annualized volatility percentage
    }
    calculatePivotPoints(high, low, close) {
        const pivot = (high + low + close) / 3;
        return {
            pivot_point: pivot,
            resistance_1: (2 * pivot) - low,
            resistance_2: pivot + (high - low),
            support_1: (2 * pivot) - high,
            support_2: pivot - (high - low)
        };
    }
    createFeatureVector(symbol, currentCandle, candles, indicators) {
        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        // Calculate lagged features
        const laggedFeatures = {};
        if (candles.length > 1) {
            laggedFeatures.price_lag_1 = candles[candles.length - 2].close;
            laggedFeatures.volume_lag_1 = candles[candles.length - 2].volume;
        }
        if (candles.length > 5) {
            laggedFeatures.price_lag_5 = candles[candles.length - 6].close;
        }
        // Calculate rolling statistics
        const rollingStats = {};
        if (candles.length >= 20) {
            const recent20Closes = closes.slice(-20);
            const recent20Volumes = volumes.slice(-20);
            const pricesMean = lodash_1.default.mean(recent20Closes);
            const pricesStd = this.calculateStd(recent20Closes);
            const volumesMean = lodash_1.default.mean(recent20Volumes);
            const volumesStd = this.calculateStd(recent20Volumes);
            rollingStats.price_zscore_20 = pricesStd > 0 ?
                (currentCandle.close - pricesMean) / pricesStd : 0;
            rollingStats.volume_zscore_20 = volumesStd > 0 ?
                (currentCandle.volume - volumesMean) / volumesStd : 0;
            // Returns statistics
            const returns = [];
            for (let i = 1; i < recent20Closes.length; i++) {
                returns.push((recent20Closes[i] - recent20Closes[i - 1]) / recent20Closes[i - 1]);
            }
            rollingStats.returns_mean_20 = lodash_1.default.mean(returns);
            rollingStats.returns_std_20 = this.calculateStd(returns);
        }
        return {
            timestamp: currentCandle.timestamp,
            symbol,
            price: currentCandle.close,
            volume: currentCandle.volume,
            ...indicators,
            ...laggedFeatures,
            ...rollingStats
        };
    }
    calculateStd(values) {
        const mean = lodash_1.default.mean(values);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    /**
     * Get current buffer size for a symbol
     */
    getBufferSize(symbol) {
        return this.candleBuffer.get(symbol)?.length || 0;
    }
    /**
     * Clear buffer for a symbol
     */
    clearBuffer(symbol) {
        this.candleBuffer.delete(symbol);
    }
    /**
     * Get historical feature vectors for backtesting
     */
    getHistoricalFeatures(symbol, candles) {
        const features = [];
        // Build features incrementally to simulate real-time calculation
        for (let i = 50; i < candles.length; i++) { // Start after 50 candles for proper indicator calculation
            const historicalCandles = candles.slice(0, i + 1);
            this.candleBuffer.set(symbol, historicalCandles.slice(-this.maxBufferSize));
            features.push(this.calculateFeatures(symbol, this.candleBuffer.get(symbol)));
        }
        return features;
    }
}
exports.TechnicalIndicators = TechnicalIndicators;
function calculateMACD(data, shortPeriod, longPeriod, signalPeriod) {
    const shortMA = calculateMA(data, shortPeriod);
    const longMA = calculateMA(data, longPeriod);
    const macd = [];
    const signal = [];
    const histogram = [];
    for (let i = 0; i < shortMA.length; i++) {
        macd.push(shortMA[i] - longMA[i]);
    }
    const signalMA = calculateMA(macd, signalPeriod);
    for (let i = 0; i < signalMA.length; i++) {
        signal.push(signalMA[i]);
        histogram.push(macd[i] - signalMA[i]);
    }
    return { macd, signal, histogram };
}
//# sourceMappingURL=indicators.js.map