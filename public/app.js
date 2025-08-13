// 获取 DOM 元素
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const loginText = document.getElementById('login-text');
const loginLoading = document.getElementById('login-loading');

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已经登录
    checkAuthState();
    
    // 设置表单事件监听
    setupFormListeners();
    
    // 自动聚焦到邮箱输入框
    emailInput.focus();
});

// 检查认证状态
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        // 用户已登录，跳转到历史页面
        console.log('用户已登录:', user.email);
        redirectToHistory();
    }
});

// 设置表单事件监听
function setupFormListeners() {
    // 表单提交
    loginForm.addEventListener('submit', handleLogin);
    
    // 输入框回车键登录
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
    
    // 输入时清除错误信息
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('input', () => {
            clearError();
            input.classList.remove('error');
        });
    });
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    // 清除之前的错误信息
    clearError();
    
    // 获取输入值
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // 表单验证
    const validationErrors = validateForm(email, password);
    if (validationErrors.length > 0) {
        showError(validationErrors.join('，'));
        return;
    }
    
    // 显示加载状态
    setLoadingState(true);
    
    try {
        // 使用 Firebase Auth 进行登录
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // 登录成功
        console.log('登录成功:', user.email);
        showSuccessMessage('登录成功，正在跳转...');
        
        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
            redirectToHistory();
        }, 1000);
        
    } catch (error) {
        // 登录失败，显示错误信息
        console.error('登录失败:', error);
        handleLoginError(error);
    } finally {
        // 恢复按钮状态
        setLoadingState(false);
    }
}

// 表单验证
function validateForm(email, password) {
    const errors = [];
    
    if (!email) {
        errors.push('邮箱地址不能为空');
        emailInput.classList.add('error');
    } else if (!isValidEmail(email)) {
        errors.push('请输入有效的邮箱地址');
        emailInput.classList.add('error');
    }
    
    if (!password) {
        errors.push('密码不能为空');
        passwordInput.classList.add('error');
    } else if (password.length < 6) {
        errors.push('密码长度不能少于6位');
        passwordInput.classList.add('error');
    }
    
    return errors;
}

// 邮箱格式验证
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 处理登录错误
function handleLoginError(error) {
    let errorMessage = '登录失败，请重试';
    
    switch (error.code) {
        case 'auth/user-not-found':
            errorMessage = '用户不存在，请检查邮箱地址';
            emailInput.classList.add('error');
            break;
        case 'auth/wrong-password':
            errorMessage = '密码错误，请重试';
            passwordInput.classList.add('error');
            passwordInput.focus();
            break;
        case 'auth/invalid-email':
            errorMessage = '邮箱地址格式不正确';
            emailInput.classList.add('error');
            emailInput.focus();
            break;
        case 'auth/too-many-requests':
            errorMessage = '登录尝试次数过多，请稍后再试';
            break;
        case 'auth/network-request-failed':
            errorMessage = '网络连接失败，请检查网络设置';
            break;
        case 'auth/user-disabled':
            errorMessage = '账户已被禁用，请联系管理员';
            break;
        default:
            errorMessage = `登录失败：${error.message}`;
    }
    
    showError(errorMessage);
}

// 设置加载状态
function setLoadingState(loading) {
    if (loading) {
        loginBtn.disabled = true;
        loginText.style.display = 'none';
        loginLoading.style.display = 'inline-flex';
        loginBtn.innerHTML = loginLoading.outerHTML;
    } else {
        loginBtn.disabled = false;
        loginText.style.display = 'inline';
        loginLoading.style.display = 'none';
        loginBtn.innerHTML = loginText.outerHTML;
    }
}

// 显示错误信息
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // 自动隐藏错误信息
    setTimeout(() => {
        clearError();
    }, 5000);
}

// 显示成功信息
function showSuccessMessage(message) {
    errorMessage.textContent = message;
    errorMessage.className = 'error-message';
    errorMessage.style.backgroundColor = '#d1fae5';
    errorMessage.style.color = '#065f46';
    errorMessage.style.borderColor = '#a7f3d0';
    errorMessage.style.display = 'block';
}

// 清除错误信息
function clearError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
    errorMessage.className = 'error-message';
}

// 跳转到历史页面
function redirectToHistory() {
    window.location.href = '/history.html';
}

// 检查认证状态
function checkAuthState() {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            redirectToHistory();
        }
    });
}