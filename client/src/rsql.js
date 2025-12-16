/**
 * Convert AG Grid filter model to RSQL query string
 * 
 * AG Grid filter model format:
 * {
 *   "fieldName": {
 *     "filterType": "text|number|date",
 *     "type": "contains|equals|notEqual|startsWith|endsWith|lessThan|greaterThan|...",
 *     "filter": "value",
 *     "filterTo": "value2" (for range filters)
 *   }
 * }
 * 
 * RSQL format:
 * - Comparison: field==value, field!=value, field=gt=value, field=lt=value
 * - Like: field=like=*value* (contains), field=like=value* (startsWith)
 * - And: condition1;condition2
 * - Or: condition1,condition2
 */

/**
 * Escape special RSQL characters in a value
 */
function escapeRsqlValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and backslashes
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
}

/**
 * Quote a value if it contains special characters
 */
function quoteValue(value) {
    const escaped = escapeRsqlValue(value);
    // Quote if contains spaces, special chars, or is empty
    if (/[\s,;()=<>!~*"]/.test(escaped) || escaped === '') {
        return `"${escaped}"`;
    }
    return escaped;
}

/**
 * Convert a single AG Grid text filter to RSQL
 */
function textFilterToRsql(field, filter) {
    const { type, filter: value } = filter;
    const quotedValue = quoteValue(value);
    
    switch (type) {
        case 'equals':
            return `${field}==${quotedValue}`;
        case 'notEqual':
            return `${field}!=${quotedValue}`;
        case 'contains':
            return `${field}=like="*${escapeRsqlValue(value)}*"`;
        case 'notContains':
            return `${field}=notlike="*${escapeRsqlValue(value)}*"`;
        case 'startsWith':
            return `${field}=like="${escapeRsqlValue(value)}*"`;
        case 'endsWith':
            return `${field}=like="*${escapeRsqlValue(value)}"`;
        case 'blank':
            return `${field}=isnull=true`;
        case 'notBlank':
            return `${field}=isnull=false`;
        default:
            console.warn(`Unknown text filter type: ${type}`);
            return null;
    }
}

/**
 * Convert a single AG Grid number filter to RSQL
 */
function numberFilterToRsql(field, filter) {
    const { type, filter: value, filterTo } = filter;
    
    switch (type) {
        case 'equals':
            return `${field}==${value}`;
        case 'notEqual':
            return `${field}!=${value}`;
        case 'lessThan':
            return `${field}=lt=${value}`;
        case 'lessThanOrEqual':
            return `${field}=le=${value}`;
        case 'greaterThan':
            return `${field}=gt=${value}`;
        case 'greaterThanOrEqual':
            return `${field}=ge=${value}`;
        case 'inRange':
            return `(${field}=ge=${value};${field}=le=${filterTo})`;
        case 'blank':
            return `${field}=isnull=true`;
        case 'notBlank':
            return `${field}=isnull=false`;
        default:
            console.warn(`Unknown number filter type: ${type}`);
            return null;
    }
}

/**
 * Convert a single AG Grid date filter to RSQL
 * Note: AG Grid sends dates as ISO strings or timestamps
 */
function dateFilterToRsql(field, filter) {
    const { type, dateFrom, dateTo } = filter;
    
    // Convert date to timestamp (milliseconds) for comparison
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() : null;
    
    switch (type) {
        case 'equals':
            // For equals, we need a range for the same day
            const dayStart = fromTs;
            const dayEnd = fromTs + 24 * 60 * 60 * 1000; // +1 day
            return `(${field}=ge=${dayStart};${field}=lt=${dayEnd})`;
        case 'notEqual':
            return `${field}!=${fromTs}`;
        case 'lessThan':
            return `${field}=lt=${fromTs}`;
        case 'greaterThan':
            return `${field}=gt=${fromTs}`;
        case 'inRange':
            return `(${field}=ge=${fromTs};${field}=le=${toTs})`;
        case 'blank':
            return `${field}=isnull=true`;
        case 'notBlank':
            return `${field}=isnull=false`;
        default:
            console.warn(`Unknown date filter type: ${type}`);
            return null;
    }
}

/**
 * Convert a single field's filter (which may have conditions) to RSQL
 */
function fieldFilterToRsql(field, filter) {
    // Handle combined conditions (AND/OR)
    if (filter.operator && filter.conditions) {
        const conditions = filter.conditions
            .map(cond => fieldFilterToRsql(field, cond))
            .filter(Boolean);
        
        if (conditions.length === 0) return null;
        if (conditions.length === 1) return conditions[0];
        
        const joiner = filter.operator === 'OR' ? ',' : ';';
        return `(${conditions.join(joiner)})`;
    }
    
    // Single condition
    const { filterType } = filter;
    
    switch (filterType) {
        case 'text':
            return textFilterToRsql(field, filter);
        case 'number':
            return numberFilterToRsql(field, filter);
        case 'date':
            return dateFilterToRsql(field, filter);
        default:
            // Try to infer from the filter structure
            if ('filter' in filter && typeof filter.filter === 'string') {
                return textFilterToRsql(field, filter);
            }
            if ('filter' in filter && typeof filter.filter === 'number') {
                return numberFilterToRsql(field, filter);
            }
            console.warn(`Unknown filter type for field ${field}:`, filter);
            return null;
    }
}

/**
 * Convert AG Grid's full filter model to RSQL query string
 * 
 * @param {Object} filterModel - AG Grid's filter model from api.getFilterModel()
 * @returns {string|null} - RSQL query string, or null if no filters
 */
export function filterModelToRsql(filterModel) {
    if (!filterModel || Object.keys(filterModel).length === 0) {
        return null;
    }
    
    const conditions = [];
    
    for (const [field, filter] of Object.entries(filterModel)) {
        const rsql = fieldFilterToRsql(field, filter);
        if (rsql) {
            conditions.push(rsql);
        }
    }
    
    if (conditions.length === 0) {
        return null;
    }
    
    // Join all field conditions with AND (;)
    return conditions.join(';');
}

/**
 * Parse RSQL string back to a simple representation (for debugging)
 * This is a simplified parser - the server will do the real parsing
 */
export function parseRsqlForDisplay(rsql) {
    if (!rsql) return 'No filters';
    return rsql
        .replace(/;/g, ' AND ')
        .replace(/,/g, ' OR ')
        .replace(/==/g, ' = ')
        .replace(/!=/g, ' ≠ ')
        .replace(/=gt=/g, ' > ')
        .replace(/=ge=/g, ' >= ')
        .replace(/=lt=/g, ' < ')
        .replace(/=le=/g, ' <= ')
        .replace(/=like=/g, ' LIKE ')
        .replace(/=isnull=true/g, ' IS NULL')
        .replace(/=isnull=false/g, ' IS NOT NULL');
}
