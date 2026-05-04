# routes/auth.py - OAuth2.0授权模块（完全恢复原始功能）

from flask import Blueprint, request, jsonify
import requests
from datetime import datetime, timedelta

from config import APP_ID, APP_SECRET
from storage import token_storage

auth_bp = Blueprint('auth', __name__, url_prefix='')

@auth_bp.route("/callback")
def oauth_callback():
    """OAuth授权回调处理 - 完全恢复原始功能"""
    auth_code = request.args.get("auth_code")
    if not auth_code:
        return "<script>alert('缺少auth_code');window.location.href='/';</script>"
    
    try:
        r = requests.post(
            "https://ad.oceanengine.com/open_api/oauth2/access_token/", 
            json={
                "app_id": APP_ID, 
                "secret": APP_SECRET, 
                "grant_type": "auth_code", 
                "auth_code": auth_code
            },
            timeout=30
        )
        result = r.json()
        
        if result.get("code") != 0:
            return f"<script>alert('授权失败：{result.get('message')}');window.location.href='/';</script>"
        
        data = result.get("data", {})
        
        # 获取广告主ID列表
        advertiser_ids = []
        if "advertiser_ids" in data and isinstance(data["advertiser_ids"], list):
            advertiser_ids = [str(id) for id in data["advertiser_ids"]]
        elif "advertiser_id" in data:
            val = data["advertiser_id"]
            advertiser_ids = [str(v) for v in val] if isinstance(val, list) else [str(val)]
        
        if not advertiser_ids:
            return "<script>alert('无法获取广告主ID');window.location.href='/';</script>"
        
        access_token = data["access_token"]
        refresh_token = data["refresh_token"]
        expires_in = data.get("expires_in", 86400)
        
        for adv_id in advertiser_ids:
            existing_local = {}
            if adv_id in token_storage and "local_accounts" in token_storage[adv_id]:
                existing_local = token_storage[adv_id]["local_accounts"]
            
            token_storage[adv_id] = {
                "advertiser_id": adv_id,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "type": "ADVERTISER",
                "obtained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "expires_at": (datetime.now() + timedelta(seconds=expires_in)).strftime("%Y-%m-%d %H:%M:%S"),
                "local_accounts": existing_local
            }
        
        return f"<script>alert('✅ 授权成功！共{len(advertiser_ids)}个工作台账户');window.location.href='/';</script>"
        
    except Exception as e:
        return f"<script>alert('异常：{str(e)}');window.location.href='/';</script>"


@auth_bp.route("/api/token/<advertiser_id>/refresh", methods=["POST"])
def refresh_token(advertiser_id):
    """刷新Token - 完全恢复原始功能"""
    if advertiser_id not in token_storage:
        return jsonify({"success": False, "message": "账户不存在"})
    
    refresh_token_val = token_storage[advertiser_id].get("refresh_token")
    if not refresh_token_val:
        return jsonify({"success": False, "message": "无refresh_token"})
    
    try:
        r = requests.post(
            "https://ad.oceanengine.com/open_api/oauth2/refresh_token/", 
            json={
                "app_id": APP_ID, 
                "secret": APP_SECRET, 
                "grant_type": "refresh_token", 
                "refresh_token": refresh_token_val
            },
            timeout=30
        )
        result = r.json()
        
        if result.get("code") != 0:
            return jsonify({"success": False, "message": result.get("message", "刷新失败")})
        
        data = result.get("data", {})
        token_storage[advertiser_id]["access_token"] = data["access_token"]
        
        if "refresh_token" in data:
            token_storage[advertiser_id]["refresh_token"] = data["refresh_token"]
        
        token_storage[advertiser_id]["obtained_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        expires_in = data.get("expires_in", 86400)
        token_storage[advertiser_id]["expires_at"] = (datetime.now() + timedelta(seconds=expires_in)).strftime("%Y-%m-%d %H:%M:%S")
        
        return jsonify({"success": True, "message": "刷新成功"})
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})