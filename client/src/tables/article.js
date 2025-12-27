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
        cellRenderer: params => {
            if (!params.value) return '';
            const aid = params.value;
            return `<a href="#" class="article-id-link" onclick="event.preventDefault(); window.showArticlePopup('${aid}')">${aid}</a>`;
        },
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
        editable: false,  // Primary vindex column - cannot be changed
        filter: 'agTextColumnFilter',
        sortable: true,
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
    { 
        field: 'textPath', 
        headerName: 'Text File',
        width: 150,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: false,
    },
    { 
        field: 'textUrl', 
        headerName: 'Text Download',
        width: 120,
        editable: false,
        sortable: false,
        cellRenderer: params => {
            if (!params.value) return '';
            return `<a href="${params.value}" target="_blank" rel="noopener">Download</a>`;
        }
    },
    { 
        field: 'imagePath', 
        headerName: 'Image File',
        width: 150,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: false,
    },
    { 
        field: 'imageUrl', 
        headerName: 'Image Download',
        width: 120,
        editable: false,
        sortable: false,
        cellRenderer: params => {
            if (!params.value) return '';
            return `<a href="${params.value}" target="_blank" rel="noopener">Download</a>`;
        }
    },
    { 
        field: 'videoPath', 
        headerName: 'Video File',
        width: 150,
        editable: true,
        filter: 'agTextColumnFilter',
        sortable: false,
    },
    { 
        field: 'videoUrl', 
        headerName: 'Video Download',
        width: 120,
        editable: false,
        sortable: false,
        cellRenderer: params => {
            if (!params.value) return '';
            return `<a href="${params.value}" target="_blank" rel="noopener">Download</a>`;
        }
    },
];

// Protobuf field mapping for Article
// Field numbers from article.proto:
// 1: id (int64), 2: timestamp (int64), 3: aid, 4: title, 5: category,
// 6: abstract, 7: articleTags (repeated), 8: authors (repeated), 9: language,
// 11: textPath, 12: imagePath, 13: videoPath,
// 14: textUrl, 15: imageUrl, 16: videoUrl

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
        textPath: '',
        imagePath: '',
        videoPath: '',
        textUrl: '',
        imageUrl: '',
        videoUrl: '',
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
            // Length-delimited (string)
            const { value: length, bytesRead: lengthBytes } = decodeVarint(buffer, pos);
            pos += lengthBytes;
            
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
                case 11: article.textPath = str; break;
                case 12: article.imagePath = str; break;
                case 13: article.videoPath = str; break;
                case 14: article.textUrl = str; break;
                case 15: article.imageUrl = str; break;
                case 16: article.videoUrl = str; break;
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
        ...encodeString(11, article.textPath),
        ...encodeString(12, article.imagePath),
        ...encodeString(13, article.videoPath),
        // Note: URL fields (14-16) are read-only, generated by server
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
