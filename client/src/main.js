import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { fetchData, updateData, tableConfigs, setServer, getCurrentServer } from './api.js';
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
let isLoading = false;
let currentFilter = null;
let currentSortBy = null;
let currentSortDir = null;

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
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const displayPage = currentPage + 1;
    const startRow = currentPage * PAGE_SIZE + 1;
    const endRow = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);
    
    if (totalCount > 0) {
        document.getElementById('row-count').textContent = 
            `Showing ${startRow.toLocaleString()}-${endRow.toLocaleString()} of ${totalCount.toLocaleString()} ${config.name} (Page ${displayPage} of ${totalPages})`;
    } else {
        document.getElementById('row-count').textContent = `No ${config.name} found`;
    }
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 0 || isLoading;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages - 1 || isLoading;
    }
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages || 1}`;
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
        
        // Update total count from server
        totalCount = result.totalCount;
        
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
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (currentPage < totalPages - 1) {
        await loadPage(currentPage + 1);
    }
}

// Handle filter changes - reload data from server with new filters
const onFilterChanged = debounce(() => {
    console.log('Filter changed, reloading from server...');
    loadPage(0);  // Reset to first page when filter changes
}, 300);  // 300ms debounce to avoid too many requests while typing

// Handle sort changes - reload data from server with new sort
const onSortChanged = () => {
    console.log('Sort changed, reloading from server...');
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
    
    // Update grid columns
    gridApi.setGridOption('columnDefs', config.columnDefs);
    
    // Reset pagination and sort state
    currentPage = 0;
    totalCount = 0;
    currentSortBy = null;
    currentSortDir = null;
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
}

// Set up tab click handlers
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTable(btn.dataset.table);
        });
    });
}

// Switch server region
function switchServer(server) {
    if (setServer(server)) {
        // Update UI buttons
        document.getElementById('server-cell1-btn').classList.toggle('active', server === 'cell1');
        document.getElementById('server-cell2-btn').classList.toggle('active', server === 'cell2');
        
        // Update indicator
        const indicator = document.getElementById('server-indicator');
        indicator.textContent = server === 'cell1' ? 'Cell1' : 'Cell2';
        indicator.className = `server-indicator ${server}`;
        
        // Reload data from new server
        currentPage = 0;
        loadData();
        
        showStatus(`Switched to ${server === 'cell1' ? 'Beijing (Cell1)' : 'HongKong (Cell2)'} server`, 'success');
    }
}

// Make functions available globally for HTML onclick handlers
window.loadData = loadData;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.exportData = exportData;
window.switchTable = switchTable;
window.switchServer = switchServer;

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
