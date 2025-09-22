import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

export interface TradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price: number;
  executedPrice?: number;
  orderId?: string | number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'FAILED';
  fees?: number;
  commission?: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence: number;
  riskScore: number;
  pnl?: number;
  strategy?: string;
  metadata?: any;
}

export interface PositionRecord {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  timestamp: number;
  trades: string[]; // Trade IDs that make up this position
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  timestamp: number;
}

export interface MarketDataRecord {
  id: string;
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  indicators?: {
    rsi?: number;
    macd?: { macd: number; signal: number; histogram: number };
    bollinger?: { upper: number; middle: number; lower: number };
    ma20?: number;
    ma50?: number;
  };
}

export class Database extends EventEmitter {
  private dbPath: string;
  private trades: Map<string, TradeRecord> = new Map();
  private positions: Map<string, PositionRecord> = new Map();
  private marketData: Map<string, MarketDataRecord[]> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private isInitialized = false;

  constructor(dbPath: string = './data') {
    super();
    this.dbPath = path.resolve(dbPath);
  }

  async initialize(): Promise<void> {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dbPath, { recursive: true });

      // Load existing data
      await this.loadData();
      
      this.isInitialized = true;
      this.emit('connected');
      console.log('📊 Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async loadData(): Promise<void> {
    try {
      // Load trades
      const tradesPath = path.join(this.dbPath, 'trades.json');
      if (await this.fileExists(tradesPath)) {
        const tradesData = await fs.readFile(tradesPath, 'utf8');
        const trades = JSON.parse(tradesData);
        this.trades = new Map(Object.entries(trades));
        console.log(`📈 Loaded ${this.trades.size} trade records`);
      }

      // Load positions
      const positionsPath = path.join(this.dbPath, 'positions.json');
      if (await this.fileExists(positionsPath)) {
        const positionsData = await fs.readFile(positionsPath, 'utf8');
        const positions = JSON.parse(positionsData);
        this.positions = new Map(Object.entries(positions));
        console.log(`💼 Loaded ${this.positions.size} position records`);
      }

      // Load performance history
      const performancePath = path.join(this.dbPath, 'performance.json');
      if (await this.fileExists(performancePath)) {
        const performanceData = await fs.readFile(performancePath, 'utf8');
        this.performanceHistory = JSON.parse(performanceData);
        console.log(`📊 Loaded ${this.performanceHistory.length} performance records`);
      }

    } catch (error) {
      console.warn('Some data files could not be loaded (this is normal for first run):', error);
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  // Trade operations
  async saveTrade(trade: TradeRecord): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    this.trades.set(trade.id, trade);
    await this.persistTrades();
    this.emit('tradeAdded', trade);
  }

  async updateTrade(id: string, updates: Partial<TradeRecord>): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const existingTrade = this.trades.get(id);
    if (!existingTrade) throw new Error(`Trade ${id} not found`);
    
    const updatedTrade = { ...existingTrade, ...updates };
    this.trades.set(id, updatedTrade);
    await this.persistTrades();
    this.emit('tradeUpdated', updatedTrade);
  }

  getTrade(id: string): TradeRecord | undefined {
    return this.trades.get(id);
  }

  getAllTrades(): TradeRecord[] {
    return Array.from(this.trades.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  getTradesBySymbol(symbol: string): TradeRecord[] {
    return this.getAllTrades().filter(trade => trade.symbol === symbol);
  }

  getTradesInRange(startTime: number, endTime: number): TradeRecord[] {
    return this.getAllTrades().filter(trade => 
      trade.timestamp >= startTime && trade.timestamp <= endTime
    );
  }

  // Position operations
  async savePosition(position: PositionRecord): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    this.positions.set(position.id, position);
    await this.persistPositions();
    this.emit('positionAdded', position);
  }

  async updatePosition(id: string, updates: Partial<PositionRecord>): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const existingPosition = this.positions.get(id);
    if (!existingPosition) throw new Error(`Position ${id} not found`);
    
    const updatedPosition = { ...existingPosition, ...updates };
    this.positions.set(id, updatedPosition);
    await this.persistPositions();
    this.emit('positionUpdated', updatedPosition);
  }

  getPosition(id: string): PositionRecord | undefined {
    return this.positions.get(id);
  }

  getAllPositions(): PositionRecord[] {
    return Array.from(this.positions.values());
  }

  getOpenPositions(): PositionRecord[] {
    return this.getAllPositions().filter(position => position.size !== 0);
  }

  // Performance metrics
  async savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    this.performanceHistory.push(metrics);
    await this.persistPerformance();
    this.emit('performanceUpdated', metrics);
  }

  getLatestPerformance(): PerformanceMetrics | undefined {
    return this.performanceHistory[this.performanceHistory.length - 1];
  }

  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  // Market data operations
  async saveMarketData(data: MarketDataRecord): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    if (!this.marketData.has(data.symbol)) {
      this.marketData.set(data.symbol, []);
    }
    
    const symbolData = this.marketData.get(data.symbol)!;
    symbolData.push(data);
    
    // Keep only last 10000 records per symbol to manage memory
    if (symbolData.length > 10000) {
      symbolData.splice(0, symbolData.length - 10000);
    }
    
    // Persist market data less frequently (every 100 records)
    if (symbolData.length % 100 === 0) {
      await this.persistMarketData();
    }
  }

  getMarketData(symbol: string, limit?: number): MarketDataRecord[] {
    const data = this.marketData.get(symbol) || [];
    return limit ? data.slice(-limit) : data;
  }

  // Analytics methods
  calculateProfitLoss(): { totalPnL: number; realizedPnL: number; unrealizedPnL: number } {
    const trades = this.getAllTrades();
    const positions = this.getAllPositions();
    
    const realizedPnL = trades
      .filter(trade => trade.status === 'FILLED' && trade.pnl !== undefined)
      .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    
    const unrealizedPnL = positions
      .reduce((sum, position) => sum + position.unrealizedPnL, 0);
    
    return {
      totalPnL: realizedPnL + unrealizedPnL,
      realizedPnL,
      unrealizedPnL
    };
  }

  calculateWinRate(): number {
    const filledTrades = this.getAllTrades().filter(trade => trade.status === 'FILLED');
    if (filledTrades.length === 0) return 0;
    
    const winningTrades = filledTrades.filter(trade => (trade.pnl || 0) > 0);
    return winningTrades.length / filledTrades.length;
  }

  // Persistence methods
  private async persistTrades(): Promise<void> {
    const tradesPath = path.join(this.dbPath, 'trades.json');
    const tradesObj = Object.fromEntries(this.trades);
    await fs.writeFile(tradesPath, JSON.stringify(tradesObj, null, 2));
  }

  private async persistPositions(): Promise<void> {
    const positionsPath = path.join(this.dbPath, 'positions.json');
    const positionsObj = Object.fromEntries(this.positions);
    await fs.writeFile(positionsPath, JSON.stringify(positionsObj, null, 2));
  }

  private async persistPerformance(): Promise<void> {
    const performancePath = path.join(this.dbPath, 'performance.json');
    await fs.writeFile(performancePath, JSON.stringify(this.performanceHistory, null, 2));
  }

  private async persistMarketData(): Promise<void> {
    // Save market data in separate files per symbol to avoid large files
    for (const [symbol, data] of this.marketData.entries()) {
      const marketDataPath = path.join(this.dbPath, `market_${symbol.toLowerCase()}.json`);
      await fs.writeFile(marketDataPath, JSON.stringify(data, null, 2));
    }
  }

  async close(): Promise<void> {
    if (!this.isInitialized) return;
    
    // Persist all data before closing
    await Promise.all([
      this.persistTrades(),
      this.persistPositions(),
      this.persistPerformance(),
      this.persistMarketData()
    ]);
    
    this.isInitialized = false;
    this.emit('disconnected');
    console.log('📊 Database connection closed');
  }
}