/**
 * PopularRank table configuration for AG Grid
 */

// PopularRank schema - column definitions for AG Grid
export const columnDefs = [
    { 
        field: 'id', 
        headerName: 'ID',
        width: 100,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
    },
    { 
        field: 'temporalGranularity', 
        headerName: 'Granularity',
        width: 120,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'rankDate', 
        headerName: 'Date',
        width: 120,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'articleAidList', 
        headerName: 'Top Articles',
        width: 300,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: false,
        valueFormatter: params => {
            if (Array.isArray(params.value)) {
                return params.value.join(', ');
            }
            return params.value || '';
        },
    },
    { 
        field: 'timestamp', 
        headerName: 'Last Updated',
        width: 180,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
        valueFormatter: params => {
            if (params.value) {
                return new Date(Number(params.value)).toLocaleString();
            }
            return '';
        },
    },
];

// Table configuration
export const tableConfig = {
    name: 'Popular Ranks',
    endpoint: '/popularranks',
    idField: 'id',
    columnDefs,
    defaultColDef: {
        resizable: true,
        sortable: true,
    },
};

// Decode a single PopularRank from protobuf
export function decodePopularRank(buffer, decodeVarint, decodeString) {
    const result = {
        id: 0,
        timestamp: 0,
        temporalGranularity: '',
        articleAidList: [],
        rankDate: '',
    };
    
    let pos = 0;
    
    while (pos < buffer.length) {
        const { value: tag, bytesRead: tagBytes } = decodeVarint(buffer, pos);
        pos += tagBytes;
        
        const fieldNumber = Number(tag >> 3n);
        const wireType = Number(tag & 7n);
        
        switch (fieldNumber) {
            case 1: // id (int64)
                if (wireType === 0) {
                    const { value, bytesRead } = decodeVarint(buffer, pos);
                    result.id = Number(value);
                    pos += bytesRead;
                }
                break;
            case 2: // timestamp (int64)
                if (wireType === 0) {
                    const { value, bytesRead } = decodeVarint(buffer, pos);
                    result.timestamp = Number(value);
                    pos += bytesRead;
                }
                break;
            case 3: // temporalGranularity (string)
                if (wireType === 2) {
                    const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
                    pos += lengthBytes;
                    result.temporalGranularity = decodeString(buffer, pos, Number(length));
                    pos += Number(length);
                }
                break;
            case 4: // articleAidList (repeated string)
                if (wireType === 2) {
                    const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
                    pos += lengthBytes;
                    result.articleAidList.push(decodeString(buffer, pos, Number(length)));
                    pos += Number(length);
                }
                break;
            case 5: // rankDate (string)
                if (wireType === 2) {
                    const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
                    pos += lengthBytes;
                    result.rankDate = decodeString(buffer, pos, Number(length));
                    pos += Number(length);
                }
                break;
            default:
                // Skip unknown fields
                if (wireType === 0) {
                    const { bytesRead } = decodeVarint(buffer, pos);
                    pos += bytesRead;
                } else if (wireType === 2) {
                    const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
                    pos += lengthBytes + Number(length);
                } else {
                    pos = buffer.length; // Unknown wire type, stop parsing
                }
        }
    }
    
    return result;
}

// Encode a PopularRank to protobuf
export function encodePopularRank(popularRank, encodeVarintField, encodeString) {
    const bytes = [];
    
    // Field 1: id (int64)
    bytes.push(...encodeVarintField(1, popularRank.id));
    
    // Field 2: timestamp (int64) - usually set by server
    if (popularRank.timestamp) {
        bytes.push(...encodeVarintField(2, popularRank.timestamp));
    }
    
    // Field 3: temporalGranularity (string)
    bytes.push(...encodeString(3, popularRank.temporalGranularity));
    
    // Field 4: articleAidList (repeated string)
    if (Array.isArray(popularRank.articleAidList)) {
        for (const aid of popularRank.articleAidList) {
            bytes.push(...encodeString(4, aid));
        }
    }
    
    // Field 5: rankDate (string)
    bytes.push(...encodeString(5, popularRank.rankDate));
    
    return new Uint8Array(bytes);
}
