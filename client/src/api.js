/**
 * API client for Helvetia backend
 * Handles protobuf encoding/decoding for all entities
 */

import { tableConfig as userConfig, decodeUser, encodeUser } from './tables/user.js';
import { tableConfig as articleConfig, decodeArticle, encodeArticle } from './tables/article.js';
import { tableConfig as readConfig, decodeRead, encodeRead } from './tables/read.js';

// API base URL - empty string to use Vite proxy in development
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

function decodeList(buffer, decodeItem, fieldNumber = 1) {
    const items = [];
    let pos = 0;
    
    while (pos < buffer.length) {
        const { value: tag, bytesRead: tagBytes } = decodeVarint(buffer, pos);
        pos += tagBytes;
        
        const fn = Number(tag >> 3n);
        const wireType = Number(tag & 7n);
        
        if (fn === fieldNumber && wireType === 2) {
            // Length-delimited message
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            
            const itemBuffer = buffer.slice(pos, pos + Number(length));
            items.push(decodeItem(itemBuffer, decodeVarint, decodeString));
            pos += Number(length);
        } else {
            break;
        }
    }
    
    return items;
}

// ==================== User API ====================

export async function fetchUsers(rsqlFilter = null) {
    let url = `${API_BASE}/users`;
    if (rsqlFilter) {
        url += `?filter=${encodeURIComponent(rsqlFilter)}`;
    }
    
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
    
    return decodeList(uint8, decodeUser);
}

export async function updateUser(user) {
    const body = encodeUser(user, encodeVarintField, encodeString);
    
    const response = await fetch(`${API_BASE}/users/${user.id}`, {
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
    
    const response = await fetch(`${API_BASE}/users`, {
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
    const response = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// ==================== Article API ====================

export async function fetchArticles(rsqlFilter = null) {
    let url = `${API_BASE}/articles`;
    if (rsqlFilter) {
        url += `?filter=${encodeURIComponent(rsqlFilter)}`;
    }
    
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
    
    return decodeList(uint8, decodeArticle);
}

export async function updateArticle(article) {
    const body = encodeArticle(article, encodeVarintField, encodeString);
    
    const response = await fetch(`${API_BASE}/articles/${article.id}`, {
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
    
    const response = await fetch(`${API_BASE}/articles`, {
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
    const response = await fetch(`${API_BASE}/articles/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// ==================== Read API ====================

export async function fetchReads(rsqlFilter = null) {
    let url = `${API_BASE}/reads`;
    if (rsqlFilter) {
        url += `?filter=${encodeURIComponent(rsqlFilter)}`;
    }
    
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
    
    return decodeList(uint8, decodeRead);
}

export async function updateRead(read) {
    const body = encodeRead(read, encodeVarintField, encodeString);
    
    const response = await fetch(`${API_BASE}/reads/${read.id}`, {
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
    
    const response = await fetch(`${API_BASE}/reads`, {
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
    const response = await fetch(`${API_BASE}/reads/${id}`, {
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
};

// Generic fetch function
export async function fetchData(tableName, rsqlFilter = null) {
    switch (tableName) {
        case 'users': return fetchUsers(rsqlFilter);
        case 'articles': return fetchArticles(rsqlFilter);
        case 'reads': return fetchReads(rsqlFilter);
        default: throw new Error(`Unknown table: ${tableName}`);
    }
}

// Generic update function
export async function updateData(tableName, data) {
    switch (tableName) {
        case 'users': return updateUser(data);
        case 'articles': return updateArticle(data);
        case 'reads': return updateRead(data);
        default: throw new Error(`Unknown table: ${tableName}`);
    }
}
