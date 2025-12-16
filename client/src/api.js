/**
 * API client for Helvetia backend
 * Handles protobuf encoding/decoding for User entities
 */

// API base URL - empty string to use Vite proxy in development
// In production, set this to the actual backend URL
export const API_BASE = '';

// Simple protobuf decoding for User message
// Field numbers from user.proto:
// 1: id (int64), 2: timestamp (int64), 3: uid, 4: name, 5: gender,
// 6: email, 7: phone, 8: dept, 9: grade, 10: language,
// 11: region, 12: role, 13: preferTags (repeated), 14: obtainedCredits (int32)

function decodeVarint(buffer, offset) {
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

function decodeString(buffer, offset, length) {
    const bytes = buffer.slice(offset, offset + length);
    return new TextDecoder().decode(bytes);
}

function decodeUser(buffer) {
    const user = {
        id: 0,
        timestamp: 0,
        uid: '',
        name: '',
        gender: '',
        email: '',
        phone: '',
        dept: '',
        grade: '',
        language: '',
        region: '',
        role: '',
        preferTags: [],
        obtainedCredits: 0,
    };
    
    let pos = 0;
    
    while (pos < buffer.length) {
        const { value: tag, bytesRead: tagBytes } = decodeVarint(buffer, pos);
        pos += tagBytes;
        
        const fieldNumber = Number(tag >> 3n);
        const wireType = Number(tag & 7n);
        
        if (wireType === 0) {
            // Varint
            const { value, bytesRead } = decodeVarint(buffer, pos);
            pos += bytesRead;
            
            switch (fieldNumber) {
                case 1: user.id = Number(value); break;
                case 2: user.timestamp = Number(value); break;
                case 14: user.obtainedCredits = Number(value); break;
            }
        } else if (wireType === 2) {
            // Length-delimited (string)
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            const str = decodeString(buffer, pos, Number(length));
            pos += Number(length);
            
            switch (fieldNumber) {
                case 3: user.uid = str; break;
                case 4: user.name = str; break;
                case 5: user.gender = str; break;
                case 6: user.email = str; break;
                case 7: user.phone = str; break;
                case 8: user.dept = str; break;
                case 9: user.grade = str; break;
                case 10: user.language = str; break;
                case 11: user.region = str; break;
                case 12: user.role = str; break;
                case 13: user.preferTags.push(str); break;
            }
        } else {
            // Skip unknown wire types
            console.warn(`Unknown wire type ${wireType} for field ${fieldNumber}`);
            break;
        }
    }
    
    return user;
}

function decodeUserList(buffer) {
    // UserList has field 1 = repeated User
    const users = [];
    let pos = 0;
    
    while (pos < buffer.length) {
        const { value: tag, bytesRead: tagBytes } = decodeVarint(buffer, pos);
        pos += tagBytes;
        
        const fieldNumber = Number(tag >> 3n);
        const wireType = Number(tag & 7n);
        
        if (fieldNumber === 1 && wireType === 2) {
            // Length-delimited User message
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            
            const userBuffer = buffer.slice(pos, pos + Number(length));
            users.push(decodeUser(userBuffer));
            pos += Number(length);
        } else {
            break;
        }
    }
    
    return users;
}

// Encode a User to protobuf bytes
function encodeVarint(value) {
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

function encodeString(fieldNumber, value) {
    if (!value) return [];
    const encoded = new TextEncoder().encode(value);
    return [
        ...encodeVarint((fieldNumber << 3) | 2),
        ...encodeVarint(encoded.length),
        ...encoded
    ];
}

function encodeVarintField(fieldNumber, value) {
    if (value === 0 || value === undefined) return [];
    return [
        ...encodeVarint(fieldNumber << 3),
        ...encodeVarint(value)
    ];
}

function encodeUser(user) {
    const bytes = [
        ...encodeVarintField(1, user.id),
        ...encodeVarintField(2, user.timestamp),
        ...encodeString(3, user.uid),
        ...encodeString(4, user.name),
        ...encodeString(5, user.gender),
        ...encodeString(6, user.email),
        ...encodeString(7, user.phone),
        ...encodeString(8, user.dept),
        ...encodeString(9, user.grade),
        ...encodeString(10, user.language),
        ...encodeString(11, user.region),
        ...encodeString(12, user.role),
        // preferTags - repeated field
        ...(user.preferTags || []).flatMap(tag => encodeString(13, tag)),
        ...encodeVarintField(14, user.obtainedCredits),
    ];
    
    return new Uint8Array(bytes);
}

/**
 * Fetch all users from the API
 * @param {string|null} rsqlFilter - Optional RSQL filter query
 */
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
    
    return decodeUserList(uint8);
}

/**
 * Update a user via the API
 */
export async function updateUser(user) {
    const body = encodeUser(user);
    
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

/**
 * Create a new user via the API
 */
export async function createUser(user) {
    const body = encodeUser(user);
    
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

/**
 * Delete a user via the API
 */
export async function deleteUser(id) {
    const response = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}
