// 初始化 Firebase 和 Firestore
const db = firebase.firestore();

// 全局变量
let currentReport = null;
let currentUser = null;
let isEditMode = false;
let originalFormData = null;
let signaturePad = null; // 添加签名板变量

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取报告ID
    const urlParams = new URLSearchParams(window.location.search);
    const reportId = urlParams.get('id');
    
    if (reportId) {
        // 等待用户认证状态检查完成后再加载报告
        checkAuthAndLoadReport(reportId);
    } else {
        showError('No report ID provided');
    }
});

// 检查认证状态并加载报告
function checkAuthAndLoadReport(reportId) {
    firebase.auth().onAuthStateChanged(user => {
        if (!user) {
            // 用户未登录，跳转回登录页
            window.location.href = '/index.html';
            return;
        }
        
        currentUser = user;
        // 用户已认证，加载报告详情
        loadReportDetails(reportId);
    });
}

// 加载报告详情
async function loadReportDetails(reportId) {
    try {
        console.log('Loading report details for ID:', reportId);
        
        // 首先尝试通过自定义reportId查询
        let reportDoc = null;
        
        // 查询包含该reportId的文档
        const querySnapshot = await firebase.firestore()
            .collection('reports')
            .where('reportId', '==', reportId)
            .limit(1)
            .get();
        
        if (!querySnapshot.empty) {
            // 找到匹配的文档
            reportDoc = querySnapshot.docs[0];
        } else {
            // 如果没有找到，尝试使用文档ID查询（向后兼容）
            reportDoc = await firebase.firestore().collection('reports').doc(reportId).get();
        }
        
        if (reportDoc && reportDoc.exists) {
            const report = { id: reportDoc.id, ...reportDoc.data() };
            currentReport = report;
            
            console.log('Report data loaded:', report);
            
            // 隐藏加载状态
            document.getElementById('loading-container').style.display = 'none';
            
            // 显示报告内容
            document.getElementById('report-content').style.display = 'block';
            
            // 显示报告详情
            displayReportDetails(report);
            
            // 设置操作按钮
            setupActionButtons(report);
        } else {
            showError('Report not found');
        }
    } catch (error) {
        console.error('Error loading report:', error);
        showError('Failed to load report details');
    }
}

// 检查用户权限
function checkUserPermission(report) {
    // 管理员可以查看所有报告
    if (currentUser && currentUser.email) {
        // 这里可以添加管理员检查逻辑
        // 暂时允许所有登录用户查看
        return true;
    }
    
    // 普通用户只能查看自己的报告
    return report.userId === currentUser.uid;
}

// 显示报告详情
function displayReportDetails(report) {
    // 填充基本信息
    fillInputValue('report-id', report.reportId || report.id || 'N/A');
    fillInputValue('task-description', report.taskDescription || 'N/A');
    fillInputValue('service-date', report.serviceDate || 'N/A');
    
    // 填充联系信息
    fillInputValue('client-name', report.clientName || 'N/A');
    fillInputValue('client-phone', report.clientPhone || 'N/A');
    fillInputValue('client-email', report.clientEmail || 'N/A');
    fillInputValue('client-address', report.clientAddress || 'N/A');
    fillInputValue('engineer-name', report.engineerName || 'N/A');
    fillInputValue('engineer-phone', report.engineerPhone || 'N/A');
    
    // 填充服务内容
    fillInputValue('order-number', report.orderNumber || 'N/A');
    fillTextareaValue('service-details', report.serviceDetails || 'N/A');
    fillTextareaValue('outstanding-issues', report.outstandingIssues || 'N/A');
    
    // 填充状态信息
    fillStatusValue(report.status);
    // 显示PDF文件状态
    displayPDFStatus(report.pdfUrl);
    // 显示客户签名
    displaySignature(report.signature);
    updateSignatureSectionVisibility();
    
    // 保存原始数据用于编辑模式
    originalFormData = {
        taskDescription: report.taskDescription || '',
        serviceDate: report.serviceDate || '',
        engineerName: report.engineerName || '',
        engineerPhone: report.engineerPhone || '',
        clientName: report.clientName || '',
        clientPhone: report.clientPhone || '',
        clientEmail: report.clientEmail || '',
        clientAddress: report.clientAddress || '',
        orderNumber: report.orderNumber || '',
        serviceDetails: report.serviceDetails || '',
        status: report.status || '',
        outstandingIssues: report.outstandingIssues || ''
    };
}

// 填充输入框值
function fillInputValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        if (value && value !== 'N/A' && value.trim()) {
            element.value = value;
            element.classList.remove('empty');
        } else {
            element.value = '';
            element.classList.add('empty');
        }
    }
}

// 填充文本域值
function fillTextareaValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        if (value && value !== 'N/A' && value.trim()) {
            element.value = value;
            element.classList.remove('empty');
        } else {
            element.value = '';
            element.classList.add('empty');
        }
    }
}

// 填充状态值
function fillStatusValue(status) {
    const statusSelect = document.getElementById('status');
    if (statusSelect) {
        // 设置选中的状态
        statusSelect.value = status || 'In Progress';
    }
}

// 根据状态显示/隐藏签名区域（详情页）
function updateSignatureSectionVisibility() {
    const section = document.querySelector('.signature-section');
    const statusEl = document.getElementById('status');
    if (!section || !statusEl) return;

    if (statusEl.value === 'Completed') {
        section.style.display = 'block';
        // 显示已有签名或签名板
        displaySignature(currentReport && currentReport.signature ? currentReport.signature : '');
    } else {
        section.style.display = 'none';
    }
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
            return 'Completed';
        case 'Incomplete':
            return 'Incomplete';
        case 'In Progress':
            return 'In Progress';
        default:
            return 'Unknown';
    }
}

// 显示客户签名
function displaySignature(signatureData) {
    const signatureImage = document.getElementById('signature-image');
    const signaturePadCanvas = document.getElementById('signature-pad');
    const signaturePlaceholder = document.getElementById('signature-placeholder');
    const signatureControls = document.querySelector('.signature-controls');
    
    if (signatureData && signatureData.trim()) {
        // 如果有签名数据，显示签名图片
        signatureImage.src = signatureData;
        signatureImage.style.display = 'block';
        // 隐藏签名画布、占位符和控制按钮
        if (signaturePadCanvas) {
            signaturePadCanvas.style.display = 'none';
        }
        if (signaturePlaceholder) {
            signaturePlaceholder.style.display = 'none';
        }
        if (signatureControls) {
            signatureControls.style.display = 'none';
        }
    } else {
        // 如果没有签名数据，显示签名板让用户签字
        signatureImage.style.display = 'none';
        if (signaturePadCanvas) {
            signaturePadCanvas.style.display = 'block';
        }
        if (signaturePlaceholder) {
            signaturePlaceholder.style.display = 'none';
        }
        if (signatureControls) {
            signatureControls.style.display = 'block';
        }
        
        // 初始化签名板
        initializeSignaturePad();
    }
}

// 初始化签名板
function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (canvas && !signaturePad) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
        
        // 清除签名按钮事件
        const clearBtn = document.getElementById('clear-signature');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                signaturePad.clear();
            });
        }
    }
}

// 显示PDF文件状态
function displayPDFStatus(pdfUrl) {
    const pdfFileElement = document.getElementById('pdf-file');
    
    if (pdfFileElement) {
        if (pdfUrl && pdfUrl.trim()) {
            // 如果有PDF URL，显示下载按钮
            pdfFileElement.innerHTML = `
                <a href="${pdfUrl}" target="_blank" class="btn btn-success btn-sm">
                    📄 Download
                </a>
            `;
        } else {
            // 如果没有PDF URL，显示"尚未生成"
            pdfFileElement.innerHTML = '<span style="color: #6b7280; font-style: italic;">Not generated yet</span>';
        }
    }
}

// 设置操作按钮事件

function setupActionButtons(report) {
    const submitBtn = document.getElementById('submit-btn');

    if (report.status === 'Completed') {
        setFormReadonly(true);
        submitBtn.style.display = 'none';
    } else {
        setFormReadonly(false);
        submitBtn.style.display = 'inline-flex';
        submitBtn.addEventListener('click', handleSubmit);
    }

    // 状态变更时动态显示/隐藏签名区
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.addEventListener('change', updateSignatureSectionVisibility);
    }
}



// 设置表单只读状态
function setFormReadonly(readonly) {
    const form = document.getElementById('report-form');
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        if (input.id !== 'status') {
            // 状态选择器总是可编辑的
            input.readOnly = readonly;
            input.disabled = readonly;
        }
    });
    
    // 状态选择器根据只读状态设置
    const statusSelect = document.getElementById('status');
    if (statusSelect) {
        statusSelect.disabled = readonly;
    }
}

// 处理提交
async function handleSubmit() {
    try {
        // 收集表单数据
        const formData = collectFormData();
        
        // 验证必填字段
        const errors = validateForm(formData);
        if (errors.length > 0) {
            showError(`Validation errors: ${errors.join(', ')}`);
            return;
        }
        
        // 显示提交状态
        const submitBtn = document.getElementById('submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Submitting...</span>';
        submitBtn.disabled = true;
        
        // 准备更新数据
        const updateData = {
            ...formData,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByEmail: currentUser.email
        };
        
        // 处理签名数据
        if (signaturePad && !signaturePad.isEmpty()) {
            // 如果有新的签名，使用新签名
            updateData.signature = signaturePad.toDataURL();
        } else if (currentReport.signature) {
            // 如果没有新签名但有原签名，保持原签名
            updateData.signature = currentReport.signature;
        } else {
            // 如果都没有，设置为空
            updateData.signature = '';
        }
        
        // 如果状态变为"Completed"，触发PDF生成和邮件发送
        if (formData.status === 'Completed' && currentReport.status !== 'Completed') {
            updateData.pdfGenerated = false; // 标记需要生成PDF
            updateData.emailSent = false; // 标记需要发送邮件
        }
        
        // 更新数据库
        await db.collection('reports').doc(currentReport.id).update(updateData);
        
        // 更新当前报告数据
        currentReport = { ...currentReport, ...updateData };
        
        showSuccessMessage('Report updated successfully!');
        
        // 如果状态变为"Completed"，显示特殊消息
        if (formData.status === 'Completed' && currentReport.status !== 'Completed') {
            setTimeout(() => {
                showSuccessMessage('Report marked as completed. PDF generation and email sending will be processed.');
            }, 2000);
        }
        
        // 重新设置按钮状态
        setupActionButtons(currentReport);
        
    } catch (error) {
        console.error('Failed to submit changes:', error);
        showError(`Failed to submit changes: ${error.message}`);
    } finally {
        // 恢复按钮状态
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.innerHTML = '<span>Submit Changes</span>';
        submitBtn.disabled = false;
    }
}

// 收集表单数据
function collectFormData() {
    return {
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
        outstandingIssues: document.getElementById('outstanding-issues').value
    };
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
            errors.push(`${name} is required`);
        }
    });
    
    return errors;
}

// 打印报告
function printReport() {
    // 隐藏不需要打印的元素
    const actionsSection = document.querySelector('.actions-section');
    const navLinks = document.querySelector('.nav-links');
    
    if (actionsSection) actionsSection.style.display = 'none';
    if (navLinks) navLinks.style.display = 'none';
    
    // 打印页面
    window.print();
    
    // 恢复显示
    if (actionsSection) actionsSection.style.display = 'flex';
    if (navLinks) navLinks.style.display = 'flex';
}

// 删除报告
async function deleteReport(reportId) {
    try {
        // 首先尝试通过自定义reportId查找文档
        const querySnapshot = await firebase.firestore()
            .collection('reports')
            .where('reportId', '==', reportId)
            .limit(1)
            .get();
        
        let documentId = reportId; // 默认使用传入的ID
        
        if (!querySnapshot.empty) {
            // 找到匹配的文档，使用文档ID删除
            documentId = querySnapshot.docs[0].id;
        }
        
        await db.collection('reports').doc(documentId).delete();
        
        // 显示成功消息
        showSuccessMessage('Report deleted successfully');
        
        // 延迟跳转回历史页面
        setTimeout(() => {
            window.location.href = '/history.html';
        }, 1500);
        
    } catch (error) {
        console.error('Failed to delete report:', error);
        showError(`Failed to delete report: ${error.message}`);
    }
}

// 显示错误信息
function showError(message) {
    document.getElementById('loading-container').style.display = 'none';
    document.getElementById('report-content').style.display = 'none';
    
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
}

// 显示成功消息
function showSuccessMessage(message) {
    // 创建临时成功消息
    const successDiv = document.createElement('div');
    successDiv.className = 'message success';
    successDiv.textContent = message;
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.right = '20px';
    successDiv.style.zIndex = '1000';
    successDiv.style.padding = '1rem 1.5rem';
    successDiv.style.borderRadius = '8px';
    successDiv.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    successDiv.style.backgroundColor = '#10b981';
    successDiv.style.color = 'white';
    
    document.body.appendChild(successDiv);
    
    // 自动移除
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// 页面卸载时清理
window.addEventListener('unload', () => {
    // 清理资源
});
