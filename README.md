# 服务报告系统 (Service Report System)

一个基于 Google Firebase 的现代化服务报告管理系统，专为工程服务人员设计，支持现场服务后客户签字确认和报告管理。

## ✨ 主要功能

### 🔐 用户认证
- 安全的邮箱密码登录
- 用户角色管理（工程师/管理员）
- 自动登录状态检查

### 📝 服务报告管理
- 完整的服务报告表单
- 客户电子签名确认
- 自动保存草稿功能
- 表单验证和错误提示

### 📊 报告历史
- 智能搜索和筛选
- 状态筛选（已完成/未完成/进行中）
- 时间范围筛选
- 统计信息展示
- 数据导出功能（CSV格式）

### 🎨 现代化界面
- 响应式设计，支持移动端
- 现代化UI组件
- 流畅的动画效果
- 深色/浅色主题支持

## 🚀 优化内容

### 1. 用户体验优化
- **响应式设计**: 完美支持桌面端、平板和手机
- **现代化UI**: 使用CSS变量和现代设计语言
- **加载状态**: 智能的加载提示和进度反馈
- **表单验证**: 实时验证和友好的错误提示
- **自动保存**: 防止数据丢失的草稿保存功能

### 2. 功能增强
- **智能搜索**: 支持客户姓名、工程师姓名、工单号搜索
- **高级筛选**: 按状态、时间范围筛选报告
- **统计面板**: 实时显示报告数量、完成状态等关键指标
- **数据导出**: 支持CSV格式导出，便于数据分析
- **分页加载**: 优化大数据量下的性能表现

### 3. 性能优化
- **代码分割**: 模块化的JavaScript代码结构
- **防抖搜索**: 优化搜索性能，减少不必要的请求
- **懒加载**: 分页加载报告数据
- **缓存策略**: 本地存储草稿数据

### 4. 安全性增强
- **输入验证**: 严格的表单数据验证
- **权限控制**: 基于角色的访问控制
- **数据清理**: 防止XSS和注入攻击

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Google Firebase
- **认证**: Firebase Authentication
- **数据库**: Cloud Firestore
- **部署**: Firebase Hosting
- **签名**: SignaturePad.js

## 📦 安装和部署

### 前置要求
- Node.js 14+ 
- Firebase CLI
- Google Firebase 项目

### 1. 克隆项目
```bash
git clone <repository-url>
cd service-report-app
```

### 2. 安装依赖
```bash
# 安装 Firebase CLI (如果未安装)
npm install -g firebase-tools

# 登录 Firebase
firebase login
```

### 3. 配置 Firebase
```bash
# 初始化 Firebase 项目
firebase init

# 选择以下服务:
# - Hosting
# - Firestore
# - Authentication
```

### 4. 配置环境
在 `public/` 目录下创建 Firebase 配置文件，或使用 Firebase 自动配置。
在 `functions/`目录下创建 .env 配置文件:
```
GMAIL_EMAIL=xxx@gmail.com
GMAIL_PASSWORD=adfafdafasfdfas
BACKUP_EMAIL=yyy@gmail.com
```

### 5. 部署
```bash
# 部署到 Firebase Hosting
firebase deploy

# 或者只部署 Hosting
firebase deploy --only hosting
```

## 🎯 使用方法

### 1. 用户登录
- 访问系统登录页面
- 输入邮箱和密码
- 系统自动验证并跳转

### 2. 创建服务报告
- 点击"填写新报告"
- 填写完整的服务信息
- 客户在签名板上签字确认
- 提交报告

### 3. 查看报告历史
- 在历史页面查看所有报告
- 使用搜索和筛选功能
- 点击报告卡片查看详情
- 导出数据进行分析

### 4. 管理员功能
- 查看所有用户的报告
- 管理用户账户
- 系统数据统计

## 📱 移动端支持

系统完全支持移动设备，包括：
- 触摸友好的界面
- 响应式布局
- 移动端优化的表单
- 手势支持

## 🔧 自定义配置

### 修改主题颜色
在 `public/style.css` 中修改 CSS 变量：
```css
:root {
    --primary-color: #2563eb;
    --primary-hover: #1d4ed8;
    --secondary-color: #64748b;
    /* 更多颜色变量... */
}
```

### 添加新字段
在报告表单中添加新字段：
1. 修改 `public/report.html`
2. 更新 `public/report.js` 中的数据处理
3. 调整 Firestore 数据结构

### 修改验证规则
在 `firestore.rules` 中配置数据库访问规则。

## 📊 数据库结构

### 集合: reports
```javascript
{
    taskDescription: "任务描述",
    engineerName: "工程师姓名",
    engineerPhone: "工程师电话",
    clientName: "客户姓名",
    clientPhone: "客户电话",
    clientEmail: "客户邮箱",
    clientAddress: "服务地址",
    orderNumber: "工单号",
    serviceDetails: "服务详情",
    serviceDate: "服务日期",
    status: "服务状态",
    outstandingIssues: "遗留问题",
    signature: "客户签名图片",
    userId: "用户ID",
    userEmail: "用户邮箱",
    timestamp: "提交时间",
    createdAt: "创建时间"
}
```

### 集合: users
```javascript
{
    email: "用户邮箱",
    role: "用户角色", // "engineer" 或 "admin"
    createdAt: "创建时间"
}
```

## 🚨 注意事项

1. **签名数据**: 客户签名以Base64图片格式存储，注意存储空间
2. **权限控制**: 确保Firestore规则正确配置
3. **数据备份**: 定期备份重要数据
4. **性能监控**: 监控Firestore查询性能

## 🔮 未来计划

- [ ] 离线支持 (PWA)
- [ ] 图片上传功能
- [ ] 报告模板管理
- [ ] 邮件通知系统
- [ ] 多语言支持
- [ ] 高级报表功能
- [ ] 移动端原生应用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如果您遇到问题或有建议，请：
1. 查看 [Issues](../../issues) 页面
2. 创建新的 Issue
3. 联系项目维护者

---

**感谢使用服务报告系统！** 🎉
