const SPREADSHEET_ID = '1PMotLr2tSxxEByayId-3HHDHwGMrBwqjSuvwsRLouGU';
const GID = '0';

let customersData = [];
let filteredData = [];
let sortConfig = { column: 'name', direction: 'asc' };
let fetchTimeout;
let currentStatementCustomer = null;

const today = new Date('2026-05-06');

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupSearch();
    setupSorting();
    setupModal();
    setupNavigation();
});

function setupNavigation() {
    // Add logic if needed for initial state
}

function switchView(viewId) {
    // Hide all views
    const views = ['gold-customer', 'statements', 'reports', 'settings'];
    views.forEach(v => {
        const viewEl = document.getElementById(`view-${v}`);
        const navEl = document.getElementById(`nav-${v}`);
        if (viewEl) viewEl.style.display = 'none';
        if (navEl) navEl.classList.remove('active');
    });

    // Show selected view
    const selectedView = document.getElementById(`view-${viewId}`);
    const selectedNav = document.getElementById(`nav-${viewId}`);
    if (selectedView) selectedView.style.display = 'block';
    if (selectedNav) selectedNav.classList.add('active');

    // Update search bar context
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        if (viewId === 'gold-customer') {
            searchInput.placeholder = "Search Gold Customer...";
            searchInput.disabled = false;
        } else if (viewId === 'statements') {
            searchInput.placeholder = "Search batch list...";
            searchInput.disabled = false;
            renderBatchTable();
        } else {
            searchInput.placeholder = "Search disabled in this view";
            searchInput.disabled = true;
        }
    }

    lucide.createIcons();
}

function renderBatchTable() {
    const tbody = document.getElementById('batchTableBody');
    if (!tbody) return;
    
    const searchInput = document.getElementById('searchInput');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    const statusFilter = document.getElementById('batchStatusFilter') ? document.getElementById('batchStatusFilter').value : 'all';
    
    let displayData = customersData.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(term) || c.mobile.includes(term);
        const isOverdue = c.totalOverdue < 0;
        
        let matchesStatus = true;
        if (statusFilter === 'overdue') matchesStatus = isOverdue;
        if (statusFilter === 'open') matchesStatus = !isOverdue;
        
        return matchesSearch && matchesStatus;
    });

    // Apply Sorting
    const { column, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    displayData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (typeof valA === 'string') return valA.localeCompare(valB) * factor;
        return (valA - valB) * factor;
    });

    tbody.innerHTML = '';
    displayData.forEach(c => {
        const row = document.createElement('tr');
        const balanceClass = c.totalPendingBalance < 0 ? 'text-danger' : 'text-success';
        const isOverdue = c.totalOverdue < 0;
        const status = isOverdue ? '<span class="status-badge status-overdue">OVERDUE</span>' : '<span class="status-badge status-open">OPEN</span>';
        
        row.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="batch-checkbox" data-key="${c.key}"></td>
            <td style="font-weight: 500;">${c.name}</td>
            <td>${c.mobile}</td>
            <td class="text-right ${balanceClass}" style="font-weight: 600;">Rs.${c.totalPendingBalance.toFixed(2)}</td>
            <td style="text-align: center;">${status}</td>
        `;
        tbody.appendChild(row);
    });
}

function handleBatchSort(column, element) {
    // Toggle direction
    sortConfig.direction = (sortConfig.column === column && sortConfig.direction === 'asc') ? 'desc' : 'asc';
    sortConfig.column = column;
    
    // Refresh table based on current view
    const activeNav = document.querySelector('.nav-item.active');
    const currentView = activeNav ? activeNav.id.replace('nav-', '') : 'gold-customer';
    
    if (currentView === 'gold-customer') {
        sortData();
        renderTable();
    } else {
        renderBatchTable();
    }
    
    // Update Icons
    updateSortIcons();
}

function updateSortIcons() {
    const { column, direction } = sortConfig;
    const icons = document.querySelectorAll('.sortable i');
    icons.forEach(i => {
        i.setAttribute('data-lucide', 'arrow-up-down');
        i.style.color = 'inherit';
        i.style.opacity = '0.5';
    });

    // Handle both main table and batch table icons
    const targets = [
        `sort-icon-${column}`,
        `sort-icon-${column}-main`
    ];
    
    targets.forEach(id => {
        const iconEl = document.getElementById(id);
        if (iconEl) {
            iconEl.setAttribute('data-lucide', direction === 'asc' ? 'chevron-up' : 'chevron-down');
            iconEl.style.color = 'var(--primary-color)';
            iconEl.style.opacity = '1';
        }
    });

    lucide.createIcons();
}

function setupSorting() {
    // Legacy setup - now handled by inline onclicks
}

function toggleAllBatch(source) {
    const checkboxes = document.querySelectorAll('.batch-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

async function downloadSelectedStatements() {
    const selectedKeys = Array.from(document.querySelectorAll('.batch-checkbox:checked'))
        .map(cb => cb.getAttribute('data-key'));
    
    if (selectedKeys.length === 0) {
        showToast("Please select at least one customer", "error");
        return;
    }

    showToast(`Generating ${selectedKeys.length} statements...`);
    
    for (const key of selectedKeys) {
        const customer = customersData.find(c => c.key === key);
        if (customer) {
            await generateStatementPDF(customer);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
    
    showToast("Batch Download Complete!");
}

async function generateStatementPDF(c) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header Title
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0);
        doc.text("UIC GOLD STATEMENT", 105, 20, { align: "center" });
        
        doc.setLineWidth(0.5);
        doc.line(70, 22, 140, 22);

        // Logo Section
        doc.setFontSize(36);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0);
        doc.text("fa", 20, 50);
        doc.setTextColor(122, 181, 67);
        doc.text("r", 32, 50);
        doc.setTextColor(0);
        doc.text("mkart", 38, 50);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text("the next ", 48, 54);
        doc.setFont(undefined, 'bold');
        doc.text("impact", 61, 54);

        // Company Info
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Farmkart Online Services Pvt. Ltd.", 190, 40, { align: "right" });
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text("Anjad Road, Barwani -451551", 190, 45, { align: "right" });
        doc.text("Madhya Pradesh, India", 190, 50, { align: "right" });
        doc.text("9407218000", 190, 55, { align: "right" });
        doc.text("contact@farmkart.com", 190, 60, { align: "right" });
        doc.text("www.farmkart.com, www.farmkartgroup.com", 190, 65, { align: "right" });
        
        doc.setDrawColor(200);
        doc.setLineWidth(0.1);
        doc.line(20, 70, 190, 70);

        // Customer Details
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("CUSTOMER DETAILS", 20, 80);
        doc.setFont(undefined, 'normal');
        doc.text(`Name: ${c.name}`, 20, 87);
        doc.text(`Mobile: ${c.mobile}`, 20, 93);
        doc.text(`Net Account Balance: Rs.${c.totalPendingBalance.toFixed(2)}`, 20, 99);
        
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 190, 80, { align: "right" });

        const displayList = getOutstandingTransactions(c);
        const tableData = displayList.map(t => {
            const diffDays = t.date ? Math.floor((today - t.date) / (1000 * 60 * 60 * 24)) : 0;
            const dueDate = t.date ? new Date(t.date) : null;
            if (dueDate) dueDate.setDate(dueDate.getDate() + 30);
            return [
                t.date ? t.date.toLocaleDateString() : 'N/A',
                dueDate ? dueDate.toLocaleDateString() : 'N/A',
                t.type.toUpperCase() + (t.outstandingAmount < t.amount ? ' (PARTIAL)' : ''),
                'DEBIT',
                diffDays > 30 ? 'OVERDUE' : 'OPEN',
                'Rs.' + t.amount.toFixed(2),
                'Rs.' + t.outstandingAmount.toFixed(2)
            ];
        });

        doc.autoTable({
            startY: 110,
            head: [['Date', 'Due Date', 'Description', 'Type', 'Status', 'Original', 'Outstanding']],
            body: tableData,
            headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                4: { fontStyle: 'bold' },
                5: { halign: 'left' },
                6: { halign: 'left', fontStyle: 'bold', textColor: [239, 68, 68] }
            },
            styles: { fontSize: 8 },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 4) {
                    if (data.cell.raw === 'OVERDUE') data.cell.styles.textColor = [153, 27, 27];
                }
            }
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("UIC Gold - Secure Premium Customer Portal", 105, 285, { align: "center" });
            doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: "right" });
        }

        doc.save(`Statement_${c.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
        console.error(err);
        throw err;
    }
}

function init() {
    fetchData();
}

function fetchData() {
    showLoader();
    const oldScript = document.getElementById('gviz-script');
    if (oldScript) oldScript.remove();

    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
        if (customersData.length === 0) {
            showError("Request timed out. Check connection.");
            hideLoader();
        }
    }, 15000);

    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:handleResponse&gid=${GID}&t=${Date.now()}`;
    const script = document.createElement('script');
    script.src = url;
    script.id = 'gviz-script';
    script.onerror = () => {
        clearTimeout(fetchTimeout);
        showError("Failed to load data.");
        hideLoader();
    };
    document.body.appendChild(script);
}

window.handleResponse = function (response) {
    clearTimeout(fetchTimeout);
    if (!response || response.status === 'error') {
        showError("Google Sheet access error.");
        hideLoader();
        return;
    }

    try {
        const table = response.table;
        customersData = aggregateCustomerDataGviz(table);
        filteredData = [...customersData];
        sortData();
        updateStats();
        renderTable();
        hideLoader();
        showToast("Data synced!");
    } catch (err) {
        console.error(err);
        showError("Data processing error.");
        hideLoader();
    }
};

function parseGvizDate(dateVal) {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    const dateStr = String(dateVal);
    const match = dateStr.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4] || 0), parseInt(match[5] || 0), parseInt(match[6] || 0));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

function aggregateCustomerDataGviz(table) {
    const customers = {};
    const COL = { TYPE: 0, DATE: 1, NAME: 2, MOBILE: 3, AMOUNT: 11, BALANCE: 12 };
    const additiveTypes = ['offer', 'recharged via cms', 'refund', 'paid', 'u2ureward', 'recharged online', 'cashback', 'recharged via direct', 'referral bounus', 'recharged via online'];

    table.rows.forEach(row => {
        const cells = row.c;
        if (!cells || !cells[COL.NAME] || !cells[COL.NAME].v) return;

        const type = cells[COL.TYPE] && cells[COL.TYPE].v ? String(cells[COL.TYPE].v).toLowerCase().trim() : '';
        const name = String(cells[COL.NAME].v).trim();
        let mobile = cells[COL.MOBILE] ? (cells[COL.MOBILE].f || String(cells[COL.MOBILE].v)) : 'N/A';
        // Clean mobile number to ensure consistent grouping
        mobile = mobile.replace(/[\s\-\(\)]/g, '');
        const date = cells[COL.DATE] ? parseGvizDate(cells[COL.DATE].v) : null;
        const amount = cells[COL.AMOUNT] ? parseFloat(cells[COL.AMOUNT].v) || 0 : 0;

        const key = `${name}_${mobile}`;
        if (!customers[key]) {
            customers[key] = {
                key: key,
                name: name,
                mobile: mobile,
                totalPendingBalance: 0,
                totalOverdue: 0,
                lastTransactionDate: new Date(0),
                transactions: []
            };
        }

        const isAdditive = additiveTypes.includes(type);
        customers[key].transactions.push({ type, date, amount, isAdditive });
    });

    Object.values(customers).forEach(c => {
        // Sort chronologically. Null dates go to the beginning.
        c.transactions.sort((a, b) => (a.date || 0) - (b.date || 0));

        let runningBalance = 0;
        c.transactions.forEach(t => {
            if (t.isAdditive) runningBalance += t.amount;
            else runningBalance -= t.amount;

            t.calculatedBalance = runningBalance;

            if (t.date) {
                if (t.date >= c.lastTransactionDate) {
                    c.lastTransactionDate = t.date;
                }
                if (!t.isAdditive && t.type === 'order') {
                    const diffDays = Math.floor((today - t.date) / (1000 * 60 * 60 * 24));
                    if (diffDays > 30) c.totalOverdue += t.amount;
                }
            }
        });

        // Final balance is the running balance after ALL transactions
        c.totalPendingBalance = runningBalance;

        if (c.totalPendingBalance >= 0) {
            c.totalOverdue = 0;
        } else {
            c.totalOverdue = Math.min(Math.abs(c.totalPendingBalance), c.totalOverdue);
        }
    });

    return Object.values(customers);
}

function updateStats() {
    const totalOverdue = customersData.reduce((sum, c) => sum + c.totalOverdue, 0);
    const customersEl = document.getElementById('totalCustomers');
    const overdueEl = document.getElementById('totalOverdueAmount');
    if (customersEl) customersEl.textContent = customersData.length;
    if (overdueEl) overdueEl.textContent = `Rs.${totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No matching customers found.</td></tr>';
        return;
    }

    filteredData.forEach(customer => {
        const tr = document.createElement('tr');
        const isPositive = customer.totalPendingBalance >= 0;
        const statusIcon = isPositive ? 'trending-up' : 'trending-down';
        const statusClass = isPositive ? 'up' : 'down';

        tr.innerHTML = `
            <td><div class="customer-info"><span class="customer-name">${customer.name}</span></div></td>
            <td>${customer.mobile}</td>
            <td><div class="status-indicator ${statusClass}"><i data-lucide="${statusIcon}"></i></div></td>
            <td class="amount overdue">Rs.${customer.totalOverdue.toFixed(2)}</td>
            <td class="amount balance">Rs.${customer.totalPendingBalance.toFixed(2)}</td>
            <td class="actions-col">
                <button class="icon-btn" onclick="openStatement('${customer.key}')" title="View Unpaid Orders">
                    <i data-lucide="file-text"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

/**
 * Improved FIFO Logic:
 * Matches credits against ALL debits (Orders, Deducts, etc.) in chronological order.
 * This ensures that a payment correctly pays off the oldest debt, even if it's not an 'order'.
 */
function getOutstandingTransactions(customer) {
    let totalCredits = customer.transactions
        .filter(t => t.isAdditive)
        .reduce((sum, t) => sum + t.amount, 0);

    // All transactions that subtract from balance (Orders, Deducts, Reverts, etc.)
    const allDebits = customer.transactions.filter(t => !t.isAdditive);
    const outstanding = [];

    allDebits.forEach(debit => {
        if (totalCredits >= debit.amount) {
            totalCredits -= debit.amount;
        } else if (totalCredits > 0) {
            const remainingAmount = debit.amount - totalCredits;
            totalCredits = 0;
            outstanding.push({ ...debit, outstandingAmount: remainingAmount });
        } else {
            outstanding.push({ ...debit, outstandingAmount: debit.amount });
        }
    });

    // Final filter: User specifically wants to see "Outstanding Orders" in the statement
    // But we include all debits that haven't been cleared to ensure balance matching.
    return outstanding;
}

function openStatement(key) {
    const customer = customersData.find(c => c.key === key);
    if (!customer) return;

    currentStatementCustomer = customer;
    document.getElementById('stmtCustomerName').textContent = customer.name;
    document.getElementById('stmtCustomerMobile').textContent = customer.mobile;
    document.getElementById('stmtCurrentBalance').textContent = `Rs.${customer.totalPendingBalance.toFixed(2)}`;
    document.getElementById('stmtGeneratedAt').textContent = new Date().toLocaleString();

    const stmtTbody = document.getElementById('statementTableBody');
    stmtTbody.innerHTML = '';

    const outstanding = getOutstandingTransactions(customer);

    if (outstanding.length === 0) {
        if (customer.totalPendingBalance >= 0) {
            stmtTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--success); font-weight: 600;">No outstanding items. Account is clear!</td></tr>';
        } else {
            stmtTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Debt found in balance but no matching transactions identified.</td></tr>';
        }
    } else {
        outstanding.forEach(t => renderStatementRow(stmtTbody, t));
    }

    document.getElementById('statementModal').classList.add('active');
    lucide.createIcons();
}

function renderStatementRow(tbody, t) {
    const row = document.createElement('tr');
    const isPartial = t.outstandingAmount < t.amount;
    const diffDays = t.date ? Math.floor((today - t.date) / (1000 * 60 * 60 * 24)) : 0;
    const isOverdue = diffDays > 30;
    const statusText = isOverdue ? 'OVERDUE' : 'OPEN';
    const statusClass = isOverdue ? 'status-overdue' : 'status-open';

    const dueDate = t.date ? new Date(t.date) : null;
    if (dueDate) dueDate.setDate(dueDate.getDate() + 30);

    row.innerHTML = `
        <td style="text-align: left !important; padding: 12px 16px !important;">${t.date ? t.date.toLocaleDateString() : 'N/A'}</td>
        <td style="text-align: left !important; padding: 12px 16px !important;">${dueDate ? dueDate.toLocaleDateString() : 'N/A'}</td>
        <td style="text-align: left !important; padding: 12px 16px !important; text-transform: capitalize;">${t.type} ${isPartial ? '<span class="badge badge-success" style="font-size: 0.6rem; padding: 2px 6px;">PARTIAL</span>' : ''}</td>
        <td style="text-align: left !important; padding: 12px 16px !important;" class="stmt-type-order">DEBIT</td>
        <td style="text-align: left !important; padding: 12px 16px !important;"><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td style="text-align: right !important; padding: 12px 16px !important;">Rs.${t.amount.toFixed(2)}</td>
        <td style="text-align: right !important; padding: 12px 16px !important;" class="stmt-type-order">Rs.${t.outstandingAmount.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
}

function setupModal() {
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            document.getElementById('statementModal').classList.remove('active');
        };
    }

    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            if (!currentStatementCustomer) return;
            generatePdfWithJsPDF();
        };
    }

    window.onclick = (event) => {
        const modal = document.getElementById('statementModal');
        if (event.target == modal) {
            modal.classList.remove('active');
        }
    };
}

async function generatePdfWithJsPDF() {
    if (currentStatementCustomer) {
        await generateStatementPDF(currentStatementCustomer);
        showToast("PDF Downloaded!");
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const activeNav = document.querySelector('.nav-item.active');
            const currentView = activeNav ? activeNav.id.replace('nav-', '') : 'gold-customer';
            
            if (currentView === 'gold-customer') {
                const term = e.target.value.toLowerCase();
                filteredData = customersData.filter(c => c.name.toLowerCase().includes(term) || c.mobile.includes(term));
                renderTable();
            } else if (currentView === 'statements') {
                renderBatchTable();
            }
        });
    }
}

function setupSorting() {
    const headers = document.querySelectorAll('th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            sortConfig.direction = (sortConfig.column === column && sortConfig.direction === 'asc') ? 'desc' : 'asc';
            sortConfig.column = column;
            headers.forEach(h => h.classList.remove('asc', 'desc'));
            header.classList.add(sortConfig.direction);
            sortData();
            renderTable();
        });
    });
}

function sortData() {
    const { column, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    filteredData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (typeof valA === 'string') return valA.localeCompare(valB) * factor;
        return (valA - valB) * factor;
    });
}

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'table-row';
    const err = document.getElementById('errorMessage');
    if (err) err.style.display = 'none';
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function showError(msg) {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }
    showToast(msg, 'error');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
