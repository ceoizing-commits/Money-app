// --- Data Definitions ---
const CATEGORIES = {
    expense: [
        { id: 'food', name: '餐饮', icon: '🍽️' },
        { id: 'transport', name: '交通', icon: '🚗' },
        { id: 'shopping', name: '购物', icon: '🛍️' },
        { id: 'entertainment', name: '娱乐', icon: '🎮' },
        { id: 'housing', name: '住房', icon: '🏠' },
        { id: 'medical', name: '医疗', icon: '🏥' },
        { id: 'education', name: '教育', icon: '📚' },
        { id: 'other', name: '其他', icon: '📝' }
    ],
    income: [
        { id: 'salary', name: '工资', icon: '💰' },
        { id: 'investment', name: '理财', icon: '📈' },
        { id: 'gift', name: '礼物', icon: '🎁' },
        { id: 'other', name: '其他', icon: '📝' }
    ]
};

const STORAGE_KEY = 'finance_app_data';
const PREF_KEY = 'finance_app_prefs';

// --- State Management ---
let appData = {
    bills: [],
    goals: [],
    savingsRecords: [],
    fixedExpenses: [],
    wishes: [],
    budgets: { total: 0, categoryBudgets: {} },
    settings: { currency: '¥', theme: 'light', enableAI: false },
    accounts: {
        cash: { name: '现金', balance: 0 },
        bank: { name: '银行卡', balance: 0 },
        alipay: { name: '支付宝', balance: 0 },
        wechat: { name: '微信支付', balance: 0 }
    }
};

let prefs = {
    lastType: 'expense',
    lastCategory: 'food',
    billFilter: 'all',
    timeFilter: 'month',
    customStartDate: null,
    customEndDate: null
};

let currentBillState = {
    type: 'expense',
    category: 'food'
};

let editingBillId = null;

// --- Chart Instances ---
let chartInstance = null;
let categoryChartInstance = null;

// --- AI Analysis Cache ---
let aiAnalysisCache = {};

// --- Initialization ---
function init() {
    loadData();
    loadPrefs();
    applyTheme();
    
    // Set Date
    const now = new Date();
    document.getElementById('current-date').textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日}`;

    // Initialize Home Form
    setBillType(prefs.lastType);
    setCategory(prefs.lastCategory);

    // Render Initial Data
    renderBills();
    renderStats();
    renderBudgetAndSavings();
    renderTodaySummary();
    
    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Custom date range toggle
    document.getElementById('time-filter').addEventListener('change', function() {
        const customRangeDiv = document.getElementById('custom-time-range');
        if (this.value === 'custom') {
            customRangeDiv.style.display = 'block';
            // Set default dates
            const today = new Date();
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            document.getElementById('start-date').value = start.toISOString().split('T')[0];
            document.getElementById('end-date').value = end.toISOString().split('T')[0];
        } else {
            customRangeDiv.style.display = 'none';
        }
    });
    
    // Set default dates for custom range
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('start-date').value = start.toISOString().split('T')[0];
    document.getElementById('end-date').value = end.toISOString().split('T')[0];
}

// --- Data Persistence ---
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Merge to ensure structure exists
            appData = { ...appData, ...parsed };
        } catch (e) {
            console.error("Data load error", e);
        }
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadPrefs() {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored) {
        prefs = JSON.parse(stored);
    }
}

function savePrefs() {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

// --- UI Logic: Navigation ---
function switchPage(pageId) {
    // Update Tab Bar
    document.querySelectorAll('.tab-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerText.includes(getPageName(pageId))) {
            item.classList.add('active');
        }
    });

    // Update Pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`page-${pageId}`).classList.add('active');

    // Refresh specific page data
    if (pageId === 'bills') renderBills();
    if (pageId === 'stats') {
        renderStats();
        setTimeout(initChart, 100); // Delay for DOM rendering
    }
    if (pageId === 'budget') renderBudgetAndSavings();
    if (pageId === 'settings') updateSettingsUI();
}

function getPageName(id) {
    const map = { 'home': '首页', 'bills': '账单', 'stats': '统计', 'budget': '预算', 'settings': '设置' };
    return map[id];
}

// --- UI Logic: Home Page (Add Bill) ---
function setBillType(type) {
    currentBillState.type = type;
    prefs.lastType = type;
    savePrefs();

    // Update Toggle UI
    document.querySelectorAll('.type-option').forEach(el => {
        el.classList.remove('active', 'expense', 'income');
        if (el.dataset.type === type) {
            el.classList.add('active', type);
        }
    });

    // Render Categories
    renderCategories(type);
    
    // Reset category to first available if current type doesn't have it
    const available = CATEGORIES[type];
    if (!available.find(c => c.id === currentBillState.category)) {
        setCategory(available[0].id);
    } else {
        renderCategories(type); // Re-render to show selection
    }
}

function setCategory(catId) {
    currentBillState.category = catId;
    prefs.lastCategory = catId;
    savePrefs();
    renderCategories(currentBillState.type);
}

function renderCategories(type) {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = '';
    
    CATEGORIES[type].forEach(cat => {
        const div = document.createElement('div');
        div.className = `category-item ${currentBillState.category === cat.id ? 'selected' : ''}`;
        div.onclick = () => setCategory(cat.id);
        div.innerHTML = `
            <div class="category-icon">${cat.icon}</div>
            <div class="category-name">${cat.name}</div>
        `;
        grid.appendChild(div);
    });
}

function submitBill() {
    const amountInput = document.getElementById('amount');
    const noteInput = document.getElementById('note');
    const errorMsg = document.getElementById('amount-error');
    
    const amountVal = parseFloat(amountInput.value);

    // Validation
    if (isNaN(amountVal) || amountVal <= 0) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = '金额必须大于0';
        return;
    }
    
    // Check decimal places
    const decimals = (amountVal.toString().split('.')[1] || '').length;
    if (decimals > 2) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = '最多支持两位小数';
        return;
    }

    errorMsg.style.display = 'none';

    // Create Bill Object
    const newBill = {
        id: Date.now(),
        type: currentBillState.type,
        category: currentBillState.category,
        amount: amountVal,
        note: noteInput.value.trim(),
        date: new Date().toISOString()
    };

    // Save
    appData.bills.unshift(newBill);
    saveData();

    // Feedback
    showToast('记账成功');
    
    // Continuous Entry: Reset amount and note, keep type and category
    amountInput.value = '';
    noteInput.value = '';
    amountInput.focus();

    // Update Home Summary
    renderTodaySummary();
    renderStats();
    renderBudgetAndSavings();
    
    // Trigger AI analysis update if enabled
    if (appData.settings.enableAI) {
        setTimeout(updateAIInsights, 1000);
    }
}

function renderTodaySummary() {
    const today = new Date().toDateString();
    let expense = 0;
    let income = 0;

    appData.bills.forEach(bill => {
        if (new Date(bill.date).toDateString() === today) {
            if (bill.type === 'expense') expense += bill.amount;
            else income += bill.amount;
        }
    });

    document.getElementById('today-expense').textContent = formatMoney(expense);
    document.getElementById('today-income').textContent = formatMoney(income);
}

// --- UI Logic: Bills Page ---
function setBillFilter(filter) {
    prefs.billFilter = filter;
    savePrefs();
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderBills();
}

function setTimeFilter(timeRange) {
    prefs.timeFilter = timeRange;
    savePrefs();
    renderBills();
}

function applyCustomRange() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (startDate && endDate) {
        prefs.customStartDate = startDate;
        prefs.customEndDate = endDate;
        prefs.timeFilter = 'custom';
        savePrefs();
        renderBills();
    }
}

function searchBills() {
    const searchTerm = document.getElementById('bill-search').value.toLowerCase();
    renderBills(searchTerm);
}

function renderBills(searchTerm = '') {
    const container = document.getElementById('bills-list');
    container.innerHTML = '';

    if (appData.bills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <div>暂无账单记录</div>
            </div>`;
        return;
    }

    // Filter bills based on preferences and time range
    let filteredBills = appData.bills;
    
    // Apply type filter
    if (prefs.billFilter !== 'all') {
        filteredBills = filteredBills.filter(bill => bill.type === prefs.billFilter);
    }
    
    // Apply time filter
    filteredBills = applyTimeFilter(filteredBills);
    
    // Apply search filter
    if (searchTerm) {
        filteredBills = filteredBills.filter(bill => {
            return (
                bill.note.toLowerCase().includes(searchTerm) ||
                bill.category.toLowerCase().includes(searchTerm) ||
                bill.amount.toString().includes(searchTerm)
            );
        });
    }

    // Calculate period statistics
    calculatePeriodStats(filteredBills);

    if (filteredBills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div>没有找到匹配的账单</div>
            </div>`;
        return;
    }

    // Group bills by date
    const groupedBills = groupBillsByDate(filteredBills);

    // Render grouped bills
    Object.entries(groupedBills).forEach(([date, bills]) => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'bill-date-header';
        dateHeader.innerHTML = `<h4>${date}</h4>`;
        container.appendChild(dateHeader);

        bills.forEach(bill => {
            const catInfo = getCategoryInfo(bill.type, bill.category);
            const dateObj = new Date(bill.date);
            const timeStr = `${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;
            
            const div = document.createElement('div');
            div.className = 'bill-item';
            div.innerHTML = `
                <div class="bill-left">
                    <div class="bill-icon">${catInfo.icon}</div>
                    <div class="bill-info">
                        <h4>${catInfo.name}</h4>
                        <p>${bill.note || timeStr}</p>
                    </div>
                </div>
                <div class="bill-amount ${bill.type}">
                    ${bill.type === 'expense' ? '-' : '+'}${formatMoney(bill.amount)}
                </div>
                <div class="bill-actions">
                    <button class="action-btn edit-btn" onclick="editBill(${bill.id})">✏️</button>
                    <button class="action-btn delete-btn" onclick="deleteBill(${bill.id})">🗑️</button>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

function applyTimeFilter(bills) {
    const now = new Date();
    let startDate, endDate;
    
    switch(prefs.timeFilter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - dayOfWeek);
            startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear() + 1, 0, 1);
            break;
        case 'custom':
            if (prefs.customStartDate && prefs.customEndDate) {
                startDate = new Date(prefs.customStartDate);
                endDate = new Date(prefs.customEndDate);
                endDate.setDate(endDate.getDate() + 1); // Include end date
            }
            break;
        default:
            return bills;
    }
    
    return bills.filter(bill => {
        const billDate = new Date(bill.date);
        return billDate >= startDate && billDate < endDate;
    });
}

function groupBillsByDate(bills) {
    const grouped = {};
    bills.forEach(bill => {
        const dateStr = formatDate(new Date(bill.date), 'MM月dd日');
        if (!grouped[dateStr]) {
            grouped[dateStr] = [];
        }
        grouped[dateStr].push(bill);
    });
    return grouped;
}

function calculatePeriodStats(bills) {
    let income = 0;
    let expense = 0;
    
    bills.forEach(bill => {
        if (bill.type === 'income') {
            income += bill.amount;
        } else {
            expense += bill.amount;
        }
    });
    
    const net = income - expense;
    
    document.getElementById('period-income').textContent = formatMoney(income);
    document.getElementById('period-expense').textContent = formatMoney(expense);
    document.getElementById('period-net').textContent = formatMoney(net);
    document.getElementById('period-net').className = net >= 0 ? 'stat-value income' : 'stat-value expense';
}

function editBill(billId) {
    const bill = appData.bills.find(b => b.id === billId);
    if (!bill) return;
    
    editingBillId = billId;
    
    document.getElementById('edit-bill-type').value = bill.type;
    document.getElementById('edit-bill-amount').value = bill.amount;
    document.getElementById('edit-bill-note').value = bill.note || '';
    
    // Populate category options
    const categorySelect = document.getElementById('edit-bill-category');
    categorySelect.innerHTML = '';
    const categories = CATEGORIES[bill.type];
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        if (cat.id === bill.category) {
            option.selected = true;
        }
        categorySelect.appendChild(option);
    });
    
    document.getElementById('edit-bill-modal').style.display = 'flex';
}

function saveEditedBill() {
    const type = document.getElementById('edit-bill-type').value;
    const amount = parseFloat(document.getElementById('edit-bill-amount').value);
    const category = document.getElementById('edit-bill-category').value;
    const note = document.getElementById('edit-bill-note').value;
    
    if (isNaN(amount) || amount <= 0) {
        showToast('请输入有效金额');
        return;
    }
    
    const index = appData.bills.findIndex(b => b.id === editingBillId);
    if (index !== -1) {
        appData.bills[index] = {
            ...appData.bills[index],
            type,
            amount,
            category,
            note
        };
        saveData();
        closeModal('edit-bill-modal');
        renderBills();
        renderStats();
        renderTodaySummary();
        renderBudgetAndSavings();
        showToast('账单已更新');
    }
}

function deleteBill(billId) {
    if (confirm('确定要删除这条账单吗？')) {
        appData.bills = appData.bills.filter(bill => bill.id !== billId);
        saveData();
        renderBills();
        renderStats();
        renderTodaySummary();
        renderBudgetAndSavings();
        showToast('账单已删除');
    }
}

// --- UI Logic: Stats Page ---
function renderStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthExpense = 0;
    let monthIncome = 0;

    appData.bills.forEach(bill => {
        const d = new Date(bill.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            if (bill.type === 'expense') monthExpense += bill.amount;
            else monthIncome += bill.amount;
        }
    });

    document.getElementById('month-expense').textContent = formatMoney(monthExpense);
    document.getElementById('month-income').textContent = formatMoney(monthIncome);
    
    // Show/hide AI section based on setting
    const aiSection = document.getElementById('ai-analysis-section');
    if (appData.settings.enableAI) {
        aiSection.style.display = 'block';
        updateAIInsights();
    } else {
        aiSection.style.display = 'none';
    }
}

function initChart() {
    // Main chart - daily expenses
    const dom = document.getElementById('chart-main');
    if (!dom) return;
    
    if (chartInstance) chartInstance.dispose();
    chartInstance = echarts.init(dom);
    
    // Prepare last 7 days data
    const dates = [];
    const expenseData = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
        dates.push(dateStr);
        
        const dayTotal = appData.bills
            .filter(b => new Date(b.date).toDateString() === d.toDateString() && b.type === 'expense')
            .reduce((sum, b) => sum + b.amount, 0);
        expenseData.push(dayTotal);
    }

    const option = {
        color: ['#FF3B30'],
        grid: { top: 30, right: 10, bottom: 20, left: 40 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dates },
        yAxis: { type: 'value' },
        series: [{
            data: expenseData,
            type: 'line',
            smooth: true,
            areaStyle: { opacity: 0.2 }
        }]
    };

    // Handle dark mode color for chart
    if (document.body.getAttribute('data-theme') === 'dark') {
        option.darkMode = true;
        option.textStyle = { color: '#fff' };
    }

    chartInstance.setOption(option);
    
    // Category chart - monthly expenses by category
    const categoryDom = document.getElementById('chart-category');
    if (!categoryDom) return;
    
    if (categoryChartInstance) categoryChartInstance.dispose();
    categoryChartInstance = echarts.init(categoryDom);
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate expenses by category
    const categoryExpenses = {};
    appData.bills.forEach(bill => {
        const d = new Date(bill.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && bill.type === 'expense') {
            if (!categoryExpenses[bill.category]) {
                categoryExpenses[bill.category] = 0;
            }
            categoryExpenses[bill.category] += bill.amount;
        }
    });
    
    const categoryNames = Object.keys(categoryExpenses);
    const categoryValues = Object.values(categoryExpenses);
    
    const categoryOption = {
        color: ['#FF3B30', '#FF9500', '#5AC8FA', '#34C759', '#AF52DE', '#FFD60A', '#FF2D55', '#007AFF'],
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left' },
        series: [{
            name: '支出分类',
            type: 'pie',
            radius: '50%',
            data: categoryNames.map((name, index) => ({
                value: categoryValues[index],
                name: getCategoryInfo('expense', name).name
            })),
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };
    
    if (document.body.getAttribute('data-theme') === 'dark') {
        categoryOption.darkMode = true;
        categoryOption.textStyle = { color: '#fff' };
    }
    
    categoryChartInstance.setOption(categoryOption);
}

// --- UI Logic: Budget & Savings Page ---
function renderBudgetAndSavings() {
    renderBudgets();
    renderFixedExpenses();
    renderGoals();
}

function renderBudgets() {
    const container = document.getElementById('budgets-list');
    container.innerHTML = '';

    if (Object.keys(appData.budgets.categoryBudgets).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div>暂无预算设置</div>
            </div>`;
        return;
    }

    // Get current month's expenses by category
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyExpenses = {};
    appData.bills.forEach(bill => {
        if (bill.type === 'expense') {
            const d = new Date(bill.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (!monthlyExpenses[bill.category]) {
                    monthlyExpenses[bill.category] = 0;
                }
                monthlyExpenses[bill.category] += bill.amount;
            }
        }
    });

    for (const [categoryId, budgetAmount] of Object.entries(appData.budgets.categoryBudgets)) {
        const catInfo = getCategoryInfo('expense', categoryId);
        const spent = monthlyExpenses[categoryId] || 0;
        const percent = Math.min(100, (spent / budgetAmount) * 100).toFixed(1);
        const remaining = budgetAmount - spent;
        
        const div = document.createElement('div');
        div.className = 'budget-item';
        div.innerHTML = `
            <div class="budget-info">
                <div>${catInfo.name}</div>
                <div class="text-secondary">${formatMoney(spent)} / ${formatMoney(budgetAmount)} (${remaining >= 0 ? '剩余' + formatMoney(remaining) : '超支' + formatMoney(Math.abs(remaining))})</div>
                <div class="budget-progress">
                    <div class="budget-progress-fill" style="width: ${percent}%"></div>
                </div>
            </div>
            <div class="budget-controls">
                <button class="btn btn-secondary" onclick="editBudget('${categoryId}')">编辑</button>
                <button class="btn btn-secondary" onclick="deleteBudget('${categoryId}')">删除</button>
            </div>
        `;
        container.appendChild(div);
    }
}

function openAddBudgetModal() {
    const select = document.getElementById('budget-category');
    select.innerHTML = '';
    
    CATEGORIES.expense.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
    
    document.getElementById('budget-amount').value = '';
    document.getElementById('add-budget-modal').style.display = 'flex';
}

function addBudget() {
    const categoryId = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);
    
    if (isNaN(amount) || amount <= 0) {
        showToast('请输入有效预算金额');
        return;
    }
    
    appData.budgets.categoryBudgets[categoryId] = amount;
    saveData();
    closeModal('add-budget-modal');
    renderBudgetAndSavings();
    showToast('预算已添加');
}

function editBudget(categoryId) {
    const amount = appData.budgets.categoryBudgets[categoryId];
    document.getElementById('budget-category').value = categoryId;
    document.getElementById('budget-amount').value = amount;
    document.getElementById('add-budget-modal').style.display = 'flex';
    
    // Remove the category from the list so it can't be selected again
    const select = document.getElementById('budget-category');
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === categoryId) {
            select.removeChild(select.options[i]);
            break;
        }
    }
}

function deleteBudget(categoryId) {
    if (confirm('确定要删除这个预算吗？')) {
        delete appData.budgets.categoryBudgets[categoryId];
        saveData();
        renderBudgetAndSavings();
        showToast('预算已删除');
    }
}

function renderFixedExpenses() {
    const container = document.getElementById('fixed-expenses-list');
    container.innerHTML = '';

    if (appData.fixedExpenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <div>暂无固定支出</div>
            </div>`;
        return;
    }

    appData.fixedExpenses.forEach(expense => {
        const div = document.createElement('div');
        div.className = 'fixed-expense-item';
        div.innerHTML = `
            <div class="fixed-expense-info">
                <div>${expense.name}</div>
                <div class="text-secondary">${formatMoney(expense.amount)} • ${getCycleText(expense.cycle)}</div>
            </div>
            <div class="fixed-expense-controls">
                <button class="btn btn-secondary" onclick="editFixedExpense(${expense.id})">编辑</button>
                <button class="btn btn-secondary" onclick="deleteFixedExpense(${expense.id})">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function openAddFixedExpenseModal() {
    document.getElementById('fixed-expense-name').value = '';
    document.getElementById('fixed-expense-amount').value = '';
    document.getElementById('fixed-expense-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('fixed-expense-modal').style.display = 'flex';
}

function addFixedExpense() {
    const name = document.getElementById('fixed-expense-name').value;
    const amount = parseFloat(document.getElementById('fixed-expense-amount').value);
    const cycle = document.getElementById('fixed-expense-cycle').value;
    const startDate = document.getElementById('fixed-expense-start-date').value;
    
    if (!name || isNaN(amount) || amount <= 0 || !startDate) {
        showToast('请输入完整的固定支出信息');
        return;
    }
    
    appData.fixedExpenses.push({
        id: Date.now(),
        name,
        amount,
        cycle,
        startDate
    });
    saveData();
    closeModal('fixed-expense-modal');
    renderBudgetAndSavings();
    showToast('固定支出已添加');
}

function editFixedExpense(expenseId) {
    // Implementation for editing fixed expense
    showToast('编辑固定支出功能待完善');
}

function deleteFixedExpense(expenseId) {
    if (confirm('确定要删除这个固定支出吗？')) {
        appData.fixedExpenses = appData.fixedExpenses.filter(e => e.id !== expenseId);
        saveData();
        renderBudgetAndSavings();
        showToast('固定支出已删除');
    }
}

function renderGoals() {
    const container = document.getElementById('goals-list');
    container.innerHTML = '';

    if (appData.goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div>暂无存钱目标</div>
            </div>`;
        return;
    }

    appData.goals.forEach(goal => {
        const percent = Math.min(100, (goal.current / goal.target) * 100).toFixed(1);
        const div = document.createElement('div');
        div.className = 'goal-item';
        div.innerHTML = `
            <div class="goal-header">
                <span>${goal.name}</span>
                <span>${formatMoney(goal.current)} / ${formatMoney(goal.target)}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function openAddGoalModal() {
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-current').value = '0';
    document.getElementById('add-goal-modal').style.display = 'flex';
}

function addGoal() {
    const name = document.getElementById('goal-name').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const current = parseFloat(document.getElementById('goal-current').value) || 0;
    
    if (!name || isNaN(target) || target <= 0) {
        showToast('请输入有效的目标信息');
        return;
    }
    
    appData.goals.push({
        id: Date.now(),
        name,
        target,
        current
    });
    saveData();
    closeModal('add-goal-modal');
    renderBudgetAndSavings();
    showToast('目标已添加');
}

// --- UI Logic: Settings & Theme ---
function toggleTheme() {
    const current = appData.settings.theme;
    const next = current === 'light' ? 'dark' : 'light';
    appData.settings.theme = next;
    saveData();
    applyTheme();
}

function applyTheme() {
    const isDark = appData.settings.theme === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    const toggle = document.getElementById('theme-toggle');
    if (isDark) toggle.classList.add('on');
    else toggle.classList.remove('on');
}

function toggleAIAnalysis() {
    appData.settings.enableAI = !appData.settings.enableAI;
    saveData();
    updateSettingsUI();
    
    // Show/hide AI section in stats page
    const aiSection = document.getElementById('ai-analysis-section');
    if (appData.settings.enableAI) {
        aiSection.style.display = 'block';
        updateAIInsights();
    } else {
        aiSection.style.display = 'none';
    }
}

function updateSettingsUI() {
    const aiToggle = document.getElementById('ai-toggle');
    if (appData.settings.enableAI) {
        aiToggle.classList.add('on');
    } else {
        aiToggle.classList.remove('on');
    }
}

function openBackupModal() {
    const backupData = JSON.stringify(appData, null, 2);
    document.getElementById('backup-data').value = backupData;
    document.getElementById('backup-modal').style.display = 'flex';
}

function copyBackupData() {
    const textarea = document.getElementById('backup-data');
    textarea.select();
    document.execCommand('copy');
    showToast('数据已复制到剪贴板');
}

function restoreData() {
    const restoreTextarea = document.getElementById('restore-data');
    const data = restoreTextarea.value;
    
    try {
        const parsed = JSON.parse(data);
        appData = { ...appData, ...parsed };
        saveData();
        location.reload();
    } catch (e) {
        showToast('数据格式错误，无法恢复');
    }
}

function clearData() {
    if(confirm('确定要清空所有数据吗？此操作无法撤销。')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PREF_KEY);
        location.reload();
    }
}

// --- Modal Functions ---
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// --- Utilities ---
function getCategoryInfo(type, id) {
    const list = CATEGORIES[type] || [];
    const found = list.find(c => c.id === id);
    return found || { name: '未知', icon: '❓' };
}

function formatMoney(num) {
    return '¥' + num.toFixed(2);
}

function formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (format === 'MM月dd日') {
        return `${month}月${day}日`;
    }
    return `${year}-${month}-${day}`;
}

function getCycleText(cycle) {
    const cycles = {
        'daily': '每日',
        'weekly': '每周',
        'monthly': '每月',
        'yearly': '每年'
    };
    return cycles[cycle] || cycle;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// --- AI Analysis Module ---
function updateAIInsights() {
    if (!appData.settings.enableAI) return;
    
    const insightsContainer = document.getElementById('ai-insights');
    if (!insightsContainer) return;
    
    // Clear previous insights
    insightsContainer.innerHTML = '<div>正在分析您的财务状况...</div>';
    
    // Simulate async processing
    setTimeout(() => {
        const insights = generateAIInsights();
        insightsContainer.innerHTML = insights;
    }, 500);
}

function generateAIInsights() {
    // Analyze spending patterns
    const spendingAnalysis = analyzeSpendingPatterns();
    // Check for budget warnings
    const budgetWarnings = checkBudgetWarnings();
    // Analyze financial health
    const healthAssessment = assessFinancialHealth();
    // Generate recommendations
    const recommendations = generateRecommendations();
    
    return `
        <div class="ai-insight">
            <div class="ai-insight-title">消费模式分析</div>
            <div class="ai-insight-content">${spendingAnalysis}</div>
        </div>
        <div class="ai-insight">
            <div class="ai-insight-title ai-warning">预算提醒</div>
            <div class="ai-insight-content">${budgetWarnings}</div>
        </div>
        <div class="ai-insight">
            <div class="ai-insight-title">财务健康度</div>
            <div class="ai-insight-content">${healthAssessment}</div>
        </div>
        <div class="ai-insight">
            <div class="ai-insight-title">改善建议</div>
            <div class="ai-insight-content">${recommendations}</div>
        </div>
    `;
}

function analyzeSpendingPatterns() {
    // Find top spending category
    const categoryTotals = {};
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    appData.bills.forEach(bill => {
        if (bill.type === 'expense') {
            const d = new Date(bill.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (!categoryTotals[bill.category]) {
                    categoryTotals[bill.category] = 0;
                }
                categoryTotals[bill.category] += bill.amount;
            }
        }
    });
    
    // Find max spending category
    let maxCat = null;
    let maxAmount = 0;
    for (const [cat, amount] of Object.entries(categoryTotals)) {
        if (amount > maxAmount) {
            maxAmount = amount;
            maxCat = cat;
        }
    }
    
    if (maxCat) {
        const catInfo = getCategoryInfo('expense', maxCat);
        return `本月最大支出类别是"${catInfo.name}"，共花费${formatMoney(maxAmount)}。`;
    }
    return "本月暂无支出记录。";
}

function checkBudgetWarnings() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyExpenses = {};
    appData.bills.forEach(bill => {
        if (bill.type === 'expense') {
            const d = new Date(bill.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (!monthlyExpenses[bill.category]) {
                    monthlyExpenses[bill.category] = 0;
                }
                monthlyExpenses[bill.category] += bill.amount;
            }
        }
    });
    
    const warnings = [];
    for (const [categoryId, budgetAmount] of Object.entries(appData.budgets.categoryBudgets)) {
        const spent = monthlyExpenses[categoryId] || 0;
        const percentUsed = (spent / budgetAmount) * 100;
        
        if (percentUsed >= 90) {
            const catInfo = getCategoryInfo('expense', categoryId);
            if (percentUsed >= 100) {
                warnings.push(`<span class="ai-danger">⚠️ "${catInfo.name}"已超预算${formatMoney(spent - budgetAmount)}！</span>`);
            } else {
                warnings.push(`<span class="ai-warning">⚠️ "${catInfo.name}"预算已使用${percentUsed.toFixed(1)}%</span>`);
            }
        }
    }
    
    if (warnings.length === 0) {
        return "✅ 所有预算均在控制范围内";
    }
    return warnings.join('<br>');
}

function assessFinancialHealth() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    
    appData.bills.forEach(bill => {
        const d = new Date(bill.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            if (bill.type === 'income') {
                monthlyIncome += bill.amount;
            } else {
                monthlyExpense += bill.amount;
            }
        }
    });
    
    const netIncome = monthlyIncome - monthlyExpense;
    const savingsRate = monthlyIncome > 0 ? (netIncome / monthlyIncome) * 100 : 0;
    
    if (savingsRate > 20) {
        return `<span class="ai-success">✅ 财务状况优秀！储蓄率达到${savingsRate.toFixed(1)}%</span>`;
    } else if (savingsRate > 10) {
        return `<span class="ai-success">✅ 财务状况良好，储蓄率为${savingsRate.toFixed(1)}%</span>`;
    } else if (savingsRate > 0) {
        return `<span class="ai-warning">⚠️ 储蓄率较低(${savingsRate.toFixed(1)}%)，建议控制支出</span>`;
    } else {
        return `<span class="ai-danger">❌ 本月入不敷出，需关注支出情况</span>`;
    }
}

function generateRecommendations() {
    const recommendations = [];
    
    // Check if there are unused budgets
    if (Object.keys(appData.budgets.categoryBudgets).length === 0) {
        recommendations.push("💡 建议设置预算来更好地控制支出");
    }
    
    // Check if there are no savings goals
    if (appData.goals.length === 0) {
        recommendations.push("💡 设定储蓄目标有助于实现财务自由");
    }
    
    // Check for high expense categories
    const categoryTotals = {};
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    appData.bills.forEach(bill => {
        if (bill.type === 'expense') {
            const d = new Date(bill.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (!categoryTotals[bill.category]) {
                    categoryTotals[bill.category] = 0;
                }
                categoryTotals[bill.category] += bill.amount;
            }
        }
    });
    
    // Find categories that might be too high
    let totalExpenses = 0;
    for (const amount of Object.values(categoryTotals)) {
        totalExpenses += amount;
    }
    
    if (totalExpenses > 0) {
        for (const [catId, amount] of Object.entries(categoryTotals)) {
            const percentage = (amount / totalExpenses) * 100;
            if (percentage > 30) { // If any category takes more than 30% of expenses
                const catInfo = getCategoryInfo('expense', catId);
                recommendations.push(`💡 "${catInfo.name}"支出占比过高(${percentage.toFixed(1)}%)，可适当控制`);
            }
        }
    }
    
    if (recommendations.length === 0) {
        return "继续保持良好的财务习惯！";
    }
    
    return recommendations.join('<br>');
}
document.addEventListener('DOMContentLoaded', init);

// --- Run ---
window.addEventListener('DOMContentLoaded', init);
