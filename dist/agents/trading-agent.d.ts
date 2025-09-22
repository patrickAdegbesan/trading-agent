import { PredictionEngine } from '../ml/prediction-engine';
import { PortfolioManager } from '../portfolio/portfolio-manager';
import { OrderManager } from '../exchanges/order-manager';
import { RiskManager } from '../portfolio/risk-manager';
import { TradingSignal, TradeResult } from '../types';
import { EventEmitter } from 'events';
export declare class TradingAgent extends EventEmitter {
    private predictionEngine;
    private portfolioManager;
    private orderManager;
    private riskManager;
    private isActive;
    private lastTradeTime;
    private lastSignalCache;
    private readonly TRADE_COOLDOWN_MS;
    private readonly MAX_ORDERS_PER_SYMBOL;
    private readonly MIN_PRICE_CHANGE_PERCENT;
    private readonly SIGNAL_DEDUP_MS;
    /**
     * Set trading agent active state
     */
    setActive(active: boolean): void;
    /**
     * Check if signal should be processed (deduplication logic)
     */
    private shouldProcessSignal;
    constructor(predictionEngine: PredictionEngine, portfolioManager: PortfolioManager, orderManager: OrderManager, riskManager: RiskManager);
    /**
     * Execute a trade based on ML prediction signal
     */
    private readonly MIN_CONFIDENCE;
    executeTrade(signal: TradingSignal): Promise<TradeResult>;
    /**
     * Check for filled orders and update PnL
     */
    private checkForFilledOrders;
    /**
     * Emergency stop all trading activity
     */
    /**
     * Emergency stop all trading activity
     */
    emergencyStop(): Promise<void>;
    /**
     * Start the trading agent
     */
    run(): Promise<void>;
    /**
     * Stop the trading agent gracefully
     */
    stop(): Promise<void>;
}
