const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getStorage } = require('firebase-admin/storage');
const { initializeApp } = require('firebase-admin/app');
const puppeteer = require('puppeteer-core'); // Use puppeteer-core
const chromium = require('@sparticuz/chromium'); // Use the serverless chromium
const logger = require("firebase-functions/logger");
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { onCall } = require('firebase-functions/v2/https');
const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
initializeApp();
const db = require('firebase-admin/firestore').getFirestore();
const storage = getStorage();

// 修改原有的PDF生成函数，只在状态为Completed时触发
exports.generateReportPDF = onDocumentCreated({
    document: 'reports/{reportId}',
    region: 'asia-southeast1',
    timeoutSeconds: 540,
    memory: '2GiB'
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        logger.info("No data associated with the event.");
        return;
    }
    
    const reportData = snap.data();
    const documentId = snap.id;
    
    // 使用自定义的reportId而不是文档ID
    const reportId = reportData.reportId || documentId;
    
    // 只有当状态为"Completed"时才生成PDF和发送邮件
    if (reportData.status !== 'Completed') {
        logger.info(`Report ${reportId} status is not 'Completed', skipping PDF generation.`);
        return;
    }
    
    await generatePDFAndSendEmail(reportData, reportId, documentId);
});

// 新增：处理报告更新时的PDF生成
exports.handleReportUpdate = onDocumentUpdated({
    document: 'reports/{reportId}',
    region: 'asia-southeast1',
    timeoutSeconds: 540,
    memory: '2GiB'
}, async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const documentId = event.data.after.id;
    
    // 使用自定义的reportId
    const reportId = afterData.reportId || documentId;
    
    // 检查状态是否从非"Completed"变为"Completed"
    const wasCompleted = beforeData.status === 'Completed';
    const isNowCompleted = afterData.status === 'Completed';
    
    // 如果状态变为"Completed"且之前没有PDF，则生成PDF
    if (!wasCompleted && isNowCompleted && !afterData.pdfUrl) {
        logger.info(`Report ${reportId} status changed to 'Completed', generating PDF...`);
        await generatePDFAndSendEmail(afterData, reportId, documentId);
    }
});

// 提取PDF生成和邮件发送的公共函数
async function generatePDFAndSendEmail(reportData, reportId, documentId) {
    const bucketName = storage.app.options.storageBucket;
    const bucket = storage.bucket(bucketName);
    
    logger.info(`Generating PDF for ${reportId}...`, { reportData });
    
    try {
        const browser = await puppeteer.launch({
            args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        // 读取模板文件
        const templatePath = path.join(__dirname, 'template.hbs');
        const templateHtml = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateHtml);

        const page = await browser.newPage();

        // 渲染数据到模板，使用自定义reportId
        const htmlContent = template({
            reportId: reportId, // 使用完整的自定义reportId
            engineerName: reportData.engineerName,
            engineerPhone: reportData.engineerPhone,
            clientName: reportData.clientName,
            clientPhone: reportData.clientPhone || 'N/A',
            clientEmail: reportData.clientEmail || 'N/A',
            clientAddress: reportData.clientAddress || 'N/A',
            orderNumber: reportData.orderNumber,
            serviceDetails: reportData.serviceDetails,
            taskDescription: reportData.taskDescription,
            serviceDate: reportData.serviceDate,
            status: reportData.status,
            outstandingIssues: reportData.outstandingIssues,
            signature: reportData.signature,
            timestamp: new Date(reportData.timestamp.seconds * 1000).toLocaleString(),
            signDate: new Date(reportData.timestamp.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            company: {
                name: 'Hilife Interactive Pte. Ltd.',
                address1: '33 Ubi Avenue 3 #08-18 Vertex Tower B Singapore 408868',
                tel: '(65) 62830326',
                email: 'cs@hilife.sg',
                logoUrl: 'https://www.hilife.sg/images/logo.png'
            }
        });
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            scale: 0.98
        });
        await browser.close();
        
        // 使用自定义reportId作为文件名
        const file = bucket.file(`service_reports/${reportId}.pdf`);
        await file.save(pdfBuffer, { contentType: 'application/pdf' });
        logger.info(`PDF file ${reportId}.pdf successfully uploaded to Cloud Storage.`);
        
        const pdfUrl = `https://storage.googleapis.com/${bucketName}/service_reports/${reportId}.pdf`;
        // 使用文档ID更新数据库
        await db.collection('reports').doc(documentId).update({ 
            pdfUrl: pdfUrl,
            pdfGenerated: true,
            pdfGeneratedAt: new Date().toISOString()
        });
        
        // 发送邮件通知
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_EMAIL,
                pass: process.env.GMAIL_PASSWORD
            }
        });

        // 准备邮件收件人列表
        const recipients = [process.env.BACKUP_EMAIL]; // 总是发送给公司邮箱
        
        // 如果有客户邮箱，也添加到收件人列表
        if (reportData.clientEmail) {
            recipients.push(reportData.clientEmail);
        }

        const mailOptions = {
            from: process.env.GMAIL_EMAIL,
            to: recipients.join(', '),
            subject: `Service Report #${reportId} - ${reportData.status}`,
            html: `
                <p>Dear Customer,</p>
                <p>Your service report has been completed and is ready for download.</p>
                <p><strong>Report Details:</strong></p>
                <ul>
                    <li><strong>Report ID:</strong> ${reportId}</li>
                    <li><strong>Customer:</strong> ${reportData.clientName}</li>
                    <li><strong>Engineer:</strong> ${reportData.engineerName}</li>
                    <li><strong>Service Date:</strong> ${reportData.serviceDate}</li>
                    <li><strong>Status:</strong> ${reportData.status}</li>
                </ul>
                <p>You can download the report using the link below:</p>
                <a href="${pdfUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 16px 0;">Download Service Report</a>
                <p>If you have any questions, please contact us at cs@hilife.sg</p>
                <p>Best regards,<br>Hilife Interactive Pte. Ltd.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        logger.info('Email successfully sent to recipients.');
        
        // 更新邮件发送状态
        await db.collection('reports').doc(documentId).update({ 
            emailSent: true,
            emailSentAt: new Date().toISOString(),
            emailRecipients: recipients
        });

        return { success: true, pdfUrl: pdfUrl };
    } catch (error) {
        logger.error(`Error generating PDF: ${error.message}`, error);
        await db.collection('reports').doc(documentId).update({ 
            pdfError: error.message,
            pdfGenerated: false
        });
        return { success: false, error: error.message };
    }
}


exports.listUsers = onCall({region: 'asia-southeast1'},async (request) => {
    // 验证用户是否已认证
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    
    // 获取用户角色，检查是否是管理员
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only administrators can list users.');
    }
    
    const listUsersResult = await admin.auth().listUsers();
    // 我们从 Firestore 获取每个用户的姓名
    const users = await Promise.all(listUsersResult.users.map(async userRecord => {
        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        const userData = userDoc.data() || {};
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            name: userData.name || userRecord.displayName || '未设置', // 优先从 Firestore 获取姓名
            role: userData.role || '未设置'
        };
    }));

    return { users };
});



// 新增：可调用函数，用于创建新用户
exports.createUser = onCall({
    region: 'asia-southeast1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only administrators can create users.');
    }

    const { name, phone, email, password, role } = request.data;
    if (!name || !email || !password || !role) {
        throw new HttpsError('invalid-argument', 'The function must be called with name, email, password, and role.');
    }

    const newUser = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: name, // 也可以在 Firebase Auth 中保存姓名
        emailVerified: false,
        disabled: false
    });

    // 在 Firestore 中为新用户创建文档，并保存角色、姓名和手机号
    await db.collection('users').doc(newUser.uid).set({
        name: name,
        phone: phone || '', // 如果手机号为空，则保存为空字符串
        role: role
    });

    return { uid: newUser.uid, email: newUser.email, name: name, role: role };
});


// 新增：可调用函数，用于重置用户密码
exports.resetUserPassword = onCall({
    region: 'asia-southeast1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only administrators can reset user passwords.');
    }

    const { uid, newPassword } = request.data;
    if (!uid || !newPassword) {
        throw new HttpsError('invalid-argument', 'The function must be called with a user UID and a new password.');
    }

    try {
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        return { success: true };
    } catch (error) {
        throw new HttpsError('internal', 'Failed to reset user password.', error);
    }
});

// 新增：可调用函数，用于删除用户
exports.deleteUser = onCall({
    region: 'asia-southeast1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only administrators can delete users.');
    }

    const { uid } = request.data;
    if (!uid) {
        throw new HttpsError('invalid-argument', 'The function must be called with a user UID.');
    }

    try {
        // 首先，删除 Firestore 中的用户角色文档
        await db.collection('users').doc(uid).delete();
        // 然后，删除 Firebase Authentication 中的用户
        await admin.auth().deleteUser(uid);

        return { success: true };
    } catch (error) {
        throw new HttpsError('internal', 'Failed to delete user.', error);
    }
});

