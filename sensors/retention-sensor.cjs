#!/usr/bin/env node
/**
 * Retention Receptor (Sensor)
 * 
 * Role: Non-agentic data fetcher. Updates GPM pressure based on Churn Risk.
 * Purpos: Decouples "Observation" from "Reasoning" to save tokens.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPaths = [path.join(__dirname, '.env'), path.join(__dirname, '../../../.env'), path.join(process.cwd(), '.env')];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        break;
    }
}

const GPM_PATH = path.join(__dirname, '../../../landing-page-hostinger/data/pressure-matrix.json');

async function fetchShopifyOrders(shop, token) {
    if (!shop || !token) {
        throw new Error('Shopify Shop and Access Token required');
    }
    const url = `https://${shop}/admin/api/2024-01/orders.json?status=any&limit=250&fields=email,created_at,total_price,customer`;
    const response = await fetch(url, {
        headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) throw new Error(`Shopify API Error: ${response.status}`);
    const data = await response.json();
    return data.orders;
}

function calculateChurnPressure(orders) {
    if (!orders || orders.length === 0) return 0;

    const customerMap = {};
    const now = new Date();

    orders.forEach(order => {
        if (!order.email) return;
        if (!customerMap[order.email]) {
            customerMap[order.email] = { orders: [] };
        }
        customerMap[order.email].orders.push(new Date(order.created_at));
    });

    const customers = Object.values(customerMap).map(c => {
        c.orders.sort((a, b) => b - a);
        const lastOrder = c.orders[0];
        const daysSinceLast = Math.floor((now - lastOrder) / (1000 * 60 * 60 * 24));
        return { recency: daysSinceLast, frequency: c.orders.length };
    });

    // High risk = recency > 90 days or only 1 order and recency > 60
    const highRiskCount = customers.filter(c => c.recency > 90 || (c.frequency === 1 && c.recency > 60)).length;
    const churnRate = highRiskCount / customers.length;

    // Pressure mapping: 0% churn = 0 pressure, 20%+ churn = 95 pressure
    return Math.min(95, Math.floor(churnRate * 500));
}

function updateGPM(pressure, stats) {
    if (!fs.existsSync(GPM_PATH)) return;
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));

    gpm.sectors.marketing.retention = {
        pressure: pressure,
        trend: (gpm.sectors.marketing.retention && pressure > gpm.sectors.marketing.retention.pressure) ? "UP" : "DOWN",
        last_check: new Date().toISOString(),
        sensor_data: stats
    };

    gpm.last_updated = new Date().toISOString();
    fs.writeFileSync(GPM_PATH, JSON.stringify(gpm, null, 2));
    console.log(`📡 GPM Updated: Retention Pressure is ${pressure}`);
}

async function main() {
    // Handle --health check - REAL API TEST (added Session 168quaterdecies)
    if (process.argv.includes('--health')) {
        const shop = process.env.SHOPIFY_SHOP || process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_DOMAIN;
        const token = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

        const health = {
            status: 'checking',
            sensor: 'retention-sensor',
            version: '1.1.0',
            credentials: {
                SHOPIFY_STORE: shop ? 'set' : 'missing',
                SHOPIFY_ACCESS_TOKEN: token ? 'set' : 'missing'
            },
            gpm_path: GPM_PATH,
            gpm_exists: fs.existsSync(GPM_PATH),
            metrics: ['order_count', 'high_risk_indicator', 'churn_rate'],
            timestamp: new Date().toISOString()
        };

        if (!shop || !token) {
            health.status = 'error';
            health.error = !shop ? 'SHOPIFY_STORE not set' : 'SHOPIFY_ACCESS_TOKEN not set';
        } else {
            try {
                const orders = await fetchShopifyOrders(shop, token);
                health.status = 'ok';
                health.api_test = 'passed';
                health.orders_fetched = orders.length;
                health.store = shop;
            } catch (e) {
                health.status = 'error';
                health.api_test = 'failed';
                health.error = e.message.split('\n')[0];
            }
        }

        console.log(JSON.stringify(health, null, 2));
        process.exit(health.status === 'ok' ? 0 : 1);
        return;
    }

    try {
        const shop = process.env.SHOPIFY_SHOP || process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_DOMAIN;
        const token = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

        if (!shop || !token) {
            console.warn("⚠️ Shopify credentials missing. Skipping retention sensor.");
            return;
        }

        const orders = await fetchShopifyOrders(shop, token);
        const pressure = calculateChurnPressure(orders);
        updateGPM(pressure, { order_count: orders.length, high_risk_indicator: pressure });
    } catch (e) {
        console.error("Retention Sensor Failure:", e.message);
    }
}

main();
