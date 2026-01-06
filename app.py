from flask import Flask, request, jsonify, render_template, make_response, redirect, url_for
import os
import json
import requests
from datetime import datetime, timedelta
import jwt
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

# 初始化 Flask 应用
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'ansapra_secure_key_2026')  # 生产环境从环境变量获取
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB 文件限制
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'docx'}

# 创建上传文件夹
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 模拟数据库（生产环境可替换为 SQLite/PostgreSQL）
users_db = {}  # {user_id: {email, password_hash, profile, settings, reading_history}}
sessions_db = {}  # {session_id: {user_id, expires_at}}

# API 配置（从 Render 环境变量获取）
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY')
DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
SPRINGER_API_KEY = os.environ.get('SPRINGER_API_KEY')
SPRINGER_API_URL = 'https://api.springernature.com/openaccess/json'

# JWT 配置
JWT_SECRET = os.environ.get('JWT_SECRET', 'ansapra_jwt_secret')
JWT_EXPIRY_HOURS = 24

# ------------------------------
# 工具函数
# ------------------------------
def allowed_file(filename):
    """验证文件类型"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def generate_jwt(user_id):
    """生成 JWT Token"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_jwt(token):
    """验证 JWT Token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_user_from_token():
    """从请求头获取用户信息"""
    token = request.cookies.get('ansapra_token')
    if not token:
        return None
    user_id = verify_jwt(token)
    return users_db.get(user_id) if user_id else None

def call_deepseek_api(prompt, files_data=None):
    """调用 DeepSeek API 生成解读"""
    if not DEEPSEEK_API_KEY:
        return {'error': 'DeepSeek API Key 未配置'}, 500
    
    headers = {
        'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    messages = [
        {
            'role': 'system',
            'content': '你是高中生自然科学论文解读助手，必须严格按照以下要求执行：'
                      '1. 解读对象是高中生，语言简短清晰，分小标题，遵循论文逻辑'
                      '2. 注重用户知识框架薄弱点，发挥其长处'
                      '3. 只解读论文内容，不生成额外内容'
                      '4. 最后必须附上术语解读区'
                      '5. 全部使用中文输出'
        },
        {
            'role': 'user',
            'content': prompt
        }
    ]
    
    data = {
        'model': 'deepseek-chat',
        'messages': messages,
        'temperature': 0.7,
        'stream': False
    }
    
    try:
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        return {
            'success': True,
            'interpretation': result['choices'][0]['message']['content']
        }
    except Exception as e:
        return {'error': f'DeepSeek API 调用失败: {str(e)}'}, 500

def call_springer_api(keywords, limit=5):
    """调用 Springer Open Access API 获取相关论文"""
    if not SPRINGER_API_KEY:
        return {'error': 'Springer API Key 未配置'}, 500
    
    params = {
        'q': keywords,
        'api_key': SPRINGER_API_KEY,
        'p': limit,
        's': 1,
        'format': 'json'
    }
    
    try:
        response = requests.get(SPRINGER_API_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        papers = []
        for item in data.get('records', []):
            paper = {
                'title': item.get('title'),
                'authors': ', '.join(auth.get('creator') for auth in item.get('creators', [])),
                'journal': item.get('publicationName'),
                'year': item.get('publicationYear'),
                'doi': item.get('doi'),
                'url': item.get('url')[0]['value'] if item.get('url') else '',
                'abstract': item.get('abstract')
            }
            papers.append(paper)
        
        # 补充 Nature/Science 链接（基于关键词匹配）
        nature_science_links = [
            {
                'title': f'Nature: {keywords} 相关研究',
                'url': f'https://www.nature.com/search?q={keywords.replace(" ", "+")}',
                'journal': 'Nature',
                'abstract': 'Nature 期刊相关研究论文集合'
            },
            {
                'title': f'Science: {keywords} 相关研究',
                'url': f'https://www.science.org/search?q={keywords.replace(" ", "+")}',
                'journal': 'Science',
                'abstract': 'Science 期刊相关研究论文集合'
            }
        ]
        
        return {
            'success': True,
            'papers': papers + nature_science_links
        }
    except Exception as e:
        return {'error': f'Springer API 调用失败: {str(e)}'}, 500

# ------------------------------
# 路由
# ------------------------------
@app.route('/')
def index():
    """首页（登录/注册/主界面）"""
    user = get_user_from_token()
    return render_template('index.html', user=user)

@app.route('/api/register', methods=['POST'])
def register():
    """用户注册"""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    questionnaire = data.get('questionnaire')
    
    if not email or not password or not questionnaire:
        return jsonify({'error': '邮箱、密码和问卷不能为空'}), 400
    
    # 检查邮箱是否已注册
    for user in users_db.values():
        if user['email'] == email:
            return jsonify({'error': '该邮箱已注册'}), 409
    
    # 创建新用户
    user_id = str(uuid.uuid4())
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    
    # 初始化用户数据
    users_db[user_id] = {
        'user_id': user_id,
        'email': email,
        'password_hash': hashed_password,
        'profile': questionnaire,
        'settings': {
            'language': 'zh',
            'font_size': 18,
            'font_family': 'Microsoft YaHei',
            'line_height': 1.6,
            'letter_spacing': 0,
            'background': 'light_blue',
            'reading_habits': {
                'preparation_level': 'B',
                'reading_purpose': 'B',
                'reading_time': 'B',
                'interpretation_style': 'A',
                'interpretation_depth': 'B',
                'self_assessment': ['A', 'B'],
                'preferred_charts': ['A', 'B']
            }
        },
        'reading_history': [],
        'last_page': 'paper_interpretation'
    }
    
    # 生成 JWT Token
    token = generate_jwt(user_id)
    
    # 设置 Cookie
    response = jsonify({'success': True, 'message': '注册成功'})
    response.set_cookie(
        'ansapra_token',
        value=token,
        expires=datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        httponly=True,
        secure=request.is_secure,
        samesite='Lax'
    )
    
    return response

@app.route('/api/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': '邮箱和密码不能为空'}), 400
    
    # 查找用户
    user = None
    for u in users_db.values():
        if u['email'] == email:
            user = u
            break
    
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': '邮箱或密码错误'}), 401
    
    # 生成 JWT Token
    token = generate_jwt(user['user_id'])
    
    # 设置 Cookie
    response = jsonify({
        'success': True,
        'message': '登录成功',
        'last_page': user.get('last_page', 'paper_interpretation')
    })
    response.set_cookie(
        'ansapra_token',
        value=token,
        expires=datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        httponly=True,
        secure=request.is_secure,
        samesite='Lax'
    )
    
    return response

@app.route('/api/logout', methods=['POST'])
def logout():
    """用户登出"""
    response = jsonify({'success': True, 'message': '登出成功'})
    response.set_cookie('ansapra_token', '', expires=0)
    return response

@app.route('/api/user/settings', methods=['GET', 'PUT'])
def user_settings():
    """用户设置管理"""
    user = get_user_from_token()
    if not user:
        return jsonify({'error': '未登录'}), 401
    
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': user['settings']})
    
    # 更新设置
    data = request.json
    user['settings'].update(data)
    return jsonify({'success': True, 'message': '设置更新成功'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传论文文件"""
    user = get_user_from_token()
    if not user:
        return jsonify({'error': '未登录'}), 401
    
    if 'file' not in request.files:
        return jsonify({'error': '未选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'error': '不支持的文件类型，仅支持 PDF 和 DOCX'}), 400
    
    # 保存文件
    filename = secure_filename(f"{user['user_id']}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)
    
    # 提取关键词（用于论文推送）
    keywords = request.form.get('keywords', 'natural science')
    
    # 构建 DeepSeek 提示词
    prompt = f"""
用户是一位高中生，需要解读一篇自然科学学术论文。
其具体个性化解读方式设置数据：{json.dumps(user['settings']['reading_habits'])}
过往阅读数据：{json.dumps([h['title'] for h in user['reading_history'][:3]])}
个人自然科学知识框架问卷：{json.dumps(user['profile'])}
本次解读的论文文件：{filename}
请根据用户输入的论文，生成一篇符合所有个性化需求的解读内容。
为了帮助完善用户的知识框架，可以在解读时注重用户知识框架的薄弱点，并发挥用户在自然科学方面的长处。
解读时，句子不能冗长，要求简短、清晰；尽可能逻辑清晰地分出小标题，有条理地分开解读内容的各部分；
尽可能在解读时，遵循论文本身的分段逻辑。只进行论文内容的解读，不需要额外生成其他内容。
生成的解读内容需要是中文。在解读的最后请附上这篇论文的术语解读区。
    """
    
    # 调用 DeepSeek API
    deepseek_result = call_deepseek_api(prompt)
    if 'error' in deepseek_result:
        return jsonify(deepseek_result), 500
    
    # 调用 Springer API 获取相关论文
    springer_result = call_springer_api(keywords)
    
    # 记录阅读历史
    reading_record = {
        'id': str(uuid.uuid4()),
        'title': request.form.get('title', filename),
        'filename': filename,
        'upload_time': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
        'interpretation': deepseek_result['interpretation'],
        'keywords': keywords
    }
    user['reading_history'].insert(0, reading_record)
    
    return jsonify({
        'success': True,
        'interpretation': deepseek_result['interpretation'],
        'related_papers': springer_result.get('papers', []) if 'success' in springer_result else [],
        'reading_record': reading_record
    })

@app.route('/api/reading-history', methods=['GET'])
def reading_history():
    """获取阅读历史"""
    user = get_user_from_token()
    if not user:
        return jsonify({'error': '未登录'}), 401
    
    return jsonify({'success': True, 'history': user['reading_history']})

@app.route('/api/delete-account', methods=['POST'])
def delete_account():
    """删除账户"""
    user = get_user_from_token()
    if not user:
        return jsonify({'error': '未登录'}), 401
    
    # 删除用户数据
    del users_db[user['user_id']]
    
    # 清除 Cookie
    response = jsonify({'success': True, 'message': '账户已删除'})
    response.set_cookie('ansapra_token', '', expires=0)
    return response

@app.route('/api/save-annotation', methods=['POST'])
def save_annotation():
    """保存批注"""
    user = get_user_from_token()
    if not user:
        return jsonify({'error': '未登录'}), 401
    
    data = request.json
    record_id = data.get('record_id')
    annotation = data.get('annotation')
    
    # 查找阅读记录并添加批注
    for record in user['reading_history']:
        if record['id'] == record_id:
            record['annotations'] = record.get('annotations', []) + [annotation]
            return jsonify({'success': True, 'message': '批注保存成功'})
    
    return jsonify({'error': '阅读记录不存在'}), 404

# ------------------------------
# 全局错误处理
# ------------------------------
@app.errorhandler(404)
def not_found(e):
    return render_template('index.html', error='页面不存在'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('index.html', error='服务器错误'), 500

# ------------------------------
# 启动配置
# ------------------------------
if __name__ == '__main__':
    # Render 要求端口为 10000
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)  # 生产环境关闭 debug
