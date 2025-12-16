import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { fetchUsers, updateUser, API_BASE } from './api.js';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// User schema - hardcoded as it won't change
const columnDefs = [
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
        editable: false,  // Shard key - cannot be changed
        filter: 'agTextColumnFilter',
        sortable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
            values: ['Beijing', 'HongKong']
        }
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

// Grid instance
let gridApi = null;

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
    document.getElementById('row-count').textContent = `Showing ${count.toLocaleString()} users`;
}

// Load users from API
async function loadUsers() {
    showStatus('Loading users...', 'loading');
    
    try {
        const users = await fetchUsers();
        gridApi.setGridOption('rowData', users);
        updateRowCount();
        showStatus(`Loaded ${users.length.toLocaleString()} users`, 'success');
    } catch (error) {
        console.error('Failed to load users:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Handle cell value changes
async function onCellValueChanged(event) {
    const { data, colDef, oldValue, newValue } = event;
    
    if (oldValue === newValue) return;
    
    console.log(`Cell changed: ${colDef.field} from "${oldValue}" to "${newValue}" for user ${data.id}`);
    
    try {
        showStatus('Saving...', 'loading');
        await updateUser(data);
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
    
    gridApi.exportDataAsCsv({
        fileName: 'users.csv',
        columnSeparator: ',',
    });
    showStatus('Exported to CSV', 'success');
}

// Grid options
const gridOptions = {
    columnDefs,
    defaultColDef: {
        resizable: true,
        sortable: true,
        filter: true,
    },
    rowData: [],
    
    // Enable editing
    editType: 'fullRow',  // or use undefined for cell-by-cell editing
    stopEditingWhenCellsLoseFocus: true,
    
    // Selection
    rowSelection: 'multiple',
    
    // Events
    onCellValueChanged,
    onFilterChanged: updateRowCount,
    onSortChanged: updateRowCount,
    onGridReady: (params) => {
        gridApi = params.api;
        loadUsers();
    },
    
    // Appearance
    animateRows: true,
    pagination: true,
    paginationPageSize: 100,
    paginationPageSizeSelector: [50, 100, 500, 1000],
    
    // Status bar (shows selected count, etc.)
    enableCellTextSelection: true,
    ensureDomOrder: true,
};

// Initialize grid
function initGrid() {
    const gridContainer = document.getElementById('grid-container');
    gridContainer.classList.add('ag-theme-alpine');
    
    createGrid(gridContainer, gridOptions);
    // gridApi is set in onGridReady callback
}

// Make functions available globally for HTML onclick handlers
window.loadUsers = loadUsers;
window.exportData = exportData;

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGrid);
} else {
    initGrid();
}
