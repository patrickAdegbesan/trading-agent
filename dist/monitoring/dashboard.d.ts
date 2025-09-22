import { OrderManager } from '../exchanges/order-manager';
import { PortfolioManager } from '../portfolio/portfolio-manager';
export declare class TradingDashboard {
    private app;
    private orderManager;
    private portfolioManager;
    private server;
    constructor(orderManager: OrderManager, portfolioManager: PortfolioManager);
    private setupRoutes;
    private getDashboardData;
    private generateDashboardHTML;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=dashboard.d.ts.map