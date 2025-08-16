// 初始化 Firebase 和 Firestore
const db = firebase.firestore();

// 全局变量
let signaturePad;
let autoSaveTimer;
let isFormDirty = false;
let currentUser = null; // 添加currentUser全局变量

// 监听用户的认证状态
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        // 如果用户未登录，跳转回登录页
        window.location.href = '/index.html';
        return;
    }
    
    // 设置全局currentUser变量
    currentUser = user;
    
    // 用户已登录，初始化页面
    initializePage(user);
});

// 页面初始化
function initializePage(user) {
    document.getElementById('service-date').value = new Date().toISOString().split('T')[0];
    generateReportId();
    autoFillEngineerInfo(user);
    restoreFormData();
    initializeSignaturePad();
    setupFormListeners();
    setupAutoSave();
    // 初始化时根据状态设置签名区显示
    updateSignatureSectionVisibility();
    showMessage(`Welcome back, ${user.email}`, 'info');
}

// 生成自增长的报告ID
async function generateReportId() {
    try {
        const today = new Date();
        const year = today.getFullYear().toString().slice(-2); // 获取年份后两位
        const month = String(today.getMonth() + 1).padStart(2, '0'); // 月份，补零
        const day = String(today.getDate()).padStart(2, '0'); // 日期，补零
        const datePrefix = `${year}${month}${day}`;
        
        // 查询今天已创建的报告数量
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const querySnapshot = await db.collection('reports')
            .where('createdAt', '>=', startOfDay.toISOString())
            .where('createdAt', '<', endOfDay.toISOString())
            .get();
        
        // 计算今天的序号（从1开始）
        const todayCount = querySnapshot.size + 1;
        const sequenceNumber = String(todayCount).padStart(5, '0'); // 5位数字，补零
        
        // 生成完整的ID：YYMMDDNNNNN
        const reportId = `${datePrefix}${sequenceNumber}`;
        
        // 设置到表单字段
        document.getElementById('report-id').value = reportId;
        
    } catch (error) {
        console.error('Failed to generate report ID:', error);
        // 如果出错，使用时间戳作为备选方案
        const fallbackId = `ID${Date.now()}`;
        document.getElementById('report-id').value = fallbackId;
    }
}

// 自动填充工程师信息
async function autoFillEngineerInfo(user) {
    try {
        // 从用户文档中获取详细信息
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // 填充工程师姓名
            if (userData.name && !document.getElementById('engineer-name').value) {
                document.getElementById('engineer-name').value = userData.name;
            }
            
            // 填充工程师电话
            if (userData.phone && !document.getElementById('engineer-phone').value) {
                document.getElementById('engineer-phone').value = userData.phone;
            }
        } else {
            // 如果用户文档不存在，使用邮箱作为工程师姓名
            if (!document.getElementById('engineer-name').value) {
                document.getElementById('engineer-name').value = user.email.split('@')[0];
            }
        }
    } catch (error) {
        console.error('Failed to auto-fill engineer info:', error);
        // 如果出错，使用邮箱作为工程师姓名
        if (!document.getElementById('engineer-name').value) {
            document.getElementById('engineer-name').value = user.email.split('@')[0];
        }
    }
}

// 初始化签名板
function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)'
    });
    
    // 清除签名按钮事件
    document.getElementById('clear-signature').addEventListener('click', () => {
        signaturePad.clear();
        isFormDirty = true;
    });
    
    // 签名板变化事件, 这个需要取消吗?
    /*
    signaturePad.addEventListener('beginStroke', () => {
        isFormDirty = true;
    });
    */
}

// 根据状态显示/隐藏签名区域
function updateSignatureSectionVisibility() {
    const section = document.querySelector('.signature-section');
    const statusEl = document.getElementById('status');
    if (!section || !statusEl) return;
    section.style.display = statusEl.value === 'Completed' ? 'block' : 'none';
}


// 设置表单事件监听
function setupFormListeners() {
    const form = document.getElementById('report-form');
    form.addEventListener('submit', handleFormSubmit);
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('input', () => { isFormDirty = true; });
        input.addEventListener('change', () => { isFormDirty = true; });
    });
    // 状态切换时动态显示/隐藏签名区
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.addEventListener('change', updateSignatureSectionVisibility);
    }
}




// 设置自动保存
function setupAutoSave() {
    // 每30秒自动保存一次
    autoSaveTimer = setInterval(() => {
        if (isFormDirty) {
            saveFormData();
            isFormDirty = false;
        }
    }, 30000);
}

// 保存表单数据到localStorage
function saveFormData() {
    try {
        const formData = {
            taskDescription: document.getElementById('task-description').value,
            serviceDate: document.getElementById('service-date').value,
            engineerName: document.getElementById('engineer-name').value,
            engineerPhone: document.getElementById('engineer-phone').value,
            clientName: document.getElementById('client-name').value,
            clientPhone: document.getElementById('client-phone').value,
            clientEmail: document.getElementById('client-email').value,
            clientAddress: document.getElementById('client-address').value,
            orderNumber: document.getElementById('order-number').value,
            serviceDetails: document.getElementById('service-details').value,
            status: document.getElementById('status').value,
            outstandingIssues: document.getElementById('outstanding-issues').value,
            savedAt: new Date().toISOString()
        };
        
        localStorage.setItem('reportDraft', JSON.stringify(formData));
        console.log('Form data auto-saved');
    } catch (error) {
        console.error('Failed to save form data:', error);
    }
}

// 从localStorage恢复表单数据
function restoreFormData() {
    try {
        const savedData = localStorage.getItem('reportDraft');
        if (savedData) {
            const formData = JSON.parse(savedData);
            
            // 检查保存时间，如果超过24小时则清除
            const savedAt = new Date(formData.savedAt);
            const now = new Date();
            const hoursDiff = (now - savedAt) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                localStorage.removeItem('reportDraft');
                return;
            }
            
            // 恢复表单数据
            Object.keys(formData).forEach(key => {
                if (key !== 'savedAt' && document.getElementById(key)) {
                    document.getElementById(key).value = formData[key];
                }
            });
            
            showMessage('Draft restored from previous session', 'info');
        }
    } catch (error) {
        console.error('Failed to restore form data:', error);
    }
}

// 处理表单提交
async function handleFormSubmit(event) {
    event.preventDefault();
    
    try {
        // 检查currentUser是否存在
        if (!currentUser) {
            showError('User not authenticated. Please refresh the page and try again.');
            return;
        }
        
        // 显示提交状态
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Submitting...</span>';
        submitBtn.disabled = true;
        
        // 获取签名数据，如果没有签名则设置为空字符串
        const signatureData = signaturePad.isEmpty() ? '' : signaturePad.toDataURL();
        
        // 收集表单数据
        const reportData = {
            taskDescription: document.getElementById('task-description').value,
            serviceDate: document.getElementById('service-date').value,
            engineerName: document.getElementById('engineer-name').value,
            engineerPhone: document.getElementById('engineer-phone').value,
            clientName: document.getElementById('client-name').value,
            clientPhone: document.getElementById('client-phone').value,
            clientEmail: document.getElementById('client-email').value,
            clientAddress: document.getElementById('client-address').value,
            orderNumber: document.getElementById('order-number').value,
            serviceDetails: document.getElementById('service-details').value,
            status: document.getElementById('status').value,
            outstandingIssues: document.getElementById('outstanding-issues').value,
            reportId: document.getElementById('report-id').value, // 确保包含自定义reportId
            signature: signatureData, // 使用处理后的签名数据
            timestamp: new Date(),
            createdAt: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        };
        
        // 验证必填字段
        const errors = validateForm(reportData);
        if (errors.length > 0) {
            showError(`Please fill in all required fields: ${errors.join(', ')}`);
            return;
        }
        
        // 保存到数据库
        const docRef = await db.collection('reports').add(reportData);
        
        // 清除本地存储
        localStorage.removeItem('reportDraft');
        
        // 显示成功消息
        showMessage('Service report submitted successfully!', 'success');
        
        // 延迟跳转到历史页面
        setTimeout(() => {
            window.location.href = '/history.html';
        }, 2000);
        
    } catch (error) {
        console.error('Failed to submit report:', error);
        showError(`Failed to submit report: ${error.message}`);
    } finally {
        // 恢复按钮状态
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// 表单验证
function validateForm(formData) {
    const errors = [];
    
    const requiredFields = [
        { field: 'taskDescription', name: 'Task Description' },
        { field: 'serviceDate', name: 'Service Date' },
        { field: 'engineerName', name: 'Engineer Name' },
        { field: 'engineerPhone', name: 'Engineer Phone' },
        { field: 'clientName', name: 'Customer Name' },
        { field: 'orderNumber', name: 'Order Number' },
        { field: 'serviceDetails', name: 'Service Details' },
        { field: 'status', name: 'Service Status' }
    ];
    
    requiredFields.forEach(({ field, name }) => {
        if (!formData[field] || !formData[field].trim()) {
            errors.push(name);
        }
    });
    
    return errors;
}

// 显示消息
function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // 自动隐藏消息
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// 显示错误消息
function showError(message) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = 'message error';
    messageElement.style.display = 'block';
    
    // 自动隐藏消息
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// 显示成功消息
function showSuccessMessage(message) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = 'message success';
    messageElement.style.display = 'block';
    
    // 自动隐藏消息
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// 页面卸载时清理
window.addEventListener('unload', () => {
    // 清除自动保存定时器
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    
    // 保存当前表单数据
    if (isFormDirty) {
        saveFormData();
    }
});