# ANSAPRA - 高中生自然科学论文自适应阅读程序

## 项目介绍
ANSAPRA（Adaptive Natural Science Academic Paper Reading Agent）是一款专为高中生设计的自然科学论文阅读工具，支持个性化解读、论文推送、视觉自定义等功能。

## 核心功能
- 用户注册/登录/账户管理
- 认知框架问卷收集
- 论文上传与智能解读（基于 DeepSeek API）
- 相关论文推送（基于 Springer API）
- 个性化阅读设置（字体、背景、语言等）
- 阅读历史与批注管理

## 部署说明

### 1. 前置条件
- Python 3.10+
- GitHub 账号
- Render 账号
- DeepSeek API 密钥
- Springer API 密钥

### 2. GitHub 部署
1. Fork 本仓库到你的 GitHub 账号
2. 克隆仓库到本地：
   ```bash
   git clone https://github.com/你的用户名/ansapra.git
   cd ansapra
