/**
 * BeRead table configuration for AG Grid
 */

// BeRead schema - column definitions for AG Grid
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
        field: 'aid', 
        headerName: 'Article ID',
        width: 120,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'category', 
        headerName: 'Category',
        width: 120,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'readNum', 
        headerName: 'Reads',
        width: 100,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
    },
    { 
        field: 'readUidList', 
        headerName: 'Read By',
        width: 200,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: false,
        valueFormatter: params => {
            if (Array.isArray(params.value)) {
                if (params.value.length > 5) {
                    return params.value.slice(0, 5).join(', ') + ` (+${params.value.length - 5} more)`;
                }
                return params.value.join(', ');
            }
            return params.value || '';
        },
    },
    { 
        field: 'commentNum', 
        headerName: 'Comments',
        width: 100,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
    },
    { 
        field: 'commentUidList', 
        headerName: 'Commented By',
        width: 200,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: false,
        valueFormatter: params => {
            if (Array.isArray(params.value)) {
                if (params.value.length > 5) {
                    return params.value.slice(0, 5).join(', ') + ` (+${params.value.length - 5} more)`;
                }
                return params.value.join(', ');
            }
            return params.value || '';
        },
    },
    { 
        field: 'agreeNum', 
        headerName: 'Agrees',
        width: 100,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
    },
    { 
        field: 'agreeUidList', 
        headerName: 'Agreed By',
        width: 200,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: false,
        valueFormatter: params => {
            if (Array.isArray(params.value)) {
                if (params.value.length > 5) {
                    return params.value.slice(0, 5).join(', ') + ` (+${params.value.length - 5} more)`;
                }
                return params.value.join(', ');
            }
            return params.value || '';
        },
    },
    { 
        field: 'shareNum', 
        headerName: 'Shares',
        width: 100,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
    },
    { 
        field: 'shareUidList', 
        headerName: 'Shared By',
        width: 200,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: false,
        valueFormatter: params => {
            if (Array.isArray(params.value)) {
                if (params.value.length > 5) {
                    return params.value.slice(0, 5).join(', ') + ` (+${params.value.length - 5} more)`;
                }
                return params.value.join(', ');
            }
            return params.value || '';
        },
    },
    { 
        field: 'timestamp', 
        headerName: 'Updated',
        width: 170,
        editable: false,
        filter: 'agDateColumnFilter',
        sortable: true,
        valueFormatter: params => {
            if (!params.value) return '';
            const date = new Date(Number(params.value));
            return date.toLocaleString();
        }
    },
];

// Protobuf field mapping for BeRead
// Field numbers from be_read.proto:
// 1: id (int64), 2: timestamp (int64), 3: aid, 4: category,
// 5: readNum (int32), 6: readUidList (repeated), 7: commentNum (int32),
// 8: commentUidList (repeated), 9: agreeNum (int32), 10: agreeUidList (repeated),
// 11: shareNum (int32), 12: shareUidList (repeated)

export function decodeBeRead(buffer, decodeVarint, decodeString) {
    const beread = {
        id: 0,
        timestamp: 0,
        aid: '',
        category: '',
        readNum: 0,
        readUidList: [],
        commentNum: 0,
        commentUidList: [],
        agreeNum: 0,
        agreeUidList: [],
        shareNum: 0,
        shareUidList: [],
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
                case 1: beread.id = Number(value); break;
                case 2: beread.timestamp = Number(value); break;
                case 5: beread.readNum = Number(value); break;
                case 7: beread.commentNum = Number(value); break;
                case 9: beread.agreeNum = Number(value); break;
                case 11: beread.shareNum = Number(value); break;
            }
        } else if (wireType === 2) {
            // Length-delimited (string)
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            
            const str = decodeString(buffer, pos, Number(length));
            pos += Number(length);
            
            switch (fieldNumber) {
                case 3: beread.aid = str; break;
                case 4: beread.category = str; break;
                case 6: beread.readUidList.push(str); break;
                case 8: beread.commentUidList.push(str); break;
                case 10: beread.agreeUidList.push(str); break;
                case 12: beread.shareUidList.push(str); break;
            }
        } else {
            console.warn(`Unknown wire type ${wireType} for field ${fieldNumber}`);
            break;
        }
    }
    
    return beread;
}

export function encodeBeRead(beread, encodeVarintField, encodeString) {
    const bytes = [
        ...encodeVarintField(1, beread.id),
        ...encodeVarintField(2, beread.timestamp),
        ...encodeString(3, beread.aid),
        ...encodeString(4, beread.category),
        ...encodeVarintField(5, beread.readNum),
        ...(beread.readUidList || []).flatMap(uid => encodeString(6, uid)),
        ...encodeVarintField(7, beread.commentNum),
        ...(beread.commentUidList || []).flatMap(uid => encodeString(8, uid)),
        ...encodeVarintField(9, beread.agreeNum),
        ...(beread.agreeUidList || []).flatMap(uid => encodeString(10, uid)),
        ...encodeVarintField(11, beread.shareNum),
        ...(beread.shareUidList || []).flatMap(uid => encodeString(12, uid)),
    ];
    
    return new Uint8Array(bytes);
}

// Export config
export const tableConfig = {
    name: 'bereads',
    title: 'BeRead Statistics',
    endpoint: '/bereads',
    columnDefs,
    decode: decodeBeRead,
    encode: encodeBeRead,
};
