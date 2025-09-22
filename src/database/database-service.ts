import { Database, TradeRecord, PositionRecord, PerformanceMetrics, MarketDataRecord } from './database';
import { TradeSignal } from '../portfolio/risk-manager';
import { EventEmitter } from 'events';

export interface TradeExecutionResult {
  orderId: string | number;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  executedPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence: number;
  riskScore: number;
  status: 'FILLED' | 'FAILED' | 'CANCELLED';
  error?: string;
}

export class DatabaseService extends EventEmitter {
  private db: Database;
  private isConnected = false;

  constructor(dbPath?: string) {
    super();
    this.db = new Database(dbPath);
    
    // Forward database events
    this.db.on('connected', () => {
      this.isConnected = true;
      this.emit('connected');
    });
    
    this.db.on('disconnected', () => {
      this.isConnected = false;
      this.emit('disconnected');
    });
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
    console.log('🗄️ Database service initialized');
  }

  async close(): Promise<void> {
    await this.db.close();
    console.log('🗄️ Database service closed');
  }

  // Trade management
  async recordTradeExecution(result: TradeExecutionResult): Promise<string> {
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const trade: TradeRecord = {
      id: tradeId,
      timestamp: Date.now(),
      symbol: result.symbol,
      side: result.side,
      type: 'MARKET', // Most trades are market orders for now
      quantity: result.size,
      price: result.price,
      executedPrice: result.executedPrice || result.price,
      orderId: result.orderId,
      status: result.status,
      stopLoss: result.stopLoss,
      takeProfit: result.takeProfit,
      confidence: result.confidence,
      riskScore: result.riskScore,
      strategy: 'adaptive_strategy' // Default strategy name
    };

    await this.db.saveTrade(trade);
    console.log(`📝 Recorded trade execution: ${tradeId} - ${result.symbol} ${result.side} ${result.size}`);
    
    return tradeId;
  }

  async updateTradeStatus(tradeId: string, status: 'FILLED' | 'CANCELLED' | 'FAILED', pnl?: number): Promise<void> {
    const updates: Partial<TradeRecord> = { status };
    if (pnl !== undefined) {
      updates.pnl = pnl;
    }
    
    await this.db.updateTrade(tradeId, updates);
    console.log(`🔄 Updated trade ${tradeId}: ${status}${pnl !== undefined ? ` (PnL: ${pnl})` : ''}`);
  }

  // Position tracking
  async updatePosition(symbol: string, currentPrice: number, trades: string[]): Promise<void> {
    const positionId = `pos_${symbol}`;
    let position = this.db.getPosition(positionId);
    
    // Calculate position size and PnL from trades
    let totalSize = 0;
    let totalCost = 0;
    let realizedPnL = 0;
    
    for (const tradeId of trades) {
      const trade = this.db.getTrade(tradeId);
      if (trade && trade.status === 'FILLED') {
        const sizeChange = trade.side === 'BUY' ? trade.quantity : -trade.quantity;
        totalSize += sizeChange;
        totalCost += sizeChange * (trade.executedPrice || trade.price);
        
        if (trade.pnl) {
          realizedPnL += trade.pnl;
        }
      }
    }
    
    const entryPrice = totalSize !== 0 ? totalCost / totalSize : 0;
    const unrealizedPnL = totalSize * (currentPrice - entryPrice);
    
    const positionRecord: PositionRecord = {
      id: positionId,
      symbol,
      side: totalSize > 0 ? 'LONG' : 'SHORT',
      size: Math.abs(totalSize),
      entryPrice,
      currentPrice,
      unrealizedPnL,
      realizedPnL,
      timestamp: Date.now(),
      trades
    };

    if (position) {
      await this.db.updatePosition(positionId, positionRecord);
    } else {
      await this.db.savePosition(positionRecord);
    }
  }

  // Market data storage
  async saveMarketData(symbol: string, klineData: any): Promise<void> {
    const marketData: MarketDataRecord = {
      id: `${symbol}_${klineData.openTime}`,
      symbol,
      timestamp: klineData.openTime,
      open: parseFloat(klineData.open),
      high: parseFloat(klineData.high),
      low: parseFloat(klineData.low),
      close: parseFloat(klineData.close),
      volume: parseFloat(klineData.volume)
    };

    await this.db.saveMarketData(marketData);
  }

  // Analytics and reporting
  async calculateAndSavePerformanceMetrics(): Promise<PerformanceMetrics> {
    const trades = this.db.getAllTrades().filter(t => t.status === 'FILLED');
    const pnlData = this.db.calculateProfitLoss();
    
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
    
    const metrics: PerformanceMetrics = {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: this.db.calculateWinRate(),
      totalPnL: pnlData.totalPnL,
      maxDrawdown: this.calculateMaxDrawdown(trades),
      maxDrawdownPercent: this.calculateMaxDrawdownPercent(trades),
      sharpeRatio: this.calculateSharpeRatio(trades),
      averageWin: winningTrades.length > 0 ? 
        winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? 
        Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)) / losingTrades.length : 0,
      profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
      timestamp: Date.now()
    };

    await this.db.savePerformanceMetrics(metrics);
    return metrics;
  }

  private calculateMaxDrawdown(trades: TradeRecord[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let currentBalance = 0;

    for (const trade of trades.sort((a, b) => a.timestamp - b.timestamp)) {
      currentBalance += trade.pnl || 0;
      
      if (currentBalance > peak) {
        peak = currentBalance;
      }
      
      const drawdown = peak - currentBalance;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateMaxDrawdownPercent(trades: TradeRecord[]): number {
    // Simplified calculation - would need initial capital for accurate percentage
    const maxDrawdown = this.calculateMaxDrawdown(trades);
    const initialCapital = 10000; // From settings
    return maxDrawdown / initialCapital;
  }

  private calculateSharpeRatio(trades: TradeRecord[]): number {
    if (trades.length < 2) return 0;
    
    const returns = trades.map(t => t.pnl || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  private calculateProfitFactor(winningTrades: TradeRecord[], losingTrades: TradeRecord[]): number {
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  }

  // Query methods for analysis and ML training
  getTradeHistory(symbol?: string, limit?: number): TradeRecord[] {
    let trades = this.db.getAllTrades().filter(t => t.status === 'FILLED');
    
    if (symbol) {
      trades = trades.filter(t => t.symbol === symbol);
    }
    
    if (limit) {
      trades = trades.slice(0, limit);
    }
    
    return trades;
  }

  getPositionHistory(): PositionRecord[] {
    return this.db.getAllPositions();
  }

  getPerformanceHistory(): PerformanceMetrics[] {
    return this.db.getPerformanceHistory();
  }

  getMarketDataForTraining(symbol: string, limit: number = 1000): MarketDataRecord[] {
    return this.db.getMarketData(symbol, limit);
  }

  // Health check
  isHealthy(): boolean {
    return this.isConnected;
  }

  // Statistics for dashboard
  getStatistics() {
    const trades = this.db.getAllTrades();
    const positions = this.db.getAllPositions();
    const performance = this.db.getLatestPerformance();
    const pnlData = this.db.calculateProfitLoss();

    return {
      totalTrades: trades.length,
      activeTrades: trades.filter(t => t.status === 'PENDING').length,
      filledTrades: trades.filter(t => t.status === 'FILLED').length,
      failedTrades: trades.filter(t => t.status === 'FAILED').length,
      totalPositions: positions.length,
      openPositions: this.db.getOpenPositions().length,
      totalPnL: pnlData.totalPnL,
      realizedPnL: pnlData.realizedPnL,
      unrealizedPnL: pnlData.unrealizedPnL,
      winRate: this.db.calculateWinRate(),
      lastPerformanceUpdate: performance?.timestamp
    };
  }
}