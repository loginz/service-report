// 初始化 Firebase 和 Firestore
const db = firebase.firestore();




// 新增：初始化 Cloud Functions SDK
const functions = firebase.app().functions('asia-southeast1');

// 监听用户的认证状态
firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = '/index.html';
    } else {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userRole = userDoc.exists && userDoc.data().role === 'admin' ? 'admin' : 'engineer';

        if (userRole === 'admin') {
            // 只有管理员才能访问此页面
            loadUsers();
        } else {
            // 非管理员则跳转回历史页面
            window.location.href = '/history.html';
        }
    }
});

const usersListContainer = document.getElementById('users-list');
const addUserForm = document.getElementById('add-user-form');
const showAddUserBtn = document.getElementById('show-add-user-btn');
const addUserBtn = document.getElementById('add-user-btn');
const newUserEmailInput = document.getElementById('new-user-email');
const newUserPasswordInput = document.getElementById('new-user-password');
const newUserRoleSelect = document.getElementById('new-user-role');
const addUserMessageElement = document.getElementById('add-user-message');
const newUserNameInput = document.getElementById('new-user-name');
const newUserPhoneInput = document.getElementById('new-user-phone');

showAddUserBtn.addEventListener('click', () => {
    addUserForm.style.display = addUserForm.style.display === 'block' ? 'none' : 'block';
});

// 新增：添加新用户的事件监听器
addUserBtn.addEventListener('click', async () => {
  
    const name = newUserNameInput.value;
    const phone = newUserPhoneInput.value;
    const email = newUserEmailInput.value;
    const password = newUserPasswordInput.value;
    const role = newUserRoleSelect.value;

    addUserMessageElement.textContent = ''; // 清空之前的消息

    if (!email || !password) {
        addUserMessageElement.textContent = '邮箱和密码不能为空。';
        return;
    }

    try {

        const createUserFunction = functions.httpsCallable('createUser');
        // 更新调用参数
        const result = await createUserFunction({ name, phone, email, password, role });

        // 更新成功提示
        addUserMessageElement.textContent = `成功创建用户：${result.data.email}，姓名：${result.data.name}，角色：${result.data.role}`;
        addUserMessageElement.style.color = 'green';

        // 清空表单
        newUserNameInput.value = '';
        newUserPhoneInput.value = '';
        newUserEmailInput.value = '';
        newUserPasswordInput.value = '';


        // 重新加载用户列表，以显示新添加的用户
        loadUsers();

    } catch (error) {
        console.error("创建用户时出错:", error);
        addUserMessageElement.textContent = `创建用户失败：${error.message}`;
        addUserMessageElement.style.color = 'red';
    }
});



async function loadUsers() {
    usersListContainer.innerHTML = '<p>正在加载用户列表...</p>';
    try {
        const listUsersFunction = functions.httpsCallable('listUsers');
        
        const result = await listUsersFunction();
        
        // Add a safety check here to ensure data exists
        if (!result.data || !result.data.users) {
            usersListContainer.innerHTML = '<p>用户列表加载失败，请重试。</p>';
            console.error("Cloud Function returned no user data.");
            return;
        }

        const users = result.data.users;

        if (users.length === 0) {
            usersListContainer.innerHTML = '<p>没有找到任何用户。</p>';
            return;
        }

        usersListContainer.innerHTML = '';

        users.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.innerHTML = `
                <div class="user-info">
                    <strong>姓名:</strong> ${user.name || '未设置'} <br>
                    <strong>邮箱:</strong> ${user.email}
                </div>
                <div class="user-actions">
                    <button onclick="resetPassword('${user.uid}')">重置密码</button>
                    <button onclick="deleteUser('${user.uid}')">删除</button>
                </div>
            `;
            usersListContainer.appendChild(userCard);
        });


    } catch (error) {
        console.error("加载用户列表时出错:", error);
        usersListContainer.innerHTML = `<p>加载用户列表失败：${error.message}</p>`;
    }
}

const resetPasswordFunction = functions.httpsCallable('resetUserPassword');

async function resetPassword(uid) {
    const newPassword = prompt("New Password (at least 6 chars):");
    if (!newPassword || newPassword.length < 6) {
        alert("密码必须至少为6位。");
        return;
    }

    if (confirm(`Confirm reset password for ${uid}？`)) {
        try {
            await resetPasswordFunction({ uid, newPassword });
            alert("密码重置成功！");
        } catch (error) {
            console.error("重置密码时出错:", error);
            alert(`重置密码失败：${error.message}`);
        }
    }
}

const deleteUserFunction = functions.httpsCallable('deleteUser');

async function deleteUser(uid) {
    if (confirm("确定要删除此用户吗？此操作不可逆！")) {
        try {
            await deleteUserFunction({ uid });
            alert("用户删除成功！");
            // 重新加载用户列表
            loadUsers();
        } catch (error) {
            console.error("删除用户时出错:", error);
            alert(`删除用户失败：${error.message}`);
        }
    }
}