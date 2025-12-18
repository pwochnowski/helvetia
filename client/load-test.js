#!/usr/bin/env node

/**
 * Simple load testing script to generate CPU pressure on vttablets
 * Fires concurrent requests to the Helvetia API to trigger high CPU alerts
 */

import http from 'http';

const BASE_URL = 'http://localhost:8080';
const CONCURRENT_REQUESTS = 50; // Number of parallel requests
const REQUEST_DELAY = 10; // ms between batches

let totalRequests = 0;
let successRequests = 0;
let errorRequests = 0;
let isRunning = true;

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📊 Load Test Summary:');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful: ${successRequests}`);
  console.log(`Errors: ${errorRequests}`);
  console.log(`Success Rate: ${((successRequests / totalRequests) * 100).toFixed(2)}%`);
  process.exit(0);
});

function request(method, path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        totalRequests++;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          successRequests++;
        } else {
          errorRequests++;
        }
        resolve({ status: res.statusCode });
      });
    });

    req.on('error', () => {
      totalRequests++;
      errorRequests++;
      resolve({ status: 0 });
    });

    req.on('timeout', () => {
      req.destroy();
      totalRequests++;
      errorRequests++;
      resolve({ status: 0 });
    });

    req.end();
  });
}

// Various endpoints to hit
const endpoints = [
  { method: 'GET', path: '/users?limit=100' },
  { method: 'GET', path: '/users?rsql=id>1000;id<2000&limit=50' },
  { method: 'GET', path: '/articles?limit=100' },
  { method: 'GET', path: '/articles?rsql=aid>1000;aid<2000&limit=50' },
  { method: 'GET', path: '/reads?limit=100' },
  { method: 'GET', path: '/reads?rsql=id>10000;id<20000&limit=50' },
  { method: 'GET', path: '/users/1' },
  { method: 'GET', path: '/users/5000' },
  { method: 'GET', path: '/articles/1' },
  { method: 'GET', path: '/articles/5000' },
  { method: 'GET', path: '/reads/50000' },
];

async function fireBatch() {
  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    promises.push(request(endpoint.method, endpoint.path));
  }
  await Promise.all(promises);
}

async function runLoadTest() {
  console.log('🔥 Starting Load Test');
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Target: ${BASE_URL}`);
  console.log('Press Ctrl+C to stop\n');

  const startTime = Date.now();
  
  while (isRunning) {
    await fireBatch();
    
    // Progress update every 500 requests
    if (totalRequests % 500 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rps = (totalRequests / elapsed).toFixed(2);
      console.log(`📈 ${totalRequests} requests | ${rps} req/s | Success: ${successRequests} | Errors: ${errorRequests}`);
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
  }
}

console.log('🚀 Helvetia Load Test\n');
runLoadTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
