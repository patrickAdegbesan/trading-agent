import { EventEmitter } from 'events';
import { OrderData } from '../../src/exchanges/exchange-connector';

interface MockOrderData extends OrderData {
    status?: string;
}

export class MockExchangeConnector extends EventEmitter {
    private orders: Map<number, MockOrderData> = new Map();
    private lastOrderId = 0;
    private marketPrices: Map<string, number> = new Map();
    private isConnected = false;

    constructor() {
        super();
        // Initialize with some default market prices
        this.marketPrices.set('BTCUSDT', 50000);
        this.marketPrices.set('ETHUSDT', 3000);
    }

    public async connect(): Promise<void> {
        this.isConnected = true;
        this.emit('connected');
    }

    public async disconnect(): Promise<void> {
        this.isConnected = false;
        this.emit('disconnected');
    }

    public async placeOrder(orderData: OrderData): Promise<{ orderId: number }> {
        if (!this.isConnected) {
            throw new Error('Exchange not connected');
        }

        this.lastOrderId++;
        const orderId = this.lastOrderId;
        
        this.orders.set(orderId, {
            ...orderData,
            status: 'SUBMITTED'
        });

        // Simulate order execution
        setTimeout(() => {
            this.orders.set(orderId, {
                ...orderData,
                status: 'FILLED'
            });
            this.emit('orderUpdate', {
                orderId,
                status: 'FILLED',
                symbol: orderData.symbol,
                side: orderData.side,
                quantity: orderData.quantity,
                price: this.marketPrices.get(orderData.symbol) || 0
            });
        }, 100);

        return { orderId };
    }

    public async cancelOrder(symbol: string, orderId: number): Promise<void> {
        if (!this.isConnected) {
            throw new Error('Exchange not connected');
        }

        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        this.orders.set(orderId, {
            ...order,
            status: 'CANCELLED'
        });

        this.emit('orderUpdate', {
            orderId,
            status: 'CANCELLED',
            symbol,
            side: order.side,
            quantity: order.quantity
        });
    }

    public async getOrder(symbol: string, orderId: number): Promise<MockOrderData | undefined> {
        if (!this.isConnected) {
            throw new Error('Exchange not connected');
        }
        return this.orders.get(orderId);
    }

    public async getMarketPrice(symbol: string): Promise<number> {
        if (!this.isConnected) {
            throw new Error('Exchange not connected');
        }
        const price = this.marketPrices.get(symbol);
        if (!price) {
            throw new Error(`No price data for symbol ${symbol}`);
        }
        return price;
    }

    // Methods for test control
    public setMarketPrice(symbol: string, price: number): void {
        this.marketPrices.set(symbol, price);
        this.emit('priceUpdate', { symbol, price });
    }

    public simulateMarketMovement(symbol: string, percentageChange: number): void {
        const currentPrice = this.marketPrices.get(symbol) || 0;
        const newPrice = currentPrice * (1 + percentageChange);
        this.setMarketPrice(symbol, newPrice);
    }

    public getOrderCount(): number {
        return this.orders.size;
    }

    public clearOrders(): void {
        this.orders.clear();
        this.lastOrderId = 0;
    }

    public isExchangeConnected(): boolean {
        return this.isConnected;
    }
}