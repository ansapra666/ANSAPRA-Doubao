document.addEventListener('DOMContentLoaded', function() {
    // 全局状态
    const state = {
        currentUser: null,
        currentLanguage: 'zh',
        currentPage: 'website-intro',
        uploadedFile: null
    };

    // DOM 元素
    const elements = {
        // 认证相关
        authContainer: document.getElementById('auth-container'),
        loginTab: document.querySelector('.auth-tab[data-tab="login"]'),
        registerTab: document.querySelector('.auth-tab[data-tab="register"]'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginBtn: document.getElementById('login-btn'),
        startQuestionnaireBtn: document.getElementById('start-questionnaire-btn'),
        loginMessage: document.getElementById('login-message'),
        registerMessage: document.getElementById('register-message'),
        
        // 问卷相关
        questionnaireContainer: document.getElementById('questionnaire-container'),
        questionnaireForm: document.getElementById('questionnaire-form'),
        closeQuestionnaireBtn: document.getElementById('close-questionnaire'),
        
        // 主界面相关
        mainContainer: document.getElementById('main-container'),
        navLinks: document.querySelectorAll('.nav-link'),
        contentPages: document.querySelectorAll('.content-page'),
        
        // 论文解读相关
        paperUpload: document.getElementById('paper-upload'),
        uploadFilename: document.getElementById('upload-filename'),
        paperTitle: document.getElementById('paper-title'),
        paperKeywords: document.getElementById('paper-keywords'),
        startInterpretationBtn: document.getElementById('start-interpretation'),
        pdfViewer: document.getElementById('pdf-viewer'),
        interpretationResult: document.getElementById('interpretation-result'),
        relatedPapersList: document.getElementById('related-papers-list'),
        
        // 设置相关
        languageRadios: document.querySelectorAll('input[name="language"]'),
        fontFamilies: document.getElementById('font-family'),
        fontSize: document.getElementById('font-size'),
        fontSizeValue: document.getElementById('font-size-value'),
        themeBtns: document.querySelectorAll('.theme-btn'),
        customBackground: document.getElementById('custom-background'),
        logoutBtn: document.getElementById('logout-btn'),
        deleteAccountBtn: document.getElementById('delete-account-btn'),
        
        // 模态框相关
        modalContainer: document.getElementById('modal-container'),
        modalContent: document.getElementById('modal-content'),
        closeModalBtn: document.getElementById('close-modal'),
        footerLinks: document.querySelectorAll('.footer-link')
    };

    // 初始化
    init();

    function init() {
        // 检查登录状态
        checkLoginStatus();
        
        // 绑定事件监听
        bindEventListeners();
        
        // 加载模态框内容
        loadModalContents();
    }

    function checkLoginStatus() {
        const token = getCookie('ansapra_token');
        if (token) {
            // 验证 token 有效性（实际项目中应调用 API 验证）
            state.currentUser = { token };
            showMainContainer();
        } else {
            showAuthContainer();
        }
    }

    function bindEventListeners() {
        // 认证标签切换
        elements.loginTab.addEventListener('click', () => switchAuthTab('login'));
        elements.registerTab.addEventListener('click', () => switchAuthTab('register'));
        
        // 登录按钮
        elements.loginBtn.addEventListener('click', handleLogin);
        
        // 开始问卷按钮
        elements.startQuestionnaireBtn.addEventListener('click', handleStartQuestionnaire);
        
        // 关闭问卷按钮
        elements.closeQuestionnaireBtn.addEventListener('click', () => {
            elements.questionnaireContainer.classList.remove('active');
        });
        
        // 提交问卷
        elements.questionnaireForm.addEventListener('submit', handleSubmitQuestionnaire);
        
        // 导航链接切换
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                switchContentPage(page);
            });
        });
        
        // 论文上传
        elements.paperUpload.addEventListener('change', handleFileUpload);
        
        // 开始解读
        elements.startInterpretationBtn.addEventListener('click', handleStartInterpretation);
        
        // 语言切换
        elements.languageRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.currentLanguage = e.target.value;
                document.body.className = `lang-${state.currentLanguage}`;
                saveUserSettings();
            });
        });
        
        // 字体设置
        elements.fontFamilies.addEventListener('change', (e) => {
            document.body.style.fontFamily = e.target.value;
            saveUserSettings();
        });
        
        elements.fontSize.addEventListener('input', (e) => {
            const size = e.target.value + 'px';
            document.body.style.fontSize = size;
            elements.fontSizeValue.textContent = size;
            saveUserSettings();
        });
        
        // 主题设置
        elements.themeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = btn.getAttribute('data-theme');
                if (theme) {
                    const themeColors = {
                        light_pink: '#ffecf0',
                        light_blue: '#e6f7ff',
                        light_green: '#e6ffe6',
                        light_purple: '#f3e6ff'
                    };
                    document.body.style.backgroundColor = themeColors[theme];
                    saveUserSettings();
                }
            });
        });
        
        // 自定义背景
        elements.customBackground.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.body.style.backgroundImage = `url(${event.target.result})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundAttachment = 'fixed';
                    saveUserSettings();
                };
                reader.readAsDataURL(file);
            }
        });
        
        // 登出按钮
        elements.logoutBtn.addEventListener('click', handleLogout);
        
        // 删除账户按钮
        elements.deleteAccountBtn.addEventListener('click', handleDeleteAccount);
        
        // 底部链接
        elements.footerLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = link.getAttribute('data-modal');
                showModal(modal);
            });
        });
        
        // 关闭模态框
        elements.closeModalBtn.addEventListener('click', () => {
            elements.modalContainer.classList.remove('active');
        });
    }

    // ------------------------------
    // 认证相关函数
    // ------------------------------
    function switchAuthTab(tabName) {
        // 切换标签
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });
        
        // 切换表单
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tabName}-form`);
        });
        
        // 清除消息
        elements.loginMessage.textContent = '';
        elements.registerMessage.textContent = '';
    }

    async function handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        
        if (!email || !password) {
            elements.loginMessage.textContent = state.currentLanguage === 'zh' ? '请填写完整信息' : 'Please fill in all information';
            elements.loginMessage.style.color = 'red';
            return;
        }
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                elements.loginMessage.textContent = state.currentLanguage === 'zh' ? '登录成功' : 'Login successful';
                elements.loginMessage.style.color = 'green';
                
                // 保存用户状态
                state.currentUser = { email };
                setTimeout(() => {
                    showMainContainer();
                    switchContentPage(data.last_page);
                }, 1000);
            } else {
                elements.loginMessage.textContent = data.error || (state.currentLanguage === 'zh' ? '登录失败' : 'Login failed');
                elements.loginMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Login error:', error);
            elements.loginMessage.textContent = state.currentLanguage === 'zh' ? '网络错误' : 'Network error';
            elements.loginMessage.style.color = 'red';
        }
    }

    function handleStartQuestionnaire() {
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value.trim();
        
        if (!email || !password) {
            elements.registerMessage.textContent = state.currentLanguage === 'zh' ? '请填写完整信息' : 'Please fill in all information';
            elements.registerMessage.style.color = 'red';
            return;
        }
        
        // 保存注册信息到状态
        state.registerData = { email, password };
        
        // 显示问卷
        elements.questionnaireContainer.classList.add('active');
    }

    async function handleSubmitQuestionnaire(e) {
        e.preventDefault();
        
        // 收集问卷数据
        const formData = new FormData(elements.questionnaireForm);
        const questionnaireData = {};
        
        for (const [key, value] of formData.entries()) {
            questionnaireData[key] = value;
        }
        
        // 合并注册数据和问卷数据
        const registerData = {
            email: state.registerData.email,
            password: state.registerData.password,
            questionnaire: questionnaireData
        };
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 注册成功
                elements.questionnaireContainer.classList.remove('active');
                elements.registerMessage.textContent = state.currentLanguage === 'zh' ? '注册成功，即将自动登录' : 'Registration successful, logging in automatically';
                elements.registerMessage.style.color = 'green';
                
                // 自动登录
                setTimeout(async () => {
                    await handleLogin();
                }, 1500);
            } else {
                alert(data.error || (state.currentLanguage === 'zh' ? '注册失败' : 'Registration failed'));
            }
        } catch (error) {
            console.error('Register error:', error);
            alert(state.currentLanguage === 'zh' ? '网络错误' : 'Network error');
        }
    }

    // ------------------------------
    // 页面切换函数
    // ------------------------------
    function showAuthContainer() {
        elements.authContainer.classList.add('active');
        elements.mainContainer.classList.remove('active');
    }

    function showMainContainer() {
        elements.authContainer.classList.remove('active');
        elements.mainContainer.classList.add('active');
        
        // 加载用户设置
        loadUserSettings();
    }

    function switchContentPage(pageName) {
        // 更新导航状态
        elements.navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === pageName);
        });
        
        // 更新内容页面
        elements.contentPages.forEach(page => {
            page.classList.toggle('active', page.id === pageName);
        });
        
        // 保存当前页面状态
        state.currentPage = pageName;
        saveUserSettings();
    }

    // ------------------------------
    // 论文解读相关函数
    // ------------------------------
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (file) {
            state.uploadedFile = file;
            elements.uploadFilename.textContent = file.name;
            
            // 简单的文件预览（仅显示文件名，实际项目可集成 PDF.js）
            elements.pdfViewer.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <p class="zh">已上传文件：${file.name}</p>
                    <p class="en">Uploaded file: ${file.name}</p>
                    <p class="zh">文件大小：${formatFileSize(file.size)}</p>
                    <p class="en">File size: ${formatFileSize(file.size)}</p>
                </div>
            `;
        }
    }

    async function handleStartInterpretation() {
        const file = state.uploadedFile;
        const title = elements.paperTitle.value.trim() || file.name;
        const keywords = elements.paperKeywords.value.trim();
        
        if (!file) {
            alert(state.currentLanguage === 'zh' ? '请先上传论文文件' : 'Please upload a paper file first');
            return;
        }
        
        if (!keywords) {
            alert(state.currentLanguage === 'zh' ? '请输入关键词' : 'Please enter keywords');
            return;
        }
        
        // 创建 FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('keywords', keywords);
        
        // 显示加载状态
        elements.interpretationResult.innerHTML = `
            <div style="text-align:center; padding:50px;">
                <p class="zh">正在解读论文，请稍候...</p>
                <p class="en">Interpreting paper, please wait...</p>
            </div>
        `;
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 显示解读结果
                elements.interpretationResult.innerHTML = data.interpretation.replace(/\n/g, '<br>');
                
                // 显示相关论文
                renderRelatedPapers(data.related_papers);
                
                // 提示成功
                alert(state.currentLanguage === 'zh' ? '论文解读完成' : 'Paper interpretation completed');
            } else {
                elements.interpretationResult.innerHTML = `
                    <div style="color:red; padding:20px;">
                        <p>${data.error || (state.currentLanguage === 'zh' ? '解读失败' : 'Interpretation failed')}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Interpretation error:', error);
            elements.interpretationResult.innerHTML = `
                <div style="color:red; padding:20px;">
                    <p>${state.currentLanguage === 'zh' ? '网络错误，解读失败' : 'Network error, interpretation failed'}</p>
                </div>
            `;
        }
    }

    function renderRelatedPapers(papers) {
        if (!papers || papers.length === 0) {
            elements.relatedPapersList.innerHTML = `
                <div style="text-align:center; padding:20px; grid-column: 1 / -1;">
                    <p class="zh">暂无相关论文</p>
                    <p class="en">No related papers available</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        papers.forEach(paper => {
            html += `
                <div class="paper-item">
                    <h4>${paper.title || '无标题'}</h4>
                    ${paper.authors ? `<p><strong class="zh">作者：</strong><strong class="en">Authors：</strong>${paper.authors}</p>` : ''}
                    ${paper.journal ? `<p><strong class="zh">期刊：</strong><strong class="en">Journal：</strong>${paper.journal}</p>` : ''}
                    ${paper.year ? `<p><strong class="zh">年份：</strong><strong class="en">Year：</strong>${paper.year}</p>` : ''}
                    ${paper.abstract ? `<p><strong class="zh">摘要：</strong><strong class="en">Abstract：</strong>${paper.abstract.substring(0, 100)}...</p>` : ''}
                    ${paper.url ? `<a href="${paper.url}" target="_blank" class="zh">查看全文</a><a href="${paper.url}" target="_blank" class="en">View full text</a>` : ''}
                </div>
            `;
        });
        
        elements.relatedPapersList.innerHTML = html;
    }

    // ------------------------------
    // 用户设置相关函数
    // ------------------------------
    async function loadUserSettings() {
        try {
            const response = await fetch('/api/user/settings');
            const data = await response.json();
            
            if (data.success) {
                const settings = data.settings;
                
                // 应用语言设置
                state.currentLanguage = settings.language || 'zh';
                document.body.className = `lang-${state.currentLanguage}`;
                elements.languageRadios.forEach(radio => {
                    radio.checked = radio.value === state.currentLanguage;
                });
                
                // 应用字体设置
                document.body.style.fontFamily = settings.font_family || 'Microsoft YaHei';
                elements.fontFamilies.value = settings.font_family || 'Microsoft YaHei';
                
                document.body.style.fontSize = `${settings.font_size || 18}px`;
                elements.fontSize.value = settings.font_size || 18;
                elements.fontSizeValue.textContent = `${settings.font_size || 18}px`;
                
                // 应用背景设置
                if (settings.background) {
                    const themeColors = {
                        light_pink: '#ffecf0',
                        light_blue: '#e6f7ff',
                        light_green: '#e6ffe6',
                        light_purple: '#f3e6ff'
                    };
                    document.body.style.backgroundColor = themeColors[settings.background] || '#f5f7fa';
                }
                
                // 应用行高和字间距
                document.body.style.lineHeight = settings.line_height || 1.6;
                document.body.style.letterSpacing = `${settings.letter_spacing || 0}px`;
            }
        } catch (error) {
            console.error('Load settings error:', error);
        }
    }

    async function saveUserSettings() {
        const settings = {
            language: state.currentLanguage,
            font_family: document.body.style.fontFamily || 'Microsoft YaHei',
            font_size: parseInt(document.body.style.fontSize) || 18,
            line_height: parseFloat(document.body.style.lineHeight) || 1.6,
            letter_spacing: parseInt(document.body.style.letterSpacing) || 0,
            background: getCurrentTheme(),
            last_page: state.currentPage
        };
        
        try {
            await fetch('/api/user/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
        } catch (error) {
            console.error('Save settings error:', error);
        }
    }

    function getCurrentTheme() {
        const bgColor = document.body.style.backgroundColor;
        const themeMap = {
            '#ffecf0': 'light_pink',
            '#e6f7ff': 'light_blue',
            '#e6ffe6': 'light_green',
            '#f3e6ff': 'light_purple'
        };
        return themeMap[bgColor] || 'light_blue';
    }

    async function handleLogout() {
        if (confirm(state.currentLanguage === 'zh' ? '确定要退出登录吗？' : 'Are you sure to logout?')) {
            try {
                await fetch('/api/logout', { method: 'POST' });
                
                // 清除状态
                state.currentUser = null;
                
                // 跳转到登录页
                showAuthContainer();
                switchAuthTab('login');
                
                // 清除 Cookie
                setCookie('ansapra_token', '', -1);
            } catch (error) {
                console.error('Logout error:', error);
                alert(state.currentLanguage === 'zh' ? '登出失败' : 'Logout failed');
            }
        }
    }

    async function handleDeleteAccount() {
        if (confirm(state.currentLanguage === 'zh' ? '确定要删除账户吗？此操作不可恢复！' : 'Are you sure to delete your account? This action cannot be undone!')) {
            try {
                await fetch('/api/delete-account', { method: 'POST' });
                
                // 清除状态
                state.currentUser = null;
                
                // 跳转到登录页
                showAuthContainer();
                switchAuthTab('login');
                
                // 清除 Cookie
                setCookie('ansapra_token', '', -1);
                
                alert(state.currentLanguage === 'zh' ? '账户已删除' : 'Account deleted');
            } catch (error) {
                console.error('Delete account error:', error);
                alert(state.currentLanguage === 'zh' ? '删除账户失败' : 'Delete account failed');
            }
        }
    }

    // ------------------------------
    // 模态框相关函数
    // ------------------------------
    function loadModalContents() {
        // 模态框内容映射
        const modalContents = {
            'contact-us': {
                zh: `<h3>联系我们</h3><p>邮箱：support@ansapra.com</p><p>电话：400-123-4567</p>`,
                en: `<h3>Contact Us</h3><p>Email: support@ansapra.com</p><p>Phone: +86 400-123-4567</p>`
            },
            'copyright': {
                zh: `<h3>版权说明</h3><p>© 2026 ANSAPRA 保留所有权利</p>`,
                en: `<h3>Copyright Notice</h3><p>© 2026 ANSAPRA All Rights Reserved</p>`
            },
            'terms': {
                zh: `<h3>服务条款</h3><p>1. 使用本网站即表示您同意遵守相关条款...</p>`,
                en: `<h3>Terms of Service</h3><p>1. By using this website, you agree to comply with the relevant terms...</p>`
            },
            'privacy': {
                zh: `<h3>隐私政策</h3><p>我们重视您的隐私保护...</p>`,
                en: `<h3>Privacy Policy</h3><p>We value your privacy protection...</p>`
            },
            'cookie': {
                zh: `<h3>Cookie政策</h3><p>本网站使用Cookie来提升用户体验...</p>`,
                en: `<h3>Cookie Policy</h3><p>This website uses cookies to enhance user experience...</p>`
            }
        };
        
        // 保存到全局状态
        state.modalContents = modalContents;
    }

    function showModal(modalName) {
        const content = state.modalContents[modalName];
        if (content) {
            elements.modalContent.innerHTML = state.currentLanguage === 'zh' ? content.zh : content.en;
            elements.modalContainer.classList.add('active');
        }
    }

    // ------------------------------
    // 工具函数
    // ------------------------------
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    function setCookie(name, value, days) {
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = `; expires=${date.toUTCString()}`;
        }
        document.cookie = `${name}=${value || ''}${expires}; path=/`;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});
