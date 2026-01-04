import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { fetchData, updateData, createData, canCreateEntry, tableConfigs, setServer, getCurrentServer } from './api.js';
import { filterModelToRsql, parseRsqlForDisplay } from './rsql.js';
import './articlePopup.js'; // Initialize article popup

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Current table state
let currentTable = 'users';
let gridApi = null;

// Server-side pagination and sorting state
const PAGE_SIZE = 100;
let currentPage = 0;
let totalCount = 0;
let isEstimatedCount = false;  // True when count is a placeholder (for cross-shard joins)
let hasReachedEnd = false;     // True when we've detected the last page
let isLoading = false;
let currentFilter = null;
let currentSortBy = null;
let currentSortDir = null;

// Placeholder count used for cross-shard queries (matches server-side PLACEHOLDER_COUNT = -1)
const PLACEHOLDER_COUNT = -1;
const ESTIMATED_TOTAL = 50000;  // Display value when count is unavailable

// Get current table config
function getTableConfig() {
    return tableConfigs[currentTable];
}

// Status display helper
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    if (type !== 'loading') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

// Update row count display with total and current page info
function updateRowCount() {
    const config = getTableConfig();
    const startRow = currentPage * PAGE_SIZE + 1;
    const rowData = gridApi?.getDisplayedRowCount() || 0;
    const endRow = currentPage * PAGE_SIZE + rowData;
    
    if (rowData > 0) {
        let countDisplay;
        if (isEstimatedCount && !hasReachedEnd) {
            // Show estimated count with indicator
            countDisplay = `~${ESTIMATED_TOTAL.toLocaleString()}+`;
        } else if (hasReachedEnd) {
            // We know the exact count now
            countDisplay = totalCount.toLocaleString();
        } else {
            countDisplay = totalCount.toLocaleString();
        }
        
        const totalPages = hasReachedEnd ? Math.ceil(totalCount / PAGE_SIZE) : '?';
        const displayPage = currentPage + 1;
        
        document.getElementById('row-count').textContent = 
            `Showing ${startRow.toLocaleString()}-${endRow.toLocaleString()} of ${countDisplay} ${config.name} (Page ${displayPage} of ${totalPages})`;
    } else if (currentPage === 0) {
        document.getElementById('row-count').textContent = `No ${config.name} found`;
    } else {
        // Empty page but not first page - we've gone past the end
        document.getElementById('row-count').textContent = `No more ${config.name}`;
    }
}

// Update pagination controls
function updatePaginationControls() {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 0 || isLoading;
    }
    if (nextBtn) {
        // Disable next button if we've reached the end
        const atEnd = hasReachedEnd && (currentPage >= Math.ceil(totalCount / PAGE_SIZE) - 1);
        nextBtn.disabled = atEnd || isLoading;
        // Visual indicator that we don't know if there's more
        if (isEstimatedCount && !hasReachedEnd) {
            nextBtn.textContent = 'Next →';
            nextBtn.title = 'More pages may be available';
        } else {
            nextBtn.textContent = 'Next →';
            nextBtn.title = '';
        }
    }
    if (pageInfo) {
        const totalPages = hasReachedEnd ? Math.ceil(totalCount / PAGE_SIZE) : '?';
        pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
    }
}

// Update page title
function updateTitle() {
    const config = getTableConfig();
    document.getElementById('page-title').textContent = `📊 Helvetia ${config.title}`;
    document.title = `Helvetia - ${config.title}`;
}

// Update active tab
function updateActiveTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.table === currentTable);
    });
}

// Debounce helper for filter changes
let filterDebounceTimer = null;
function debounce(fn, delay) {
    return (...args) => {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = setTimeout(() => fn(...args), delay);
    };
}

// Load data for current page
async function loadPage(page = 0) {
    if (isLoading) return;
    
    const config = getTableConfig();
    isLoading = true;
    currentPage = page;
    
    showStatus(`Loading ${config.name}...`, 'loading');
    updatePaginationControls();
    
    try {
        // Get current filter model and convert to RSQL
        const filterModel = gridApi?.getFilterModel() || {};
        currentFilter = filterModelToRsql(filterModel);
        
        // Get current sort state from grid
        const sortModel = gridApi?.getColumnState()?.find(col => col.sort);
        currentSortBy = sortModel?.colId || null;
        currentSortDir = sortModel?.sort || null;
        
        // Debug: show the RSQL and sort in console
        if (currentFilter || currentSortBy) {
            console.log('RSQL Filter:', currentFilter);
            console.log('Sort:', currentSortBy, currentSortDir);
        }
        
        const offset = page * PAGE_SIZE;
        const result = await fetchData(currentTable, currentFilter, PAGE_SIZE, offset, currentSortBy, currentSortDir);
        
        // Handle placeholder count from server (-1 means count was too expensive)
        if (result.totalCount === PLACEHOLDER_COUNT) {
            isEstimatedCount = true;
            totalCount = ESTIMATED_TOTAL;  // Display placeholder
        } else {
            isEstimatedCount = false;
            totalCount = result.totalCount;
            hasReachedEnd = true;  // Server gave us real count
        }
        
        // Detect end-of-list: fewer rows returned than requested
        const returnedRows = result.items.length;
        if (returnedRows < PAGE_SIZE) {
            hasReachedEnd = true;
            // Calculate actual total count based on current position
            totalCount = offset + returnedRows;
            isEstimatedCount = false;
        }
        
        // Set page data in grid
        gridApi.setGridOption('rowData', result.items);
        updateRowCount();
        updatePaginationControls();
        
        const filterMsg = currentFilter ? ` (filtered)` : '';
        const sortMsg = currentSortBy ? ` (sorted by ${currentSortBy})` : '';
        showStatus(`Loaded page ${page + 1} of ${config.name}${filterMsg}${sortMsg}`, 'success');
    } catch (error) {
        console.error(`Failed to load ${config.name}:`, error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        isLoading = false;
        updatePaginationControls();
    }
}

// Load first page (reset)
async function loadData() {
    await loadPage(0);
}

// Navigate to previous page
async function prevPage() {
    if (currentPage > 0) {
        await loadPage(currentPage - 1);
    }
}

// Navigate to next page
async function nextPage() {
    // If we have a definite count, check if we can go forward
    if (hasReachedEnd) {
        const totalPages = Math.ceil(totalCount / PAGE_SIZE);
        if (currentPage >= totalPages - 1) {
            return;
        }
    }
    // Otherwise, try loading the next page - we'll detect end-of-list if needed
    await loadPage(currentPage + 1);
}

// Handle filter changes - reload data from server with new filters
const onFilterChanged = debounce(() => {
    console.log('Filter changed, reloading from server...');
    // Reset estimation state when filter changes
    hasReachedEnd = false;
    isEstimatedCount = false;
    loadPage(0);  // Reset to first page when filter changes
}, 300);  // 300ms debounce to avoid too many requests while typing

// Handle sort changes - reload data from server with new sort
const onSortChanged = () => {
    console.log('Sort changed, reloading from server...');
    // Reset estimation state when sort changes
    hasReachedEnd = false;
    isEstimatedCount = false;
    loadPage(0);  // Reset to first page when sort changes
};

// Handle cell value changes
async function onCellValueChanged(event) {
    const { data, colDef, oldValue, newValue } = event;
    
    if (oldValue === newValue) return;
    
    console.log(`Cell changed: ${colDef.field} from "${oldValue}" to "${newValue}" for id ${data.id}`);
    
    try {
        showStatus('Saving...', 'loading');
        await updateData(currentTable, data);
        showStatus('Saved', 'success');
    } catch (error) {
        console.error('Failed to save:', error);
        showStatus(`Save failed: ${error.message}`, 'error');
        // Revert the change in the grid
        event.node.setDataValue(colDef.field, oldValue);
    }
}

// Export grid data to CSV
function exportData() {
    if (!gridApi) return;
    
    const config = getTableConfig();
    gridApi.exportDataAsCsv({
        fileName: `${config.name}.csv`,
        columnSeparator: ',',
    });
    showStatus('Exported to CSV', 'success');
}

// Switch to a different table
function switchTable(tableName) {
    if (tableName === currentTable) return;
    if (!tableConfigs[tableName]) {
        console.error(`Unknown table: ${tableName}`);
        return;
    }
    
    currentTable = tableName;
    const config = getTableConfig();
    
    // Update UI
    updateTitle();
    updateActiveTabs();
    updateAddButtonVisibility();
    
    // Update grid columns
    gridApi.setGridOption('columnDefs', config.columnDefs);
    
    // Reset pagination and sort state
    currentPage = 0;
    totalCount = 0;
    currentSortBy = null;
    currentSortDir = null;
    hasReachedEnd = false;
    isEstimatedCount = false;
    gridApi.setGridOption('rowData', []);
    loadPage(0);
}

// Create grid options
function createGridOptions() {
    const config = getTableConfig();
    
    return {
        columnDefs: config.columnDefs,
        defaultColDef: {
            resizable: true,
            sortable: true,
            filter: true,
            floatingFilter: true,  // Show filter inputs below headers
        },
        rowData: [],
        
        // Enable editing
        editType: 'fullRow',
        stopEditingWhenCellsLoseFocus: true,
        
        // Selection
        rowSelection: 'multiple',
        
        // Events
        onCellValueChanged,
        onFilterChanged,
        onSortChanged,
        onGridReady: (params) => {
            gridApi = params.api;
            loadPage(0);
        },
        
        // Appearance
        animateRows: true,
        
        // Disable AG Grid's built-in pagination since we're doing server-side
        pagination: false,
        
        // Status bar
        enableCellTextSelection: true,
        ensureDomOrder: true,
    };
}

// Initialize grid
function initGrid() {
    const gridContainer = document.getElementById('grid-container');
    gridContainer.classList.add('ag-theme-alpine');
    
    const gridOptions = createGridOptions();
    createGrid(gridContainer, gridOptions);
    
    updateTitle();
    updateActiveTabs();
    updateAddButtonVisibility();
}

// Set up tab click handlers
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTable(btn.dataset.table);
        });
    });
}

// Track current datacenter
let currentDataCenter = 'dc1';

// Update add button visibility based on current table
function updateAddButtonVisibility() {
    const addBtn = document.getElementById('add-btn');
    if (addBtn) {
        addBtn.classList.toggle('hidden', !canCreateEntry(currentTable));
    }
}

// Form field definitions for each table
const formFields = {
    users: [
        { name: 'uid', label: 'User ID', type: 'text', required: true, hint: 'Unique user identifier (e.g., u123)', placeholder: () => `u${Math.floor(Math.random() * 900000 + 100000)}` },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: () => ['Alice Chen', 'Bob Wang', 'Charlie Li', 'Diana Zhang', 'Edward Liu', 'Fiona Wu'][Math.floor(Math.random() * 6)] },
        { name: 'gender', label: 'Gender', type: 'select', options: ['male', 'female', 'other'], defaultOption: () => ['male', 'female'][Math.floor(Math.random() * 2)] },
        { name: 'email', label: 'Email', type: 'email', placeholder: () => `user${Math.floor(Math.random() * 9000 + 1000)}@example.com` },
        { name: 'phone', label: 'Phone', type: 'text', placeholder: () => `1${Math.floor(Math.random() * 9000000000 + 1000000000)}` },
        { name: 'dept', label: 'Department', type: 'text', placeholder: () => ['Engineering', 'Marketing', 'Sales', 'Research', 'Finance'][Math.floor(Math.random() * 5)] },
        { name: 'grade', label: 'Grade', type: 'text', placeholder: () => ['Junior', 'Senior', 'Lead', 'Manager', 'Director'][Math.floor(Math.random() * 5)] },
        { name: 'language', label: 'Language', type: 'select', options: ['en', 'zh'], required: true, defaultOption: () => ['en', 'zh'][Math.floor(Math.random() * 2)] },
        { name: 'region', label: 'Region', type: 'select', options: ['Beijing', 'HongKong'], required: true, hint: 'Determines which shard stores the data', defaultOption: () => ['Beijing', 'HongKong'][Math.floor(Math.random() * 2)] },
        { name: 'role', label: 'Role', type: 'text', placeholder: () => ['reader', 'writer', 'admin', 'guest'][Math.floor(Math.random() * 4)] },
        { name: 'preferTags', label: 'Preferred Tags', type: 'text', hint: 'Comma-separated tags', placeholder: () => ['technology, science', 'sports, health', 'finance, business', 'entertainment, music'][Math.floor(Math.random() * 4)] },
        { name: 'obtainedCredits', label: 'Credits', type: 'number', placeholder: () => Math.floor(Math.random() * 1000) },
    ],
    articles: [
        { name: 'aid', label: 'Article ID', type: 'text', required: true, hint: 'Unique article identifier (e.g., a123)', placeholder: () => `a${Math.floor(Math.random() * 900000 + 100000)}` },
        { name: 'title', label: 'Title', type: 'text', required: true, placeholder: () => ['Breaking News Today', 'New Research Findings', 'Tech Industry Update', 'Market Analysis Report', 'Scientific Discovery'][Math.floor(Math.random() * 5)] },
        { name: 'category', label: 'Category', type: 'select', options: ['science', 'technology'], required: true, hint: 'Determines which shard stores the data', defaultOption: () => ['science', 'technology'][Math.floor(Math.random() * 2)] },
        { name: 'abstract', label: 'Abstract', type: 'textarea', placeholder: () => 'This article discusses the latest developments in the field and provides insights into future trends.' },
        { name: 'articleTags', label: 'Tags', type: 'text', hint: 'Comma-separated tags', placeholder: () => ['research, innovation', 'analysis, trends', 'breaking, news'][Math.floor(Math.random() * 3)] },
        { name: 'authors', label: 'Authors', type: 'text', hint: 'Comma-separated author names', placeholder: () => ['John Smith, Jane Doe', 'Dr. Chen Wei', 'Research Team A'][Math.floor(Math.random() * 3)] },
        { name: 'language', label: 'Language', type: 'select', options: ['en', 'zh'], defaultOption: () => ['en', 'zh'][Math.floor(Math.random() * 2)] },
    ],
    reads: [
        { name: 'uid', label: 'User ID', type: 'text', required: true, hint: 'ID of the user who read the article', placeholder: () => `u${Math.floor(Math.random() * 1000 + 1)}` },
        { name: 'aid', label: 'Article ID', type: 'text', required: true, hint: 'ID of the article that was read', placeholder: () => `a${Math.floor(Math.random() * 1000 + 1)}` },
        { name: 'region', label: 'Region', type: 'select', options: ['Beijing', 'HongKong'], required: true, hint: 'Determines which shard stores the data', defaultOption: () => ['Beijing', 'HongKong'][Math.floor(Math.random() * 2)] },
        { name: 'readTimeLength', label: 'Read Time (seconds)', type: 'number', placeholder: () => Math.floor(Math.random() * 300 + 30) },
        { name: 'agreeOrNot', label: 'Agreed', type: 'select', options: ['true', 'false'], defaultOption: () => ['true', 'false'][Math.floor(Math.random() * 2)] },
        { name: 'commentOrNot', label: 'Commented', type: 'select', options: ['true', 'false'], defaultOption: () => ['true', 'false'][Math.floor(Math.random() * 2)] },
        { name: 'commentDetail', label: 'Comment', type: 'textarea', placeholder: () => ['Great article!', 'Very informative read.', 'Interesting perspective.', 'Could use more details.'][Math.floor(Math.random() * 4)] },
        { name: 'shareOrNot', label: 'Shared', type: 'select', options: ['true', 'false'], defaultOption: () => ['true', 'false'][Math.floor(Math.random() * 2)] },
    ],
};

// Open the add entry modal
function addNewEntry() {
    if (!canCreateEntry(currentTable)) {
        showStatus('Cannot add entries to derived/read-only tables', 'error');
        return;
    }
    
    const config = getTableConfig();
    const modal = document.getElementById('add-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('add-form');
    
    title.textContent = `Add New ${config.title.replace(' Management', '').replace(' Records', '')}`;
    
    // Build form fields with pre-filled random values
    const fields = formFields[currentTable] || [];
    form.innerHTML = fields.map(field => {
        const required = field.required ? '<span class="required">*</span>' : '';
        const hint = field.hint ? `<div class="hint">${field.hint}</div>` : '';
        const defaultValue = field.placeholder ? field.placeholder() : '';
        
        let input;
        if (field.type === 'select') {
            // For select, pre-select a random option if there's a default
            const options = field.options.map(opt => {
                const selected = (field.defaultOption && opt === field.defaultOption()) ? 'selected' : '';
                return `<option value="${opt}" ${selected}>${opt}</option>`;
            }).join('');
            input = `<select name="${field.name}" id="field-${field.name}" ${field.required ? 'required' : ''}><option value="">Select...</option>${options}</select>`;
        } else if (field.type === 'textarea') {
            input = `<textarea name="${field.name}" id="field-${field.name}" rows="3" ${field.required ? 'required' : ''}>${defaultValue}</textarea>`;
        } else {
            input = `<input type="${field.type}" name="${field.name}" id="field-${field.name}" ${field.required ? 'required' : ''} value="${defaultValue}">`;
        }
        
        return `<div class="form-group"><label for="field-${field.name}">${field.label} ${required}</label>${input}${hint}</div>`;
    }).join('');
    
    modal.classList.add('visible');
}

// Close the add entry modal
function closeAddModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.remove('visible');
}

// Submit the new entry
async function submitNewEntry() {
    const form = document.getElementById('add-form');
    const formData = new FormData(form);
    
    // Build the data object
    const data = {};
    const fields = formFields[currentTable] || [];
    
    for (const field of fields) {
        let value = formData.get(field.name);
        
        if (value === '' || value === null) {
            if (field.required) {
                showStatus(`${field.label} is required`, 'error');
                return;
            }
            continue;
        }
        
        // Type conversions
        if (field.type === 'number') {
            value = parseInt(value, 10) || 0;
        } else if (field.name === 'agreeOrNot' || field.name === 'commentOrNot' || field.name === 'shareOrNot') {
            value = value === 'true';
        } else if (field.name === 'preferTags' || field.name === 'articleTags' || field.name === 'authors') {
            value = value.split(',').map(s => s.trim()).filter(s => s);
        }
        
        data[field.name] = value;
    }
    
    // Add timestamp
    data.timestamp = Date.now();
    
    // Generate random id for sharding (required by Vitess for sharded tables)
    // Using a large random number to avoid collisions
    if (currentTable === 'users' || currentTable === 'articles' || currentTable === 'reads') {
        data.id = Math.floor(Math.random() * 900000000) + 100000000;  // 9-digit random id
    }
    
    try {
        showStatus('Creating entry...', 'loading');
        await createData(currentTable, data);
        closeAddModal();
        showStatus('Entry created successfully', 'success');
        // Reload the data to show the new entry
        await loadData();
    } catch (error) {
        console.error('Failed to create entry:', error);
        showStatus(`Failed to create: ${error.message}`, 'error');
    }
}

// Switch datacenter toggle
function switchDataCenter(dc) {
    currentDataCenter = dc;
    
    // Update datacenter toggle buttons
    document.getElementById('dc1-toggle-btn').classList.toggle('active', dc === 'dc1');
    document.getElementById('dc2-toggle-btn').classList.toggle('active', dc === 'dc2');
    
    // Show/hide server options
    document.getElementById('dc1-servers').style.display = dc === 'dc1' ? 'flex' : 'none';
    document.getElementById('dc2-servers').style.display = dc === 'dc2' ? 'flex' : 'none';
    
    // Switch to the first server in the selected datacenter
    if (dc === 'dc1') {
        switchServer('cell1');
    } else {
        switchServer('dc2-cell1');
    }
}

// Switch server region
function switchServer(server) {
    if (setServer(server)) {
        // Update UI buttons - DC1
        document.getElementById('server-cell1-btn').classList.toggle('active', server === 'cell1');
        document.getElementById('server-cell2-btn').classList.toggle('active', server === 'cell2');
        document.getElementById('server-cell3-btn').classList.toggle('active', server === 'cell3');
        // Update UI buttons - DC2
        document.getElementById('server-dc2-cell1-btn')?.classList.toggle('active', server === 'dc2-cell1');
        document.getElementById('server-dc2-cell2-btn')?.classList.toggle('active', server === 'dc2-cell2');
        
        // Update indicator
        const indicator = document.getElementById('server-indicator');
        const labels = {
            cell1: 'DC1-Cell1',
            cell2: 'DC1-Cell2',
            cell3: 'DC1-Backup',
            'dc2-cell1': 'DC2-Cell1',
            'dc2-cell2': 'DC2-Cell2'
        };
        indicator.textContent = labels[server] || server;
        indicator.className = `server-indicator ${server}`;
        
        // Reload data from new server
        currentPage = 0;
        loadData();
        
        const serverNames = {
            cell1: 'DC1 Beijing (Cell1)',
            cell2: 'DC1 HongKong (Cell2)',
            cell3: 'DC1 Backup (Cell3)',
            'dc2-cell1': 'DC2 Cell1',
            'dc2-cell2': 'DC2 Cell2'
        };
        showStatus(`Switched to ${serverNames[server]} server`, 'success');
    }
}

// Make functions available globally for HTML onclick handlers
window.loadData = loadData;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.exportData = exportData;
window.switchTable = switchTable;
window.switchServer = switchServer;
window.switchDataCenter = switchDataCenter;
window.addNewEntry = addNewEntry;
window.closeAddModal = closeAddModal;
window.submitNewEntry = submitNewEntry;

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTabs();
        initGrid();
    });
} else {
    initTabs();
    initGrid();
}
