import { Trade, TradingSignal, Position, Portfolio, TradeResult } from '../../src/types';
import { EventEmitter } from 'events';

export interface MockPredictionEngine {
    generateSignal: () => Promise<TradingSignal | null>;
}

export interface MockPortfolioManager extends EventEmitter {
    getPortfolio: () => Promise<Portfolio>;
    updateAfterTrade: (trade: Trade) => Promise<void>;
    closeAllPositions: () => Promise<void>;
    getBalance: () => number;
    updateMetrics: () => Promise<void>;
}

export interface MockOrderManager extends EventEmitter {
    submitOrder: (order: any) => Promise<TradeResult>;
    getActiveOrders: () => Promise<MockActiveOrder[]>;
    cancelOrder: (orderId: string, symbol: string) => Promise<void>;
}

export interface MockRiskManager extends EventEmitter {
    evaluatePosition: () => Promise<number>;
    assessTradeRisk: () => {
        approved: boolean;
        positionSize: number;
        riskScore: number;
    };
}

export interface MockActiveOrder {
    id: string;
    symbol: string;
    status: string;
    quantity: number;
    price: number;
}