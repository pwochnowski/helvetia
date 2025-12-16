import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { fetchData, updateData, tableConfigs } from './api.js';
import { filterModelToRsql, parseRsqlForDisplay } from './rsql.js';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Current table state
let currentTable = 'users';
let gridApi = null;

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

// Update row count display
function updateRowCount() {
    const count = gridApi?.getDisplayedRowCount() || 0;
    const config = getTableConfig();
    document.getElementById('row-count').textContent = `Showing ${count.toLocaleString()} ${config.name}`;
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

// Load data from API with current filters
async function loadData() {
    const config = getTableConfig();
    showStatus(`Loading ${config.name}...`, 'loading');
    
    try {
        // Get current filter model and convert to RSQL
        const filterModel = gridApi?.getFilterModel() || {};
        const rsqlFilter = filterModelToRsql(filterModel);
        
        // Debug: show the RSQL in console
        if (rsqlFilter) {
            console.log('RSQL Filter:', rsqlFilter);
            console.log('Human readable:', parseRsqlForDisplay(rsqlFilter));
        }
        
        const data = await fetchData(currentTable, rsqlFilter);
        gridApi.setGridOption('rowData', data);
        updateRowCount();
        
        const filterMsg = rsqlFilter ? ` (filtered)` : '';
        showStatus(`Loaded ${data.length.toLocaleString()} ${config.name}${filterMsg}`, 'success');
    } catch (error) {
        console.error(`Failed to load ${config.name}:`, error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Handle filter changes - reload data from server with new filters
const onFilterChanged = debounce(() => {
    console.log('Filter changed, reloading from server...');
    loadData();
}, 300);  // 300ms debounce to avoid too many requests while typing

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
    
    // Clear and reload data
    gridApi.setGridOption('rowData', []);
    loadData();
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
        onSortChanged: updateRowCount,
        onGridReady: (params) => {
            gridApi = params.api;
            loadData();
        },
        
        // Appearance
        animateRows: true,
        pagination: true,
        paginationPageSize: 100,
        paginationPageSizeSelector: [50, 100, 500, 1000],
        
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

// Make functions available globally for HTML onclick handlers
window.loadData = loadData;
window.exportData = exportData;
window.switchTable = switchTable;

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
