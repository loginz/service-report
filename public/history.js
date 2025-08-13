// 初始化 Firebase 和 Firestore
const db = firebase.firestore();

// 全局变量
let currentUser = null;
let userRole = 'engineer';
let allReports = [];
let filteredReports = [];
let currentView = 'grid';
let lastDoc = null;
const pageSize = 20;

// 监听用户的认证状态
firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    
    currentUser = user;
    
    // 查询用户角色
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
            userRole = 'admin';
        }
    } catch (error) {
        console.error('获取用户角色失败:', error);
    }
    
    // 初始化页面
    initializePage();
});

// 页面初始化
function initializePage() {
    // 设置导航链接
    setupNavigation();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 加载报告数据
    loadReports();
    
    // 加载统计信息
    loadStatistics();
}

// 设置导航链接
function setupNavigation() {
    const navLinks = document.getElementById('nav-links');
    navLinks.innerHTML = '';
    
    // 新建报告链接
    const newReportLink = document.createElement('a');
    newReportLink.href = 'report.html';
    newReportLink.className = 'btn btn-primary';
    newReportLink.innerHTML = '<span>填写新报告</span>';
    navLinks.appendChild(newReportLink);
    
    // 管理员功能
    if (userRole === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = 'user-management.html';
        adminLink.className = 'btn btn-outline';
        adminLink.innerHTML = '<span>用户管理</span>';
        navLinks.appendChild(adminLink);
    }
    
    // 登出按钮
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-outline';
    logoutBtn.innerHTML = '<span>退出登录</span>';
    logoutBtn.onclick = () => firebase.auth().signOut();
    navLinks.appendChild(logoutBtn);
}

// 设置事件监听器
function setupEventListeners() {
    // 搜索输入
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // 状态筛选
    const statusFilter = document.getElementById('status-filter');
    statusFilter.addEventListener('change', handleFilter);
    
    // 日期筛选
    const dateFilter = document.getElementById('date-filter');
    dateFilter.addEventListener('change', handleFilter);
    
    // 清除筛选
    const clearFiltersBtn = document.getElementById('clear-filters');
    clearFiltersBtn.addEventListener('click', clearFilters);
    
    // 导出数据
    const exportBtn = document.getElementById('export-data');
    exportBtn.addEventListener('click', exportData);
    
    // 视图切换
    const gridViewBtn = document.getElementById('grid-view');
    const listViewBtn = document.getElementById('list-view');
    
    gridViewBtn.addEventListener('click', () => switchView('grid'));
    listViewBtn.addEventListener('click', () => switchView('list'));
    
    // 加载更多
    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.addEventListener('click', loadMoreReports);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 加载报告数据
async function loadReports() {
    const reportsList = document.getElementById('reports-list');
    reportsList.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        let query;
        if (userRole === 'admin') {
            // 管理员可以查看所有报告
            query = db.collection('reports')
                       .orderBy('timestamp', 'desc')
                       .limit(pageSize);
        } else {
            // 普通用户只能查看自己的报告
            query = db.collection('reports')
                       .where('userId', '==', currentUser.uid)
                       .orderBy('timestamp', 'desc')
                       .limit(pageSize);
        }
        
        const querySnapshot = await query.get();
        
        if (querySnapshot.empty) {
            reportsList.innerHTML = '<div class="no-data">暂无报告数据</div>';
            return;
        }
        
        // 保存最后一个文档用于分页
        lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // 处理数据
        allReports = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // 应用筛选
        applyFilters();
        
        // 显示加载更多按钮
        if (querySnapshot.docs.length === pageSize) {
            document.getElementById('load-more-section').style.display = 'block';
        }
        
    } catch (error) {
        console.error("加载报告时出错: ", error);
        reportsList.innerHTML = `<div class="message error">加载报告失败：${error.message}</div>`;
    }
}

// 加载更多报告
async function loadMoreReports() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.innerHTML = '<span>加载中...</span>';
    loadMoreBtn.disabled = true;
    
    try {
        let query;
        if (userRole === 'admin') {
            query = db.collection('reports')
                       .orderBy('timestamp', 'desc')
                       .startAfter(lastDoc)
                       .limit(pageSize);
        } else {
            query = db.collection('reports')
                       .where('userId', '==', currentUser.uid)
                       .orderBy('timestamp', 'desc')
                       .startAfter(lastDoc)
                       .limit(pageSize);
        }
        
        const querySnapshot = await query.get();
        
        if (querySnapshot.empty) {
            document.getElementById('load-more-section').style.display = 'none';
            return;
        }
        
        // 更新最后一个文档
        lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // 添加新数据
        const newReports = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        allReports = [...allReports, ...newReports];
        
        // 应用筛选
        applyFilters();
        
        // 如果数据不足一页，隐藏加载更多按钮
        if (querySnapshot.docs.length < pageSize) {
            document.getElementById('load-more-section').style.display = 'none';
        }
        
    } catch (error) {
        console.error("加载更多报告时出错: ", error);
        showMessage(`加载更多报告失败：${error.message}`, 'error');
    } finally {
        loadMoreBtn.innerHTML = '<span>加载更多</span>';
        loadMoreBtn.disabled = false;
    }
}

// 处理搜索
function handleSearch() {
    applyFilters();
}

// 处理筛选
function handleFilter() {
    applyFilters();
}

// 应用筛选
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    const dateFilter = document.getElementById('date-filter').value;
    
    filteredReports = allReports.filter(report => {
        // 搜索筛选
        const matchesSearch = !searchTerm || 
            report.clientName?.toLowerCase().includes(searchTerm) ||
            report.engineerName?.toLowerCase().includes(searchTerm) ||
            report.orderNumber?.toLowerCase().includes(searchTerm);
        
        // 状态筛选
        const matchesStatus = !statusFilter || report.status === statusFilter;
        
        // 日期筛选
        const matchesDate = !dateFilter || matchesDateFilter(report, dateFilter);
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    // 显示筛选后的报告
    displayReports(filteredReports);
    
    // 更新统计信息
    updateFilteredStats();
}

// 日期筛选匹配
function matchesDateFilter(report, dateFilter) {
    if (!report.timestamp) return false;
    
    const reportDate = new Date(report.timestamp.seconds * 1000);
    const now = new Date();
    
    switch (dateFilter) {
        case 'today':
            return reportDate.toDateString() === now.toDateString();
        case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return reportDate >= weekAgo;
        case 'month':
            return reportDate.getMonth() === now.getMonth() && 
                   reportDate.getFullYear() === now.getFullYear();
        case 'quarter':
            const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            return reportDate >= quarterStart;
        default:
            return true;
    }
}

// 清除筛选
function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('date-filter').value = '';
    
    filteredReports = [...allReports];
    displayReports(filteredReports);
    updateFilteredStats();
}

// 显示报告
function displayReports(reports) {
    const reportsList = document.getElementById('reports-list');
    
    if (reports.length === 0) {
        reportsList.innerHTML = '<div class="no-data">没有找到匹配的报告</div>';
        return;
    }
    
    reportsList.innerHTML = '';
    
    reports.forEach(report => {
        const reportCard = createReportCard(report);
        reportsList.appendChild(reportCard);
    });
}

// 创建报告卡片
function createReportCard(report) {
    const reportCard = document.createElement('div');
    reportCard.className = 'report-card fade-in';
    reportCard.addEventListener('click', () => {
        window.location.href = `report-detail.html?id=${report.id}`;
    });
    
    const timestamp = report.timestamp ? 
        new Date(report.timestamp.seconds * 1000).toLocaleString('zh-CN') : 
        '未知时间';
    
    const statusClass = getStatusClass(report.status);
    const statusText = getStatusText(report.status);
    
    reportCard.innerHTML = `
        <div class="card-header">
            <h3>报告 #${report.id.substring(0, 8)}</h3>
            <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="card-content">
            <p><strong>客户：</strong> ${report.clientName || '未填写'}</p>
            <p><strong>工程师：</strong> ${report.engineerName || '未填写'}</p>
            <p><strong>工单号：</strong> ${report.orderNumber || '未填写'}</p>
            <p><strong>服务日期：</strong> ${report.serviceDate || '未填写'}</p>
            <p><strong>提交时间：</strong> ${timestamp}</p>
        </div>
    `;
    
    return reportCard;
}

// 获取状态样式类
function getStatusClass(status) {
    switch (status) {
        case 'Completed':
            return 'status-completed';
        case 'Incomplete':
            return 'status-incomplete';
        case 'In Progress':
            return 'status-in-progress';
        default:
            return 'status-unknown';
    }
}

// 获取状态文本
function getStatusText(status) {
    switch (status) {
        case 'Completed':
            return '已完成';
        case 'Incomplete':
            return '未完成';
        case 'In Progress':
            return '进行中';
        default:
            return '未知';
    }
}

// 切换视图
function switchView(view) {
    currentView = view;
    
    const reportsList = document.getElementById('reports-list');
    const gridViewBtn = document.getElementById('grid-view');
    const listViewBtn = document.getElementById('list-view');
    
    if (view === 'grid') {
        reportsList.classList.remove('list-view');
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    } else {
        reportsList.classList.add('list-view');
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    }
}

// 加载统计信息
async function loadStatistics() {
    try {
        let query;
        if (userRole === 'admin') {
            query = db.collection('reports');
        } else {
            query = db.collection('reports').where('userId', '==', currentUser.uid);
        }
        
        const querySnapshot = await query.get();
        const reports = querySnapshot.docs.map(doc => doc.data());
        
        updateStats(reports);
        
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 更新统计信息
function updateStats(reports) {
    const total = reports.length;
    const completed = reports.filter(r => r.status === 'Completed').length;
    const pending = reports.filter(r => r.status !== 'Completed').length;
    
    // 本月新增
    const now = new Date();
    const thisMonth = reports.filter(r => {
        if (!r.timestamp) return false;
        const reportDate = new Date(r.timestamp.seconds * 1000);
        return reportDate.getMonth() === now.getMonth() && 
               reportDate.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('total-reports').textContent = total;
    document.getElementById('completed-reports').textContent = completed;
    document.getElementById('pending-reports').textContent = pending;
    document.getElementById('this-month').textContent = thisMonth;
}

// 更新筛选后的统计
function updateFilteredStats() {
    const total = filteredReports.length;
    const completed = filteredReports.filter(r => r.status === 'Completed').length;
    const pending = filteredReports.filter(r => r.status !== 'Completed').length;
    
    // 本月新增（筛选后）
    const now = new Date();
    const thisMonth = filteredReports.filter(r => {
        if (!r.timestamp) return false;
        const reportDate = new Date(r.timestamp.seconds * 1000);
        return reportDate.getMonth() === now.getMonth() && 
               reportDate.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('total-reports').textContent = total;
    document.getElementById('completed-reports').textContent = completed;
    document.getElementById('pending-reports').textContent = pending;
    document.getElementById('this-month').textContent = thisMonth;
}

// 导出数据
function exportData() {
    if (filteredReports.length === 0) {
        showMessage('没有数据可导出', 'info');
        return;
    }
    
    try {
        const csvContent = generateCSV(filteredReports);
        downloadCSV(csvContent, `服务报告_${new Date().toISOString().split('T')[0]}.csv`);
        showMessage('数据导出成功', 'success');
    } catch (error) {
        console.error('导出数据失败:', error);
        showMessage('导出数据失败', 'error');
    }
}

// 生成CSV内容
function generateCSV(reports) {
    const headers = [
        '报告ID', '客户姓名', '工程师姓名', '工单号', '服务日期', 
        '状态', '任务描述', '服务详情', '提交时间'
    ];
    
    const rows = reports.map(report => [
        report.id,
        report.clientName || '',
        report.engineerName || '',
        report.orderNumber || '',
        report.serviceDate || '',
        getStatusText(report.status) || '',
        report.taskDescription || '',
        report.serviceDetails || '',
        report.timestamp ? new Date(report.timestamp.seconds * 1000).toLocaleString('zh-CN') : ''
    ]);
    
    return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
}

// 下载CSV文件
function downloadCSV(content, filename) {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// 显示消息
function showMessage(message, type = 'info') {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}