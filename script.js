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
    const views = ['gold-customer', 'pending-invoices', 'statements', 'reports', 'settings'];
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

    if (viewId === 'pending-invoices') {
        renderPendingInvoicesTable();
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
