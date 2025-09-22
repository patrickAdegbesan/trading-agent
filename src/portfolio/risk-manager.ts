import { EventEmitter } from 'events';
import { settings, TradingConfig } from '../config/settings';
import { Portfolio } from '../types';

export interface PositionInfo {
  symbol: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  side: 'LONG' | 'SHORT';
  timestamp: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalPnL: number;
  dailyPnL: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  openPositions: number;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyDrawdown: number;
  maxTotalDrawdown: number;
  maxCorrelation: number;
  maxLeverage: number;
  maxTradesPerDay: number;
  kellyFraction: number;
}

export interface TradeSignal {
  symbol: string;
  side: 'BUY' | 'SELL';
  confidence: number; // 0-1
  stopLoss?: number;
  takeProfit?: number;
  expectedReturn?: number;
  winProbability?: number;
  timestamp: number;
}

export interface RiskAssessment {
  approved: boolean;
  positionSize: number;
  reason?: string;
  adjustedSignal?: TradeSignal;
  riskScore: number; // 0-100
}

export class RiskManager extends EventEmitter {
  private positions: Map<string, PositionInfo> = new Map();
  private tradeHistory: any[] = [];
  private dailyTrades = 0;
  private dailyPnL = 0;
  private startOfDayTimestamp = 0;
  private portfolioValue: number;
  private initialValue: number;
  private maxPortfolioValue: number;
  private circuitBreakerTriggered = false;
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  
  private readonly limits: RiskLimits;

  constructor(initialCapital: number, config: TradingConfig = settings) {
    super();
    this.portfolioValue = initialCapital;
    this.initialValue = initialCapital;
    this.maxPortfolioValue = initialCapital;
    this.startOfDayTimestamp = this.getStartOfDay();
    
    this.limits = {
      maxPositionSize: config.trading.maxPositionSize,
      maxDailyDrawdown: config.trading.maxDailyDrawdown,
      maxTotalDrawdown: 0.2, // Hard coded 20% max drawdown
      maxCorrelation: 0.7,
      maxLeverage: config.trading.leverage,
      maxTradesPerDay: config.riskManagement.maxTradesPerDay,
      kellyFraction: config.riskManagement.kellyFraction
    };
  }

  /**
   * Evaluate position size based on risk parameters
   */
  public async evaluatePosition(params: { symbol: string; confidence: number; portfolio: Portfolio }): Promise<number> {
    try {
      const signal: TradeSignal = {
        symbol: params.symbol,
        side: 'BUY', // Default to BUY for position sizing
        confidence: params.confidence,
        timestamp: Date.now()
      };

      // Use portfolio value from params
      this.portfolioValue = params.portfolio.totalValue;

      // Get risk assessment
      const assessment = this.assessTradeRisk(signal, 0); // Price will be determined later

      if (!assessment.approved) {
        console.log(`Position evaluation rejected: ${assessment.reason}`);
        return 0;
      }

      return assessment.positionSize;
    } catch (error) {
      console.error('Position evaluation failed:', error);
      return 0;
    }
  }

  /**
   * Main risk assessment method - analyzes trade signal and returns risk decision
   */
  public assessTradeRisk(signal: TradeSignal, currentPrice: number): RiskAssessment {
    try {
      // Ensure portfolio value is set
      if (!this.portfolioValue || this.portfolioValue <= 0) {
        const initialCapital = parseFloat(process.env.INITIAL_CAPITAL || '10000');
        this.portfolioValue = initialCapital;
        console.log(`[DEBUG RiskManager] Setting portfolio value from env:`, { portfolioValue: this.portfolioValue });
      }

      // DEBUG: Log input values
      console.log(`[DEBUG RiskManager] Assessing trade risk:`, {
        symbol: signal.symbol,
        side: signal.side,
        confidence: signal.confidence,
        currentPrice,
        priceType: typeof currentPrice,
        isValid: currentPrice > 0,
        portfolioValue: this.portfolioValue
      });

      // Validate price first
      if (!currentPrice || currentPrice <= 0) {
        console.log(`[DEBUG RiskManager] Price validation failed:`, { currentPrice, isNumber: typeof currentPrice });
        return {
          approved: false,
          positionSize: 0,
          reason: 'Invalid or zero price',
          riskScore: 100
        };
      }

      // Reset daily counters if new day
      this.checkAndResetDaily();

      // Circuit breaker check
      if (this.circuitBreakerTriggered) {
        return {
          approved: false,
          positionSize: 0,
          reason: 'Circuit breaker active - trading halted',
          riskScore: 100
        };
      }

      // Basic risk checks
      const basicCheck = this.performBasicRiskChecks(signal);
      if (!basicCheck.approved) {
        return basicCheck;
      }

      // Calculate optimal position size using Kelly Criterion
      const positionSize = this.calculateKellyPositionSize(signal, currentPrice);
      
      // Portfolio concentration check
      const concentrationCheck = this.checkPortfolioConcentration(signal.symbol, positionSize);
      if (!concentrationCheck.approved) {
        return concentrationCheck;
      }

      // Correlation check
      const correlationCheck = this.checkCorrelationRisk(signal.symbol, positionSize);
      if (!correlationCheck.approved) {
        return correlationCheck;
      }

      // Final risk score calculation
      const riskScore = this.calculateRiskScore(signal, positionSize, currentPrice);

      return {
        approved: true,
        positionSize,
        riskScore,
        adjustedSignal: {
          ...signal,
          // Add risk-adjusted stop loss and take profit
          stopLoss: signal.stopLoss || this.calculateStopLoss(currentPrice, signal.side),
          takeProfit: signal.takeProfit || this.calculateTakeProfit(currentPrice, signal.side, signal.confidence)
        }
      };

    } catch (error) {
      console.error('Risk assessment error:', error);
      return {
        approved: false,
        positionSize: 0,
        reason: 'Risk assessment error',
        riskScore: 100
      };
    }
  }

  /**
   * Kelly Criterion position sizing with robust error handling
   */
  private calculateKellyPositionSize(signal: TradeSignal, currentPrice: number): number {
    try {
      // DEBUG: Log inputs
      console.log(`[DEBUG Kelly] Position sizing inputs:`, {
        symbol: signal.symbol,
        currentPrice,
        portfolioValue: this.portfolioValue,
        confidence: signal.confidence,
        winProbability: signal.winProbability,
        expectedReturn: signal.expectedReturn
      });

      // Validate inputs
      if (!currentPrice || currentPrice <= 0 || !isFinite(currentPrice)) {
        console.warn('Invalid current price for position sizing, using fallback');
        return this.calculateFallbackPositionSize(signal, 50000); // Use fallback price
      }

      if (!this.portfolioValue || this.portfolioValue <= 0) {
        console.warn('Invalid portfolio value, cannot calculate position size');
        console.log(`[DEBUG Kelly] Portfolio value issue:`, { portfolioValue: this.portfolioValue });
        return 0;
      }

      const winProb = signal.winProbability || this.estimateWinProbability(signal);
      const avgWin = signal.expectedReturn || this.getHistoricalAvgWin();
      const avgLoss = this.getHistoricalAvgLoss();

      // Validate probabilities and returns
      if (!isFinite(winProb) || winProb <= 0 || winProb >= 1) {
        console.warn(`Invalid win probability: ${winProb}, using fallback`);
        return this.calculateFallbackPositionSize(signal, currentPrice);
      }

      if (!isFinite(avgWin) || avgWin <= 0) {
        console.warn(`Invalid average win: ${avgWin}, using fallback`);
        return this.calculateFallbackPositionSize(signal, currentPrice);
      }

      if (!isFinite(avgLoss) || avgLoss >= 0) {
        console.warn(`Invalid average loss: ${avgLoss}, using fallback`);
        return this.calculateFallbackPositionSize(signal, currentPrice);
      }

      // Kelly Formula: f = (bp - q) / b
      // where: f = fraction to wager, b = odds of winning, p = probability of win, q = probability of loss
      const b = avgWin / Math.abs(avgLoss);
      const p = winProb;
      const q = 1 - p;
      
      if (!isFinite(b) || b <= 0) {
        console.warn(`Invalid odds calculation: ${b}, using fallback`);
        return this.calculateFallbackPositionSize(signal, currentPrice);
      }

      let kellyFraction = (b * p - q) / b;
      
      // Validate Kelly fraction
      if (!isFinite(kellyFraction) || kellyFraction < 0) {
        console.warn(`Invalid Kelly fraction: ${kellyFraction}, using fallback`);
        return this.calculateFallbackPositionSize(signal, currentPrice);
      }
      
      // Apply Kelly fraction limit and ensure non-negative
      kellyFraction = Math.max(0, Math.min(kellyFraction, this.limits.kellyFraction));
      
      // If Kelly fraction is too small, use fallback
      if (kellyFraction < 0.001) {
        console.warn(`Kelly fraction too small: ${kellyFraction}, using fallback`);
        return this.calculateFallbackPositionSize(signal, currentPrice);
      }
      
      // Calculate position size based on Kelly fraction and confidence
      // Apply quadratic confidence scaling for more realistic position sizing
      const confidenceMultiplier = Math.pow(signal.confidence, 1.5); // More dramatic scaling
      const basePositionSize = (this.portfolioValue * kellyFraction) * confidenceMultiplier;
      
      // Apply maximum position size limit
      const maxPositionValue = this.portfolioValue * this.limits.maxPositionSize;
      const positionValue = Math.min(basePositionSize, maxPositionValue);
      
      // Convert to position size (number of units)
      const positionSize = positionValue / currentPrice;
      
      // Final validation
      if (!isFinite(positionSize) || positionSize <= 0) {
        console.warn(`Invalid final position size: ${positionSize}, using fallback`);
        return this.calculateFallbackPositionSize(signal, currentPrice);
      }

      return positionSize;

    } catch (error) {
      console.error('Kelly position sizing error:', error);
      return this.calculateFallbackPositionSize(signal, currentPrice);
    }
  }

  /**
   * Fallback position sizing when Kelly calculation fails
   */
  private calculateFallbackPositionSize(signal: TradeSignal, currentPrice: number): number {
    try {
      // DEBUG: Log fallback inputs
      console.log(`[DEBUG Fallback] Position sizing inputs:`, {
        symbol: signal.symbol,
        currentPrice,
        portfolioValue: this.portfolioValue,
        confidence: signal.confidence
      });

      // Validate current price
      if (!currentPrice || currentPrice <= 0) {
        throw new Error('Invalid price for position sizing');
      }

      // Validate confidence
      if (!signal.confidence || signal.confidence <= 0 || signal.confidence > 1) {
        console.warn(`Invalid confidence ${signal.confidence}, using minimum viable confidence`);
        signal.confidence = 0.01; // Use minimum viable confidence instead of throwing error
      }

      // Use BASE_TRADE_SIZE from environment if available, otherwise use portfolio percentage
      const baseTradeSize = process.env.BASE_TRADE_SIZE ? parseFloat(process.env.BASE_TRADE_SIZE) : null;
      let positionSize: number;

      if (baseTradeSize && baseTradeSize > 0) {
        // Use fixed base trade size (in base currency units like BTC)
        positionSize = baseTradeSize * signal.confidence;
        console.log(`[DEBUG Fallback] Using BASE_TRADE_SIZE:`, { baseTradeSize, confidence: signal.confidence, positionSize });
      } else {
        // Fallback to portfolio percentage method
        const basePercentage = 0.02; // 2% of portfolio at max confidence
        const confidenceMultiplier = Math.pow(signal.confidence, 1.5);
        const confidenceAdjustedPercentage = basePercentage * confidenceMultiplier;
        
        // Enforce maximum position size limit
        const maxPositionValue = this.portfolioValue * this.limits.maxPositionSize;
        const targetPositionValue = Math.min(
          this.portfolioValue * confidenceAdjustedPercentage,
          maxPositionValue
        );
        
        positionSize = targetPositionValue / currentPrice;
        console.log(`[DEBUG Fallback] Using portfolio percentage:`, { 
          basePercentage, 
          confidenceAdjustedPercentage, 
          targetPositionValue, 
          positionSize 
        });
      }

      // Ensure minimum position size for Binance (BTC minimum is 0.0001)
      const minPositionSize = signal.symbol.includes('BTC') ? 0.0001 : 0.001;
      if (positionSize < minPositionSize) {
        console.log(`[DEBUG Fallback] Position too small (${positionSize}), using minimum (${minPositionSize})`);
        positionSize = minPositionSize;
      }
      
      // Ensure we have a valid, positive position size
      if (!isFinite(positionSize) || positionSize <= 0) {
        throw new Error('Invalid position size calculated');
      }

      console.log(`[DEBUG Fallback] Final position size:`, { positionSize, minPositionSize });
      return positionSize;
      
    } catch (error) {
      console.error('Fallback position sizing error:', error);
      return 0;
    }
  }

  private performBasicRiskChecks(signal: TradeSignal): RiskAssessment {
    // Update daily trade count before checking
    this.checkAndResetDaily();

    // Increment daily trades before checking (since this trade would count)
    this.dailyTrades++;

    // Check daily trade limit
    if (this.dailyTrades > this.limits.maxTradesPerDay) {
      this.dailyTrades--; // Revert increment since trade was rejected
      return {
        approved: false,
        positionSize: 0,
        reason: `Daily trade limit reached (${this.limits.maxTradesPerDay})`,
        riskScore: 80
      };
    }

    // Check daily drawdown
    const currentDrawdown = (this.maxPortfolioValue - this.portfolioValue) / this.maxPortfolioValue;
    if (currentDrawdown >= this.limits.maxDailyDrawdown) {
      this.triggerCircuitBreaker('Daily drawdown limit exceeded');
      return {
        approved: false,
        positionSize: 0,
        reason: 'Daily drawdown limit exceeded',
        riskScore: 100
      };
    }

    // Check total drawdown
    const totalDrawdown = (this.initialValue - this.portfolioValue) / this.initialValue;
    if (totalDrawdown >= this.limits.maxTotalDrawdown) {
      this.triggerCircuitBreaker('Total drawdown limit exceeded');
      return {
        approved: false,
        positionSize: 0,
        reason: 'Total drawdown limit exceeded',
        riskScore: 100
      };
    }

    // Check confidence threshold
    if (signal.confidence < 0.6) {
      return {
        approved: false,
        positionSize: 0,
        reason: 'Signal confidence too low',
        riskScore: 70
      };
    }

    return { approved: true, positionSize: 0, riskScore: 30 };
  }

  private checkPortfolioConcentration(symbol: string, positionSize: number): RiskAssessment {
    const currentPosition = this.positions.get(symbol);
    const currentExposure = currentPosition ? Math.abs(currentPosition.size) : 0;
    const newExposure = Math.abs(positionSize);
    const totalExposure = currentExposure + newExposure;
    
    const maxAllowedExposure = this.portfolioValue * this.limits.maxPositionSize;
    
    if (totalExposure > maxAllowedExposure) {
      // Adjust position size to fit within limits
      const adjustedSize = Math.max(0, maxAllowedExposure - currentExposure);
      
      if (adjustedSize < positionSize * 0.5) { // If adjustment is too severe
        return {
          approved: false,
          positionSize: 0,
          reason: `Position would exceed concentration limit for ${symbol}`,
          riskScore: 75
        };
      }
      
      return {
        approved: true,
        positionSize: adjustedSize,
        reason: `Position size adjusted for concentration limits`,
        riskScore: 60
      };
    }

    return { approved: true, positionSize, riskScore: 20 };
  }

  private checkCorrelationRisk(symbol: string, positionSize: number): RiskAssessment {
    const correlatedPositions = this.getHighlyCorrelatedPositions(symbol);
    let totalCorrelatedExposure = 0;

    for (const [corrSymbol, correlation] of correlatedPositions) {
      const position = this.positions.get(corrSymbol);
      if (position) {
        totalCorrelatedExposure += Math.abs(position.size) * Math.abs(correlation);
      }
    }

    const maxCorrelatedExposure = this.portfolioValue * this.limits.maxPositionSize * 2; // Allow 2x individual limit for correlated assets
    
    if (totalCorrelatedExposure > maxCorrelatedExposure) {
      return {
        approved: false,
        positionSize: 0,
        reason: 'Too much correlated exposure',
        riskScore: 85
      };
    }

    return { approved: true, positionSize, riskScore: 25 };
  }

  private calculateRiskScore(signal: TradeSignal, positionSize: number, currentPrice: number): number {
    try {
      let riskScore = 0;

      // Validate inputs
      if (!isFinite(positionSize) || positionSize < 0) positionSize = 0;
      if (!isFinite(currentPrice) || currentPrice <= 0) currentPrice = 50000; // fallback price
      if (!isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) signal.confidence = 0.5;
      if (!isFinite(this.portfolioValue) || this.portfolioValue <= 0) return 50; // medium risk fallback

      // Position size risk (larger positions = higher risk)
      const positionRatio = (positionSize * currentPrice) / this.portfolioValue;
      if (isFinite(positionRatio)) {
        riskScore += positionRatio * 100;
      }

      // Confidence risk (lower confidence = higher risk)
      riskScore += (1 - signal.confidence) * 50;

      // Volatility risk (if available)
      // This would ideally use ATR or recent volatility data
      riskScore += 20; // Base volatility risk

      // Current drawdown risk
      if (isFinite(this.maxPortfolioValue) && this.maxPortfolioValue > 0) {
        const currentDrawdown = (this.maxPortfolioValue - this.portfolioValue) / this.maxPortfolioValue;
        if (isFinite(currentDrawdown)) {
          riskScore += currentDrawdown * 100;
        }
      }

      const finalScore = Math.min(100, Math.max(0, riskScore));
      return isFinite(finalScore) ? finalScore : 50; // fallback to medium risk
    } catch (error) {
      console.warn('Risk score calculation error, using fallback:', error);
      return 50; // Medium risk fallback
    }
  }

  // Public getters
  public getPortfolioValue(): number {
    return this.portfolioValue;
  }

  public getPositions(): Map<string, PositionInfo> {
    return new Map(this.positions);
  }

  public isCircuitBreakerActive(): boolean {
    return this.circuitBreakerTriggered;
  }

  public getTradeHistory(): any[] {
    return [...this.tradeHistory];
  }

  public getRiskLimits(): RiskLimits {
    return { ...this.limits };
  }

  // Helper methods - simplified for brevity
  private estimateWinProbability(signal: TradeSignal): number {
    // Use signal confidence as base, add some variance for realism
    const baseWinRate = 0.55; // 55% base win rate
    const confidenceBonus = (signal.confidence - 0.5) * 0.2; // Confidence can add up to ±10%
    const winProb = Math.max(0.1, Math.min(0.9, baseWinRate + confidenceBonus));
    return winProb;
  }

  private getHistoricalAvgWin(): number {
    return 0.025; // 2.5% average win
  }

  private getHistoricalAvgLoss(): number {
    return -0.015; // 1.5% average loss
  }

  private calculateStopLoss(price: number, side: 'BUY' | 'SELL'): number {
    const stopLossPercent = 0.02; // 2% stop loss
    return side === 'BUY' ? 
      price * (1 - stopLossPercent) : 
      price * (1 + stopLossPercent);
  }

  private calculateTakeProfit(price: number, side: 'BUY' | 'SELL', confidence: number): number {
    const takeProfitPercent = 0.04 * confidence; // Variable take profit based on confidence
    return side === 'BUY' ? 
      price * (1 + takeProfitPercent) : 
      price * (1 - takeProfitPercent);
  }

  private getHighlyCorrelatedPositions(symbol: string): Map<string, number> {
    return new Map(); // Simplified - would use actual correlation data
  }

  private triggerCircuitBreaker(reason: string): void {
    this.circuitBreakerTriggered = true;
    console.error(`CIRCUIT BREAKER TRIGGERED: ${reason}`);
    this.emit('circuitBreaker', { reason, portfolioValue: this.portfolioValue });
  }

  /**
   * Manually reset the circuit breaker
   * Should only be used after resolving the underlying issue
   */
  public resetCircuitBreaker(): void {
    this.circuitBreakerTriggered = false;
    console.log('Circuit breaker manually reset');
    this.emit('circuitBreakerReset', { portfolioValue: this.portfolioValue });
  }

  private checkAndResetDaily(): void {
    const startOfToday = this.getStartOfDay();
    if (startOfToday > this.startOfDayTimestamp) {
      this.dailyTrades = 0;
      this.dailyPnL = 0;
      this.startOfDayTimestamp = startOfToday;
    }
  }

  private getStartOfDay(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
}