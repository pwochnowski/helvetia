/**
 * Read table configuration for AG Grid
 */

// Read schema - column definitions for AG Grid
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
        field: 'uid', 
        headerName: 'User ID',
        width: 120,
        editable: false,
        filter: 'agTextColumnFilter',
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
        field: 'region', 
        headerName: 'Region',
        width: 110,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: ['Beijing', 'HongKong']
        }
    },
    { 
        field: 'readTimeLength', 
        headerName: 'Read Time (s)',
        width: 130,
        editable: true,
        filter: 'agNumberColumnFilter',
        sortable: true,
        cellEditor: 'agNumberCellEditor',
    },
    { 
        field: 'agreeOrNot', 
        headerName: 'Agreed',
        width: 100,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellRenderer: params => params.value ? '✓' : '✗',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: [true, false]
        },
        valueParser: params => params.newValue === 'true' || params.newValue === true,
    },
    { 
        field: 'commentOrNot', 
        headerName: 'Commented',
        width: 110,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellRenderer: params => params.value ? '✓' : '✗',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: [true, false]
        },
        valueParser: params => params.newValue === 'true' || params.newValue === true,
    },
    { 
        field: 'commentDetail', 
        headerName: 'Comment',
        width: 250,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'shareOrNot', 
        headerName: 'Shared',
        width: 100,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellRenderer: params => params.value ? '✓' : '✗',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: [true, false]
        },
        valueParser: params => params.newValue === 'true' || params.newValue === true,
    },
    { 
        field: 'timestamp', 
        headerName: 'Read At',
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

// Protobuf field mapping for Read
// Field numbers from read.proto:
// 1: id (int64), 2: timestamp (int64), 3: uid, 4: aid, 5: region,
// 6: readTimeLength (int32), 7: agreeOrNot (bool), 8: commentOrNot (bool),
// 9: commentDetail, 10: shareOrNot (bool)

export function decodeRead(buffer, decodeVarint, decodeString) {
    const read = {
        id: 0,
        timestamp: 0,
        uid: '',
        aid: '',
        region: '',
        readTimeLength: 0,
        agreeOrNot: false,
        commentOrNot: false,
        commentDetail: '',
        shareOrNot: false,
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
                case 1: read.id = Number(value); break;
                case 2: read.timestamp = Number(value); break;
                case 6: read.readTimeLength = Number(value); break;
                case 7: read.agreeOrNot = value !== 0n; break;
                case 8: read.commentOrNot = value !== 0n; break;
                case 10: read.shareOrNot = value !== 0n; break;
            }
        } else if (wireType === 2) {
            // Length-delimited (string)
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            const str = decodeString(buffer, pos, Number(length));
            pos += Number(length);
            
            switch (fieldNumber) {
                case 3: read.uid = str; break;
                case 4: read.aid = str; break;
                case 5: read.region = str; break;
                case 9: read.commentDetail = str; break;
            }
        } else {
            console.warn(`Unknown wire type ${wireType} for field ${fieldNumber}`);
            break;
        }
    }
    
    return read;
}

export function encodeRead(read, encodeVarintField, encodeString) {
    // Helper for encoding booleans
    const encodeBool = (fieldNumber, value) => {
        if (!value) return [];
        return [...encodeVarintField(fieldNumber, 1)];
    };

    const bytes = [
        ...encodeVarintField(1, read.id),
        ...encodeVarintField(2, read.timestamp),
        ...encodeString(3, read.uid),
        ...encodeString(4, read.aid),
        ...encodeString(5, read.region),
        ...encodeVarintField(6, read.readTimeLength),
        ...encodeBool(7, read.agreeOrNot),
        ...encodeBool(8, read.commentOrNot),
        ...encodeString(9, read.commentDetail),
        ...encodeBool(10, read.shareOrNot),
    ];
    
    return new Uint8Array(bytes);
}

// Export config
export const tableConfig = {
    name: 'reads',
    title: 'Read Records',
    endpoint: '/reads',
    columnDefs,
    decode: decodeRead,
    encode: encodeRead,
};
