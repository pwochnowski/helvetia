#!/usr/bin/env node

/**
 * Load generator for testing API endpoints and generating metrics
 * Usage: node load-test.js [requests-per-second] [duration-seconds]
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';
const RPS = parseInt(process.argv[2]) || 2; // requests per second
const DURATION = parseInt(process.argv[3]) || 0; // 0 = run forever

let stats = {
    total: 0,
    success: 0,
    failure: 0,
    latencies: []
};

function request(method, path) {
    return new Promise((resolve) => {
        const start = Date.now();
        const url = new URL(path, BASE_URL);
        
        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const latency = Date.now() - start;
                resolve({ status: res.statusCode, latency });
            });
        });
        
        req.on('error', (err) => {
            const latency = Date.now() - start;
            resolve({ status: 0, latency, error: err.message });
        });
        
        req.end();
    });
}

async function makeRequest() {
    stats.total++;
    
    // Randomly pick an endpoint
    const endpoints = [
        { method: 'GET', path: '/users' },
        { method: 'GET', path: '/hello' }
    ];
    
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const result = await request(endpoint.method, endpoint.path);
    
    stats.latencies.push(result.latency);
    if (stats.latencies.length > 100) stats.latencies.shift(); // Keep last 100
    
    if (result.status >= 200 && result.status < 300) {
        stats.success++;
        console.log(`✓ #${stats.total} ${endpoint.method} ${endpoint.path} → ${result.status} (${result.latency}ms)`);
    } else {
        stats.failure++;
        console.log(`✗ #${stats.total} ${endpoint.method} ${endpoint.path} → ${result.status} (${result.latency}ms)`);
    }
}

function showStats() {
    const avgLatency = stats.latencies.length > 0
        ? (stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(1)
        : 0;
    
    console.log(`\n=== Statistics ===`);
    console.log(`Total: ${stats.total} | Success: ${stats.success} | Failures: ${stats.failure}`);
    console.log(`Success rate: ${((stats.success / stats.total) * 100).toFixed(1)}%`);
    console.log(`Avg latency: ${avgLatency}ms`);
}

console.log(`Load test starting: ${RPS} req/s against ${BASE_URL}`);
console.log(`Duration: ${DURATION > 0 ? DURATION + 's' : 'unlimited (Ctrl+C to stop)'}`);
console.log('');

const interval = 1000 / RPS;
let requestCount = 0;
const maxRequests = DURATION * RPS;

const timer = setInterval(() => {
    makeRequest();
    requestCount++;
    
    if (DURATION > 0 && requestCount >= maxRequests) {
        clearInterval(timer);
        showStats();
        process.exit(0);
    }
}, interval);

// Show stats on Ctrl+C
process.on('SIGINT', () => {
    clearInterval(timer);
    showStats();
    process.exit(0);
});
