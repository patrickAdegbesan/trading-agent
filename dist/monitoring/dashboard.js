"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingDashboard = void 0;
const express_1 = __importDefault(require("express"));
const settings_1 = require("../config/settings");
class TradingDashboard {
    constructor(orderManager, portfolioManager) {
        this.app = (0, express_1.default)();
        this.orderManager = orderManager;
        this.portfolioManager = portfolioManager;
        this.setupRoutes();
    }
    setupRoutes() {
        // Serve static files
        this.app.use(express_1.default.static('public'));
        // API endpoint for dashboard data
        this.app.get('/api/dashboard', async (req, res) => {
            try {
                const dashboardData = await this.getDashboardData();
                res.json(dashboardData);
            }
            catch (error) {
                console.error('Error fetching dashboard data:', error);
                res.status(500).json({ error: 'Failed to fetch dashboard data' });
            }
        });
        // API endpoint for orders
        this.app.get('/api/orders', (req, res) => {
            try {
                const orders = this.orderManager.listOrders();
                res.json(orders);
            }
            catch (error) {
                console.error('Error fetching orders:', error);
                res.status(500).json({ error: 'Failed to fetch orders' });
            }
        });
        // API endpoint for trading stats
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = this.orderManager.getTradingStats();
                res.json(stats);
            }
            catch (error) {
                console.error('Error fetching stats:', error);
                res.status(500).json({ error: 'Failed to fetch stats' });
            }
        });
        // Main dashboard HTML
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });
    }
    async getDashboardData() {
        const portfolio = await this.portfolioManager.getPortfolio();
        const orders = this.orderManager.listOrders();
        const activeOrders = this.orderManager.getActiveOrders();
        const stats = this.orderManager.getTradingStats();
        return {
            timestamp: new Date().toISOString(),
            portfolio: {
                totalValue: portfolio.totalValue,
                availableBalance: portfolio.totalValue, // Use totalValue as fallback
                totalPnl: 0, // Calculate from orders or use default
                positions: Object.keys(portfolio.positions).map(symbol => ({
                    symbol,
                    quantity: portfolio.positions[symbol]
                }))
            },
            trading: {
                totalOrders: stats.totalOrders,
                activeOrders: stats.activeOrders,
                filledOrders: stats.filledOrders,
                successRate: stats.successRate
            },
            recentOrders: orders.slice(-10).reverse(), // Last 10 orders
            activeOrdersList: activeOrders
        };
    }
    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crypto Trading Bot Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            color: white;
        }
        .header h1 { 
            font-size: 2.5rem; 
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .status { 
            display: inline-block; 
            padding: 8px 16px; 
            background: #27ae60; 
            color: white; 
            border-radius: 20px; 
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .card { 
            background: white; 
            border-radius: 15px; 
            padding: 25px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card h3 { 
            color: #2c3e50; 
            margin-bottom: 15px; 
            font-size: 1.3rem;
            border-bottom: 2px solid #3498db;
            padding-bottom: 8px;
        }
        .metric { 
            display: flex; 
            justify-content: space-between; 
            margin: 10px 0; 
            padding: 8px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        .metric:last-child { border-bottom: none; }
        .metric-label { 
            color: #7f8c8d; 
            font-weight: 500;
        }
        .metric-value { 
            font-weight: bold; 
            color: #2c3e50;
        }
        .positive { color: #27ae60; }
        .negative { color: #e74c3c; }
        .orders-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px;
        }
        .orders-table th, .orders-table td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #ecf0f1;
        }
        .orders-table th { 
            background: #f8f9fa; 
            font-weight: 600;
            color: #2c3e50;
        }
        .orders-table tr:hover { 
            background: #f8f9fa; 
        }
        .status-badge { 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 0.8rem; 
            font-weight: bold;
        }
        .status-submitted { background: #3498db; color: white; }
        .status-filled { background: #27ae60; color: white; }
        .status-cancelled { background: #e74c3c; color: white; }
        .auto-refresh { 
            text-align: center; 
            margin-top: 20px; 
            color: white;
            font-size: 0.9rem;
        }
        .loading { 
            text-align: center; 
            color: #7f8c8d; 
            font-style: italic;
        }
        .refresh-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            margin: 10px;
            transition: all 0.3s ease;
        }
        .refresh-btn:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Crypto Trading Bot Dashboard</h1>
            <div class="status" id="bot-status">🟢 LIVE TRADING ACTIVE</div>
            <div style="margin-top: 15px;">
                <button class="refresh-btn" onclick="loadDashboard()">🔄 Refresh</button>
                <button class="refresh-btn" onclick="toggleAutoRefresh()">⏱️ Auto-Refresh: ON</button>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>💰 Portfolio</h3>
                <div id="portfolio-data" class="loading">Loading...</div>
            </div>
            
            <div class="card">
                <h3>📊 Trading Stats</h3>
                <div id="trading-stats" class="loading">Loading...</div>
            </div>
            
            <div class="card">
                <h3>⚡ Active Orders</h3>
                <div id="active-orders" class="loading">Loading...</div>
            </div>
        </div>

        <div class="card">
            <h3>📋 Recent Orders</h3>
            <div id="recent-orders" class="loading">Loading...</div>
        </div>

        <div class="auto-refresh">
            <span id="last-update">Last updated: Loading...</span><br>
            <span id="next-refresh">Next refresh in: --</span>
        </div>
    </div>

    <script>
        let autoRefreshEnabled = true;
        let refreshInterval;
        let countdownInterval;
        let nextRefreshTime = 30;

        function formatCurrency(value) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(value);
        }

        function formatNumber(value, decimals = 2) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(value);
        }

        function formatTime(timestamp) {
            return new Date(timestamp).toLocaleString();
        }

        async function loadDashboard() {
            try {
                const response = await fetch('/api/dashboard');
                const data = await response.json();
                
                // Update portfolio section
                document.getElementById('portfolio-data').innerHTML = \`
                    <div class="metric">
                        <span class="metric-label">Total Value:</span>
                        <span class="metric-value">\${formatCurrency(data.portfolio.totalValue)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Available Balance:</span>
                        <span class="metric-value">\${formatCurrency(data.portfolio.availableBalance)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Total PnL:</span>
                        <span class="metric-value \${data.portfolio.totalPnl >= 0 ? 'positive' : 'negative'}">
                            \${formatCurrency(data.portfolio.totalPnl)}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Positions:</span>
                        <span class="metric-value">\${data.portfolio.positions.length}</span>
                    </div>
                \`;

                // Update trading stats
                document.getElementById('trading-stats').innerHTML = \`
                    <div class="metric">
                        <span class="metric-label">Total Orders:</span>
                        <span class="metric-value">\${data.trading.totalOrders}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Active Orders:</span>
                        <span class="metric-value">\${data.trading.activeOrders}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Filled Orders:</span>
                        <span class="metric-value">\${data.trading.filledOrders}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Success Rate:</span>
                        <span class="metric-value">\${formatNumber(data.trading.successRate, 1)}%</span>
                    </div>
                \`;

                // Update active orders
                if (data.activeOrdersList.length > 0) {
                    const activeOrdersHTML = data.activeOrdersList.map(order => \`
                        <div class="metric">
                            <span class="metric-label">\${order.symbol} \${order.side}:</span>
                            <span class="metric-value">
                                \${formatNumber(order.quantity, 5)} @ \${formatCurrency(order.price)}
                            </span>
                        </div>
                    \`).join('');
                    document.getElementById('active-orders').innerHTML = activeOrdersHTML;
                } else {
                    document.getElementById('active-orders').innerHTML = '<div class="metric">No active orders</div>';
                }

                // Update recent orders table
                if (data.recentOrders.length > 0) {
                    const ordersHTML = \`
                        <table class="orders-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Symbol</th>
                                    <th>Side</th>
                                    <th>Quantity</th>
                                    <th>Price</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${data.recentOrders.map(order => \`
                                    <tr>
                                        <td>\${formatTime(order.timestamp)}</td>
                                        <td>\${order.symbol}</td>
                                        <td>\${order.side}</td>
                                        <td>\${formatNumber(order.quantity, 5)}</td>
                                        <td>\${formatCurrency(order.price)}</td>
                                        <td><span class="status-badge status-\${order.status.toLowerCase()}">\${order.status}</span></td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                    document.getElementById('recent-orders').innerHTML = ordersHTML;
                } else {
                    document.getElementById('recent-orders').innerHTML = '<div class="loading">No orders yet</div>';
                }

                document.getElementById('last-update').textContent = \`Last updated: \${formatTime(data.timestamp)}\`;
                
            } catch (error) {
                console.error('Error loading dashboard:', error);
                document.getElementById('portfolio-data').innerHTML = '<div style="color: #e74c3c;">Error loading data</div>';
            }
        }

        function toggleAutoRefresh() {
            autoRefreshEnabled = !autoRefreshEnabled;
            const button = event.target;
            
            if (autoRefreshEnabled) {
                button.textContent = '⏱️ Auto-Refresh: ON';
                startAutoRefresh();
            } else {
                button.textContent = '⏱️ Auto-Refresh: OFF';
                clearInterval(refreshInterval);
                clearInterval(countdownInterval);
                document.getElementById('next-refresh').textContent = 'Auto-refresh disabled';
            }
        }

        function startAutoRefresh() {
            if (!autoRefreshEnabled) return;
            
            nextRefreshTime = 30;
            
            refreshInterval = setInterval(() => {
                loadDashboard();
                nextRefreshTime = 30;
            }, 30000); // 30 seconds
            
            countdownInterval = setInterval(() => {
                nextRefreshTime--;
                document.getElementById('next-refresh').textContent = \`Next refresh in: \${nextRefreshTime}s\`;
                
                if (nextRefreshTime <= 0) {
                    nextRefreshTime = 30;
                }
            }, 1000);
        }

        // Initialize dashboard
        loadDashboard();
        startAutoRefresh();
    </script>
</body>
</html>
        `;
    }
    async start() {
        const port = settings_1.settings.monitoring.port;
        this.server = this.app.listen(port, () => {
            console.log(`🌐 Trading Dashboard available at: http://localhost:${port}`);
            console.log(`📊 Real-time monitoring and analytics ready!`);
        });
    }
    async stop() {
        if (this.server) {
            this.server.close();
            console.log('📊 Trading Dashboard stopped');
        }
    }
}
exports.TradingDashboard = TradingDashboard;
//# sourceMappingURL=dashboard.js.map