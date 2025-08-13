// 初始化 Firebase 和 Firestore
const db = firebase.firestore();

// 全局变量
let signaturePad;
let autoSaveTimer;
let isFormDirty = false;

// 监听用户的认证状态
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        // 如果用户未登录，跳转回登录页
        window.location.href = '/index.html';
        return;
    }
    
    // 用户已登录，初始化页面
    initializePage(user);
});

// 页面初始化
function initializePage(user) {
    // 设置默认日期为今天
    document.getElementById('service-date').value = new Date().toISOString().split('T')[0];
    
    // 尝试从localStorage恢复表单数据
    restoreFormData();
    
    // 初始化签名板
    initializeSignaturePad();
    
    // 设置表单事件监听
    setupFormListeners();
    
    // 设置自动保存
    setupAutoSave();
    
    // 显示欢迎信息
    showMessage(`欢迎回来，${user.email}`, 'info');
}

// 初始化签名板
function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
        minWidth: 1,
        maxWidth: 2.5
    });
    
    // 清除签名按钮
    document.getElementById('clear-signature').addEventListener('click', () => {
        signaturePad.clear();
        markFormDirty();
    });
    
    // 签名变化时标记表单为脏状态
    signaturePad.addEventListener('endStroke', () => {
        markFormDirty();
    });
}

// 设置表单事件监听
function setupFormListeners() {
    const form = document.getElementById('report-form');
    const inputs = form.querySelectorAll('input, textarea, select');
    
    // 监听所有输入变化
    inputs.forEach(input => {
        input.addEventListener('input', () => markFormDirty());
        input.addEventListener('change', () => markFormDirty());
    });
    
    // 表单提交
    form.addEventListener('submit', handleFormSubmit);
    
    // 页面离开前提醒保存
    window.addEventListener('beforeunload', (e) => {
        if (isFormDirty) {
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
        }
    });
}

// 设置自动保存
function setupAutoSave() {
    // 每30秒自动保存一次
    autoSaveTimer = setInterval(() => {
        if (isFormDirty) {
            autoSaveForm();
        }
    }, 30000);
}

// 标记表单为脏状态
function markFormDirty() {
    isFormDirty = true;
    // 可以在这里添加视觉提示，比如改变保存按钮的颜色
}

// 自动保存表单
async function autoSaveForm() {
    try {
        const formData = collectFormData();
        if (formData && !signaturePad.isEmpty()) {
            localStorage.setItem('reportDraft', JSON.stringify(formData));
            console.log('表单已自动保存');
        }
    } catch (error) {
        console.error('自动保存失败:', error);
    }
}

// 恢复表单数据
function restoreFormData() {
    try {
        const savedData = localStorage.getItem('reportDraft');
        if (savedData) {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(key => {
                const element = document.getElementById(key);
                if (element && key !== 'signature') {
                    element.value = data[key];
                }
            });
            showMessage('已恢复上次未完成的表单数据', 'info');
        }
    } catch (error) {
        console.error('恢复表单数据失败:', error);
    }
}

// 收集表单数据
function collectFormData() {
    const formData = {
        taskDescription: document.getElementById('task-description').value,
        engineerName: document.getElementById('engineer-name').value,
        engineerPhone: document.getElementById('engineer-phone').value,
        clientName: document.getElementById('client-name').value,
        clientPhone: document.getElementById('client-phone').value,
        clientEmail: document.getElementById('client-email').value,
        clientAddress: document.getElementById('client-address').value,
        orderNumber: document.getElementById('order-number').value,
        serviceDetails: document.getElementById('service-details').value,
        serviceDate: document.getElementById('service-date').value,
        status: document.getElementById('status').value,
        outstandingIssues: document.getElementById('outstanding-issues').value,
        signature: signaturePad.toDataURL()
    };
    
    return formData;
}

// 表单验证
function validateForm() {
    const errors = [];
    
    // 必填字段验证
    const requiredFields = [
        { id: 'task-description', name: '任务描述' },
        { id: 'engineer-name', name: '工程师姓名' },
        { id: 'engineer-phone', name: '工程师电话' },
        { id: 'client-name', name: '客户姓名' },
        { id: 'order-number', name: '工单号' },
        { id: 'service-details', name: '服务详情' },
        { id: 'service-date', name: '服务日期' },
        { id: 'status', name: '服务状态' }
    ];
    
    requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element.value.trim()) {
            errors.push(`${field.name}不能为空`);
            element.classList.add('error');
        } else {
            element.classList.remove('error');
        }
    });
    
    // 签名验证
    if (signaturePad.isEmpty()) {
        errors.push('客户签名不能为空');
    }
    
    // 电话格式验证
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    const engineerPhone = document.getElementById('engineer-phone').value;
    const clientPhone = document.getElementById('client-phone').value;
    
    if (engineerPhone && !phoneRegex.test(engineerPhone)) {
        errors.push('工程师电话格式不正确');
    }
    
    if (clientPhone && !phoneRegex.test(clientPhone)) {
        errors.push('客户电话格式不正确');
    }
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const clientEmail = document.getElementById('client-email').value;
    
    if (clientEmail && !emailRegex.test(clientEmail)) {
        errors.push('客户邮箱格式不正确');
    }
    
    return errors;
}

// 处理表单提交
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const user = firebase.auth().currentUser;
    if (!user) {
        showMessage('您还未登录，请先登录！', 'error');
        return;
    }
    
    // 表单验证
    const errors = validateForm();
    if (errors.length > 0) {
        showMessage(`表单验证失败：${errors.join('，')}`, 'error');
        return;
    }
    
    // 显示加载状态
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>提交中...</span>';
    submitBtn.disabled = true;
    
    try {
        const formData = collectFormData();
        
        // 添加额外字段
        const reportData = {
            ...formData,
            userId: user.uid,
            userEmail: user.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString(),
            status: 'submitted'
        };
        
        // 保存到Firestore
        const docRef = await db.collection('reports').add(reportData);
        
        // 清除本地草稿
        localStorage.removeItem('reportDraft');
        isFormDirty = false;
        
        // 显示成功消息
        showMessage('服务报告提交成功！', 'success');
        
        // 重置表单
        setTimeout(() => {
            resetForm();
            // 跳转到历史页面
            window.location.href = '/history.html';
        }, 2000);
        
    } catch (error) {
        console.error("提交报告时出错: ", error);
        showMessage(`提交报告失败：${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// 重置表单
function resetForm() {
    document.getElementById('report-form').reset();
    signaturePad.clear();
    document.getElementById('service-date').value = new Date().toISOString().split('T')[0];
    isFormDirty = false;
}

// 显示消息
function showMessage(message, type = 'info') {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    
    // 自动隐藏消息
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// 页面卸载时清理
window.addEventListener('unload', () => {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
});