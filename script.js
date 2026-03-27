// ==================== Data & State ====================
const CATEGORIES = {
    expense: ['餐饮', '交通', '购物', '娱乐', '住房', '其他'],
    income: ['工资', '理财', '其他']
};

const CATEGORY_ICONS = {
    '餐饮': '🍽️', '交通': '🚗', '购物': '🛍️', '娱乐': '🎮',
    '住房': '🏠', '工资': '💰', '理财': '📈', '其他': '📝'
};

let appData = {
    bills: [],
    goals: [],
    savingsRecords: [],
    fixedExpenses: [],
    wishes: [],
    budgets: { total: 0, categoryBudgets: {} },
    settings: { currency: '¥', theme: 'light', lastType: 'expense', lastCategory: '餐饮' }
};

// ==================== Utility Functions ====================
/**
 * 生成唯一ID
 * @returns {string} 基于时间戳和随机数的唯一字符串
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 安全转换为数字，无效值返回0
 * @param {*} v - 待转换的值
 * @returns {number} 转换后的数值
 */
function safeNumber(v) {
    const num = Number(v);
    return isNaN(num) ? 0 : num;
}

/**
 * 四舍五入到两位小数
 * @param {number|string} value - 待处理的数值
 * @returns {number} 处理后的数值
 */
function roundTo2(value) {
    return Math.round(safeNumber(value) * 100) / 100;
}

/**
 * 格式化金额显示
 * @param {number} amount - 金额数值
 * @returns {string} 格式化后的金额字符串
 */
function formatMoney(amount) {
    return appData.settings.currency + roundTo2(amount);
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {string|Date} dateStr - 日期字符串或Date对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * 显示轻量级提示信息
 * @param {string} msg - 提示内容
 */
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// ==================== Form Validation Functions ====================
/**
 * 验证必填字段
 * @param {*} value - 字段值
 * @param {string} label - 字段标签（用于错误提示）
 * @returns {string|null} 验证通过返回trim后的值，失败返回错误信息
 */
function validateRequired(value, label) {
    const val = String(value || '').trim();
    return val ? val : `${label}不能为空`;
}

/**
 * 验证金额格式（>0，最多两位小数）
 * @param {*} value - 金额值
 * @param {string} label - 字段标签
 * @returns {number|string} 验证通过返回数值，失败返回错误信息
 */
function validateAmount(value, label) {
    const num = safeNumber(value);
    if (num <= 0) return `${label}必须大于0`;
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) return `${label}最多两位小数`;
    return num;
}

/**
 * 验证日期合法性
 * @param {string} value - 日期字符串（YYYY-MM-DD格式）
 * @param {string} label - 字段标签
 * @returns {string|boolean} 验证通过返回原值，失败返回错误信息
 */
function validateDate(value, label) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? `${label}不合法` : value;
}

/**
 * 检查是否为有效日期对象
 * @param {any} value - 待检查的值
 * @returns {boolean} 是否为有效日期
 */
function isValidDate(value) {
    return value instanceof Date && !isNaN(value.getTime());
}

// ==================== Storage Management ====================
/**
 * 加载本地存储数据并进行兼容性处理
 * 兼容旧版数据结构，为新字段提供默认值
 */
function loadData() {
    try {
        let data = null;
        // 优先读取新key
        const newData = localStorage.getItem('finance_app_data');
        if (newData) {
            data = JSON.parse(newData);
        } else {
            // 回退旧key
            const legacyData = localStorage.getItem('myWalletData');
            if (legacyData) {
                data = JSON.parse(legacyData);
                // 一次性迁移
                localStorage.setItem('finance_app_data', legacyData);
                // 可选：清除旧数据
                // localStorage.removeItem('myWalletData');
            }
        }

        if (data) {
            // 合并数据并确保结构完整
            appData = { ...appData, ...data };
            
            // 数据迁移：确保所有必要字段存在
            if (!appData.budgets) appData.budgets = { total: 0, categoryBudgets: {} };
            if (!appData.savingsRecords) appData.savingsRecords = [];
            if (!appData.wishes) appData.wishes = [];
            if (!appData.fixedExpenses) appData.fixedExpenses = [];
            if (!appData.goals) appData.goals = [];
            if (!appData.settings) appData.settings = { currency: '¥', theme: 'light' };
            if (typeof appData.settings.theme !== 'string') appData.settings.theme = 'light';
            if (!appData.settings.lastType) appData.settings.lastType = 'expense';
            if (!appData.settings.lastCategory) appData.settings.lastCategory = '餐饮';

            // 迁移旧数据：为固定支出添加缺失的cycle字段
            appData.fixedExpenses.forEach(item => {
                if (!item.cycle) item.cycle = 'monthly'; // 默认每月
                if (!item.nextDate) item.nextDate = formatDate(new Date());
            });
        }
    } catch (e) {
        console.error("数据加载失败", e);
        showToast("数据加载异常");
    }
    
    // 应用主题设置
    applyTheme();
    renderAll();
}

/**
 * 保存数据到localStorage
 */
function saveData() {
    try {
        localStorage.setItem('finance_app_data', JSON.stringify(appData));
    } catch (e) {
        console.error("数据保存失败", e);
        showToast("存储空间不足，请清理浏览器缓存");
    }
}

// ==================== Theme Management ====================
/**
 * 应用当前主题设置到页面
 */
function applyTheme() {
    const theme = appData.settings.theme;
    document.documentElement.setAttribute('data-theme', theme);
    // 更新切换按钮状态
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式';
    }
}

/**
 * 切换深色/浅色模式
 */
function toggleTheme() {
    const currentTheme = appData.settings.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    appData.settings.theme = newTheme;
    saveData();
    applyTheme();
    showToast(`已切换至${newTheme === 'light' ? '浅色' : '深色'}模式`);
}

// ==================== Core Business Logic ====================
/**
 * 计算下一周期日期，自动处理月末等特殊情况
 * @param {string} dateStr - 当前日期（YYYY-MM-DD）
 * @param {string} cycle - 周期类型：weekly/monthly/yearly
 * @returns {string} 下一周期日期
 */
function getNextRecurringDate(dateStr, cycle) {
    const date = new Date(dateStr);
    let next = new Date(date);

    switch (cycle) {
        case 'weekly':
            next.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            const currentDay = date.getDate();
            next.setMonth(date.getMonth() + 1);
            // 处理月末情况：如1月31日 → 2月最后一天
            const lastDayOfNextMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
            if (currentDay > lastDayOfNextMonth) {
                next.setDate(lastDayOfNextMonth);
            } else {
                next.setDate(currentDay);
            }
            break;
        case 'yearly':
            const targetYear = date.getFullYear() + 1;
            const targetMonth = date.getMonth();
            const targetDay = date.getDate();
            // 处理闰年情况：2月29日 → 次年2月最后一天
            const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            if (targetDay > lastDayOfTargetMonth) {
                next = new Date(targetYear, targetMonth, lastDayOfTargetMonth);
            } else {
                next = new Date(targetYear, targetMonth, targetDay);
            }
            break;
    }
    return formatDate(next);
}

/**
 * 检查指定周期内是否已记账
 * @param {Object} item - 固定支出项目
 * @returns {boolean} 是否已记账
 */
function isRecurringExpenseAlreadyLogged(item) {
    return appData.bills.some(bill => 
        bill.fixedId === item.id && 
        bill.date === item.nextDate
    );
}

/**
 * 重新计算存钱目标当前金额
 * @param {string} goalId - 目标ID
 */
function recalculateGoalAmount(goalId) {
    const records = appData.savingsRecords.filter(r => r.goalId === goalId);
    const total = records.reduce((sum, r) => sum + safeNumber(r.amount), 0);
    const goal = appData.goals.find(g => g.id === goalId);
    if (goal) {
        goal.current = Math.max(0, roundTo2(total)); // 确保不小于0
    }
}

// ==================== Bill Management CRUD ====================
/**
 * 新增账单
 * @param {Object} bill - 账单数据
 */
function addBill(bill) {
    appData.bills.unshift({ ...bill, id: generateId(), timestamp: Date.now() });
    saveData();
    renderAll();
}

/**
 * 更新账单
 * @param {string} id - 账单ID
 * @param {Object} updatedBill - 更新后的账单数据
 */
function updateBill(id, updatedBill) {
    const idx = appData.bills.findIndex(b => b.id === id);
    if (idx !== -1) {
        appData.bills[idx] = { ...appData.bills[idx], ...updatedBill };
        saveData();
        renderAll();
    }
}

/**
 * 删除账单（带二次确认）
 * @param {string} id - 账单ID
 */
function deleteBill(id) {
    confirmAction('确定删除这条账单吗？', () => {
        appData.bills = appData.bills.filter(b => b.id !== id);
        saveData();
        renderAll();
        showToast('已删除');
    });
}

// ==================== Fixed Expense Management ====================
/**
 * 执行固定支出记账操作
 * @param {string} fixedId - 固定支出ID
 */
function logFixedExpense(fixedId) {
    const item = appData.fixedExpenses.find(f => f.id === fixedId);
    if (!item) return;

    if (isRecurringExpenseAlreadyLogged(item)) {
        showToast('本周期已记账');
        return;
    }

    // 创建新的支出账单
    const newBill = {
        type: 'expense',
        amount: item.amount,
        category: item.category,
        note: `固定支出: ${item.name}`,
        date: item.nextDate,
        time: new Date().toTimeString().split(' ')[0],
        fixedId: item.id
    };

    addBill(newBill);

    // 更新下次记账日期
    item.nextDate = getNextRecurringDate(item.nextDate, item.cycle);
    saveData();
    renderSavingsPage(); // 刷新存钱页
    showToast('记账成功');
}

// ==================== Savings Goal Management ====================
/**
 * 新增存钱记录
 * @param {Object} record - 存钱记录数据
 */
function addSavingsRecord(record) {
    appData.savingsRecords.push({ ...record, id: generateId() });
    recalculateGoalAmount(record.goalId);
    saveData();
    renderAll();
}

/**
 * 删除存钱记录
 * @param {string} recordId - 记录ID
 */
function deleteSavingsRecord(recordId) {
    const rec = appData.savingsRecords.find(r => r.id === recordId);
    if (rec) {
        appData.savingsRecords = appData.savingsRecords.filter(r => r.id !== recordId);
        recalculateGoalAmount(rec.goalId);
        saveData();
        renderAll();
    }
}

/**
 * 删除存钱目标（级联删除相关记录和解绑心愿）
 * @param {string} goalId - 目标ID
 */
function deleteGoal(goalId) {
    confirmAction('删除目标将同时删除其存钱记录并解除心愿绑定，确定吗？', () => {
        // 级联删除相关记录
        appData.savingsRecords = appData.savingsRecords.filter(r => r.goalId !== goalId);
        // 解绑相关心愿
        appData.wishes.forEach(wish => {
            if (wish.linkedGoalId === goalId) wish.linkedGoalId = null;
        });
        // 删除目标本身
        appData.goals = appData.goals.filter(g => g.id !== goalId);
        
        saveData();
        renderAll();
        showToast('已删除');
    });
}

// ==================== Wish List Management ====================
/**
 * 删除心愿
 * @param {string} wishId - 心愿ID
 */
function deleteWish(wishId) {
    confirmAction('确定删除这个心愿吗？', () => {
        appData.wishes = appData.wishes.filter(w => w.id !== wishId);
        saveData();
        renderSavingsPage();
        showToast('已删除');
    });
}

// ==================== Budget Calculation ====================
/**
 * 获取指定月份的统计信息
 * @param {number} year - 年份
 * @param {number} month - 月份（1-12）
 * @returns {Object} 统计结果
 */
function getMonthlyStats(year, month) {
    const prefix = `${year}-${String(month).padStart(2,'0')}`;
    // 空数组兜底处理
    const bills = Array.isArray(appData.bills) ? appData.bills : [];
    const monthlyBills = bills.filter(b => b.date?.startsWith(prefix));
    
    const expense = monthlyBills
        .filter(b => b.type === 'expense')
        .reduce((sum, b) => sum + safeNumber(b.amount), 0);
    
    const income = monthlyBills
        .filter(b => b.type === 'income')
        .reduce((sum, b) => sum + safeNumber(b.amount), 0);
    
    // 分类统计
    const catStats = {};
    monthlyBills
        .filter(b => b.type === 'expense')
        .forEach(b => {
            catStats[b.category] = (catStats[b.category] || 0) + safeNumber(b.amount);
        });

    return { expense: roundTo2(expense), income: roundTo2(income), catStats };
}

/**
 * 获取最近7天的每日收支数据
 * @returns {Object} 包含日期、收入、支出数组的对象
 */
function getLast7DaysData() {
    const dates = [];
    const incomes = [];
    const expenses = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = formatDate(date);
        dates.push(`${date.getMonth()+1}/${date.getDate()}`);
        
        const dailyBills = appData.bills.filter(b => b.date === dateStr);
        const income = dailyBills
            .filter(b => b.type === 'income')
            .reduce((sum, b) => sum + safeNumber(b.amount), 0);
        const expense = dailyBills
            .filter(b => b.type === 'expense')
            .reduce((sum, b) => sum + safeNumber(b.amount), 0);
            
        incomes.push(roundTo2(income));
        expenses.push(roundTo2(expense));
    }
    
    return { dates, incomes, expenses };
}

// ==================== Import/Export ====================
/**
 * 导出数据为JSON文件
 */
function exportData() {
    try {
        const dataStr = JSON.stringify(appData);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_app_backup_${formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('导出成功');
    } catch (e) {
        console.error("导出失败", e);
        showToast('导出失败');
    }
}

/**
 * 导入数据（支持覆盖和合并两种模式）
 * @param {File} file - JSON文件
 * @param {string} mode - 模式：overwrite | merge
 */
function importData(file, mode) {
    if (!file) {
        showToast('请选择文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            
            // 基础数据结构验证
            if (!imported.hasOwnProperty('bills')) {
                throw new Error('数据格式错误');
            }

            if (mode === 'overwrite') {
                appData = imported;
            } else {
                // 合并模式：按ID去重，避免脏数据
                const existingIds = new Set([...appData.bills.map(b => b.id)]);
                const newBills = imported.bills.filter(b => !existingIds.has(b.id));
                appData.bills = [...appData.bills, ...newBills];

                // 合并其他数据集（同样去重）
                const mergeArrayById = (target, source, key) => {
                    const ids = new Set(target.map(i => i.id));
                    const newItems = source.filter(i => !ids.has(i.id));
                    target.push(...newItems);
                };

                mergeArrayById(appData.fixedExpenses, imported.fixedExpenses || [], 'fixedExpenses');
                mergeArrayById(appData.goals, imported.goals || [], 'goals');
                mergeArrayById(appData.savingsRecords, imported.savingsRecords || [], 'savingsRecords');
                mergeArrayById(appData.wishes, imported.wishes || [], 'wishes');

                // 合并预算设置
                if (imported.budgets) {
                    appData.budgets.total = imported.budgets.total || appData.budgets.total;
                    Object.assign(appData.budgets.categoryBudgets, imported.budgets.categoryBudgets || {});
                }
                
                // 合并设置
                if (imported.settings) {
                    Object.assign(appData.settings, imported.settings);
                }
            }
            
            saveData();
            renderAll();
            closeModal();
            showToast('导入成功');
        } catch (err) {
            showToast('导入失败: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ==================== Clear All Data ====================
/**
 * 清空所有应用数据（需二次确认）
 */
function clearAllData() {
    confirmAction('此操作将永久删除所有数据且无法恢复，确定要清空所有数据吗？', () => {
        appData = {
            bills: [],
            goals: [],
            savingsRecords: [],
            fixedExpenses: [],
            wishes: [],
            budgets: { total: 0, categoryBudgets: {} },
            settings: { currency: '¥', theme: 'light', lastType: 'expense', lastCategory: '餐饮' }
        };
        saveData();
        renderAll();
        showToast('所有数据已清空');
    });
}

// ==================== Modal & Toast System ====================
const modal = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const modalTitle = document.getElementById('modal-title');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

/**
 * 关闭模态框
 */
function closeModal() {
    modal.style.display = 'none';
}

/**
 * 显示确认操作模态框
 * @param {string} message - 确认信息
 * @param {Function} onConfirm - 确认回调函数
 */
function confirmAction(message, onConfirm) {
    modalTitle.textContent = '确认操作';
    modalBody.innerHTML = `<p>${message}</p>`;
    modalConfirmBtn.onclick = () => {
        onConfirm();
        closeModal();
    };
    modal.style.display = 'flex';
}

/**
 * 初始化模态框点击外部关闭功能
 */
function initModalClose() {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// ==================== Home Page Form Logic ====================
/**
 * 更新分类选项根据当前选择的类型
 * @param {string} selectedCat - 预选中的分类
 */
function updateCategoryOptions(selectedCat = '') {
    const type = document.getElementById('home-type').value;
    const select = document.getElementById('home-category');
    const options = CATEGORIES[type].map(c => 
        `<option value="${c}" ${c===selectedCat?'selected':''}>${c}</option>`
    ).join('');
    select.innerHTML = options;
}

/**
 * 处理首页表单提交
 */
function handleHomeFormSubmit() {
    // 收集表单数据
    const amountInput = document.getElementById('home-amount');
    const typeSelect = document.getElementById('home-type');
    const categorySelect = document.getElementById('home-category');
    const noteInput = document.getElementById('home-note');
    
    // 清除之前的错误提示
    clearErrorMessages();
    
    // 字段校验
    let hasError = false;
    const validations = [
        { value: amountInput.value, label: '金额', validator: validateAmount },
        { value: categorySelect.value, label: '分类', validator: validateRequired }
    ];
    
    validations.forEach(({ value, label, validator }) => {
        const result = validator(value, label);
        if (typeof result === 'string') {
            showError(categorySelect, result);
            hasError = true;
        }
    });
    
    if (hasError) return;
    
    // 获取校验通过的数据
    const amount = validateAmount(amountInput.value, '金额');
    const type = typeSelect.value;
    const category = validateRequired(categorySelect.value, '分类');
    const note = noteInput.value.trim();
    const now = new Date();
    
    // 创建账单对象
    const bill = {
        type,
        amount,
        category,
        note,
        date: formatDate(now),
        time: now.toTimeString().split(' ')[0]
    };
    
    // 添加账单
    addBill(bill);
    
    // 更新用户偏好
    appData.settings.lastType = type;
    appData.settings.lastCategory = category;
    saveData();
    
    // 显示成功提示
    showToast('记账成功');
    
    // 可配置：是否清空表单（当前实现连续记账不清空）
    // amountInput.value = '';
    noteInput.value = '';
    
    // 重新渲染首页数据
    renderHome();
}

/**
 * 显示字段错误信息
 * @param {HTMLElement} fieldElement - 表单字段元素
 * @param {string} errorMsg - 错误消息
 */
function showError(fieldElement, errorMsg) {
    const errorDiv = document.getElementById('home-error-msg');
    errorDiv.textContent = errorMsg;
    errorDiv.style.display = 'block';
}

/**
 * 清除所有错误提示
 */
function clearErrorMessages() {
    const errorDiv = document.getElementById('home-error-msg');
    errorDiv.style.display = 'none';
}

// ==================== Category Shortcut Handling ====================
/**
 * 处理快捷分类按钮点击
 * @param {string} category - 分类名称
 */
function handleCategoryShortcut(category) {
    const type = document.getElementById('home-type').value;
    const categorySelect = document.getElementById('home-category');
    
    // 更新下拉框选择
    updateCategoryOptions(category);
    
    // 记忆用户选择
    appData.settings.lastType = type;
    appData.settings.lastCategory = category;
    saveData();
}

// ==================== Chart Rendering ====================
/**
 * 使用Canvas绘制7天趋势图
 */
function renderTrendChart() {
    const canvas = document.getElementById('stats-chart-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const data = getLast7DaysData();
    
    // 设置画布尺寸
    const padding = 40;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 找到最大值用于比例计算
    const maxVal = Math.max(...data.incomes, ...data.expenses, 1);
    const barWidth = (width - padding * 2) / (data.dates.length * 2 - 1);
    const gap = barWidth;
    
    // 绘制坐标轴
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(padding, padding);
    ctx.lineTo(width - padding, padding);
    ctx.strokeStyle = '#8E8E93';
    ctx.stroke();
    
    // 绘制X轴标签
    ctx.fillStyle = '#8E8E93';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    data.dates.forEach((date, i) => {
        const x = padding + i * (barWidth + gap) + barWidth/2;
        ctx.fillText(date, x, height - padding + 15);
    });
    
    // 绘制Y轴标签
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const y = height - padding - i * ((height - padding * 2) / 4);
        const value = roundTo2(maxVal * i / 4);
        ctx.fillText(formatMoney(value).replace('¥',''), padding - 10, y + 4);
    }
    
    // 绘制折线
    const drawLine = (values, color) => {
        ctx.beginPath();
        values.forEach((val, i) => {
            const x = padding + i * (barWidth + gap) + barWidth/2;
            const y = height - padding - (val / maxVal) * (height - padding * 2);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制数据点
        values.forEach((val, i) => {
            const x = padding + i * (barWidth + gap) + barWidth/2;
            const y = height - padding - (val / maxVal) * (height - padding * 2);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });
    };
    
    // 绘制收入线（绿色）
    drawLine(data.incomes, '#34C759');
    
    // 绘制支出线（红色）
    drawLine(data.expenses, '#FF3B30');
    
    // 绘制图例
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    
    // 收入图例
    ctx.fillStyle = '#34C759';
    ctx.fillRect(width - 100, 10, 12, 12);
    ctx.fillStyle = '#000000';
    ctx.fillText('收入', width - 84, 20);
    
    // 支出图例
    ctx.fillStyle = '#FF3B30';
    ctx.fillRect(width - 100, 30, 12, 12);
    ctx.fillStyle = '#000000';
    ctx.fillText('支出', width - 84, 40);
}

// ==================== Data Rendering Functions ====================
/**
 * 渲染所有页面数据
 */
function renderAll() {
    renderHome();
    renderBills();
    renderStats();
    renderSavingsPage();
    renderSettings();
}

/**
 * 渲染首页数据
 */
function renderHome() {
    const now = new Date();
    const stats = getMonthlyStats(now.getFullYear(), now.getMonth() + 1);
    
    document.getElementById('current-month').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
    document.getElementById('home-income').textContent = formatMoney(stats.income);
    document.getElementById('home-expense').textContent = formatMoney(stats.expense);
    
    // 预算状态
    const budgetTotal = appData.budgets.total || 0;
    const budgetEl = document.getElementById('home-budget-status');
    if (budgetTotal > 0) {
        const percent = (stats.expense / budgetTotal) * 100;
        let msg = `预算使用 ${percent.toFixed(1)}%`;
        if (percent >= 100) {
            budgetEl.innerHTML = `<span class="budget-over">⚠️ 已超预算 (${formatMoney(stats.expense)} / ${formatMoney(budgetTotal)})</span>`;
        } else if (percent >= 80) {
            budgetEl.innerHTML = `<span class="budget-warning">⚠️ 预算预警 (${formatMoney(stats.expense)} / ${formatMoney(budgetTotal)})</span>`;
        } else {
            budgetEl.textContent = `预算剩余 ${formatMoney(budgetTotal - stats.expense)}`;
        }
    } else {
        budgetEl.textContent = '';
    }
    
    // 近期账单
    const list = document.getElementById('home-bill-list');
    const recent = appData.bills.slice(0, 5);
    if (recent.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div>暂无账单</div>';
    } else {
        list.innerHTML = recent.map(b => `
            <div class="list-item" onclick="openBillModal('${b.id}')">
                <div style="display:flex; align-items:center;">
                    <div class="item-icon">${CATEGORY_ICONS[b.category] || '📝'}</div>
                    <div>
                        <div class="item-title">${b.category}</div>
                        <div class="item-subtitle">${b.date} ${b.note}</div>
                    </div>
                </div>
                <div class="item-amount ${b.type==='income'?'amount-income':'amount-expense'}">
                    ${b.type==='income'?'+':'-'}${formatMoney(b.amount)}
                </div>
            </div>
        `).join('');
    }
    
    // 恢复上次使用的类型和分类
    const typeSelect = document.getElementById('home-type');
    const categorySelect = document.getElementById('home-category');
    if (typeSelect && categorySelect) {
        typeSelect.value = appData.settings.lastType;
        updateCategoryOptions(appData.settings.lastCategory);
    }
}

/**
 * 渲染账单列表
 */
function renderBills() {
    const list = document.getElementById('bills-list');
    const search = document.getElementById('bill-search')?.value.toLowerCase() || '';
    
    let filtered = appData.bills;
    if (search) {
        filtered = filtered.filter(b => 
            b.category.includes(search) || 
            (b.note && b.note.toLowerCase().includes(search))
        );
    }
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>无账单记录</div>';
        return;
    }
    
    list.innerHTML = filtered.map(b => `
        <div class="list-item" onclick="openBillModal('${b.id}')">
            <div style="display:flex; align-items:center;">
                <div class="item-icon">${CATEGORY_ICONS[b.category] || '📝'}</div>
                <div>
                    <div class="item-title">${b.category}</div>
                    <div class="item-subtitle">${b.date} ${b.note}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div class="item-amount ${b.type==='income'?'amount-income':'amount-expense'}">
                    ${b.type==='income'?'+':'-'}${formatMoney(b.amount)}
                </div>
                <button class="btn btn-sm btn-outline" style="margin-top:4px; border:none; color:#999;" onclick="event.stopPropagation(); deleteBill('${b.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

/**
 * 渲染统计页面
 */
function renderStats() {
    // 本月收支总额已在renderHome中处理
    
    // 分类支出排行
    const now = new Date();
    const stats = getMonthlyStats(now.getFullYear(), now.getMonth() + 1);
    const cats = Object.keys(stats.catStats);
    const maxVal = Math.max(...Object.values(stats.catStats), 1);
    
    const chartHtml = cats.length ? cats.map(cat => {
        const val = stats.catStats[cat];
        const width = (val / maxVal) * 100;
        return `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span>${cat}</span>
                    <span>${formatMoney(val)}</span>
                </div>
                <div style="background:#E5E5EA; height:8px; border-radius:4px; overflow:hidden;">
                    <div style="width:${width}%; background:var(--primary-color); height:100%;"></div>
                </div>
            </div>
        `;
    }).join('') : '<div class="empty-state">暂无数据</div>';
    
    const categoryList = document.getElementById('stats-category-list');
    if (categoryList) {
        categoryList.innerHTML = chartHtml;
    }
    
    // 7天趋势图
    renderTrendChart();
}

/**
 * 渲染存钱页数据
 */
function renderSavingsPage() {
    // 固定支出
    const fixedList = document.getElementById('fixed-list');
    if (appData.fixedExpenses.length === 0) {
        fixedList.innerHTML = '<div class="empty-state" style="padding:20px;">无固定支出</div>';
    } else {
        fixedList.innerHTML = appData.fixedExpenses.map(f => `
            <div class="list-item">
                <div style="flex:1;">
                    <div class="item-title" style="font-size:16px;">${f.name} (${f.cycle})</div>
                    <div class="item-subtitle" style="font-size:14px;">下次: ${f.nextDate}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; margin-bottom:4px;">${formatMoney(f.amount)}</div>
                    <button class="btn btn-sm btn-primary" style="padding:8px 16px;" onclick="logFixedExpense('${f.id}')">记账</button>
                    <button class="btn btn-sm btn-outline" style="border:none;" onclick="confirmDeleteFixed('${f.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    // 心愿清单
    const wishList = document.getElementById('wish-list');
    if (appData.wishes.length === 0) {
        wishList.innerHTML = '<div class="empty-state" style="padding:20px;">无心愿</div>';
    } else {
        wishList.innerHTML = appData.wishes.map(w => {
            const linkedGoal = appData.goals.find(g => g.id === w.linkedGoalId);
            const statusText = linkedGoal ? (linkedGoal.current >= linkedGoal.target ? '已完成' : '存钱中') : '未开始';
            return `
            <div class="list-item">
                <div style="flex:1;">
                    <div class="item-title">${w.name} <span class="priority-badge p-${w.priority}">${w.priority}</span></div>
                    <div class="item-subtitle">目标: ${formatMoney(w.target)} | 状态: ${statusText}</div>
                </div>
                <div>
                    ${linkedGoal ? `<button class="btn btn-sm btn-outline" onclick="openWishBindModal('${w.id}')">更换目标</button>` : `<button class="btn btn-sm btn-primary" onclick="openWishBindModal('${w.id}')">去绑定</button>`}
                    <button class="btn btn-sm btn-outline" style="border:none;" onclick="confirmDeleteWish('${w.id}')">🗑️</button>
                </div>
            </div>
        `}).join('');
    }
    
    // 存钱目标
    const goalList = document.getElementById('goal-list');
    if (appData.goals.length === 0) {
        goalList.innerHTML = '<div class="empty-state" style="padding:20px;">无存钱目标</div>';
    } else {
        goalList.innerHTML = appData.goals.map(g => {
            const percent = Math.min(100, (g.current / g.target) * 100).toFixed(1);
            const isCompleted = g.current >= g.target;
            return `
            <div class="card" style="margin-bottom:12px; padding:16px;">
                <div class="card-header" style="margin-bottom:8px;">
                    <span class="item-title" style="font-size:17px;">${g.name}</span>
                    ${isCompleted ? '<span style="color:var(--success-color); font-size:12px;">已达成</span>' : ''}
                </div>
                <div class="goal-stats">
                    <span>已存: ${formatMoney(g.current)}</span>
                    <span>目标: ${formatMoney(g.target)}</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width:${percent}%"></div>
                </div>
                <div style="text-align:right; margin-bottom:12px; font-size:14px; color:var(--text-secondary);">${percent}%</div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-primary btn-sm" style="flex:1" onclick="openDepositModal('${g.id}')">+ 存入</button>
                    <button class="btn btn-outline btn-sm" style="flex:1" onclick="openGoalRecords('${g.id}')">记录</button>
                    <button class="btn btn-outline btn-sm" onclick="deleteGoal('${g.id}')">删除</button>
                </div>
            </div>
        `}).join('');
    }
}

/**
 * 渲染设置页面
 */
function renderSettings() {
    // 货币符号
    const currencySelect = document.getElementById('setting-currency');
    if (currencySelect) {
        const currencies = ['¥', '$', '€', '£'];
        currencySelect.innerHTML = currencies.map(cur => 
            `<option value="${cur}" ${appData.settings.currency===cur?'selected':''}>${cur}</option>`
        ).join('');
    }
    
    // 主题切换按钮
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = appData.settings.theme === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式';
    }
    
    // 预算设置
    document.getElementById('setting-total-budget').value = appData.budgets.total || '';
    
    const catContainer = document.getElementById('setting-category-budgets');
    const cats = CATEGORIES.expense;
    catContainer.innerHTML = cats.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span>${c}</span>
            <input type="number" class="form-input" style="width:100px; padding:6px;" 
                value="${appData.budgets.categoryBudgets[c] || ''}" 
                placeholder="0" 
                onchange="updateCategoryBudget('${c}', this.value)">
        </div>
    `).join('');
}

// ==================== Settings Page Functions ====================
/**
 * 更新分类预算
 * @param {string} cat - 分类名称
 * @param {string} val - 预算值
 */
function updateCategoryBudget(cat, val) {
    appData.budgets.categoryBudgets[cat] = safeNumber(val);
    saveData();
    renderHome(); // 刷新警告
}

/**
 * 保存总预算设置
 */
function saveBudgetSettings() {
    appData.budgets.total = safeNumber(document.getElementById('setting-total-budget').value);
    saveData();
    renderHome();
    showToast('预算已更新');
}

/**
 * 保存货币符号设置
 */
function saveCurrencySetting() {
    const currency = document.getElementById('setting-currency').value;
    appData.settings.currency = currency;
    saveData();
    renderAll();
    showToast('货币符号已更新');
}

// ==================== Navigation ====================
/**
 * 切换页面
 * @param {string} tabId - 页面ID (home/bills/stats/savings/settings)
 */
function switchTab(tabId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    
    document.getElementById(`page-${tabId}`).classList.add('active');
    
    // 更新底部导航栏激活状态
    const tabs = ['home', 'bills', 'stats', 'savings', 'settings'];
    const idx = tabs.indexOf(tabId);
    if (idx !== -1) {
        document.querySelectorAll('.tab-item')[idx].classList.add('active');
    }
    
    // 更新页面标题
    const titles = { home: '首页', bills: '账单明细', stats: '数据统计', savings: '存钱目标', settings: '设置' };
    document.getElementById('page-title').textContent = titles[tabId];
    
    // 特殊处理：进入统计页时重绘图表
    if (tabId === 'stats') {
        setTimeout(renderTrendChart, 100);
    }
}

// ==================== Initialization ====================
/**
 * 初始化应用
 */
function initApp() {
    // 加载数据
    loadData();
    
    // 初始化模态框关闭事件
    initModalClose();
    
    // 绑定首页表单提交事件
    const form = document.getElementById('home-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleHomeFormSubmit();
        });
    }
    
    // 绑定类型切换事件以更新分类
    const typeSelect = document.getElementById('home-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            updateCategoryOptions();
        });
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initApp);