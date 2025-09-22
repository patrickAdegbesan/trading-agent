export declare function calculateMA(data: number[], period: number): number[];
export interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
}
export interface IndicatorValues {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    ema12?: number;
    ema26?: number;
    ema50?: number;
    rsi?: number;
    rsi_signal?: 'oversold' | 'overbought' | 'neutral';
    rsi_normalized?: number;
    stoch_k?: number;
    stoch_d?: number;
    williams_r?: number;
    macd?: number;
    macd_signal?: number;
    macd_histogram?: number;
    macd_trend?: 'bullish' | 'bearish' | 'neutral';
    bb_upper?: number;
    bb_middle?: number;
    bb_lower?: number;
    bb_width?: number;
    bb_position?: number;
    atr?: number;
    volume_sma?: number;
    volume_ratio?: number;
    volume_normalized?: number;
    adx?: number;
    trend_strength?: 'strong' | 'weak';
    price_change_1h?: number;
    price_change_4h?: number;
    price_change_24h?: number;
    volatility_1h?: number;
    volatility_24h?: number;
    pivot_point?: number;
    resistance_1?: number;
    resistance_2?: number;
    support_1?: number;
    support_2?: number;
}
export interface FeatureVector extends IndicatorValues {
    timestamp: number;
    symbol: string;
    price: number;
    volume: number;
    rsi_normalized?: number;
    volume_normalized?: number;
    volatility_normalized?: number;
    price_lag_1?: number;
    price_lag_5?: number;
    volume_lag_1?: number;
    rsi_lag_1?: number;
    price_zscore_20?: number;
    volume_zscore_20?: number;
    returns_mean_20?: number;
    returns_std_20?: number;
}
export declare class TechnicalIndicators {
    private candleBuffer;
    private readonly maxBufferSize;
    constructor();
    /**
     * Add new candle data and calculate all indicators
     */
    addCandle(symbol: string, candle: CandleData): FeatureVector;
    /**
     * Calculate complete feature vector from candle data
     */
    private calculateFeatures;
    private calculatePriceChange;
    private calculateVolatility;
    private calculatePivotPoints;
    private createFeatureVector;
    private calculateStd;
    /**
     * Get current buffer size for a symbol
     */
    getBufferSize(symbol: string): number;
    /**
     * Clear buffer for a symbol
     */
    clearBuffer(symbol: string): void;
    /**
     * Get historical feature vectors for backtesting
     */
    getHistoricalFeatures(symbol: string, candles: CandleData[]): FeatureVector[];
}
export declare function calculateMACD(data: number[], shortPeriod: number, longPeriod: number, signalPeriod: number): {
    macd: number[];
    signal: number[];
    histogram: number[];
};
//# sourceMappingURL=indicators.d.ts.map