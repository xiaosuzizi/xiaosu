# routes/__init__.py - 蓝图注册中心

from flask import Flask

def register_blueprints(app: Flask):
    """
    注册所有蓝图路由
    调用方式：在 app.py 中 register_blueprints(app)
    """
    
    # 1. 注册 OAuth 授权蓝图
    from .auth import auth_bp
    app.register_blueprint(auth_bp)
    
    # 2. 注册账户管理蓝图
    from .account import account_bp
    app.register_blueprint(account_bp)
    
    # 3. 注册账号服务蓝图
    from .account_service import account_service_bp
    app.register_blueprint(account_service_bp)
    
    # 4. 注册本地推数据报表蓝图
    from .localpush import localpush_bp
    app.register_blueprint(localpush_bp)
    
    # 5. 注册本地推项目管理蓝图（新增）
    from .local_delivery import local_delivery_bp
    app.register_blueprint(local_delivery_bp)
    
    # 6. 注册本地推素材管理蓝图（新增）
    from .local_material import local_material_bp
    app.register_blueprint(local_material_bp)

    print("[OK] 所有蓝图已注册:")
    print("  - /callback (OAuth授权)")
    print("  - /api/accounts, /api/token/*, /api/account/* (账户管理)")
    print("  - /api/workspace/*, /api/account_service/* (账号服务)")
    print("  - /api/localpush/* (本地推数据报表)")
    print("  - /api/local_delivery/* (本地推项目管理)")
    print("  - /api/local_material/* (本地推素材管理)")