/**
 * Article table configuration for AG Grid
 */

// Article schema - column definitions for AG Grid
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
        field: 'title', 
        headerName: 'Title',
        width: 250,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'category', 
        headerName: 'Category',
        width: 120,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: ['science', 'technology', 'entertainment', 'sport', 'business', 'politics', 'health', 'travel']
        }
    },
    { 
        field: 'abstract', 
        headerName: 'Abstract',
        width: 300,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: true,
    },
    { 
        field: 'articleTags', 
        headerName: 'Tags',
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
            if (typeof params.newValue === 'string') {
                return params.newValue.split(',').map(s => s.trim()).filter(s => s);
            }
            return params.newValue;
        }
    },
    { 
        field: 'authors', 
        headerName: 'Authors',
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
            if (typeof params.newValue === 'string') {
                return params.newValue.split(',').map(s => s.trim()).filter(s => s);
            }
            return params.newValue;
        }
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
        field: 'timestamp', 
        headerName: 'Created',
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

// Protobuf field mapping for Article
// Field numbers from article.proto:
// 1: id (int64), 2: timestamp (int64), 3: aid, 4: title, 5: category,
// 6: abstract, 7: articleTags (repeated), 8: authors (repeated), 9: language,
// 10: text, 11: image (bytes), 12: video (bytes)

export function decodeArticle(buffer, decodeVarint, decodeString) {
    const article = {
        id: 0,
        timestamp: 0,
        aid: '',
        title: '',
        category: '',
        abstract: '',
        articleTags: [],
        authors: [],
        language: '',
        text: '',
        // Skip image and video for list view
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
                case 1: article.id = Number(value); break;
                case 2: article.timestamp = Number(value); break;
            }
        } else if (wireType === 2) {
            // Length-delimited (string or bytes)
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            
            // Skip binary fields (image=11, video=12)
            if (fieldNumber === 11 || fieldNumber === 12) {
                pos += Number(length);
                continue;
            }
            
            const str = decodeString(buffer, pos, Number(length));
            pos += Number(length);
            
            switch (fieldNumber) {
                case 3: article.aid = str; break;
                case 4: article.title = str; break;
                case 5: article.category = str; break;
                case 6: article.abstract = str; break;
                case 7: article.articleTags.push(str); break;
                case 8: article.authors.push(str); break;
                case 9: article.language = str; break;
                case 10: article.text = str; break;
            }
        } else {
            console.warn(`Unknown wire type ${wireType} for field ${fieldNumber}`);
            break;
        }
    }
    
    return article;
}

export function encodeArticle(article, encodeVarintField, encodeString) {
    const bytes = [
        ...encodeVarintField(1, article.id),
        ...encodeVarintField(2, article.timestamp),
        ...encodeString(3, article.aid),
        ...encodeString(4, article.title),
        ...encodeString(5, article.category),
        ...encodeString(6, article.abstract),
        ...(article.articleTags || []).flatMap(tag => encodeString(7, tag)),
        ...(article.authors || []).flatMap(author => encodeString(8, author)),
        ...encodeString(9, article.language),
        ...encodeString(10, article.text),
        // Skip image and video for updates
    ];
    
    return new Uint8Array(bytes);
}

// Export config
export const tableConfig = {
    name: 'articles',
    title: 'Article Management',
    endpoint: '/articles',
    columnDefs,
    decode: decodeArticle,
    encode: encodeArticle,
};
