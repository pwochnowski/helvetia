/**
 * User table configuration for AG Grid
 */

// User schema - column definitions for AG Grid
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
        headerName: 'UID',
        width: 120,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'name', 
        headerName: 'Name',
        width: 150,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'gender', 
        headerName: 'Gender',
        width: 100,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: ['male', 'female', 'other']
        }
    },
    { 
        field: 'email', 
        headerName: 'Email',
        width: 200,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'phone', 
        headerName: 'Phone',
        width: 130,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'dept', 
        headerName: 'Department',
        width: 130,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'grade', 
        headerName: 'Grade',
        width: 100,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'language', 
        headerName: 'Language',
        width: 100,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: ['en', 'zh']
        }
    },
    { 
        field: 'region', 
        headerName: 'Region',
        width: 110,
        editable: false,  // Primary vindex column - cannot be changed
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'role', 
        headerName: 'Role',
        width: 100,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'preferTags', 
        headerName: 'Preferred Tags',
        width: 180,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
        valueFormatter: params => {
            if (Array.isArray(params.value)) {
                return params.value.join(', ');
            }
            return params.value || '';
        },
        valueParser: params => {
            // Parse comma-separated string back to array
            if (typeof params.newValue === 'string') {
                return params.newValue.split(',').map(s => s.trim()).filter(s => s);
            }
            return params.newValue;
        }
    },
    { 
        field: 'obtainedCredits', 
        headerName: 'Credits',
        width: 100,
        editable: true,
        filter: 'agNumberColumnFilter',
        sortable: true,
        cellEditor: 'agNumberCellEditor',
    },
    { 
        field: 'timestamp', 
        headerName: 'Created',
        width: 170,
        editable: false,
        filter: 'agDateColumnFilter',
        sortable: true,
        valueFormatter: params => {
            if (!params.value) return '';
            // timestamp is in milliseconds
            const date = new Date(Number(params.value));
            return date.toLocaleString();
        }
    },
];

// Protobuf field mapping for User
// Field numbers from user.proto:
// 1: id (int64), 2: timestamp (int64), 3: uid, 4: name, 5: gender,
// 6: email, 7: phone, 8: dept, 9: grade, 10: language,
// 11: region, 12: role, 13: preferTags (repeated), 14: obtainedCredits (int32)

export function decodeUser(buffer, decodeVarint, decodeString) {
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

export function encodeUser(user, encodeVarintField, encodeString) {
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

// Export config
export const tableConfig = {
    name: 'users',
    title: 'User Management',
    endpoint: '/users',
    columnDefs,
    decode: decodeUser,
    encode: encodeUser,
};
