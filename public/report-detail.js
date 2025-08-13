// 初始化 Firebase 和 Firestore
const db = firebase.firestore();

// 监听用户的认证状态
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = '/index.html';
    } else {
        // 从 URL 中获取报告 ID
        const urlParams = new URLSearchParams(window.location.search);
        const reportId = urlParams.get('id');
        if (reportId) {
            loadReportDetail(reportId, user);
        } else {
            document.getElementById('report-detail').innerHTML = '<p>未找到报告ID。</p>';
        }
    }
});


// ... (之前的代码保持不变)

async function loadReportDetail(reportId, user) {
    const reportDetailContainer = document.getElementById('report-detail');
    try {
        const doc = await db.collection('reports').doc(reportId).get();
        if (!doc.exists) {
            reportDetailContainer.innerHTML = '<p>Report Not Exist</p>';
            return;
        }

        const report = doc.data();
        
        // --- 新增：获取用户角色并检查权限 ---
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userRole = userDoc.exists && userDoc.data().role === 'admin' ? 'admin' : 'engineer';

        // 只有报告创建者或管理员可以查看报告
        if (report.userId !== user.uid && userRole !== 'admin') {
             reportDetailContainer.innerHTML = '<p>Access Limited</p>';
             return;
        }
        
        const downloadLink = report.pdfUrl 
            ? `<a href="${report.pdfUrl}" target="_blank">Download PDF</a>`
            : '<span>PDF正在生成...</span>';

        // ... (其余的渲染代码保持不变)
        reportDetailContainer.innerHTML = `

            <h2>Task Description</h2>
            <div class="field"><strong>Task Description:</strong> ${report.taskDescription || 'N/A'}</div>
            <div class="field"><strong>Service Date:</strong> ${report.serviceDate || 'N/A'}</div>
    

            <h2>Customer</h2>
            <p><strong>name:</strong>${report.clientName}</p>
            <p><strong>Phone:</strong>${report.clientPhone || '无'}</p>
            <p><strong>Email:</strong>${report.clientEmail || '无'}</p>
            <p><strong>Address:</strong>${report.clientAddress || '无'}</p>
            
            <h2>Service Detail</h2>
            <p><strong>Ticket/Invoice</strong>${report.orderNumber}</p>
            <p><strong>Service Content:</strong>${report.serviceDetails}</p>
            <div class="field"><strong>Status:</strong> ${report.status || 'N/A'}</div>
            <div class="field"><strong>Remaining Issues:</strong> ${report.outstandingIssues || 'None'}</div>

            <h2>Customer Acceptance</h2>
            <p>We acknowledge that the service personnel have attended to this job and performed the service described above.</p>
            <img src="${report.signature}" alt="Client Signature" style="max-width: 300px; border: 1px solid #ccc;"/>
  
            <p><strong>提交时间：</strong>${report.timestamp ? new Date(report.timestamp.seconds * 1000).toLocaleString() : '未知'}</p>
            
            <div style="margin-top: 20px;">
                ${downloadLink}
            </div>
        `;
    } catch (error) {
        console.error("error in loading service report:", error);
        reportDetailContainer.innerHTML = `<p>failed in loading service report:${error.message}</p>`;
    }
}
