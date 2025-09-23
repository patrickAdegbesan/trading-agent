import { BaseStrategy } from './base-strategy';

export class AdaptiveStrategy extends BaseStrategy {
    private marketConditions: any;

    constructor() {
        super();
        this.marketConditions = {};
    }

    public generateSignals(marketData: any): any {
        this.updateMarketConditions(marketData);
        // Implement dynamic signal generation logic based on market conditions
        const signals = this.dynamicSignalGeneration();
        return signals;
    }

    public evaluatePerformance(trades: any[]): any {
        // Enhanced performance evaluation with adaptive metrics
        const basePerformance = super.evaluatePerformance(trades);
        
        // Add adaptive-specific metrics based on available data
        const adaptiveMetrics = {
            ...basePerformance,
            volatilityAdaptation: this.marketConditions.volatility || 0.3,
            trendAlignment: this.marketConditions.trend || 'sideways'
        };
        
        return adaptiveMetrics;
    }

    private updateMarketConditions(marketData: any): void {
        // Analyze market data to update market conditions
        this.marketConditions = {
            volatility: this.calculateVolatility(marketData),
            trend: this.detectTrend(marketData),
            // Add more conditions as needed
        };
    }

    private calculateVolatility(marketData: any): number {
        // Calculate volatility based on price movements in market data
        if (!marketData || !marketData.prices || marketData.prices.length < 2) {
            return 0.3; // Default moderate volatility
        }
        
        try {
            const prices = marketData.prices.slice(-20); // Use last 20 data points
            const returns = [];
            
            for (let i = 1; i < prices.length; i++) {
                const returnRate = (prices[i] - prices[i-1]) / prices[i-1];
                returns.push(returnRate);
            }
            
            // Calculate standard deviation of returns
            const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
            const volatility = Math.sqrt(variance);
            
            // Normalize to 0-1 range
            return Math.min(1, Math.max(0, volatility * 100));
        } catch (error) {
            console.warn('Error calculating volatility:', error);
            return 0.3; // Safe fallback
        }
    }

    private detectTrend(marketData: any): string {
        // Detect trend based on moving averages and price action
        if (!marketData || !marketData.prices || marketData.prices.length < 10) {
            return 'sideways'; // Default neutral trend
        }
        
        try {
            const prices = marketData.prices.slice(-10); // Use last 10 data points
            const shortMA = prices.slice(-5).reduce((sum: number, p: number) => sum + p, 0) / 5;
            const longMA = prices.reduce((sum: number, p: number) => sum + p, 0) / 10;
            
            const currentPrice = prices[prices.length - 1];
            const previousPrice = prices[prices.length - 2];
            
            // Combine moving average comparison with recent price action
            const maSignal = shortMA > longMA ? 1 : -1;
            const priceSignal = currentPrice > previousPrice ? 1 : -1;
            const combinedSignal = (maSignal + priceSignal) / 2;
            
            if (combinedSignal > 0.3) return 'uptrend';
            if (combinedSignal < -0.3) return 'downtrend';
            return 'sideways';
        } catch (error) {
            console.warn('Error detecting trend:', error);
            return 'sideways'; // Safe fallback
        }
    }

    private dynamicSignalGeneration(): any {
        // Generate signals based on the updated market conditions
        if (this.marketConditions.volatility > 0.5 && this.marketConditions.trend === 'uptrend') {
            return { action: 'buy', strength: this.marketConditions.volatility };
        } else if (this.marketConditions.volatility > 0.5 && this.marketConditions.trend === 'downtrend') {
            return { action: 'sell', strength: this.marketConditions.volatility };
        }
        return { action: 'hold' };
    }
}