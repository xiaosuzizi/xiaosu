#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
抖音投流管理系统 - 模块化版本
功能：OAuth2.0授权 + 本地推数据报表（账户/项目/单元/素材/受众分析）
修复：项目ID、单元ID、素材ID大整数精度问题（转为字符串）
"""

from flask import Flask, render_template
from config import APP_ID, PORT, HOST, DEBUG
from routes import register_blueprints

# 创建Flask应用
app = Flask(__name__)

# 注册所有蓝图路由（从routes/__init__.py导入）
register_blueprints(app)

@app.route("/")
def index():
    """首页 - 渲染模板"""
    return render_template('index.html', APP_ID=APP_ID)

if __name__ == "__main__":
    print(f"\n{'='*60}")
    print(f"抖音投流管理系统 - OAuth2.0 + 本地推数据报表")
    print(f"访问地址: http://{HOST}:{PORT}/")
    print(f"功能: 授权管理 + 账户数据 + 项目数据 + 单元数据 + 素材数据 + 受众分析")
    print(f"修复: 项目/单元/素材ID大整数精度问题（转为字符串）")
    print(f"{'='*60}\n")
    app.run(host=HOST, port=PORT, debug=DEBUG)