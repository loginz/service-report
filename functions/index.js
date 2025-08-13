const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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
    const reportId = snap.id;
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

        // 渲染数据到模板
        const htmlContent = template({
            reportId: reportId.substring(0, 8),
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
        const pdfBuffer = await page.pdf({ format: 'A4' ,
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            scale: 0.98 // 如需兜底可调 0.95-0.99
        });
        await browser.close();
        const file = bucket.file(`service_reports/${reportId}.pdf`);
        await file.save(pdfBuffer, { contentType: 'application/pdf' });
        logger.info(`PDF 文件 ${reportId}.pdf 已成功上传到 Cloud Storage。`);
        const pdfUrl = `https://storage.googleapis.com/${bucketName}/service_reports/${reportId}.pdf`;
        await db.collection('reports').doc(reportId).update({ pdfUrl: pdfUrl });
        
        // --- 新增：发送邮件通知 ---
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_EMAIL,
                pass: process.env.GMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.GMAIL_EMAIL,
            to: reportData.clientEmail, // 发送给客户
            subject: `服务报告 #${reportId.substring(0, 8)}`,
            html: `<p>亲爱的客户，您的服务报告已生成。您可以点击以下链接查看或下载：</p>
                <a href="${pdfUrl}">下载服务报告</a>`,
            attachments: [{
                filename: `服务报告-${reportId.substring(0, 8)}.pdf`,
                path: pdfUrl
            }]
        };

        await transporter.sendMail(mailOptions);
        logger.info('邮件已成功发送给客户。');


        return { success: true, pdfUrl: pdfUrl };
    } catch (error) {
        logger.error(`生成 PDF 时出错: ${error.message}`, error);
        await db.collection('reports').doc(reportId).update({ pdfError: error.message });
        return { success: false, error: error.message };
    }
});



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

