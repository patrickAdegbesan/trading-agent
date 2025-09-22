import Binance from 'binance-api-node';
import { EventEmitter } from 'events';
import winston from 'winston';
import ReconnectingWebSocket from 'reconnecting-websocket';
import WS from 'ws';

export interface OrderData {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'OCO';
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface PositionData {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  percentage: string;
}

export interface TickerData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  quoteVolume: string;
}

export interface KlineData {
  symbol: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
}

export class ExchangeConnector extends EventEmitter {
  private client: any;
  private futuresClient: any;
  private wsConnections: Map<string, ReconnectingWebSocket> = new Map();
  private logger: winston.Logger;
  private isConnected = false;
  private apiKey: string;
  private apiSecret: string;
  private testnet: boolean;
  private rateLimitCount = 0;
  private rateLimitReset = 0;

  constructor(apiKey: string, apiSecret: string, testnet: boolean = true) {
    super();
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.testnet = testnet;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/exchange.log' })
      ]
    });
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Binance API...', { testnet: this.testnet });
      
      // FIXED: Initialize Binance client ONCE using the working diagnostic pattern
      this.client = Binance({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        httpBase: this.testnet ? 'https://testnet.binance.vision' : undefined,
        wsBase: this.testnet ? 'wss://stream.testnet.binance.vision' : undefined,
      });

      // Test connection with single call (no multiple reconnections)
      const serverTime = await this.client.time();
      const accountInfo = await this.client.accountInfo();
      
      this.isConnected = true;
      this.logger.info('Successfully connected to Binance', {
        serverTime,
        accountType: accountInfo.accountType,
        canTrade: accountInfo.canTrade
      });

      this.emit('connected');
    } catch (error: any) {
      this.logger.error('Failed to connect to Binance', { error: error.message });
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Binance...');
      
      // Close all WebSocket connections
      for (const [symbol, ws] of this.wsConnections) {
        ws.close();
        this.logger.debug(`Closed WebSocket for ${symbol}`);
      }
      this.wsConnections.clear();
      
      this.isConnected = false;
      this.emit('disconnected');
      this.logger.info('Disconnected from Binance');
    } catch (error: any) {
      this.logger.error('Error during disconnect', { error: error.message });
      throw error;
    }
  }

  isConnectedToExchange(): boolean {
    return this.isConnected;
  }

  // Market data methods
  async getTickerPrice(symbol: string): Promise<TickerData> {
    try {
      // Use the improved getTickerData method with retry logic
      const tickerData = await this.getTickerData(symbol);
      if (!tickerData) {
        throw new Error(`No ticker data available for ${symbol}`);
      }
      return tickerData;
    } catch (error: any) {
      this.logger.error(`Failed to get ticker for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  async getKlines(symbol: string, interval: string, limit: number = 500): Promise<KlineData[]> {
    try {
      const klines = await this.client.candles({ symbol, interval, limit });
      
      const mappedKlines = klines.map((k: any) => ({
        symbol,
        openTime: k.openTime,
        closeTime: k.closeTime,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        trades: k.count
      }));
      
      return mappedKlines;
    } catch (error: any) {
      this.logger.error(`Failed to get klines for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  // Data retrieval methods
  async getTickerData(symbol: string): Promise<TickerData | null> {
    try {
      this.checkRateLimit();
      
      // Add retry logic for ticker data fetching
      let lastError: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Use 24hr ticker stats which is more reliable on testnet
          const ticker = await this.client.dailyStats({ symbol });
          
          return {
            symbol: ticker.symbol,
            price: ticker.lastPrice,
            change: ticker.priceChange,
            changePercent: ticker.priceChangePercent,
            volume: ticker.volume,
            quoteVolume: ticker.quoteVolume
          };
        } catch (error: any) {
          lastError = error;
          this.logger.warn(`Attempt ${attempt} failed for ticker data ${symbol}`, { 
            error: error.message 
          });
          
          // Wait before retry (exponential backoff)
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      // If all retries failed, try alternative method
      try {
        const price = await this.client.prices({ symbol });
        if (price && price[symbol]) {
          this.logger.info(`Fallback to price-only data for ${symbol}`);
          return {
            symbol,
            price: price[symbol],
            change: '0',
            changePercent: '0',
            volume: '0',
            quoteVolume: '0'
          };
        }
      } catch (fallbackError: any) {
        this.logger.warn(`Fallback price fetch also failed for ${symbol}`, { 
          error: fallbackError.message 
        });
      }
      
      throw lastError;
    } catch (error: any) {
      this.logger.error(`Failed to get ticker data for ${symbol}`, { error: error.message });
      return null;
    }
  }

  // Trading methods
  async placeOrder(orderData: OrderData): Promise<any> {
    try {
      this.checkRateLimit();
      
      const order = await this.client.order(orderData);
      
      this.logger.info('Order placed successfully', {
        orderId: order.orderId,
        symbol: orderData.symbol,
        side: orderData.side,
        type: orderData.type,
        quantity: orderData.quantity
      });

      this.emit('orderPlaced', order);
      return order;
    } catch (error: any) {
      this.logger.error('Failed to place order', { 
        error: error.message,
        orderData 
      });
      this.emit('orderError', { error, orderData });
      throw error;
    }
  }

  async placeOCOOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: string,
    price: string,
    stopPrice: string,
    stopLimitPrice: string
  ): Promise<any> {
    try {
      this.checkRateLimit();
      
      const order = await this.client.orderOco({
        symbol,
        side,
        quantity,
        price,
        stopPrice,
        stopLimitPrice,
        stopLimitTimeInForce: 'GTC'
      });

      this.logger.info('OCO Order placed successfully', {
        orderListId: order.orderListId,
        symbol,
        side,
        quantity
      });

      this.emit('ocoOrderPlaced', order);
      return order;
    } catch (error: any) {
      this.logger.error('Failed to place OCO order', { error: error.message });
      throw error;
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    try {
      const result = await this.client.cancelOrder({ symbol, orderId });
      this.logger.info('Order cancelled', { symbol, orderId });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to cancel order', { 
        error: error.message, 
        symbol, 
        orderId 
      });
      throw error;
    }
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    try {
      const orders = await this.client.openOrders(symbol ? { symbol } : {});
      return orders;
    } catch (error: any) {
      this.logger.error('Failed to get open orders', { error: error.message });
      throw error;
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      const account = await this.client.accountInfo();
      return account;
    } catch (error: any) {
      this.logger.error('Failed to get account info', { error: error.message });
      throw error;
    }
  }

  // WebSocket methods for real-time data - SAFELY RE-ENABLED
  subscribeToTicker(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    this.subscribeToStream(streamName, (data) => {
      const tickerData: TickerData = {
        symbol: data.s,
        price: data.c,
        change: data.P,
        changePercent: data.p,
        volume: data.v,
        quoteVolume: data.q
      };
      this.emit('ticker', tickerData);
    });
  }

  subscribeToKlines(symbol: string, interval: string): void {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    this.subscribeToStream(streamName, (data) => {
      const kline = data.k;
      const klineData: KlineData = {
        symbol: kline.s,
        openTime: kline.t,
        closeTime: kline.T,
        open: kline.o,
        high: kline.h,
        low: kline.l,
        close: kline.c,
        volume: kline.v,
        trades: kline.n
      };
      this.emit('kline', klineData);
    });
  }

  private subscribeToStream(streamName: string, callback: (data: any) => void): void {
    if (this.wsConnections.has(streamName)) {
      this.logger.warn(`Already subscribed to ${streamName}`);
      return;
    }

    // Use correct testnet WebSocket endpoints (updated 2025 format)
    const wsUrl = this.testnet 
      ? `wss://stream.testnet.binance.vision/ws/${streamName}`  // Correct testnet format
      : `wss://stream.binance.com/ws/${streamName}`;           // Production format

    const ws = new ReconnectingWebSocket(wsUrl, [], {
      WebSocket: WS,
      connectionTimeout: 30000, // Increased timeout to 30 seconds for reliability
      maxRetries: 3, // Reduced retries to avoid rate limits
      maxReconnectionDelay: 60000, // Longer delay between reconnections
      minReconnectionDelay: 5000, // Start with 5 seconds delay
    });

    // Add error handler to prevent unhandled events
    ws.onerror = (error) => {
      this.logger.warn(`WebSocket error for ${streamName} (handled gracefully)`, { 
        error: error?.message || 'Connection error' 
      });
      // Don't re-emit to prevent unhandled error events
    };

    ws.onopen = () => {
      this.logger.info(`WebSocket connected: ${streamName}`);
      // No subscription message needed for individual stream endpoints
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        callback(data);
      } catch (error: any) {
        this.logger.error(`Failed to parse WebSocket message for ${streamName}`, { 
          error: error.message 
        });
      }
    };

    ws.onclose = (event) => {
      this.logger.info(`WebSocket closed: ${streamName} (code: ${event?.code || 'unknown'})`);
    };

    // Additional error prevention for the underlying WebSocket
    ws.addEventListener('error', (error) => {
      // Silently handle to prevent crashes
      this.logger.debug(`WebSocket addEventListener error for ${streamName}`, { 
        error: error?.message || 'Unknown error' 
      });
    });

    this.wsConnections.set(streamName, ws);
  }

  private checkRateLimit(): void {
    const now = Date.now();
    
    // Reset rate limit counter if needed (Binance resets every minute)
    if (now > this.rateLimitReset) {
      this.rateLimitCount = 0;
      this.rateLimitReset = now + 60000; // Reset in 1 minute
    }

    // Binance allows 1200 requests per minute for spot trading
    if (this.rateLimitCount >= 1100) { // Leave some buffer
      const waitTime = this.rateLimitReset - now;
      this.logger.warn(`Rate limit approaching, waiting ${waitTime}ms`);
      throw new Error(`Rate limit exceeded, wait ${waitTime}ms`);
    }

    this.rateLimitCount++;
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.client.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', latency: Date.now() - start };
    }
  }
}