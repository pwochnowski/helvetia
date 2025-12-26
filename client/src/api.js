/**
 * API client for Helvetia backend
 * Handles protobuf encoding/decoding for all entities
 */

import { tableConfig as userConfig, decodeUser, encodeUser } from './tables/user.js';
import { tableConfig as articleConfig, decodeArticle, encodeArticle } from './tables/article.js';
import { tableConfig as readConfig, decodeRead, encodeRead } from './tables/read.js';
import { tableConfig as bereadConfig, decodeBeRead, encodeBeRead } from './tables/beread.js';
import { tableConfig as popularrankConfig, decodePopularRank, encodePopularRank } from './tables/popularrank.js';

// Server configuration for multi-region setup
// In development: Vite proxies /api/cell1/*, /api/cell2/*, /api/cell3/* to respective servers
// In production: These would be actual server URLs
const SERVER_CONFIG = {
    // DC1 - Primary Data Center
    cell1: '/api/cell1',      // Beijing region - connects to vtgate_cell1
    cell2: '/api/cell2',      // HongKong region - connects to vtgate_cell2
    cell3: '/api/cell3',      // Backup region - connects to vtgate_cell3 (backup replicas)
    // DC2 - Secondary Data Center
    'dc2-cell1': '/api/dc2-cell1',  // DC2 Cell1 - connects to vtgate_cell1_dc2
    'dc2-cell2': '/api/dc2-cell2',  // DC2 Cell2 - connects to vtgate_cell2_dc2
};

// Current active server (default to cell1)
let currentServer = 'cell1';

// Get API base URL for current server
export function getApiBase() {
    return SERVER_CONFIG[currentServer];
}

// Switch to a different server
export function setServer(server) {
    if (SERVER_CONFIG[server]) {
        currentServer = server;
        return true;
    }
    return false;
}

// Get current server
export function getCurrentServer() {
    return currentServer;
}

// Legacy export for backward compatibility
export const API_BASE = '';

// ==================== Protobuf Utilities ====================

export function decodeVarint(buffer, offset) {
    let result = 0n;
    let shift = 0n;
    let pos = offset;
    
    while (pos < buffer.length) {
        const byte = buffer[pos];
        result |= BigInt(byte & 0x7f) << shift;
        pos++;
        if ((byte & 0x80) === 0) break;
        shift += 7n;
    }
    
    return { value: result, bytesRead: pos - offset };
}

export function decodeString(buffer, offset, length) {
    const bytes = buffer.slice(offset, offset + length);
    return new TextDecoder().decode(bytes);
}

export function encodeVarint(value) {
    const bytes = [];
    let v = BigInt(value);
    
    do {
        let byte = Number(v & 0x7fn);
        v >>= 7n;
        if (v > 0n) byte |= 0x80;
        bytes.push(byte);
    } while (v > 0n);
    
    return bytes;
}

export function encodeString(fieldNumber, value) {
    if (!value) return [];
    const encoded = new TextEncoder().encode(value);
    return [
        ...encodeVarint((fieldNumber << 3) | 2),
        ...encodeVarint(encoded.length),
        ...encoded
    ];
}

export function encodeVarintField(fieldNumber, value) {
    if (value === 0 || value === undefined) return [];
    return [
        ...encodeVarint(fieldNumber << 3),
        ...encodeVarint(value)
    ];
}

// ==================== Generic List Decoder ====================

/**
 * Decode a protobuf list message with items (field 1) and totalCount (field 2)
 * @returns {{ items: array, totalCount: number }}
 */
function decodeListWithCount(buffer, decodeItem) {
    const items = [];
    let totalCount = 0;
    let pos = 0;
    
    while (pos < buffer.length) {
        const { value: tag, bytesRead: tagBytes } = decodeVarint(buffer, pos);
        pos += tagBytes;
        
        const fn = Number(tag >> 3n);
        const wireType = Number(tag & 7n);
        
        if (fn === 1 && wireType === 2) {
            // Field 1: Length-delimited message (items)
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            
            const itemBuffer = buffer.slice(pos, pos + Number(length));
            items.push(decodeItem(itemBuffer, decodeVarint, decodeString));
            pos += Number(length);
        } else if (fn === 2 && wireType === 0) {
            // Field 2: Varint (totalCount)
            const { value, bytesRead } = decodeVarint(buffer, pos);
            totalCount = Number(value);
            pos += bytesRead;
        } else {
            // Unknown field, skip
            if (wireType === 0) {
                // Varint - read and discard
                const { bytesRead } = decodeVarint(buffer, pos);
                pos += bytesRead;
            } else if (wireType === 2) {
                // Length-delimited - read length and skip
                const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
                pos += lengthBytes + Number(length);
            } else {
                break;
            }
        }
    }
    
    return { items, totalCount };
}

// ==================== User API ====================

/**
 * Fetch users with pagination and sorting
 * @returns {{ items: array, totalCount: number }}
 */
export async function fetchUsers(rsqlFilter = null, limit = 100, offset = 0, sortBy = null, sortDir = null) {
    const params = new URLSearchParams();
    if (rsqlFilter) params.set('filter', rsqlFilter);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);
    
    let url = `${getApiBase()}/users`;
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/x-protobuf',
        },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    
    return decodeListWithCount(uint8, decodeUser);
}

export async function updateUser(user) {
    const body = encodeUser(user, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/users/${user.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function createUser(user) {
    const body = encodeUser(user, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function deleteUser(id) {
    const response = await fetch(`${getApiBase()}/users/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// ==================== Article API ====================

/**
 * Fetch articles with pagination and sorting
 * @returns {{ items: array, totalCount: number }}
 */
export async function fetchArticles(rsqlFilter = null, limit = 100, offset = 0, sortBy = null, sortDir = null) {
    const params = new URLSearchParams();
    if (rsqlFilter) params.set('filter', rsqlFilter);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);
    
    let url = `${getApiBase()}/articles`;
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/x-protobuf',
        },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    
    return decodeListWithCount(uint8, decodeArticle);
}

export async function updateArticle(article) {
    const body = encodeArticle(article, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/articles/${article.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function createArticle(article) {
    const body = encodeArticle(article, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/articles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function deleteArticle(id) {
    const response = await fetch(`${getApiBase()}/articles/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// ==================== Read API ====================

/**
 * Fetch reads with pagination and sorting
 * @returns {{ items: array, totalCount: number }}
 */
export async function fetchReads(rsqlFilter = null, limit = 100, offset = 0, sortBy = null, sortDir = null) {
    const params = new URLSearchParams();
    if (rsqlFilter) params.set('filter', rsqlFilter);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);
    
    let url = `${getApiBase()}/reads`;
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/x-protobuf',
        },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    
    return decodeListWithCount(uint8, decodeRead);
}

export async function updateRead(read) {
    const body = encodeRead(read, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/reads/${read.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function createRead(read) {
    const body = encodeRead(read, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/reads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function deleteRead(id) {
    const response = await fetch(`${getApiBase()}/reads/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// ==================== BeRead API ====================

/**
 * Fetch bereads with pagination and sorting
 * @returns {{ items: array, totalCount: number }}
 */
export async function fetchBeReads(rsqlFilter = null, limit = 100, offset = 0, sortBy = null, sortDir = null) {
    const params = new URLSearchParams();
    if (rsqlFilter) params.set('filter', rsqlFilter);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);
    
    let url = `${getApiBase()}/bereads`;
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/x-protobuf',
        },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    
    return decodeListWithCount(uint8, decodeBeRead);
}

export async function updateBeRead(beread) {
    const body = encodeBeRead(beread, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/bereads/${beread.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function createBeRead(beread) {
    const body = encodeBeRead(beread, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/bereads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function deleteBeRead(id) {
    const response = await fetch(`${getApiBase()}/bereads/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// ==================== PopularRank API ====================

/**
 * Fetch popular ranks with pagination and sorting
 * @returns {{ items: array, totalCount: number }}
 */
export async function fetchPopularRanks(rsqlFilter = null, limit = 100, offset = 0, sortBy = null, sortDir = null) {
    const params = new URLSearchParams();
    if (rsqlFilter) params.set('filter', rsqlFilter);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);
    
    let url = `${getApiBase()}/popularranks`;
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/x-protobuf',
        },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    
    return decodeListWithCount(uint8, decodePopularRank);
}

export async function updatePopularRank(popularRank) {
    const body = encodePopularRank(popularRank, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/popularranks/${popularRank.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function createPopularRank(popularRank) {
    const body = encodePopularRank(popularRank, encodeVarintField, encodeString);
    
    const response = await fetch(`${getApiBase()}/popularranks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

export async function deletePopularRank(id) {
    const response = await fetch(`${getApiBase()}/popularranks/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// ==================== Generic API Functions ====================

// Map of table configs for easy lookup
export const tableConfigs = {
    users: userConfig,
    articles: articleConfig,
    reads: readConfig,
    bereads: bereadConfig,
    popularranks: popularrankConfig,
};

/**
 * Generic fetch function with pagination and sorting
 * @returns {{ items: array, totalCount: number }}
 */
export async function fetchData(tableName, rsqlFilter = null, limit = 100, offset = 0, sortBy = null, sortDir = null) {
    switch (tableName) {
        case 'users': return fetchUsers(rsqlFilter, limit, offset, sortBy, sortDir);
        case 'articles': return fetchArticles(rsqlFilter, limit, offset, sortBy, sortDir);
        case 'reads': return fetchReads(rsqlFilter, limit, offset, sortBy, sortDir);
        case 'bereads': return fetchBeReads(rsqlFilter, limit, offset, sortBy, sortDir);
        case 'popularranks': return fetchPopularRanks(rsqlFilter, limit, offset, sortBy, sortDir);
        default: throw new Error(`Unknown table: ${tableName}`);
    }
}

// Generic update function
export async function updateData(tableName, data) {
    switch (tableName) {
        case 'users': return updateUser(data);
        case 'articles': return updateArticle(data);
        case 'reads': return updateRead(data);
        case 'bereads': return updateBeRead(data);
        case 'popularranks': return updatePopularRank(data);
        default: throw new Error(`Unknown table: ${tableName}`);
    }
}
