#!/usr/bin/env node

/**
 * Sample queries demonstrating the Vitess sharded database setup
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/x-protobuf',
      },
    };

    const req = http.request(options, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function log(method, path, status, extra = '') {
  const ok = status >= 200 && status < 300 ? '✓' : '✗';
  console.log(`${ok} ${method} ${path} → ${status}${extra ? ' ' + extra : ''}`);
}

/**
 * Encode a User object to protobuf wire format.
 * Based on proto: id(1), timestamp(2), uid(3), name(4), gender(5), email(6),
 * phone(7), dept(8), grade(9), language(10), region(11), role(12), preferTags(13), obtainedCredits(14)
 */
function encodeUser(user) {
  const parts = [];

  // Helper: encode varint
  function varint(n) {
    const bytes = [];
    while (n > 0x7f) {
      bytes.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    bytes.push(n & 0x7f);
    return Buffer.from(bytes);
  }

  // Helper: encode int64 as varint (field type 0)
  function int64Field(fieldNum, value) {
    if (value === undefined || value === null) return;
    parts.push(Buffer.from([fieldNum << 3])); // wire type 0
    parts.push(varint(value));
  }

  // Helper: encode string (field type 2)
  function stringField(fieldNum, value) {
    if (!value) return;
    const strBuf = Buffer.from(value, 'utf8');
    parts.push(Buffer.from([(fieldNum << 3) | 2])); // wire type 2
    parts.push(varint(strBuf.length));
    parts.push(strBuf);
  }

  int64Field(1, user.id);
  int64Field(2, user.timestamp);
  stringField(3, user.uid);
  stringField(4, user.name);
  stringField(5, user.gender);
  stringField(6, user.email);
  stringField(7, user.phone);
  stringField(8, user.dept);
  stringField(9, user.grade);
  stringField(10, user.language);
  stringField(11, user.region);
  stringField(12, user.role);
  // preferTags (repeated string) - field 13
  if (user.preferTags) {
    for (const tag of user.preferTags) {
      stringField(13, tag);
    }
  }
  int64Field(14, user.obtainedCredits);

  return Buffer.concat(parts);
}

async function runSamples() {
  console.log(`\nTesting ${BASE_URL}\n`);

  try {
    // Insert a Beijing user (automatically routes to shard -80)
    const beijingUser = {
     id: 1,
     uid: 'u001',
     name: 'Zhang Wei',
     region: 'Beijing',
     email: 'zhang@example.com',
    };
    const createRes1 = await request('POST', '/users', encodeUser(beijingUser));
    log('POST', '/users', createRes1.status, '(Beijing user: Zhang Wei)');
    
    // Insert a HongKong user (automatically routes to shard 80-)
    const hongkongUser = {
     id: 2,
     uid: 'u002',
     name: 'Chan Tai Man',
     region: 'HongKong',
     email: 'chan@example.com',
    };
    const createRes2 = await request('POST', '/users', encodeUser(hongkongUser));
    log('POST', '/users', createRes2.status, '(HongKong user: Chan Tai Man)');

    // List users
    const listRes = await request('GET', '/users');
    log('GET', '/users', listRes.status, `(${listRes.data.length} bytes)`);

    // Get user by ID
    const getRes = await request('GET', '/users/2');
    log('GET', '/users/2', getRes.status);

    const delRes1 = await request('DELETE', '/users/1');
    log('DELETE', '/users/1', delRes1.status);
    //
    // Delete user
    const delRes = await request('DELETE', '/users/2');
    log('DELETE', '/users/2', delRes.status);

  } catch (err) {
    console.error(`Connection error: ${err.message}`);
    process.exit(1);
  }
}

runSamples().then(() => {
  console.log('\nDone.\n');
}).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
