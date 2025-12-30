/**
 * UserRead table configuration for AG Grid
 * This is a joined view of the user and read tables
 */

// UserRead schema - column definitions for AG Grid
// Fields from both tables are available for filtering
export const columnDefs = [
    // Read table fields
    { 
        field: 'read_id', 
        headerName: 'Read ID',
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
        cellRenderer: params => {
            if (!params.value) return '';
            const aid = params.value;
            return `<a href="#" class="article-id-link" onclick="event.preventDefault(); window.showArticlePopup('${aid}')">${aid}</a>`;
        },
    },
    { 
        field: 'region', 
        headerName: 'Region',
        width: 110,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        // Highlight: filtering on region pushes query to specific shard
        cellStyle: { fontWeight: '500' },
    },
    { 
        field: 'readTimeLength', 
        headerName: 'Read Time (s)',
        width: 130,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
    },
    { 
        field: 'agreeOrNot', 
        headerName: 'Agreed',
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellRenderer: params => params.value ? '✓' : '✗',
    },
    { 
        field: 'commentOrNot', 
        headerName: 'Commented',
        width: 110,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellRenderer: params => params.value ? '✓' : '✗',
    },
    { 
        field: 'shareOrNot', 
        headerName: 'Shared',
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellRenderer: params => params.value ? '✓' : '✗',
    },
    { 
        field: 'read_timestamp', 
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
    // User table fields (prefixed with user_)
    { 
        field: 'user_name', 
        headerName: 'User Name',
        width: 150,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'user_gender', 
        headerName: 'Gender',
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'user_email', 
        headerName: 'Email',
        width: 200,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'user_dept', 
        headerName: 'Department',
        width: 130,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'user_grade', 
        headerName: 'Grade',
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'user_language', 
        headerName: 'Language',
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'user_role', 
        headerName: 'Role',
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'user_obtainedCredits', 
        headerName: 'Credits',
        width: 100,
        editable: false,
        filter: 'agNumberColumnFilter',
        sortable: true,
    },
];

// Protobuf field mapping for UserRead
// Field numbers from user_read.proto:
// 1: read_id, 2: read_timestamp, 3: uid, 4: aid, 5: region,
// 6: readTimeLength, 7: agreeOrNot, 8: commentOrNot, 9: commentDetail, 10: shareOrNot
// 11: user_id, 12: user_timestamp, 13: user_name, 14: user_gender, 15: user_email,
// 16: user_phone, 17: user_dept, 18: user_grade, 19: user_language, 20: user_role,
// 21: user_preferTags (repeated), 22: user_obtainedCredits

export function decodeUserRead(buffer, decodeVarint, decodeString) {
    const userRead = {
        read_id: 0,
        read_timestamp: 0,
        uid: '',
        aid: '',
        region: '',
        readTimeLength: 0,
        agreeOrNot: false,
        commentOrNot: false,
        commentDetail: '',
        shareOrNot: false,
        user_id: 0,
        user_timestamp: 0,
        user_name: '',
        user_gender: '',
        user_email: '',
        user_phone: '',
        user_dept: '',
        user_grade: '',
        user_language: '',
        user_role: '',
        user_preferTags: [],
        user_obtainedCredits: 0,
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
                case 1: userRead.read_id = Number(value); break;
                case 2: userRead.read_timestamp = Number(value); break;
                case 6: userRead.readTimeLength = Number(value); break;
                case 7: userRead.agreeOrNot = value !== 0n; break;
                case 8: userRead.commentOrNot = value !== 0n; break;
                case 10: userRead.shareOrNot = value !== 0n; break;
                case 11: userRead.user_id = Number(value); break;
                case 12: userRead.user_timestamp = Number(value); break;
                case 22: userRead.user_obtainedCredits = Number(value); break;
            }
        } else if (wireType === 2) {
            // Length-delimited (string)
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            const str = decodeString(buffer, pos, Number(length));
            pos += Number(length);
            
            switch (fieldNumber) {
                case 3: userRead.uid = str; break;
                case 4: userRead.aid = str; break;
                case 5: userRead.region = str; break;
                case 9: userRead.commentDetail = str; break;
                case 13: userRead.user_name = str; break;
                case 14: userRead.user_gender = str; break;
                case 15: userRead.user_email = str; break;
                case 16: userRead.user_phone = str; break;
                case 17: userRead.user_dept = str; break;
                case 18: userRead.user_grade = str; break;
                case 19: userRead.user_language = str; break;
                case 20: userRead.user_role = str; break;
                case 21: userRead.user_preferTags.push(str); break;
            }
        } else {
            console.warn(`Unknown wire type ${wireType} for field ${fieldNumber}`);
            break;
        }
    }
    
    return userRead;
}

// No encode function needed - this is a read-only view
export function encodeUserRead(userRead, encodeVarintField, encodeString) {
    throw new Error('UserRead is a read-only view and cannot be encoded');
}

// Export config
export const tableConfig = {
    name: 'userreads',
    title: 'User Reads (Joined View)',
    endpoint: '/userreads',
    columnDefs,
    decode: decodeUserRead,
    encode: encodeUserRead,
    readOnly: true,  // This view is read-only
};
