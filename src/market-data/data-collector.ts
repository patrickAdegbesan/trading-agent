import { EventEmitter } from 'events';
import { ExchangeConnector, KlineData, TickerData } from '../exchanges/exchange-connector';
import { TechnicalIndicators, CandleData, FeatureVector } from './indicators';
import { settings } from '../config/settings';
import winston from 'winston';

export interface MarketDataPoint {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  features?: FeatureVector;
}

export interface DataBuffer {
  symbol: string;
  data: MarketDataPoint[];
  maxSize: number;
  lastUpdate: number;
}

export interface MarketSnapshot {
  timestamp: number;
  symbols: Map<string, MarketDataPoint>;
  features: Map<string, FeatureVector>;
}

export class DataCollector extends EventEmitter {
  private exchangeConnector: ExchangeConnector;
  private indicators: TechnicalIndicators;
  private dataBuffers: Map<string, DataBuffer> = new Map();
  private currentPrices: Map<string, number> = new Map();
  private isCollecting = false;
  private logger: winston.Logger;
  private symbols: string[];
  private intervals: string[] = ['1m', '5m', '15m'];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private healthCheckInterval?: NodeJS.Timeout;
  private dataValidationErrors = 0;
  private maxValidationErrors = 100;
  private lastHealthCheckTime = 0;
  private lastReconnectTime = 0;

  constructor(exchangeConnector: ExchangeConnector, symbols: string[] = settings.trading.pairs) {
    super();
    this.exchangeConnector = exchangeConnector;
    this.indicators = new TechnicalIndicators();
    this.symbols = symbols;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/data-collector.log' })
      ]
    });

    // Initialize data buffers
    this.initializeBuffers();
    this.setupEventHandlers();
  }

  private initializeBuffers(): void {
    for (const symbol of this.symbols) {
      this.dataBuffers.set(symbol, {
        symbol,
        data: [],
        maxSize: 1000, // Keep last 1000 data points
        lastUpdate: 0
      });
    }
  }

  private setupEventHandlers(): void {
    // Exchange connection events
    this.exchangeConnector.on('connected', () => {
      this.logger.info('Exchange connector connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    });

    this.exchangeConnector.on('disconnected', () => {
      this.logger.warn('Exchange connector disconnected');
      if (this.isCollecting) {
        this.handleReconnection();
      }
    });

    this.exchangeConnector.on('error', (error) => {
      this.logger.error('Exchange connector error', { error });
      this.emit('error', error);
    });

    // Market data events
    this.exchangeConnector.on('kline', (klineData: KlineData) => {
      this.processKlineData(klineData);
    });

    this.exchangeConnector.on('ticker', (tickerData: TickerData) => {
      this.processTickerData(tickerData);
    });

    // WebSocket specific events
    this.exchangeConnector.on('wsError', ({ streamName, error }) => {
      this.logger.error(`WebSocket error for ${streamName}`, { error });
      this.handleReconnection();
    });
  }

  /**
   * Start collecting market data for all configured symbols
   */
  public async startCollection(): Promise<void> {
    if (this.isCollecting) {
      this.logger.warn('Data collection already started');
      return;
    }

    try {
      this.logger.info('Starting market data collection', { 
        symbols: this.symbols,
        intervals: this.intervals 
      });

      // FIXED: Don't reconnect if already connected - prevents connection storm
      if (!this.exchangeConnector.isConnectedToExchange()) {
        this.logger.warn('Exchange not connected - cannot start data collection');
        throw new Error('Exchange must be connected before starting data collection');
      }

      // Load initial historical data
      await this.loadInitialData();

      // Subscribe to real-time data streams - SAFELY RE-ENABLED
      await this.subscribeToRealTimeData();

      // Start health check
      this.startHealthCheck();

      this.isCollecting = true;
      this.emit('collectionStarted');

    } catch (error) {
      this.logger.error('Failed to start data collection', { error });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop collecting market data
   */
  public async stopCollection(): Promise<void> {
    if (!this.isCollecting) {
      return;
    }

    this.logger.info('Stopping market data collection');
    this.isCollecting = false;

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Disconnect from exchange
    await this.exchangeConnector.disconnect();
    
    this.emit('collectionStopped');
  }

  private async loadInitialData(): Promise<void> {
    this.logger.info('Loading initial historical data');
    
    const promises = this.symbols.map(async (symbol) => {
      try {
        // Get last 500 candles for primary interval (1m)
        const klines = await this.exchangeConnector.getKlines(symbol, '1m', 500);
        
        for (const kline of klines) {
          const candleData: CandleData = {
            open: parseFloat(kline.open),
            high: parseFloat(kline.high),
            low: parseFloat(kline.low),
            close: parseFloat(kline.close),
            volume: parseFloat(kline.volume),
            timestamp: kline.openTime
          };

          // Add to indicators for feature calculation
          const features = this.indicators.addCandle(symbol, candleData);
          
          // Add to buffer
          const dataPoint: MarketDataPoint = {
            symbol,
            timestamp: kline.openTime,
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
            volume: candleData.volume,
            features
          };

          this.addToBuffer(symbol, dataPoint);
          this.currentPrices.set(symbol, candleData.close);
        }

        this.logger.debug(`Loaded ${klines.length} historical candles for ${symbol}`);
        
      } catch (error) {
        this.logger.error(`Failed to load historical data for ${symbol}`, { error });
      }
    });

    await Promise.allSettled(promises);
    this.logger.info('Historical data loading completed');
  }

  private async subscribeToRealTimeData(): Promise<void> {
    this.logger.info('Starting real-time data subscriptions');
    
    // ✅ USING REST API ONLY - More reliable than WebSocket
    this.logger.warn('🚨 Using REST API polling mode only - WebSocket disabled for stability');
    
    // Skip WebSocket connections entirely - they're causing connection loops
    // Start REST API polling as primary data source
    this.startFallbackPolling();
  }
  
  private startFallbackPolling(): void {
    // Aggressive polling since WebSocket connections are failing
    // Poll for price updates every 30 seconds as primary data source
    setInterval(async () => {
      try {
        const now = Date.now();
        const staleThreshold = 30000; // 30 seconds stale threshold (aggressive polling)
        
        for (const symbol of this.symbols) {
          const buffer = this.dataBuffers.get(symbol);
          
          // Always make REST call if data is stale or missing
          if (!buffer || (now - buffer.lastUpdate) > staleThreshold) {
            this.logger.info(`🔄 Polling ${symbol} via REST API (WebSocket fallback: ${buffer ? (now - buffer.lastUpdate)/1000 : 'no data'}s stale)`);
            
            try {
              // Get current price via REST API
              const ticker = await this.exchangeConnector.getTickerData(symbol);
              if (ticker) {
                const price = parseFloat(ticker.price);
                this.currentPrices.set(symbol, price);
                this.emit('priceUpdate', { symbol, price, timestamp: now });
                
                // Also get recent kline data
                const klines = await this.exchangeConnector.getKlines(symbol, '1m', 1);
                if (klines && klines.length > 0) {
                  const kline = klines[0];
                  const candleData = {
                    open: parseFloat(kline.open),
                    high: parseFloat(kline.high),
                    low: parseFloat(kline.low),
                    close: parseFloat(kline.close),
                    volume: parseFloat(kline.volume),
                    timestamp: kline.openTime
                  };
                  
                  const features = this.indicators.addCandle(symbol, candleData);
                  const dataPoint: MarketDataPoint = {
                    symbol,
                    timestamp: kline.openTime,
                    open: candleData.open,
                    high: candleData.high,
                    low: candleData.low,
                    close: candleData.close,
                    volume: candleData.volume,
                    features
                  };
                  
                  this.addToBuffer(symbol, dataPoint);
                  this.emit('newCandle', dataPoint);
                }
                
                this.logger.debug(`✅ Updated ${symbol}: $${price}`);
              }
            } catch (error: any) {
              this.logger.warn(`⚠️ Failed to fetch ${symbol} data via REST API`, { error: error.message });
            }
          }
        }
      } catch (error: any) {
        this.logger.error('Error in fallback polling', { error: error.message });
      }
    }, 30000); // Poll every 30 seconds
    
    this.logger.info('🔄 Started aggressive REST API polling (WebSocket fallback mode)');
  }

  private processKlineData(klineData: KlineData): void {
    try {
      // Validate incoming data
      if (!this.validateKlineData(klineData)) {
        this.dataValidationErrors++;
        if (this.dataValidationErrors > this.maxValidationErrors) {
          this.logger.error('Too many validation errors, stopping collection');
          this.stopCollection();
          return;
        }
        return;
      }

      const candleData: CandleData = {
        open: parseFloat(klineData.open),
        high: parseFloat(klineData.high),
        low: parseFloat(klineData.low),
        close: parseFloat(klineData.close),
        volume: parseFloat(klineData.volume),
        timestamp: klineData.openTime
      };

      // Calculate technical indicators and features
      const features = this.indicators.addCandle(klineData.symbol, candleData);

      const dataPoint: MarketDataPoint = {
        symbol: klineData.symbol,
        timestamp: klineData.openTime,
        open: candleData.open,
        high: candleData.high,
        low: candleData.low,
        close: candleData.close,
        volume: candleData.volume,
        features
      };

      // Update current price
      this.currentPrices.set(klineData.symbol, candleData.close);

      // Add to buffer
      this.addToBuffer(klineData.symbol, dataPoint);

      // Emit new data event
      this.emit('newCandle', {
        symbol: klineData.symbol,
        data: dataPoint,
        features
      });

    } catch (error) {
      this.logger.error('Error processing kline data', { 
        error, 
        symbol: klineData.symbol 
      });
    }
  }

  private processTickerData(tickerData: TickerData): void {
    try {
      const price = parseFloat(tickerData.price);
      if (isNaN(price) || price <= 0) {
        return;
      }

      this.currentPrices.set(tickerData.symbol, price);
      
      this.emit('priceUpdate', {
        symbol: tickerData.symbol,
        price,
        change: parseFloat(tickerData.change),
        changePercent: parseFloat(tickerData.changePercent),
        volume: parseFloat(tickerData.volume)
      });

    } catch (error) {
      this.logger.error('Error processing ticker data', { 
        error, 
        symbol: tickerData.symbol 
      });
    }
  }

  private addToBuffer(symbol: string, dataPoint: MarketDataPoint): void {
    const buffer = this.dataBuffers.get(symbol);
    if (!buffer) return;

    buffer.data.push(dataPoint);
    buffer.lastUpdate = Date.now();

    // Keep buffer size manageable
    if (buffer.data.length > buffer.maxSize) {
      buffer.data.shift(); // Remove oldest data point
    }
  }

  private validateKlineData(kline: KlineData): boolean {
    if (!kline.symbol || !kline.open || !kline.high || !kline.low || !kline.close) {
      this.logger.warn('Invalid kline data: missing required fields', { kline });
      return false;
    }

    const open = parseFloat(kline.open);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);
    const close = parseFloat(kline.close);
    const volume = parseFloat(kline.volume);

    // Basic price validation
    if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) {
      this.logger.warn('Invalid kline data: non-numeric values', { kline });
      return false;
    }

    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
      this.logger.warn('Invalid kline data: invalid price/volume values', { kline });
      return false;
    }

    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      this.logger.warn('Invalid kline data: inconsistent OHLC values', { kline });
      return false;
    }

    // Check for extreme price movements (potential data errors)
    const priceChange = Math.abs((close - open) / open);
    if (priceChange > 0.5) { // 50% price change in one candle - likely error
      this.logger.warn('Suspicious price movement detected', { 
        symbol: kline.symbol, 
        change: priceChange * 100 + '%' 
      });
      return false;
    }

    return true;
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached, stopping collection');
      await this.stopCollection();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    this.logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      try {
        this.logger.info('Cleaning up old connections before reconnection...');
        
        // First, disconnect existing websockets to avoid conflicts
        await this.exchangeConnector.disconnect();
        
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reconnect to exchange
        await this.exchangeConnector.connect();
        
        // Restart real-time subscriptions with fresh connections
        await this.subscribeToRealTimeData();
        
        this.reconnectAttempts = 0; // Reset on successful reconnection
        this.reconnectDelay = 1000; // Reset delay
        this.logger.info('✅ Reconnection successful');
      } catch (error) {
        this.logger.error('Reconnection failed', { error });
        // Prevent infinite loop - only retry if we haven't exceeded attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => this.handleReconnection(), Math.min(delay * 2, 60000)); // Exponential backoff with max 1 minute
        } else {
          this.logger.error('Max reconnection attempts reached, stopping further attempts');
          await this.stopCollection();
        }
      }
    }, delay);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 300000); // Check every 5 minutes instead of every minute
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check if we're still receiving data
      const now = Date.now();
      const staleThreshold = 300000; // 5 minutes - increased threshold
      const reconnectThreshold = 600000; // 10 minutes - trigger reconnection only after longer delay
      
      let shouldReconnect = false;

      for (const [symbol, buffer] of this.dataBuffers) {
        const timeSinceUpdate = now - buffer.lastUpdate;
        if (timeSinceUpdate > staleThreshold) {
          this.logger.warn(`No data received for ${symbol} in ${(timeSinceUpdate / 1000).toFixed(0)}s`);
          
          // If data is really stale, trigger reconnection
          if (timeSinceUpdate > reconnectThreshold) {
            this.logger.error(`Data feed for ${symbol} is critically stale (${(timeSinceUpdate / 1000).toFixed(0)}s). Triggering reconnection.`);
            shouldReconnect = true;
          }
        }
      }

      // Only check exchange connectivity every 5 minutes to avoid aggressive reconnections
      const lastHealthCheck = this.lastHealthCheckTime || 0;
      const timeSinceLastHealthCheck = now - lastHealthCheck;
      
      if (timeSinceLastHealthCheck > 300000) { // 5 minutes
        try {
          const healthStatus = await this.exchangeConnector.healthCheck();
          this.lastHealthCheckTime = now;
          
          if (healthStatus.status !== 'healthy') {
            this.logger.warn('Exchange health check failed', { healthStatus });
            // Only reconnect if we haven't reconnected recently
            const timeSinceLastReconnect = now - (this.lastReconnectTime || 0);
            if (timeSinceLastReconnect > 300000) { // 5 minutes since last reconnect
              shouldReconnect = true;
            }
          }
        } catch (error) {
          this.logger.error('Exchange health check error:', error);
          // Don't reconnect on health check errors to avoid loops
        }
      }

      // Trigger reconnection if needed and not too recently
      if (shouldReconnect && this.isCollecting) {
        const timeSinceLastReconnect = now - (this.lastReconnectTime || 0);
        if (timeSinceLastReconnect > 300000) { // 5 minutes minimum between reconnects
          this.logger.info('Attempting automatic reconnection due to health check failure...');
          this.lastReconnectTime = now;
          await this.handleReconnection();
        } else {
          this.logger.info('Skipping reconnection - too recent since last attempt');
        }
      }

    } catch (error) {
      this.logger.error('Health check failed', { error });
      // Don't trigger reconnection on health check errors to avoid loops
    }
  }

  // Public API methods

  /**
   * Get latest market data for a symbol
   */
  public getLatestData(symbol: string): MarketDataPoint | undefined {
    const buffer = this.dataBuffers.get(symbol);
    return buffer && buffer.data.length > 0 ? buffer.data[buffer.data.length - 1] : undefined;
  }

  /**
   * Get historical data for a symbol
   */
  public getHistoricalData(symbol: string, count?: number): MarketDataPoint[] {
    const buffer = this.dataBuffers.get(symbol);
    if (!buffer) return [];
    
    return count ? buffer.data.slice(-count) : [...buffer.data];
  }

  /**
   * Get current market snapshot for all symbols
   */
  public getMarketSnapshot(): MarketSnapshot {
    const symbols = new Map<string, MarketDataPoint>();
    const features = new Map<string, FeatureVector>();

    for (const [symbol, buffer] of this.dataBuffers) {
      if (buffer.data.length > 0) {
        const latest = buffer.data[buffer.data.length - 1];
        symbols.set(symbol, latest);
        if (latest.features) {
          features.set(symbol, latest.features);
        }
      }
    }

    return {
      timestamp: Date.now(),
      symbols,
      features
    };
  }

  /**
   * Get current price for a symbol
   */
  public getCurrentPrice(symbol: string): number | undefined {
    return this.currentPrices.get(symbol);
  }

  /**
   * Get current prices for all symbols
   */
  public getAllCurrentPrices(): Map<string, number> {
    return new Map(this.currentPrices);
  }

  /**
   * Check if data collection is active
   */
  public isCollectingData(): boolean {
    return this.isCollecting;
  }

  /**
   * Get buffer statistics
   */
  public getBufferStats(): Map<string, { size: number; lastUpdate: number }> {
    const stats = new Map();
    for (const [symbol, buffer] of this.dataBuffers) {
      stats.set(symbol, {
        size: buffer.data.length,
        lastUpdate: buffer.lastUpdate
      });
    }
    return stats;
  }

  /**
   * Clear all data buffers
   */
  public clearBuffers(): void {
    for (const buffer of this.dataBuffers.values()) {
      buffer.data = [];
      buffer.lastUpdate = 0;
    }
    this.indicators = new TechnicalIndicators();
  }
}