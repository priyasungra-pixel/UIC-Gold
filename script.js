const SPREADSHEET_ID = '1PMotLr2tSxxEByayId-3HHDHwGMrBwqjSuvwsRLouGU';
const GID = '0';

let customersData = [];
let filteredData = [];
let currentCategoryFilter = 'all';
let sortConfig = { column: 'name', direction: 'asc' };
let pendingSortConfig = { column: 'date', direction: 'asc' };
let fetchTimeout;
let currentStatementCustomer = null;

const today = new Date();

function formatDate(date) {
    if (!date) return 'N/A';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
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
    const views = ['gold-customer', 'pending-invoices', 'vendor-due', 'statements', 'reports', 'settings'];
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
        } else if (viewId === 'vendor-due') {
            searchInput.placeholder = "Search Vendor Name, Mobile...";
            searchInput.disabled = false;
            renderVendorDueTable();
        } else if (viewId === 'statements') {
            searchInput.placeholder = "Search batch list...";
            searchInput.disabled = false;
            renderBatchTable();
        } else {
            searchInput.placeholder = "Search disabled in this view";
            searchInput.disabled = true;
        }
    }

    if (viewId === 'pending-invoices') {
        renderPendingInvoicesTable();
    } else if (viewId === 'vendor-due') {
        renderVendorDueView();
    } else if (viewId === 'reports') {
        initReportsView();
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
            <td class="text-right" style="font-weight: 600;">${c.totalOverdue.toFixed(2)}</td>
            <td class="text-right ${balanceClass}" style="font-weight: 600;">${c.totalPendingBalance.toFixed(2)}</td>
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

function handlePendingSort(column) {
    pendingSortConfig.direction = (pendingSortConfig.column === column && pendingSortConfig.direction === 'asc') ? 'desc' : 'asc';
    pendingSortConfig.column = column;
    
    renderPendingInvoicesTable();
    updatePendingSortIcons();
}

function updatePendingSortIcons() {
    const { column, direction } = pendingSortConfig;
    const icons = document.querySelectorAll('#view-pending-invoices .sortable i');
    icons.forEach(i => {
        i.setAttribute('data-lucide', 'arrow-up-down');
        i.style.color = 'inherit';
        i.style.opacity = '0.5';
    });

    const iconEl = document.getElementById(`sort-icon-${column}-pending`);
    if (iconEl) {
        iconEl.setAttribute('data-lucide', direction === 'asc' ? 'chevron-up' : 'chevron-down');
        iconEl.style.color = 'var(--primary-color)';
        iconEl.style.opacity = '1';
    }
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
        
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 190, 80, { align: "right" });
        
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.text(`Total Overdue: `, 160, 87, { align: "right" });
        doc.setFont(undefined, 'bold');
        doc.setTextColor(153, 27, 27); // red color for overdue
        doc.text(`${c.totalOverdue.toFixed(2)}`, 190, 87, { align: "right" });
        
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0);
        doc.text(`Total Pending Balance: `, 160, 93, { align: "right" });
        doc.setFont(undefined, 'bold');
        doc.text(`${c.totalPendingBalance.toFixed(2)}`, 190, 93, { align: "right" });

        // Overdue Category Breakdown in PDF
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100);
        doc.text(`Categories: 1-30d: ${(c.overdue1_30 || 0).toFixed(2)} | 31-60d: ${(c.overdue31_60 || 0).toFixed(2)} | 61-90d: ${(c.overdue61_90 || 0).toFixed(2)} | 90+d: ${(c.overdue90Plus || 0).toFixed(2)}`, 190, 99, { align: "right" });

        const displayList = getOutstandingTransactions(c);
        const tableData = displayList.map(t => {
            let diffDays = 0;
            if (t.date) {
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const dateStart = new Date(t.date.getFullYear(), t.date.getMonth(), t.date.getDate());
                diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
            }
            const creditDays = getCreditDays(c.category);
            const dueDate = t.date ? new Date(t.date) : null;
            if (dueDate) dueDate.setDate(dueDate.getDate() + creditDays);

            let statusText = 'OPEN';
            if (diffDays > creditDays) {
                const overdueDays = diffDays - creditDays;
                if (overdueDays <= 30) statusText = 'OVERDUE (1–30d)';
                else if (overdueDays <= 60) statusText = 'OVERDUE (31–60d)';
                else if (overdueDays <= 90) statusText = 'OVERDUE (61–90d)';
                else statusText = 'OVERDUE (90+d)';
            }

            return [
                formatDate(t.date),
                formatDate(dueDate),
                t.type.toUpperCase() + (t.outstandingAmount < t.amount ? ' (PARTIAL)' : ''),
                t.orderId || '-',
                'DEBIT',
                statusText,
                t.amount.toFixed(2),
                t.outstandingAmount.toFixed(2)
            ];
        });

        doc.autoTable({
            startY: 110,
            head: [['Date', 'Due Date', 'Description', 'Order Id', 'Type', 'Status', 'Original', 'Outstanding']],
            body: tableData,
            headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                5: { fontStyle: 'bold' },
                6: { halign: 'left' },
                7: { halign: 'left', fontStyle: 'bold', textColor: [239, 68, 68] }
            },
            styles: { fontSize: 8 },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 5) {
                    if (typeof data.cell.raw === 'string' && data.cell.raw.startsWith('OVERDUE')) {
                        data.cell.styles.textColor = [153, 27, 27];
                    }
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
function exportReport(format) {
    try {
        if (filteredData.length === 0) {
            showToast("No data to download", "error");
            return;
        }

        const headers = ['Customer Name', 'Mobile', 'Category', 'Status', 'Total Overdue', 'Total Pending Balance'];
        const data = filteredData.map(c => [
            c.name,
            c.mobile,
            c.category || 'UIC Gold',
            c.totalPendingBalance >= 0 ? 'UP' : 'DOWN',
            c.totalOverdue.toFixed(2),
            c.totalPendingBalance.toFixed(2)
        ]);

        const fileName = `UIC_Gold_Overdue_Report_${new Date().toISOString().split('T')[0]}`;

        if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text("UIC GOLD & B2B CUSTOMER OVERDUE REPORT", 148, 18, { align: "center" });
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 148, 25, { align: "center" });

            doc.autoTable({
                startY: 32,
                head: [headers],
                body: data,
                headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    4: { halign: 'right', fontStyle: 'bold' },
                    5: { halign: 'right' }
                },
                styles: { fontSize: 8 }
            });
            doc.save(`${fileName}.pdf`);
        } else if (format === 'csv' || format === 'excel') {
            // Use CSV with BOM for both CSV and Excel to ensure correct column parsing and no warnings
            const csvContent = "\uFEFF" + [
                headers.join(','),
                ...data.map(row => row.map(val => `"${val}"`).join(','))
            ].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            downloadFile(blob, `${fileName}.csv`);
        }

        showToast(`Report exported as ${format.toUpperCase()}!`);
    } catch (err) {
        console.error(err);
        showToast("Error exporting report", "error");
    }
}

function downloadFile(blob, fileName) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        updateStats();
        applyFilters();
        renderPendingInvoicesTable();
        populateAnalyticsCustomerDropdown();
        const repView = document.getElementById('view-reports');
        if (repView && repView.style.display !== 'none') {
            renderReportsView();
        }
        const vendorView = document.getElementById('view-vendor-due');
        if (vendorView && vendorView.style.display !== 'none') {
            renderVendorDueView();
        }
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

const B2B_KEYWORDS = ['trader', 'treder', 'enterprise', 'company', 'agency', 'agenci', 'corporation', 'sewa', 'seva', 'ksk', 'kendra', 'culture', 'm /s'];

function getCustomerCategory(name, address = '') {
    const lowerName = (name || '').toLowerCase();
    const lowerAddr = (address || '').toLowerCase();
    const isB2B = B2B_KEYWORDS.some(k => lowerName.includes(k)) ||
                  lowerAddr.includes('gst') ||
                  lowerAddr.includes('pan');
    return isB2B ? 'B2B' : 'UIC Gold';
}

function getCreditDays(category) {
    return category === 'B2B' ? 60 : 30;
}

function aggregateCustomerDataGviz(table) {
    const customers = {};
    const COL = { TYPE: 0, DATE: 1, NAME: 2, MOBILE: 3, ADDRESS: 4, AMOUNT: 11, BALANCE: 12 };
    const additiveTypes = ['offer', 'recharged via cms', 'refund', 'paid', 'u2ureward', 'recharged online', 'cashback', 'recharged via direct', 'referral bounus', 'recharged via online'];

    table.rows.forEach(row => {
        const cells = row.c;
        if (!cells || !cells[COL.NAME] || !cells[COL.NAME].v) return;

        const type = cells[COL.TYPE] && cells[COL.TYPE].v ? String(cells[COL.TYPE].v).toLowerCase().trim() : '';
        const name = String(cells[COL.NAME].v).trim();
        let mobile = cells[COL.MOBILE] ? (cells[COL.MOBILE].f || String(cells[COL.MOBILE].v)) : 'N/A';
        // Clean mobile number to ensure consistent grouping
        mobile = mobile.replace(/[\s\-\(\)]/g, '');
        const address = cells[COL.ADDRESS] && cells[COL.ADDRESS].v ? String(cells[COL.ADDRESS].v) : '';
        const date = cells[COL.DATE] ? parseGvizDate(cells[COL.DATE].v) : null;
        const amount = cells[COL.AMOUNT] ? parseFloat(cells[COL.AMOUNT].v) || 0 : 0;

        const key = `${name}_${mobile}`;
        if (!customers[key]) {
            customers[key] = {
                key: key,
                name: name,
                mobile: mobile,
                address: address,
                category: getCustomerCategory(name, address),
                totalPendingBalance: 0,
                totalOverdue: 0,
                overdue1_30: 0,
                overdue31_60: 0,
                overdue61_90: 0,
                overdue90Plus: 0,
                lastTransactionDate: new Date(0),
                transactions: []
            };
        }

        const isAdditive = additiveTypes.includes(type);
        // Capture Order ID from column 10
        const orderId = cells[10] && cells[10].v ? String(cells[10].v) : '-';
        customers[key].transactions.push({ type, date, amount, isAdditive, orderId });
    });

    Object.values(customers).forEach(c => {
        // Sort chronologically. Null dates go to the beginning.
        c.transactions.sort((a, b) => (a.date || 0) - (b.date || 0));

        let runningBalance = 0;
        c.transactions.forEach(t => {
            if (t.isAdditive) runningBalance += t.amount;
            else runningBalance -= t.amount;
            
            t.calculatedBalance = runningBalance;

            if (t.date && t.date >= c.lastTransactionDate) {
                c.lastTransactionDate = t.date;
            }
        });

        c.totalPendingBalance = runningBalance;
        
        // Correct Overdue Calculation using FIFO logic & Aging Categories
        const outstanding = getOutstandingTransactions(c);
        let overdue1_30 = 0;
        let overdue31_60 = 0;
        let overdue61_90 = 0;
        let overdue90Plus = 0;
        let overdueSum = 0;

        const creditDays = getCreditDays(c.category);
        outstanding.forEach(t => {
            if (t.type === 'order' && t.date) {
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const dateStart = new Date(t.date.getFullYear(), t.date.getMonth(), t.date.getDate());
                const diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
                if (diffDays > creditDays) {
                    const overdueDays = diffDays - creditDays;
                    overdueSum += t.outstandingAmount;
                    if (overdueDays <= 30) {
                        overdue1_30 += t.outstandingAmount;
                    } else if (overdueDays <= 60) {
                        overdue31_60 += t.outstandingAmount;
                    } else if (overdueDays <= 90) {
                        overdue61_90 += t.outstandingAmount;
                    } else {
                        overdue90Plus += t.outstandingAmount;
                    }
                }
            }
        });

        if (c.totalPendingBalance >= 0) {
            c.totalOverdue = 0;
            c.overdue1_30 = 0;
            c.overdue31_60 = 0;
            c.overdue61_90 = 0;
            c.overdue90Plus = 0;
        } else {
            const cappedOverdue = Math.min(Math.abs(c.totalPendingBalance), overdueSum);
            c.totalOverdue = -cappedOverdue;

            if (overdueSum > 0 && cappedOverdue < overdueSum) {
                const ratio = cappedOverdue / overdueSum;
                c.overdue1_30 = -(overdue1_30 * ratio);
                c.overdue31_60 = -(overdue31_60 * ratio);
                c.overdue61_90 = -(overdue61_90 * ratio);
                c.overdue90Plus = -(overdue90Plus * ratio);
            } else {
                c.overdue1_30 = -overdue1_30;
                c.overdue31_60 = -overdue31_60;
                c.overdue61_90 = -overdue61_90;
                c.overdue90Plus = -overdue90Plus;
            }
        }
    });

    return Object.values(customers);
}

function updateStats() {
    const totalCustomers = customersData.length;
    const totalOverdue = customersData.reduce((sum, c) => sum + c.totalOverdue, 0);
    const totalPendingBalance = customersData.reduce((sum, c) => sum + c.totalPendingBalance, 0);

    const goldCustomers = customersData.filter(c => c.category === 'UIC Gold');
    const b2bCustomers = customersData.filter(c => c.category === 'B2B');

    const goldOverdue = goldCustomers.reduce((sum, c) => sum + c.totalOverdue, 0);
    const b2bOverdue = b2bCustomers.reduce((sum, c) => sum + c.totalOverdue, 0);

    const goldPending = goldCustomers.reduce((sum, c) => sum + c.totalPendingBalance, 0);
    const b2bPending = b2bCustomers.reduce((sum, c) => sum + c.totalPendingBalance, 0);

    const overdueCount = customersData.filter(c => c.totalOverdue < -0.005).length;
    const clearCount = customersData.filter(c => Math.abs(c.totalOverdue) < 0.005).length;

    // Update Top Stat Elements
    const customersEl = document.getElementById('totalCustomers');
    const overdueEl = document.getElementById('totalOverdueAmount');
    const pendingBalanceEl = document.getElementById('totalPendingBalanceAmount');
    const goldOverdueEl = document.getElementById('goldOverdueAmount');
    const b2bOverdueEl = document.getElementById('b2bOverdueAmount');

    if (customersEl) customersEl.textContent = totalCustomers;
    if (overdueEl) overdueEl.textContent = `${totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (pendingBalanceEl) pendingBalanceEl.textContent = `${totalPendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (goldOverdueEl) goldOverdueEl.textContent = `${goldOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (b2bOverdueEl) b2bOverdueEl.textContent = `${b2bOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    // Update sublabels / counts
    const ratioEl = document.getElementById('custCategoryRatio');
    const goldCountEl = document.getElementById('goldCustomerCount');
    const b2bCountEl = document.getElementById('b2bCustomerCount');
    if (ratioEl) ratioEl.innerHTML = `${goldCustomers.length} Gold &bull; ${b2bCustomers.length} B2B`;
    if (goldCountEl) goldCountEl.innerHTML = `${goldCustomers.length} Customers &bull; 30d credit`;
    if (b2bCountEl) b2bCountEl.innerHTML = `${b2bCustomers.length} Customers &bull; 60d credit`;

    // Update Category Overview Cards
    const cardGoldAmt = document.getElementById('catCardGoldOverdue');
    const cardB2BAmt = document.getElementById('catCardB2BOverdue');
    const cardGoldBal = document.getElementById('catCardGoldBalance');
    const cardB2BBal = document.getElementById('catCardB2BBalance');
    const cardGoldCnt = document.getElementById('cardGoldCount');
    const cardB2BCnt = document.getElementById('cardB2BCount');

    if (cardGoldAmt) cardGoldAmt.textContent = `${goldOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (cardB2BAmt) cardB2BAmt.textContent = `${b2bOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (cardGoldBal) cardGoldBal.textContent = `Balance: ${goldPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (cardB2BBal) cardB2BBal.textContent = `Balance: ${b2bPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (cardGoldCnt) cardGoldCnt.textContent = `${goldCustomers.length} Accounts`;
    if (cardB2BCnt) cardB2BCnt.textContent = `${b2bCustomers.length} Accounts`;

    // Update Filter Pill Counts
    const pillAll = document.getElementById('pillCountAll');
    const pillGold = document.getElementById('pillCountGold');
    const pillB2B = document.getElementById('pillCountB2B');
    const pillOverdue = document.getElementById('pillCountOverdue');
    const pillClear = document.getElementById('pillCountClear');

    if (pillAll) pillAll.textContent = totalCustomers;
    if (pillGold) pillGold.textContent = goldCustomers.length;
    if (pillB2B) pillB2B.textContent = b2bCustomers.length;
    if (pillOverdue) pillOverdue.textContent = overdueCount;
    if (pillClear) pillClear.textContent = clearCount;
}

function filterByCustomerCategory(category) {
    currentCategoryFilter = category;

    // Update active stat cards
    document.querySelectorAll('.clickable-stat').forEach(card => {
        if (card.getAttribute('data-cust-filter') === category) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Update active category overview cards
    document.querySelectorAll('.category-card').forEach(card => {
        if (card.getAttribute('data-cust-filter') === category) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Update active filter pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
        if (pill.getAttribute('data-cust-filter') === category) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    applyFilters();
}

function filterByCategory(category) {
    filterByCustomerCategory(category);
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

    filteredData = customersData.filter(c => {
        const matchesSearch = !term || c.name.toLowerCase().includes(term) || c.mobile.includes(term);
        if (!matchesSearch) return false;

        if (currentCategoryFilter === 'all') return true;
        if (currentCategoryFilter === 'gold') return c.category === 'UIC Gold';
        if (currentCategoryFilter === 'b2b') return c.category === 'B2B';
        if (currentCategoryFilter === 'overdue') return c.totalOverdue < -0.005;
        if (currentCategoryFilter === 'clear') return Math.abs(c.totalOverdue) < 0.005;
        return true;
    });

    sortData();
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No matching customers found.</td></tr>';
        return;
    }

    filteredData.forEach(customer => {
        const tr = document.createElement('tr');
        const isPositive = customer.totalPendingBalance >= 0;
        const statusIcon = isPositive ? 'trending-up' : 'trending-down';
        const statusClass = isPositive ? 'up' : 'down';

        const categoryBadge = customer.category === 'UIC Gold'
            ? `<span class="badge-cat badge-gold"><i data-lucide="award" style="width:12px;height:12px;"></i> UIC Gold</span>`
            : `<span class="badge-cat badge-b2b"><i data-lucide="building-2" style="width:12px;height:12px;"></i> B2B</span>`;

        const totalOverdueDisplay = Math.abs(customer.totalOverdue) < 0.005 
            ? `<span class="zero-amount">0.00</span>` 
            : `<span class="overdue-urgent">${customer.totalOverdue.toFixed(2)}</span>`;

        tr.innerHTML = `
            <td><div class="customer-info"><span class="customer-name">${customer.name}</span></div></td>
            <td>${customer.mobile}</td>
            <td>${categoryBadge}</td>
            <td><div class="status-indicator ${statusClass}"><i data-lucide="${statusIcon}"></i></div></td>
            <td class="amount overdue text-right">${totalOverdueDisplay}</td>
            <td class="amount balance text-right">${customer.totalPendingBalance.toFixed(2)}</td>
            <td class="actions-col" style="text-align: center;">
                <button class="icon-btn" onclick="openStatement('${customer.key}')" title="View Statement">
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
    document.getElementById('stmtOverdueAmount').textContent = `${customer.totalOverdue.toFixed(2)}`;
    document.getElementById('stmtCurrentBalance').textContent = `${customer.totalPendingBalance.toFixed(2)}`;
    document.getElementById('stmtGeneratedAt').textContent = new Date().toLocaleString();

    // Populate category in modal
    const catEl = document.getElementById('stmtCustomerCategory');
    if (catEl) {
        catEl.innerHTML = customer.category === 'UIC Gold'
            ? `<span class="badge-cat badge-gold"><i data-lucide="award" style="width:12px;height:12px;"></i> UIC Gold</span>`
            : `<span class="badge-cat badge-b2b"><i data-lucide="building-2" style="width:12px;height:12px;"></i> B2B Customer</span>`;
    }

    // Populate category breakdown in modal
    const stmt130 = document.getElementById('stmtCat1_30');
    const stmt3160 = document.getElementById('stmtCat31_60');
    const stmt6190 = document.getElementById('stmtCat61_90');
    const stmt90P = document.getElementById('stmtCat90Plus');

    if (stmt130) stmt130.textContent = (customer.overdue1_30 || 0).toFixed(2);
    if (stmt3160) stmt3160.textContent = (customer.overdue31_60 || 0).toFixed(2);
    if (stmt6190) stmt6190.textContent = (customer.overdue61_90 || 0).toFixed(2);
    if (stmt90P) stmt90P.textContent = (customer.overdue90Plus || 0).toFixed(2);

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
        outstanding.forEach(t => renderStatementRow(stmtTbody, t, customer));
    }

    document.getElementById('statementModal').classList.add('active');
    lucide.createIcons();
}

function renderStatementRow(tbody, t, customer) {
    const cust = customer || currentStatementCustomer;
    const creditDays = getCreditDays(cust ? cust.category : 'UIC Gold');
    const row = document.createElement('tr');
    const isPartial = t.outstandingAmount < t.amount;
    let diffDays = 0;
    if (t.date) {
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dateStart = new Date(t.date.getFullYear(), t.date.getMonth(), t.date.getDate());
        diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
    }
    const isOverdue = diffDays > creditDays;
    let statusText = isOverdue ? 'OVERDUE' : 'OPEN';
    let catTag = '';
    if (isOverdue) {
        const overdueDays = diffDays - creditDays;
        if (overdueDays <= 30) catTag = ' (1–30d)';
        else if (overdueDays <= 60) catTag = ' (31–60d)';
        else if (overdueDays <= 90) catTag = ' (61–90d)';
        else catTag = ' (90+d)';
    }
    const statusClass = isOverdue ? 'status-overdue' : 'status-open';

    const dueDate = t.date ? new Date(t.date) : null;
    if (dueDate) dueDate.setDate(dueDate.getDate() + creditDays);

    row.innerHTML = `
        <td style="text-align: left !important; padding: 12px 16px !important;">${formatDate(t.date)}</td>
        <td style="text-align: left !important; padding: 12px 16px !important;">${formatDate(dueDate)}</td>
        <td style="text-align: left !important; padding: 12px 16px !important; text-transform: capitalize;">${t.type} ${isPartial ? '<span class="badge badge-success" style="font-size: 0.6rem; padding: 2px 6px;">PARTIAL</span>' : ''}</td>
        <td style="text-align: left !important; padding: 12px 16px !important;">${t.orderId || '-'}</td>
        <td style="text-align: left !important; padding: 12px 16px !important;" class="stmt-type-order">DEBIT</td>
        <td style="text-align: left !important; padding: 12px 16px !important;"><span class="status-badge ${statusClass}">${statusText}${catTag}</span></td>
        <td style="text-align: right !important; padding: 12px 16px !important;">${t.amount.toFixed(2)}</td>
        <td style="text-align: right !important; padding: 12px 16px !important;" class="stmt-type-order">${t.outstandingAmount.toFixed(2)}</td>
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
        const srModal = document.getElementById('vendorShortReportModal');
        if (event.target == srModal) {
            srModal.classList.remove('active');
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
                applyFilters();
            } else if (currentView === 'vendor-due') {
                renderVendorDueTable();
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
        if (valA === undefined) valA = 0;
        if (valB === undefined) valB = 0;
        if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * factor;
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

function renderPendingInvoicesTable() {
    const tbody = document.getElementById('pendingInvoicesTableBody');
    if (!tbody) return;

    let pendingTransactions = [];

    customersData.forEach(customer => {
        const outstanding = getOutstandingTransactions(customer);
        outstanding.forEach(t => {
            if (t.type === 'order' || t.outstandingAmount > 0) {
                pendingTransactions.push({
                    customer: customer,
                    transaction: t
                });
            }
        });
    });

    // Dynamic sorting based on pendingSortConfig
    const factor = pendingSortConfig.direction === 'asc' ? 1 : -1;
    pendingTransactions.sort((a, b) => {
        let valA, valB;
        switch (pendingSortConfig.column) {
            case 'date':
                valA = a.transaction.date ? a.transaction.date.getTime() : 0;
                valB = b.transaction.date ? b.transaction.date.getTime() : 0;
                break;
            case 'dueDate':
                const creditA = getCreditDays(a.customer.category);
                const da = a.transaction.date ? new Date(a.transaction.date) : new Date(0);
                if (a.transaction.date) da.setDate(da.getDate() + creditA);
                const creditB = getCreditDays(b.customer.category);
                const db = b.transaction.date ? new Date(b.transaction.date) : new Date(0);
                if (b.transaction.date) db.setDate(db.getDate() + creditB);
                valA = da.getTime();
                valB = db.getTime();
                break;
            case 'status':
                let diffA = 0;
                let diffB = 0;
                if (a.transaction.date) {
                    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const dateStart = new Date(a.transaction.date.getFullYear(), a.transaction.date.getMonth(), a.transaction.date.getDate());
                    diffA = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
                }
                if (b.transaction.date) {
                    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const dateStart = new Date(b.transaction.date.getFullYear(), b.transaction.date.getMonth(), b.transaction.date.getDate());
                    diffB = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
                }
                valA = diffA > getCreditDays(a.customer.category) ? 1 : 0;
                valB = diffB > getCreditDays(b.customer.category) ? 1 : 0;
                break;
            case 'orderId':
                valA = a.transaction.orderId || '';
                valB = b.transaction.orderId || '';
                break;
            case 'name':
                valA = a.customer.name;
                valB = b.customer.name;
                break;
            case 'mobile':
                valA = a.customer.mobile;
                valB = b.customer.mobile;
                break;
            case 'amount':
                valA = a.transaction.amount;
                valB = b.transaction.amount;
                break;
            case 'balance':
                valA = -a.transaction.outstandingAmount;
                valB = -b.transaction.outstandingAmount;
                break;
            default:
                valA = 0; valB = 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * factor;
        }
        return (valA - valB) * factor;
    });

    if (pendingTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No pending invoices found.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    pendingTransactions.forEach(item => {
        const c = item.customer;
        const t = item.transaction;

        const date = t.date ? new Date(t.date) : null;
        let diffDays = 0;
        let dueDate = null;
        let dateStr = 'N/A';
        let timeStr = '';
        
        const creditDays = getCreditDays(c.category);
        if (date) {
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
            dueDate = new Date(date);
            dueDate.setDate(dueDate.getDate() + creditDays);
            dateStr = formatDate(date);
            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        
        const isOverdue = diffDays > creditDays;
        let catBadge = '';
        if (isOverdue) {
            const overdueDays = diffDays - creditDays;
            if (overdueDays <= 30) {
                catBadge = `<span class="cat-badge badge-1-30" style="font-size: 0.65rem; padding: 2px 6px;">1–30d</span>`;
            } else if (overdueDays <= 60) {
                catBadge = `<span class="cat-badge badge-31-60" style="font-size: 0.65rem; padding: 2px 6px;">31–60d</span>`;
            } else if (overdueDays <= 90) {
                catBadge = `<span class="cat-badge badge-61-90" style="font-size: 0.65rem; padding: 2px 6px;">61–90d</span>`;
            } else {
                catBadge = `<span class="cat-badge badge-90-plus" style="font-size: 0.65rem; padding: 2px 6px;">90+d</span>`;
            }
        }
        const statusDisplay = isOverdue 
            ? `<span class="status-badge status-overdue">Overdue</span> ${catBadge}` 
            : `<span class="status-badge status-open">Not Yet Due</span>`;
        const dueDateStr = formatDate(dueDate);
        const orderId = t.orderId || '-';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${statusDisplay}</td>
            <td style="white-space: nowrap;">${dateStr}</td>
            <td style="white-space: nowrap;">${dueDateStr}</td>
            <td>${orderId}</td>
            <td>${c.name}</td>
            <td>${c.mobile}</td>
            <td style="white-space: nowrap;">Rs.${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="white-space: nowrap;">Rs.${(-t.outstandingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td></td>
        `;
        tbody.appendChild(row);
    });
}

// ==========================================================================
// Reports & Analytics Interactive Dashboard Logic
// ==========================================================================

let currentAnalyticsCategory = 'all';
let currentAnalyticsCustomerKey = 'all';
let currentAnalyticsTimeframe = 'all';
let timelineChartInstance = null;
let secondaryChartInstance = null;
let agingChartInstance = null;
let analyticsLedgerRecords = [];

function initReportsView() {
    populateAnalyticsCustomerDropdown();
    renderReportsView();
}

function populateAnalyticsCustomerDropdown() {
    const select = document.getElementById('analyticsCustomerSelect');
    if (!select) return;

    const prevVal = currentAnalyticsCustomerKey;
    select.innerHTML = '<option value="all">📊 All Customers (Consolidated Overview)</option>';

    let list = customersData.slice();
    if (currentAnalyticsCategory === 'gold') {
        list = list.filter(c => c.category === 'UIC Gold');
    } else if (currentAnalyticsCategory === 'b2b') {
        list = list.filter(c => c.category === 'B2B');
    }

    list.sort((a, b) => a.name.localeCompare(b.name));

    list.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.key;
        opt.textContent = `${c.name} [${c.category}] - Bal: ₹${c.totalPendingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        select.appendChild(opt);
    });

    if (list.some(c => c.key === prevVal)) {
        select.value = prevVal;
        currentAnalyticsCustomerKey = prevVal;
    } else {
        select.value = 'all';
        currentAnalyticsCustomerKey = 'all';
    }
}

function setAnalyticsCategory(category) {
    currentAnalyticsCategory = category;

    ['all', 'gold', 'b2b'].forEach(cat => {
        const btn = document.getElementById(cat === 'all' ? 'repPillAll' : (cat === 'gold' ? 'repPillGold' : 'repPillB2B'));
        if (btn) {
            if (category === cat) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    populateAnalyticsCustomerDropdown();
    renderReportsView();
}

function onAnalyticsCustomerChange() {
    const select = document.getElementById('analyticsCustomerSelect');
    if (select) {
        currentAnalyticsCustomerKey = select.value;
    }
    renderReportsView();
}

function onAnalyticsFilterChange() {
    const timeSelect = document.getElementById('analyticsTimeframe');
    if (timeSelect) {
        currentAnalyticsTimeframe = timeSelect.value;
    }
    renderReportsView();
}

function renderReportsView() {
    if (!customersData || customersData.length === 0) return;

    // 1. Filter customers
    let activeCustomers = customersData.slice();
    const isSingleCustomer = currentAnalyticsCustomerKey !== 'all';

    if (isSingleCustomer) {
        activeCustomers = activeCustomers.filter(c => c.key === currentAnalyticsCustomerKey);
        if (activeCustomers.length === 0) activeCustomers = customersData.slice();
    } else if (currentAnalyticsCategory === 'gold') {
        activeCustomers = activeCustomers.filter(c => c.category === 'UIC Gold');
    } else if (currentAnalyticsCategory === 'b2b') {
        activeCustomers = activeCustomers.filter(c => c.category === 'B2B');
    }

    // 2. Identify timeframe cutoff
    let cutoffDate = null;
    if (currentAnalyticsTimeframe !== 'all') {
        const days = parseInt(currentAnalyticsTimeframe, 10);
        if (!isNaN(days)) {
            cutoffDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
        }
    }

    // 3. Compute KPI Stats
    let totalPurchases = 0;
    let orderCount = 0;
    let totalPaid = 0;
    let allTransactions = [];

    activeCustomers.forEach(c => {
        c.transactions.forEach(t => {
            allTransactions.push({
                customer: c,
                date: t.date,
                amount: t.amount,
                isAdditive: t.isAdditive,
                type: t.type,
                orderId: t.orderId,
                calculatedBalance: t.calculatedBalance
            });

            if (!t.isAdditive) {
                totalPurchases += t.amount;
                orderCount++;
            } else {
                totalPaid += t.amount;
            }
        });
    });

    const totalPendingBalance = activeCustomers.reduce((sum, c) => sum + c.totalPendingBalance, 0);
    const totalOverdue = activeCustomers.reduce((sum, c) => sum + c.totalOverdue, 0);
    const recoveryRate = totalPurchases > 0 ? (totalPaid / totalPurchases) * 100 : 100;

    // Update KPI elements
    const elPurchased = document.getElementById('repTotalPurchased');
    const elOrderCount = document.getElementById('repOrderCount');
    const elPaid = document.getElementById('repTotalPaid');
    const elRecovery = document.getElementById('repRecoveryRate');
    const elBalance = document.getElementById('repCurrentBalance');
    const elBalStatus = document.getElementById('repBalanceStatus');
    const elOverdue = document.getElementById('repTotalOverdue');
    const elOverdueTerms = document.getElementById('repOverdueCreditTerms');
    const elCard5Title = document.getElementById('repCard5Title');
    const elCard5Val = document.getElementById('repCard5Value');
    const elCard5Sub = document.getElementById('repCard5Sub');

    if (elPurchased) elPurchased.textContent = `₹${totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (elOrderCount) elOrderCount.textContent = `${orderCount.toLocaleString('en-IN')} Orders`;
    if (elPaid) elPaid.textContent = `₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (elRecovery) elRecovery.textContent = `Recovery: ${recoveryRate.toFixed(1)}%`;
    if (elBalance) elBalance.textContent = `₹${totalPendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (elBalStatus) elBalStatus.textContent = totalPendingBalance >= 0 ? 'Surplus / Clear' : 'Unpaid Net Balance';
    if (elOverdue) elOverdue.textContent = `₹${totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    if (isSingleCustomer) {
        const cust = activeCustomers[0];
        const creditDays = getCreditDays(cust.category);
        if (elOverdueTerms) elOverdueTerms.textContent = `${creditDays}d Credit Limit`;
        if (elCard5Title) elCard5Title.textContent = 'Customer Category';
        if (elCard5Val) elCard5Val.textContent = cust.category;
        if (elCard5Sub) elCard5Sub.textContent = Math.abs(cust.totalOverdue) < 0.005 ? 'Account Clear (No Overdue)' : `Overdue: ₹${cust.totalOverdue.toFixed(2)}`;
    } else {
        const overdueCount = activeCustomers.filter(c => c.totalOverdue < -0.005).length;
        const clearCount = activeCustomers.length - overdueCount;
        if (elOverdueTerms) elOverdueTerms.textContent = 'UIC Gold 30d • B2B 60d';
        if (elCard5Title) elCard5Title.textContent = 'Portfolio Health';
        if (elCard5Val) elCard5Val.textContent = `${clearCount} / ${activeCustomers.length} Clear`;
        if (elCard5Sub) elCard5Sub.textContent = `${overdueCount} Accounts Overdue`;
    }

    // 4. Filter Transactions for Charts & Ledger based on Timeframe
    let chartTransactions = allTransactions;
    if (cutoffDate) {
        chartTransactions = allTransactions.filter(t => t.date && t.date >= cutoffDate);
    }
    chartTransactions.sort((a, b) => (a.date || 0) - (b.date || 0));

    // 5. Render Day-Wise Timeline Chart
    renderTimelineChart(chartTransactions, isSingleCustomer ? activeCustomers[0].name : 'Consolidated Portfolio');

    // 6. Render Secondary Chart
    renderSecondaryChart(activeCustomers, isSingleCustomer);

    // 7. Render Aging Chart
    renderAgingChart(activeCustomers);

    // 8. Populate Detailed Day-Wise Ledger Table
    renderAnalyticsTable(chartTransactions);

    lucide.createIcons();
}

function renderTimelineChart(transactions, titleContext) {
    const canvas = document.getElementById('timelineChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (timelineChartInstance) {
        timelineChartInstance.destroy();
    }

    // Group transactions by Day
    const dailyMap = {};
    let runningBalance = 0;

    transactions.forEach(t => {
        if (!t.date) return;
        const dayKey = formatDate(t.date);
        if (!dailyMap[dayKey]) {
            dailyMap[dayKey] = {
                timestamp: t.date.getTime(),
                dateStr: dayKey,
                purchases: 0,
                payments: 0,
                runningBalance: 0
            };
        }
        if (!t.isAdditive) {
            dailyMap[dayKey].purchases += t.amount;
            runningBalance -= t.amount;
        } else {
            dailyMap[dayKey].payments += t.amount;
            runningBalance += t.amount;
        }
        dailyMap[dayKey].runningBalance = runningBalance;
    });

    const sortedDays = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp);

    const maxPoints = 50;
    const displayDays = sortedDays.length > maxPoints ? sortedDays.slice(sortedDays.length - maxPoints) : sortedDays;

    const labels = displayDays.map(d => d.dateStr);
    const purchaseData = displayDays.map(d => d.purchases);
    const paymentData = displayDays.map(d => d.payments);
    const balanceData = displayDays.map(d => -d.runningBalance);

    const subTitle = document.getElementById('timelineChartSubtitle');
    if (subTitle) {
        subTitle.textContent = `Daily purchases, payments, and net due trajectory for ${titleContext} (${displayDays.length} transaction days shown)`;
    }

    timelineChartInstance = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Purchase (Debit)',
                    data: purchaseData,
                    backgroundColor: 'rgba(59, 130, 246, 0.75)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'Payment (Credit)',
                    data: paymentData,
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 3
                },
                {
                    type: 'line',
                    label: 'Net Due Balance',
                    data: balanceData,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderWidth: 2.5,
                    tension: 0.2,
                    fill: true,
                    pointRadius: displayDays.length > 25 ? 2 : 4,
                    pointHoverRadius: 6,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const val = context.parsed.y || 0;
                            return `${label}: ₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(241, 245, 249, 0.8)' },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#64748b',
                        maxRotation: 45
                    }
                },
                y: {
                    grid: { color: 'rgba(241, 245, 249, 0.8)' },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#64748b',
                        callback: function (val) {
                            if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + 'L';
                            if (val >= 1000) return '₹' + (val / 1000).toFixed(0) + 'k';
                            return '₹' + val;
                        }
                    }
                }
            }
        }
    });
}

function renderSecondaryChart(activeCustomers, isSingleCustomer) {
    const canvas = document.getElementById('secondaryChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (secondaryChartInstance) {
        secondaryChartInstance.destroy();
    }

    const titleEl = document.getElementById('secondaryChartTitle');
    const subTitleEl = document.getElementById('secondaryChartSubtitle');

    if (isSingleCustomer) {
        const cust = activeCustomers[0];
        if (titleEl) titleEl.textContent = `${cust.name}: Monthly Purchases vs Payments`;
        if (subTitleEl) subTitleEl.textContent = 'Month-by-month order volumes and repayments';

        const monthMap = {};
        cust.transactions.forEach(t => {
            if (!t.date) return;
            const monthKey = t.date.toLocaleString('default', { month: 'short', year: 'numeric' });
            const sortKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthMap[sortKey]) {
                monthMap[sortKey] = { label: monthKey, purchases: 0, payments: 0 };
            }
            if (!t.isAdditive) monthMap[sortKey].purchases += t.amount;
            else monthMap[sortKey].payments += t.amount;
        });

        const sortedMonths = Object.keys(monthMap).sort().map(k => monthMap[k]);
        const labels = sortedMonths.map(m => m.label);
        const purchases = sortedMonths.map(m => m.purchases);
        const payments = sortedMonths.map(m => m.payments);

        secondaryChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Purchases (₹)',
                        data: purchases,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: 'Payments (₹)',
                        data: payments,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Inter', size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { font: { family: 'Inter', size: 11 } } },
                    y: {
                        ticks: {
                            callback: val => val >= 1000 ? '₹' + (val / 1000).toFixed(0) + 'k' : '₹' + val
                        }
                    }
                }
            }
        });
    } else {
        if (titleEl) titleEl.textContent = 'Top Customers: Purchases vs Outstanding Due';
        if (subTitleEl) subTitleEl.textContent = 'Highest volume customer accounts compared against unpaid balance';

        const customerStats = activeCustomers.map(c => {
            const totalPurchased = c.transactions
                .filter(t => !t.isAdditive)
                .reduce((sum, t) => sum + t.amount, 0);
            return {
                name: c.name,
                category: c.category,
                purchased: totalPurchased,
                due: Math.abs(c.totalPendingBalance)
            };
        });

        customerStats.sort((a, b) => b.purchased - a.purchased);
        const topList = customerStats.slice(0, 8);

        const labels = topList.map(c => c.name.length > 18 ? c.name.substring(0, 16) + '...' : c.name);
        const purchaseData = topList.map(c => c.purchased);
        const dueData = topList.map(c => c.due);

        secondaryChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Purchased (₹)',
                        data: purchaseData,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: 'Outstanding Due (₹)',
                        data: dueData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Inter', size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ₹${ctx.parsed.x.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            callback: val => val >= 100000 ? '₹' + (val / 100000).toFixed(1) + 'L' : '₹' + (val / 1000).toFixed(0) + 'k'
                        }
                    },
                    y: { ticks: { font: { family: 'Inter', size: 11, weight: '500' } } }
                }
            }
        });
    }
}

function renderAgingChart(activeCustomers) {
    const canvas = document.getElementById('agingChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (agingChartInstance) {
        agingChartInstance.destroy();
    }

    let overdue1_30 = 0;
    let overdue31_60 = 0;
    let overdue61_90 = 0;
    let overdue90Plus = 0;
    let totalPending = 0;

    activeCustomers.forEach(c => {
        overdue1_30 += Math.abs(c.overdue1_30 || 0);
        overdue31_60 += Math.abs(c.overdue31_60 || 0);
        overdue61_90 += Math.abs(c.overdue61_90 || 0);
        overdue90Plus += Math.abs(c.overdue90Plus || 0);
        if (c.totalPendingBalance < 0) totalPending += Math.abs(c.totalPendingBalance);
    });

    const overdueSum = overdue1_30 + overdue31_60 + overdue61_90 + overdue90Plus;
    const notDue = Math.max(0, totalPending - overdueSum);

    const labels = ['Not Yet Due (Current)', '1–30d Overdue', '31–60d Overdue', '61–90d Overdue', '90+d Overdue'];
    const data = [notDue, overdue1_30, overdue31_60, overdue61_90, overdue90Plus];

    agingChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#10b981',
                    '#f59e0b',
                    '#f97316',
                    '#ef4444',
                    '#991b1b'
                ],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: { family: 'Inter', size: 11, weight: '500' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const val = context.parsed || 0;
                            const total = data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                            return ` ${context.label}: ₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

function renderAnalyticsTable(transactions) {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;

    analyticsLedgerRecords = transactions.slice().reverse();
    renderAnalyticsTableRows(analyticsLedgerRecords);
}

function renderAnalyticsTableRows(records) {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;

    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">No transactions match your current filters.</td></tr>';
        return;
    }

    const displayRecords = records.slice(0, 100);

    tbody.innerHTML = '';
    displayRecords.forEach(item => {
        const c = item.customer;
        const dateStr = formatDate(item.date);
        const orderId = item.orderId || '-';
        const isPurchase = !item.isAdditive;
        const purchaseAmt = isPurchase ? `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
        const paymentAmt = !isPurchase ? `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
        const balAmt = item.calculatedBalance !== undefined ? `₹${item.calculatedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

        let statusBadge = '';
        if (isPurchase) {
            let diffDays = 0;
            if (item.date) {
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const dateStart = new Date(item.date.getFullYear(), item.date.getMonth(), item.date.getDate());
                diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
            }
            const creditLimit = getCreditDays(c.category);
            if (diffDays > creditLimit) {
                statusBadge = `<span class="status-badge status-overdue">Overdue (${diffDays - creditLimit}d)</span>`;
            } else {
                statusBadge = `<span class="status-badge status-open">Due in ${creditLimit - diffDays}d</span>`;
            }
        } else {
            statusBadge = `<span class="status-badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">Credit Recd</span>`;
        }

        const catBadge = c.category === 'UIC Gold'
            ? `<span class="badge-cat badge-gold"><i data-lucide="award" style="width:11px;height:11px;"></i> Gold</span>`
            : `<span class="badge-cat badge-b2b"><i data-lucide="building-2" style="width:11px;height:11px;"></i> B2B</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="white-space: nowrap;">${dateStr}</td>
            <td><strong>${orderId}</strong></td>
            <td><a href="javascript:void(0)" onclick="selectCustomerInAnalytics('${c.key}')" style="color: var(--primary-color); font-weight: 600; text-decoration: none;">${c.name}</a></td>
            <td>${catBadge}</td>
            <td style="text-transform: capitalize;">${item.type}</td>
            <td class="text-right" style="color: ${isPurchase ? '#b91c1c' : 'var(--text-muted)'}; font-weight: 600;">${purchaseAmt}</td>
            <td class="text-right" style="color: ${!isPurchase ? '#047857' : 'var(--text-muted)'}; font-weight: 600;">${paymentAmt}</td>
            <td class="text-right" style="font-weight: 700;">${balAmt}</td>
            <td style="text-align: center;">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
}

function filterAnalyticsTable() {
    const input = document.getElementById('analyticsTableSearch');
    const term = input ? input.value.toLowerCase().trim() : '';

    if (!term) {
        renderAnalyticsTableRows(analyticsLedgerRecords);
        return;
    }

    const filtered = analyticsLedgerRecords.filter(item => {
        return (item.customer.name && item.customer.name.toLowerCase().includes(term)) ||
               (item.orderId && item.orderId.toLowerCase().includes(term)) ||
               (item.type && item.type.toLowerCase().includes(term)) ||
               (formatDate(item.date).includes(term));
    });

    renderAnalyticsTableRows(filtered);
}

function selectCustomerInAnalytics(key) {
    const select = document.getElementById('analyticsCustomerSelect');
    if (select) {
        select.value = key;
        onAnalyticsCustomerChange();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function exportAnalyticsReport(format) {
    if (!analyticsLedgerRecords || analyticsLedgerRecords.length === 0) {
        showToast("No analytics data to export", "error");
        return;
    }

    const isSingle = currentAnalyticsCustomerKey !== 'all';
    const cust = isSingle ? customersData.find(c => c.key === currentAnalyticsCustomerKey) : null;
    const namePrefix = cust ? cust.name.replace(/\s+/g, '_') : 'UIC_Gold_Consolidated';
    const fileName = `${namePrefix}_Analytics_Report_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
        const headers = ['Date', 'Order ID', 'Customer Name', 'Category', 'Transaction Type', 'Purchase (Debit)', 'Payment (Credit)', 'Balance'];
        const csvRows = [headers.join(',')];

        analyticsLedgerRecords.forEach(t => {
            const isPurchase = !t.isAdditive;
            const row = [
                `"${formatDate(t.date)}"`,
                `"${t.orderId || '-'}"`,
                `"${t.customer.name}"`,
                `"${t.customer.category}"`,
                `"${t.type}"`,
                `"${isPurchase ? t.amount.toFixed(2) : '0.00'}"`,
                `"${!isPurchase ? t.amount.toFixed(2) : '0.00'}"`,
                `"${(t.calculatedBalance !== undefined ? t.calculatedBalance : 0).toFixed(2)}"`
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, `${fileName}.csv`);
        showToast("Analytics CSV exported!");
    } else if (format === 'pdf') {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast("PDF library not ready", "error");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.text("UIC Gold - Analytics & Financial Report", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Scope: ${cust ? cust.name + ' (' + cust.category + ')' : 'All Customers Consolidated'} | Generated on: ${new Date().toLocaleString()}`, 14, 28);

        const purchases = document.getElementById('repTotalPurchased') ? document.getElementById('repTotalPurchased').textContent : '-';
        const payments = document.getElementById('repTotalPaid') ? document.getElementById('repTotalPaid').textContent : '-';
        const balance = document.getElementById('repCurrentBalance') ? document.getElementById('repCurrentBalance').textContent : '-';
        const overdue = document.getElementById('repTotalOverdue') ? document.getElementById('repTotalOverdue').textContent : '-';

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 34, 182, 18, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(`Purchases: ${purchases}  |  Payments: ${payments}  |  Balance: ${balance}  |  Overdue: ${overdue}`, 18, 45);

        const tableData = analyticsLedgerRecords.slice(0, 60).map(t => {
            const isPurchase = !t.isAdditive;
            return [
                formatDate(t.date),
                t.orderId || '-',
                t.customer.name,
                t.type.toUpperCase(),
                isPurchase ? t.amount.toFixed(2) : '-',
                !isPurchase ? t.amount.toFixed(2) : '-',
                (t.calculatedBalance !== undefined ? t.calculatedBalance.toFixed(2) : '-')
            ];
        });

        doc.autoTable({
            startY: 58,
            head: [['Date', 'Order ID', 'Customer', 'Type', 'Purchase (₹)', 'Payment (₹)', 'Balance (₹)']],
            body: tableData,
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        doc.save(`${fileName}.pdf`);
        showToast("Analytics PDF report exported!");
    }
}

/* ==========================================================================
   Vendor Payment Due Tracking System Logic
   ========================================================================== */

let vendorAgingData = [];
let vendorCategoryFilter = 'all'; // 'all', 'b2b', 'gold', 'due', 'settled'
let vendorSortConfig = { column: 'totalDue', direction: 'desc' };

function calculateVendorAging(c) {
    // 1. Identify total purchases (all debits: !t.isAdditive) and credits (t.isAdditive)
    let totalPurchases = 0;
    let totalCredits = 0;

    c.transactions.forEach(t => {
        if (!t.isAdditive) {
            totalPurchases += t.amount;
        } else {
            totalCredits += t.amount;
        }
    });

    // 2. FIFO matching of credits against debits to get outstanding unpaid invoices
    let remainingCredits = totalCredits;
    let due0_15 = 0;
    let due16_30 = 0;
    let due31_45 = 0;
    let due46_60 = 0;
    let due60Plus = 0;

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Debits sorted chronologically
    const debits = c.transactions.filter(t => !t.isAdditive);
    debits.forEach(debit => {
        if (remainingCredits >= debit.amount) {
            remainingCredits -= debit.amount;
        } else {
            const unpaidAmount = debit.amount - remainingCredits;
            remainingCredits = 0;

            if (debit.date) {
                const dateStart = new Date(debit.date.getFullYear(), debit.date.getMonth(), debit.date.getDate());
                const diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));

                if (diffDays <= 15) {
                    due0_15 += unpaidAmount;
                } else if (diffDays <= 30) {
                    due16_30 += unpaidAmount;
                } else if (diffDays <= 45) {
                    due31_45 += unpaidAmount;
                } else if (diffDays <= 60) {
                    due46_60 += unpaidAmount;
                } else {
                    due60Plus += unpaidAmount;
                }
            } else {
                due60Plus += unpaidAmount;
            }
        }
    });

    // If customer has overpaid or is in credit (balance >= 0), totalDue is 0
    if (c.totalPendingBalance >= 0) {
        due0_15 = 0;
        due16_30 = 0;
        due31_45 = 0;
        due46_60 = 0;
        due60Plus = 0;
    }

    const totalDue = due0_15 + due16_30 + due31_45 + due46_60 + due60Plus;

    return {
        key: c.key,
        name: c.name,
        mobile: c.mobile,
        address: c.address,
        category: c.category,
        purchases: totalPurchases,
        credits: totalCredits,
        due0_15: due0_15,
        due16_30: due16_30,
        due31_45: due31_45,
        due46_60: due46_60,
        due60Plus: due60Plus,
        totalDue: totalDue,
        balance: c.totalPendingBalance,
        customerObj: c
    };
}

function calculateAllVendorsAging() {
    return customersData.map(c => calculateVendorAging(c));
}

function renderVendorDueView() {
    vendorAgingData = calculateAllVendorsAging();

    const totalVendors = vendorAgingData.length;
    const b2bVendors = vendorAgingData.filter(v => v.category === 'B2B');
    const goldVendors = vendorAgingData.filter(v => v.category === 'UIC Gold');
    const dueVendors = vendorAgingData.filter(v => v.totalDue > 0.005);
    const settledVendors = vendorAgingData.filter(v => v.totalDue <= 0.005);

    const totalPurchases = vendorAgingData.reduce((sum, v) => sum + v.purchases, 0);
    const totalDue = vendorAgingData.reduce((sum, v) => sum + v.totalDue, 0);
    const total0_15 = vendorAgingData.reduce((sum, v) => sum + v.due0_15, 0);
    const total16_30 = vendorAgingData.reduce((sum, v) => sum + v.due16_30, 0);
    const total31_45 = vendorAgingData.reduce((sum, v) => sum + v.due31_45, 0);
    const total46_60 = vendorAgingData.reduce((sum, v) => sum + v.due46_60, 0);
    const total60Plus = vendorAgingData.reduce((sum, v) => sum + v.due60Plus, 0);

    const recentDue = total0_15 + total16_30;
    const criticalDue = total46_60 + total60Plus;

    // Update KPI Cards
    const totalCountEl = document.getElementById('vendorTotalCount');
    const ratioTextEl = document.getElementById('vendorRatioText');
    const totalPurchasesEl = document.getElementById('vendorTotalPurchases');
    const totalDueEl = document.getElementById('vendorTotalDue');
    const dueAccountsCountEl = document.getElementById('vendorDueAccountsCount');
    const recentDueEl = document.getElementById('vendorRecentDue');
    const criticalDueEl = document.getElementById('vendorCriticalDue');

    if (totalCountEl) totalCountEl.textContent = totalVendors;
    if (ratioTextEl) ratioTextEl.innerHTML = `${b2bVendors.length} B2B &bull; ${goldVendors.length} Gold`;
    if (totalPurchasesEl) totalPurchasesEl.textContent = `₹ ${totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalDueEl) totalDueEl.textContent = `₹ ${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (dueAccountsCountEl) dueAccountsCountEl.textContent = `${dueVendors.length} accounts with pending due`;
    if (recentDueEl) recentDueEl.textContent = `₹ ${recentDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (criticalDueEl) criticalDueEl.textContent = `₹ ${criticalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Update Filter Pill Counts
    const pillAll = document.getElementById('vpillCountAll');
    const pillB2B = document.getElementById('vpillCountB2B');
    const pillGold = document.getElementById('vpillCountGold');
    const pillDue = document.getElementById('vpillCountDue');
    const pillSettled = document.getElementById('vpillCountSettled');

    if (pillAll) pillAll.textContent = totalVendors;
    if (pillB2B) pillB2B.textContent = b2bVendors.length;
    if (pillGold) pillGold.textContent = goldVendors.length;
    if (pillDue) pillDue.textContent = dueVendors.length;
    if (pillSettled) pillSettled.textContent = settledVendors.length;

    // Update Aging Visual Progress Bar
    const sumDue = totalDue > 0 ? totalDue : 1;
    const pct0_15 = ((total0_15 / sumDue) * 100).toFixed(1);
    const pct16_30 = ((total16_30 / sumDue) * 100).toFixed(1);
    const pct31_45 = ((total31_45 / sumDue) * 100).toFixed(1);
    const pct46_60 = ((total46_60 / sumDue) * 100).toFixed(1);
    const pct60Plus = ((total60Plus / sumDue) * 100).toFixed(1);

    const b0_15 = document.getElementById('vbar0_15');
    const b16_30 = document.getElementById('vbar16_30');
    const b31_45 = document.getElementById('vbar31_45');
    const b46_60 = document.getElementById('vbar46_60');
    const b60Plus = document.getElementById('vbar60Plus');

    if (b0_15) { b0_15.style.width = `${pct0_15}%`; b0_15.title = `0-15 Days Due: ₹${total0_15.toLocaleString('en-IN')} (${pct0_15}%)`; }
    if (b16_30) { b16_30.style.width = `${pct16_30}%`; b16_30.title = `16-30 Days Due: ₹${total16_30.toLocaleString('en-IN')} (${pct16_30}%)`; }
    if (b31_45) { b31_45.style.width = `${pct31_45}%`; b31_45.title = `31-45 Days Due: ₹${total31_45.toLocaleString('en-IN')} (${pct31_45}%)`; }
    if (b46_60) { b46_60.style.width = `${pct46_60}%`; b46_60.title = `46-60 Days Due: ₹${total46_60.toLocaleString('en-IN')} (${pct46_60}%)`; }
    if (b60Plus) { b60Plus.style.width = `${pct60Plus}%`; b60Plus.title = `>60 Days Due: ₹${total60Plus.toLocaleString('en-IN')} (${pct60Plus}%)`; }

    const leg0_15 = document.getElementById('vleg0_15');
    const leg16_30 = document.getElementById('vleg16_30');
    const leg31_45 = document.getElementById('vleg31_45');
    const leg46_60 = document.getElementById('vleg46_60');
    const leg60Plus = document.getElementById('vleg60Plus');

    if (leg0_15) leg0_15.textContent = `₹${total0_15.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${pct0_15}%)`;
    if (leg16_30) leg16_30.textContent = `₹${total16_30.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${pct16_30}%)`;
    if (leg31_45) leg31_45.textContent = `₹${total31_45.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${pct31_45}%)`;
    if (leg46_60) leg46_60.textContent = `₹${total46_60.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${pct46_60}%)`;
    if (leg60Plus) leg60Plus.textContent = `₹${total60Plus.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${pct60Plus}%)`;

    const summaryText = document.getElementById('vendorAgingSummaryText');
    if (summaryText) {
        summaryText.textContent = `Total Due: ₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    renderVendorDueTable();
}

function renderVendorDueTable() {
    const tbody = document.getElementById('vendorDueTableBody');
    const tfoot = document.getElementById('vendorDueTableFooter');
    if (!tbody) return;

    if (!vendorAgingData || vendorAgingData.length === 0) {
        vendorAgingData = calculateAllVendorsAging();
    }

    const searchInput = document.getElementById('searchInput');
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Apply Filter Pills
    let displayList = vendorAgingData.filter(v => {
        if (vendorCategoryFilter === 'b2b') return v.category === 'B2B';
        if (vendorCategoryFilter === 'gold') return v.category === 'UIC Gold';
        if (vendorCategoryFilter === 'due') return v.totalDue > 0.005;
        if (vendorCategoryFilter === 'settled') return v.totalDue <= 0.005;
        return true;
    });

    // Apply Search Term
    if (term) {
        displayList = displayList.filter(v => {
            return (v.name && v.name.toLowerCase().includes(term)) ||
                   (v.mobile && v.mobile.toLowerCase().includes(term)) ||
                   (v.address && v.address.toLowerCase().includes(term));
        });
    }

    // Apply Sorting
    const { column, direction } = vendorSortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    displayList.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (typeof valA === 'string') return valA.localeCompare(valB) * factor;
        return (valA - valB) * factor;
    });

    tbody.innerHTML = '';

    if (displayList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--text-muted);">No vendor accounts match your filter criteria.</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    displayList.forEach(v => {
        const tr = document.createElement('tr');

        const catBadge = v.category === 'B2B'
            ? `<span class="badge-cat badge-b2b"><i data-lucide="building-2" style="width:12px;height:12px;"></i> B2B</span>`
            : `<span class="badge-cat badge-gold"><i data-lucide="award" style="width:12px;height:12px;"></i> UIC Gold</span>`;

        function formatDueCell(val, cls) {
            if (val > 0.005) {
                return `<span class="aging-due-val ${cls}">₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
            }
            return `<span class="zero-amount" style="color: #94a3b8;">0.00</span>`;
        }

        const due0_15_html = formatDueCell(v.due0_15, 'val-0-15');
        const due16_30_html = formatDueCell(v.due16_30, 'val-16-30');
        const due31_45_html = formatDueCell(v.due31_45, 'val-31-45');
        const due46_60_html = formatDueCell(v.due46_60, 'val-46-60');
        const due60Plus_html = formatDueCell(v.due60Plus, 'val-60-plus');

        const totalDueHtml = v.totalDue > 0.005
            ? `<span class="text-danger" style="font-weight: 700;">₹ ${v.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`
            : `<span style="color: var(--success); font-weight: 600;">0.00</span>`;

        tr.innerHTML = `
            <td>
                <div style="cursor: pointer; max-width: 175px;" onclick="openStatement('${v.key}')" title="Click to view detailed statement">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v.name}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${v.mobile !== 'N/A' ? v.mobile : ''}</div>
                </div>
            </td>
            <td>${catBadge}</td>
            <td class="text-right" style="font-weight: 600;">₹ ${v.purchases.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right col-due-0-15">${due0_15_html}</td>
            <td class="text-right col-due-16-30">${due16_30_html}</td>
            <td class="text-right col-due-31-45">${due31_45_html}</td>
            <td class="text-right col-due-46-60">${due46_60_html}</td>
            <td class="text-right col-due-60-plus">${due60Plus_html}</td>
            <td class="text-right col-total-due">${totalDueHtml}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="icon-btn" onclick="openVendorShortReport('${v.key}')" title="Generate Short Report (Due & Slabs)" style="color: var(--primary-color); margin-right: 4px;">
                    <i data-lucide="file-check-2"></i>
                </button>
                <button class="icon-btn" onclick="openStatement('${v.key}')" title="View Full Statement & Invoices">
                    <i data-lucide="file-text"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Render Grand Totals in Footer
    if (tfoot) {
        const sumPurchases = displayList.reduce((s, v) => s + v.purchases, 0);
        const sum0_15 = displayList.reduce((s, v) => s + v.due0_15, 0);
        const sum16_30 = displayList.reduce((s, v) => s + v.due16_30, 0);
        const sum31_45 = displayList.reduce((s, v) => s + v.due31_45, 0);
        const sum46_60 = displayList.reduce((s, v) => s + v.due46_60, 0);
        const sum60Plus = displayList.reduce((s, v) => s + v.due60Plus, 0);
        const sumTotalDue = displayList.reduce((s, v) => s + v.totalDue, 0);

        tfoot.innerHTML = `
            <tr>
                <td><strong>Grand Total (${displayList.length} Vendors)</strong></td>
                <td></td>
                <td class="text-right"><strong>₹ ${sumPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="text-right col-due-0-15"><strong>₹ ${sum0_15.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="text-right col-due-16-30"><strong>₹ ${sum16_30.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="text-right col-due-31-45"><strong>₹ ${sum31_45.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="text-right col-due-46-60"><strong>₹ ${sum46_60.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="text-right col-due-60-plus"><strong>₹ ${sum60Plus.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td class="text-right col-total-due text-danger"><strong>₹ ${sumTotalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td></td>
            </tr>
        `;
    }

    updateVendorSortIcons();
    lucide.createIcons();
}

function handleVendorSort(column) {
    if (vendorSortConfig.column === column) {
        vendorSortConfig.direction = vendorSortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        vendorSortConfig.column = column;
        vendorSortConfig.direction = (column === 'name' || column === 'category') ? 'asc' : 'desc';
    }
    renderVendorDueTable();
}

function updateVendorSortIcons() {
    const { column, direction } = vendorSortConfig;
    const icons = document.querySelectorAll('#vendorAgingTable th.sortable i');
    icons.forEach(i => {
        i.setAttribute('data-lucide', 'arrow-up-down');
        i.style.color = 'inherit';
        i.style.opacity = '0.5';
    });

    const targetIcon = document.getElementById(`sort-icon-vendor-${column}`);
    if (targetIcon) {
        targetIcon.setAttribute('data-lucide', direction === 'asc' ? 'chevron-up' : 'chevron-down');
        targetIcon.style.color = 'var(--primary-color)';
        targetIcon.style.opacity = '1';
    }
}

function filterVendorCategory(category) {
    vendorCategoryFilter = category;

    // Update active filter pills
    document.querySelectorAll('[data-vfilter]').forEach(pill => {
        if (pill.getAttribute('data-vfilter') === category) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    // Update stat card active indicator if matching
    const cardTotal = document.getElementById('vStatCardTotal');
    const cardDue = document.getElementById('vStatCardDue');
    if (cardTotal) cardTotal.classList.toggle('active', category === 'all');
    if (cardDue) cardDue.classList.toggle('active', category === 'due');

    renderVendorDueTable();
}

function exportVendorDue(format) {
    try {
        if (!vendorAgingData || vendorAgingData.length === 0) {
            vendorAgingData = calculateAllVendorsAging();
        }

        const dateStr = formatDate(today);
        const fileName = `Vendor_Payment_Due_Report_${dateStr}`;

        const headers = [
            'Vendor Name',
            'Category',
            'Total Purchase (INR)',
            '0-15 Days Due (INR)',
            '16-30 Days Due (INR)',
            '31-45 Days Due (INR)',
            '46-60 Days Due (INR)',
            '> 60 Days Due (INR)',
            'Total Due (INR)'
        ];

        // Apply current filter to export
        const exportList = vendorAgingData.filter(v => {
            if (vendorCategoryFilter === 'b2b') return v.category === 'B2B';
            if (vendorCategoryFilter === 'gold') return v.category === 'UIC Gold';
            if (vendorCategoryFilter === 'due') return v.totalDue > 0.005;
            if (vendorCategoryFilter === 'settled') return v.totalDue <= 0.005;
            return true;
        });

        const rows = exportList.map(v => [
            v.name,
            v.category,
            v.purchases.toFixed(2),
            v.due0_15.toFixed(2),
            v.due16_30.toFixed(2),
            v.due31_45.toFixed(2),
            v.due46_60.toFixed(2),
            v.due60Plus.toFixed(2),
            v.totalDue.toFixed(2)
        ]);

        const sumPurchases = exportList.reduce((s, v) => s + v.purchases, 0);
        const sum0_15 = exportList.reduce((s, v) => s + v.due0_15, 0);
        const sum16_30 = exportList.reduce((s, v) => s + v.due16_30, 0);
        const sum31_45 = exportList.reduce((s, v) => s + v.due31_45, 0);
        const sum46_60 = exportList.reduce((s, v) => s + v.due46_60, 0);
        const sum60Plus = exportList.reduce((s, v) => s + v.due60Plus, 0);
        const sumTotalDue = exportList.reduce((s, v) => s + v.totalDue, 0);

        if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text("VENDOR PAYMENT DUE & AGING REPORT", 148, 15, { align: "center" });

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleString()} | Filter: ${vendorCategoryFilter.toUpperCase()} (${exportList.length} Vendors)`, 148, 22, { align: "center" });

            doc.autoTable({
                startY: 28,
                head: [headers],
                body: rows,
                foot: [[
                    `Total (${exportList.length})`,
                    '',
                    sumPurchases.toFixed(2),
                    sum0_15.toFixed(2),
                    sum16_30.toFixed(2),
                    sum31_45.toFixed(2),
                    sum46_60.toFixed(2),
                    sum60Plus.toFixed(2),
                    sumTotalDue.toFixed(2)
                ]],
                headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
                footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
                columnStyles: {
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' },
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                    7: { halign: 'right' },
                    8: { halign: 'right', fontStyle: 'bold' }
                },
                styles: { fontSize: 8 }
            });

            doc.save(`${fileName}.pdf`);
            showToast("Vendor Due PDF Exported!");
        } else {
            // CSV / Excel
            const csvRows = [
                headers.join(','),
                ...rows.map(r => r.map(val => `"${val}"`).join(',')),
                [
                    `"Grand Total"`,
                    `""`,
                    `"${sumPurchases.toFixed(2)}"`,
                    `"${sum0_15.toFixed(2)}"`,
                    `"${sum16_30.toFixed(2)}"`,
                    `"${sum31_45.toFixed(2)}"`,
                    `"${sum46_60.toFixed(2)}"`,
                    `"${sum60Plus.toFixed(2)}"`,
                    `"${sumTotalDue.toFixed(2)}"`
                ].join(',')
            ];
            const csvContent = "\uFEFF" + csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            downloadFile(blob, `${fileName}.csv`);
            showToast(`Vendor Due Exported as ${format.toUpperCase()}!`);
        }
    } catch (err) {
        console.error(err);
        showToast("Error exporting vendor report", "error");
    }
}

/* ==========================================================================
   Vendor-Wise Short Report (Details + Total Due + Days-Wise Slabs)
   ========================================================================== */

let currentShortReportVendor = null;

function populateShortReportVendorDropdown(selectedKey) {
    const select = document.getElementById('srVendorSelect');
    if (!select) return;

    if (!vendorAgingData || vendorAgingData.length === 0) {
        vendorAgingData = calculateAllVendorsAging();
    }

    select.innerHTML = '';
    // Sort vendors with due first, then alphabetically
    const sorted = vendorAgingData.slice().sort((a, b) => {
        if (b.totalDue !== a.totalDue) return b.totalDue - a.totalDue;
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.key;
        const dueText = v.totalDue > 0.005 ? `₹${v.totalDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Due` : 'Settled';
        opt.textContent = `${v.name} (${v.category}) — ${dueText}`;
        if (v.key === selectedKey) opt.selected = true;
        select.appendChild(opt);
    });
}

function openVendorShortReport(vendorKey) {
    if (!vendorAgingData || vendorAgingData.length === 0) {
        vendorAgingData = calculateAllVendorsAging();
    }

    let vendor = vendorAgingData.find(v => v.key === vendorKey);
    if (!vendor && vendorAgingData.length > 0) {
        vendor = vendorAgingData[0];
    }
    if (!vendor) return;

    currentShortReportVendor = vendor;
    populateShortReportVendorDropdown(vendor.key);
    renderVendorShortReport(vendor);

    const modal = document.getElementById('vendorShortReportModal');
    if (modal) modal.classList.add('active');

    lucide.createIcons();
}

function openVendorShortReportModal() {
    if (!vendorAgingData || vendorAgingData.length === 0) {
        vendorAgingData = calculateAllVendorsAging();
    }
    // Default to the first vendor with overdue or first in list
    const topDue = vendorAgingData.find(v => v.totalDue > 0.005) || vendorAgingData[0];
    if (topDue) {
        openVendorShortReport(topDue.key);
    }
}

function closeVendorShortReportModal() {
    const modal = document.getElementById('vendorShortReportModal');
    if (modal) modal.classList.remove('active');
}

function onShortReportVendorSelect(key) {
    const vendor = vendorAgingData.find(v => v.key === key);
    if (vendor) {
        currentShortReportVendor = vendor;
        renderVendorShortReport(vendor);
    }
}

function renderVendorShortReport(v) {
    if (!v) return;

    // Header info
    const dateEl = document.getElementById('srGeneratedDate');
    if (dateEl) dateEl.textContent = `Report Date: ${formatDate(today)}`;

    const nameEl = document.getElementById('srVendorName');
    if (nameEl) nameEl.textContent = v.name;

    const mobEl = document.getElementById('srVendorMobile');
    if (mobEl) mobEl.textContent = v.mobile !== 'N/A' ? v.mobile : 'Not Available';

    const addrEl = document.getElementById('srVendorAddressSpan');
    if (addrEl) addrEl.textContent = v.address ? `• ${v.address}` : '';

    const catBadgeEl = document.getElementById('srVendorCategoryBadge');
    if (catBadgeEl) {
        catBadgeEl.innerHTML = v.category === 'B2B'
            ? `<span class="badge-cat badge-b2b"><i data-lucide="building-2" style="width:12px;height:12px;"></i> B2B Vendor</span>`
            : `<span class="badge-cat badge-gold"><i data-lucide="award" style="width:12px;height:12px;"></i> UIC Gold Customer</span>`;
    }

    const totalDueEl = document.getElementById('srTotalDue');
    if (totalDueEl) {
        if (v.totalDue > 0.005) {
            totalDueEl.textContent = `₹ ${v.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            totalDueEl.style.color = 'var(--danger)';
        } else {
            totalDueEl.textContent = `₹ 0.00 (All Clear)`;
            totalDueEl.style.color = 'var(--success)';
        }
    }

    const totalPurchEl = document.getElementById('srTotalPurchase');
    if (totalPurchEl) {
        totalPurchEl.textContent = `₹ ${v.purchases.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // 5 Slab Visual Cards
    const totalDueForPct = v.totalDue > 0 ? v.totalDue : 1;
    const p0_15 = ((v.due0_15 / totalDueForPct) * 100).toFixed(1);
    const p16_30 = ((v.due16_30 / totalDueForPct) * 100).toFixed(1);
    const p31_45 = ((v.due31_45 / totalDueForPct) * 100).toFixed(1);
    const p46_60 = ((v.due46_60 / totalDueForPct) * 100).toFixed(1);
    const p60Plus = ((v.due60Plus / totalDueForPct) * 100).toFixed(1);

    const s0_15 = document.getElementById('srSlab0_15');
    const s16_30 = document.getElementById('srSlab16_30');
    const s31_45 = document.getElementById('srSlab31_45');
    const s46_60 = document.getElementById('srSlab46_60');
    const s60Plus = document.getElementById('srSlab60Plus');

    if (s0_15) s0_15.textContent = `₹ ${v.due0_15.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (s16_30) s16_30.textContent = `₹ ${v.due16_30.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (s31_45) s31_45.textContent = `₹ ${v.due31_45.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (s46_60) s46_60.textContent = `₹ ${v.due46_60.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (s60Plus) s60Plus.textContent = `₹ ${v.due60Plus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const sp0_15 = document.getElementById('srSlabPct0_15');
    const sp16_30 = document.getElementById('srSlabPct16_30');
    const sp31_45 = document.getElementById('srSlabPct31_45');
    const sp46_60 = document.getElementById('srSlabPct46_60');
    const sp60Plus = document.getElementById('srSlabPct60Plus');

    if (sp0_15) sp0_15.textContent = `${p0_15}% of due`;
    if (sp16_30) sp16_30.textContent = `${p16_30}% of due`;
    if (sp31_45) sp31_45.textContent = `${p31_45}% of due`;
    if (sp46_60) sp46_60.textContent = `${p46_60}% of due`;
    if (sp60Plus) sp60Plus.textContent = `${p60Plus}% of due`;

    // Populate Slab Table
    const slabTbody = document.getElementById('srSlabTableBody');
    if (slabTbody) {
        const slabs = [
            { name: '0-15 Days Due', range: '0 to 15 Days', amount: v.due0_15, pct: p0_15, status: 'Current Due', badgeCls: 'val-0-15' },
            { name: '16-30 Days Due', range: '16 to 30 Days', amount: v.due16_30, pct: p16_30, status: 'Normal Due', badgeCls: 'val-16-30' },
            { name: '31-45 Days Due', range: '31 to 45 Days', amount: v.due31_45, pct: p31_45, status: 'Follow-up Required', badgeCls: 'val-31-45' },
            { name: '46-60 Days Due', range: '46 to 60 Days', amount: v.due46_60, pct: p46_60, status: 'Overdue (Urgent)', badgeCls: 'val-46-60' },
            { name: '> 60 Days Due', range: 'More than 60 Days', amount: v.due60Plus, pct: p60Plus, status: 'Critical Overdue', badgeCls: 'val-60-plus' }
        ];

        let slabRowsHtml = '';
        slabs.forEach(s => {
            const amtDisplay = s.amount > 0.005
                ? `<strong style="font-size: 0.9rem;">₹ ${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>`
                : `<span class="zero-amount" style="color: #94a3b8;">0.00</span>`;

            slabRowsHtml += `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td style="color: var(--text-muted);">${s.range}</td>
                    <td class="text-right">${amtDisplay}</td>
                    <td class="text-right" style="font-weight: 500;">${s.amount > 0.005 ? s.pct + '%' : '0.0%'}</td>
                    <td style="text-align: center;">
                        <span class="aging-due-val ${s.badgeCls}">${s.status}</span>
                    </td>
                </tr>
            `;
        });

        // Add Summary Row
        slabRowsHtml += `
            <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid var(--border-color);">
                <td><strong>Total Outstanding Due</strong></td>
                <td><strong>All Slabs</strong></td>
                <td class="text-right text-danger"><strong>₹ ${v.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                <td class="text-right"><strong>100.0%</strong></td>
                <td style="text-align: center;">
                    ${v.totalDue > 0.005 ? '<span class="status-badge status-overdue">PAYMENT PENDING</span>' : '<span class="status-badge status-open">SETTLED</span>'}
                </td>
            </tr>
        `;
        slabTbody.innerHTML = slabRowsHtml;
    }

    // Populate Itemized Invoices Table
    const invTbody = document.getElementById('srInvoicesTableBody');
    if (invTbody) {
        const outstanding = getOutstandingTransactions(v.customerObj);
        if (outstanding.length === 0) {
            invTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--success); font-weight: 600;">No outstanding unpaid invoices. Account is fully settled!</td></tr>';
        } else {
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            let invRowsHtml = '';
            outstanding.forEach(t => {
                let diffDays = 0;
                if (t.date) {
                    const dateStart = new Date(t.date.getFullYear(), t.date.getMonth(), t.date.getDate());
                    diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
                }

                let slabName = '> 60 Days';
                let slabCls = 'val-60-plus';
                if (diffDays <= 15) { slabName = '0-15 Days'; slabCls = 'val-0-15'; }
                else if (diffDays <= 30) { slabName = '16-30 Days'; slabCls = 'val-16-30'; }
                else if (diffDays <= 45) { slabName = '31-45 Days'; slabCls = 'val-31-45'; }
                else if (diffDays <= 60) { slabName = '46-60 Days'; slabCls = 'val-46-60'; }

                invRowsHtml += `
                    <tr>
                        <td>${formatDate(t.date)}</td>
                        <td style="font-weight: 500;">${t.orderId || '-'}</td>
                        <td class="text-right">₹ ${t.amount.toFixed(2)}</td>
                        <td class="text-right text-danger" style="font-weight: 600;">₹ ${t.outstandingAmount.toFixed(2)}</td>
                        <td style="text-align: center;">${diffDays} days</td>
                        <td style="text-align: center;"><span class="aging-due-val ${slabCls}">${slabName}</span></td>
                    </tr>
                `;
            });
            invTbody.innerHTML = invRowsHtml;
        }
    }

    lucide.createIcons();
}

function downloadVendorShortReportPDF() {
    if (!currentShortReportVendor) return;
    const v = currentShortReportVendor;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait');

        const dateStr = formatDate(today);
        const fileName = `Short_Report_${v.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}`;

        // Top Brand Header
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text("farmkart", 20, 20);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100);
        doc.text("Farmkart Online Services Pvt. Ltd. | Barwani (M.P.)", 20, 26);

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text("VENDOR PAYMENT DUE & AGING SLAB REPORT", 105, 36, { align: "center" });

        doc.setLineWidth(0.5);
        doc.setDrawColor(226, 232, 240);
        doc.line(20, 40, 190, 40);

        // Vendor Details Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20, 44, 170, 32, 3, 3, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(20, 44, 170, 32, 3, 3, 'S');

        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text("VENDOR DETAILS", 26, 52);

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`Name: ${v.name}`, 26, 60);

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(`Mobile: ${v.mobile}   |   Category: ${v.category}`, 26, 68);

        // Right side: Due & Purchase summary
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 184, 52, { align: "right" });

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("Total Outstanding Due:", 140, 60, { align: "right" });
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text(`INR ${v.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 184, 60, { align: "right" });

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text("Total Purchase:", 140, 68, { align: "right" });
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`INR ${v.purchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 184, 68, { align: "right" });

        // Days-Wise Aging Slabs Table
        const totalDueForPct = v.totalDue > 0 ? v.totalDue : 1;
        const slabData = [
            ['0-15 Days Due', '0 to 15 Days', v.due0_15.toFixed(2), ((v.due0_15 / totalDueForPct) * 100).toFixed(1) + '%', 'Current Due'],
            ['16-30 Days Due', '16 to 30 Days', v.due16_30.toFixed(2), ((v.due16_30 / totalDueForPct) * 100).toFixed(1) + '%', 'Normal Due'],
            ['31-45 Days Due', '31 to 45 Days', v.due31_45.toFixed(2), ((v.due31_45 / totalDueForPct) * 100).toFixed(1) + '%', 'Follow-up Required'],
            ['46-60 Days Due', '46 to 60 Days', v.due46_60.toFixed(2), ((v.due46_60 / totalDueForPct) * 100).toFixed(1) + '%', 'Overdue (Urgent)'],
            ['> 60 Days Due', 'More than 60 Days', v.due60Plus.toFixed(2), ((v.due60Plus / totalDueForPct) * 100).toFixed(1) + '%', 'Critical Overdue']
        ];

        doc.autoTable({
            startY: 82,
            head: [['Days-Wise Slab', 'Age Range', 'Due Amount (INR)', '% Share', 'Status']],
            body: slabData,
            foot: [['Total Outstanding Due', 'All Slabs', v.totalDue.toFixed(2), '100.0%', v.totalDue > 0.005 ? 'Payment Due' : 'Settled']],
            headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
            footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
            columnStyles: {
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'right' },
                4: { halign: 'center' }
            },
            styles: { fontSize: 8.5 }
        });

        // Itemized Invoices Table
        const outstanding = getOutstandingTransactions(v.customerObj);
        if (outstanding.length > 0) {
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const invData = outstanding.slice(0, 30).map(t => {
                let diffDays = 0;
                if (t.date) {
                    const dateStart = new Date(t.date.getFullYear(), t.date.getMonth(), t.date.getDate());
                    diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
                }
                let slabName = '> 60 Days';
                if (diffDays <= 15) slabName = '0-15 Days';
                else if (diffDays <= 30) slabName = '16-30 Days';
                else if (diffDays <= 45) slabName = '31-45 Days';
                else if (diffDays <= 60) slabName = '46-60 Days';

                return [
                    formatDate(t.date),
                    t.orderId || '-',
                    t.amount.toFixed(2),
                    t.outstandingAmount.toFixed(2),
                    `${diffDays}d`,
                    slabName
                ];
            });

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Invoice Date', 'Order ID', 'Order Amount', 'Unpaid Due (INR)', 'Age', 'Assigned Slab']],
                body: invData,
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' },
                    4: { halign: 'center' },
                    5: { halign: 'center' }
                },
                styles: { fontSize: 8 },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });
        }

        // Footer Note
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 250;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("This is an official computer-generated vendor aging & due notice report.", 105, Math.min(finalY, 280), { align: "center" });

        doc.save(`${fileName}.pdf`);
        showToast("Vendor Short Report PDF Downloaded!");
    } catch (err) {
        console.error(err);
        showToast("Error generating Short Report PDF", "error");
    }
}

function copyVendorShortReportWhatsApp() {
    if (!currentShortReportVendor) return;
    const v = currentShortReportVendor;

    const message = [
        `*PAYMENT DUE NOTICE - FARMKART / UIC GOLD*`,
        `Date: ${formatDate(today)}`,
        `----------------------------------------`,
        `*Vendor:* ${v.name}`,
        `*Mobile:* ${v.mobile}`,
        `*Category:* ${v.category}`,
        `*Total Purchases:* ₹ ${v.purchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `*TOTAL OUTSTANDING DUE:* ₹ ${v.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `----------------------------------------`,
        `*DAYS-WISE SLAB BREAKDOWN:*`,
        `• 0–15 Days Due: ₹ ${v.due0_15.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `• 16–30 Days Due: ₹ ${v.due16_30.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `• 31–45 Days Due: ₹ ${v.due31_45.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `• 46–60 Days Due: ₹ ${v.due46_60.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `• > 60 Days Due: ₹ ${v.due60Plus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `----------------------------------------`,
        `Please arrange payment for the pending amount at the earliest.`,
        `Contact: accounts@farmkart.com | 9407218000`
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message).then(() => {
            showToast("WhatsApp Due Notice copied to clipboard!");
        }).catch(() => {
            prompt("Copy WhatsApp Due Notice:", message);
        });
    } else {
        prompt("Copy WhatsApp Due Notice:", message);
    }
}

/* ==========================================================================
   Dashboard Authentication & Password Protection Logic
   ========================================================================== */

const DEFAULT_PASSWORD = 'farm@kart';
const DEFAULT_PASSWORD_HASH = '02a72fe456664e844c6961a1bbc9743c7b46a90e8b3660e69f1719b2b3d1bb7d'; // sha256('farm@kart')

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAuthenticated() {
    return sessionStorage.getItem('uic_auth') === 'true' || localStorage.getItem('uic_auth_remember') === 'true';
}

function initAuth() {
    // Migration: if localStorage has old admin123 hash, clear it so new default applies immediately
    if (localStorage.getItem('uic_dashboard_pwd_hash') === '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9') {
        localStorage.removeItem('uic_dashboard_pwd_hash');
    }

    const overlay = document.getElementById('authOverlay');
    if (isAuthenticated()) {
        if (overlay) overlay.classList.add('hidden');
        init(); // Start data fetch
    } else {
        if (overlay) overlay.classList.remove('hidden');
        const pwdInput = document.getElementById('authPasswordInput');
        if (pwdInput) {
            setTimeout(() => pwdInput.focus(), 200);
        }
    }
    lucide.createIcons();
}

async function handleAuthSubmit(event) {
    if (event) event.preventDefault();

    const pwdInput = document.getElementById('authPasswordInput');
    const rememberMe = document.getElementById('authRememberMe');
    const errorMsg = document.getElementById('authErrorMsg');
    const authCard = document.querySelector('.auth-card');
    const btnText = document.getElementById('authBtnText');
    const btnSpinner = document.getElementById('authBtnSpinner');

    if (!pwdInput) return;
    const enteredPassword = pwdInput.value.trim();

    if (!enteredPassword) {
        showAuthError("Please enter a password.");
        return;
    }

    if (btnText && btnSpinner) {
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
    }

    try {
        const enteredHash = await sha256(enteredPassword);
        const storedHash = localStorage.getItem('uic_dashboard_pwd_hash') || DEFAULT_PASSWORD_HASH;

        // Check against stored hash OR plaintext fallback for initial default
        const isMatch = (enteredHash === storedHash) || (enteredPassword === DEFAULT_PASSWORD && !localStorage.getItem('uic_dashboard_pwd_hash'));

        if (isMatch) {
            sessionStorage.setItem('uic_auth', 'true');
            if (rememberMe && rememberMe.checked) {
                localStorage.setItem('uic_auth_remember', 'true');
            } else {
                localStorage.removeItem('uic_auth_remember');
            }

            if (errorMsg) errorMsg.style.display = 'none';
            const overlay = document.getElementById('authOverlay');
            if (overlay) overlay.classList.add('hidden');

            showToast("Welcome to UIC Gold Dashboard!");
            init(); // Fetch data now that user is authenticated
        } else {
            showAuthError("Incorrect password. Please try again.");
            if (authCard) {
                authCard.classList.add('shake');
                setTimeout(() => authCard.classList.remove('shake'), 500);
            }
            pwdInput.value = '';
            pwdInput.focus();
        }
    } catch (err) {
        console.error("Auth error:", err);
        // Fallback check
        if (enteredPassword === DEFAULT_PASSWORD) {
            sessionStorage.setItem('uic_auth', 'true');
            const overlay = document.getElementById('authOverlay');
            if (overlay) overlay.classList.add('hidden');
            init();
        } else {
            showAuthError("Authentication verification error.");
        }
    } finally {
        if (btnText && btnSpinner) {
            btnText.style.display = 'inline-flex';
            btnSpinner.style.display = 'none';
        }
    }
}

function showAuthError(msg) {
    const errorEl = document.getElementById('authErrorMsg');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }
}

function toggleAuthPasswordVisibility() {
    const pwdInput = document.getElementById('authPasswordInput');
    const eyeIcon = document.getElementById('authEyeIcon');
    if (!pwdInput) return;

    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
        pwdInput.type = 'password';
        if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
}

function logout() {
    sessionStorage.removeItem('uic_auth');
    localStorage.removeItem('uic_auth_remember');

    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        const pwdInput = document.getElementById('authPasswordInput');
        if (pwdInput) {
            pwdInput.value = '';
            pwdInput.focus();
        }
    }
    showToast("Dashboard locked. Session ended.");
    lucide.createIcons();
}

async function handleChangePassword(event) {
    if (event) event.preventDefault();

    const currInput = document.getElementById('currentPasswordInput');
    const newInput = document.getElementById('newPasswordInput');
    const confInput = document.getElementById('confirmPasswordInput');
    const msgEl = document.getElementById('changePwdMsg');

    if (!currInput || !newInput || !confInput) return;

    const currVal = currInput.value.trim();
    const newVal = newInput.value.trim();
    const confVal = confInput.value.trim();

    if (newVal !== confVal) {
        showChangePwdMsg("New passwords do not match!", "danger");
        return;
    }

    if (newVal.length < 4) {
        showChangePwdMsg("New password must be at least 4 characters long.", "danger");
        return;
    }

    try {
        const currHash = await sha256(currVal);
        const storedHash = localStorage.getItem('uic_dashboard_pwd_hash') || DEFAULT_PASSWORD_HASH;

        const isCurrentValid = (currHash === storedHash) || (currVal === DEFAULT_PASSWORD && !localStorage.getItem('uic_dashboard_pwd_hash'));

        if (!isCurrentValid) {
            showChangePwdMsg("Current password is incorrect.", "danger");
            return;
        }

        const newHash = await sha256(newVal);
        localStorage.setItem('uic_dashboard_pwd_hash', newHash);

        currInput.value = '';
        newInput.value = '';
        confInput.value = '';

        showChangePwdMsg("Password changed successfully!", "success");
        showToast("Dashboard password updated!");
    } catch (err) {
        console.error(err);
        showChangePwdMsg("Error saving new password.", "danger");
    }
}

function showChangePwdMsg(text, type) {
    const el = document.getElementById('changePwdMsg');
    if (!el) return;
    el.textContent = text;
    el.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    el.style.fontWeight = '600';
    el.style.display = 'block';
}

function resetToDefaultPassword() {
    if (confirm("Reset dashboard password back to default ('farm@kart')?")) {
        localStorage.removeItem('uic_dashboard_pwd_hash');
        showChangePwdMsg("Password reset to default ('farm@kart').", "success");
        showToast("Password reset to default: farm@kart");
    }
}


