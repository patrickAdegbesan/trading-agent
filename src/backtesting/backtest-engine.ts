import { BaseStrategy } from '../strategies/base-strategy';
import { TechnicalIndicators, FeatureVector, CandleData } from '../market-data/indicators';
import { RiskManager, TradeSignal } from '../portfolio/risk-manager';
import { ExchangeConnector } from '../exchanges/exchange-connector';

export interface BacktestConfig {
  startDate: string;
  endDate: string;
  initialCapital: number;
  symbols: string[];
  walkForwardPeriod: number; // days
  trainingPeriod: number; // days
  commission: number; // percentage per trade
  slippage: number; // percentage
}

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  avgTradeReturn: number;
  profitFactor: number;
  calmarRatio: number;
  trades: Trade[];
  equityCurve: EquityPoint[];
  monthlyReturns: MonthlyReturn[];
}

export interface Trade {
  symbol: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  pnl: number;
  commission: number;
  slippage: number;
  duration: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
}

export class BacktestEngine {
  private strategy: BaseStrategy;
  private indicators: TechnicalIndicators;
  private riskManager: RiskManager;
  private config: BacktestConfig;

  constructor(
    strategy: BaseStrategy, 
    config: BacktestConfig,
    riskManager?: RiskManager
  ) {
    this.strategy = strategy;
    this.config = config;
    this.indicators = new TechnicalIndicators();
    this.riskManager = riskManager || new RiskManager(config.initialCapital);
  }

  /**
   * Run walk-forward backtest
   */
  public async runBacktest(exchangeConnector: ExchangeConnector): Promise<BacktestResult> {
    console.log(`🔄 Starting walk-forward backtest from ${this.config.startDate} to ${this.config.endDate}`);

    const results: BacktestResult = {
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

  private async getHistoricalData(exchangeConnector: ExchangeConnector, symbol: string): Promise<CandleData[]> {
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
      
    } catch (error) {
      console.error(`Failed to get historical data for ${symbol}:`, error);
      return [];
    }
  }

  private async runWalkForwardAnalysis(symbol: string, data: CandleData[]): Promise<Partial<BacktestResult>> {
    const trades: Trade[] = [];
    const equityCurve: EquityPoint[] = [];
    
    let currentCapital = this.config.initialCapital;
    let maxCapital = currentCapital;
    let position: { quantity: number; entryPrice: number; entryTime: number; side: 'BUY' | 'SELL' } | null = null;

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

  private openPosition(signal: TradeSignal, positionSize: number, feature: FeatureVector): 
    { quantity: number; entryPrice: number; entryTime: number; side: 'BUY' | 'SELL' } {
    
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

  private closePosition(
    position: { quantity: number; entryPrice: number; entryTime: number; side: 'BUY' | 'SELL' },
    feature: FeatureVector,
    capital: number
  ): Trade | null {
    
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

  private calculateUnrealizedPnL(
    position: { quantity: number; entryPrice: number; side: 'BUY' | 'SELL' },
    currentPrice: number
  ): number {
    const pnlPerUnit = position.side === 'BUY' ? 
      (currentPrice - position.entryPrice) : (position.entryPrice - currentPrice);
    
    return pnlPerUnit * position.quantity;
  }

  private combineResults(main: BacktestResult, additional: Partial<BacktestResult>): void {
    if (additional.trades) {
      main.trades.push(...additional.trades);
    }
    if (additional.equityCurve) {
      main.equityCurve.push(...additional.equityCurve);
    }
  }

  private calculateFinalMetrics(results: BacktestResult): void {
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
  public generateReport(results: BacktestResult): string {
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

  private generateInsights(results: BacktestResult): string {
    const insights: string[] = [];

    if (results.winRate > 0.6) {
      insights.push("• High win rate indicates good signal quality");
    }
    
    if (results.sharpeRatio > 1.5) {
      insights.push("• Excellent risk-adjusted returns");
    } else if (results.sharpeRatio < 0.5) {
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