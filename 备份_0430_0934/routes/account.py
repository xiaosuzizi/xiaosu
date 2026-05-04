# routes/account.py - 账户管理模块（工作台账户、本地推账户管理）

from flask import Blueprint, request, jsonify
import re
from datetime import datetime

from storage import token_storage

account_bp = Blueprint('account', __name__, url_prefix='')

@account_bp.route("/api/accounts")
def get_accounts():
    """获取所有已授权账户列表"""
    accounts = []
    for adv_id, info in token_storage.items():
        accounts.append({
            "id": adv_id,
            "access_token": info.get("access_token", ""),
            "refresh_token": info.get("refresh_token", ""),
            "type": info.get("type", "ADVERTISER"),
            "obtained_at": info["obtained_at"],
            "expires_at": info["expires_at"],
            "local_accounts": info.get("local_accounts", {})
        })
    return jsonify({"accounts": accounts})


@account_bp.route("/api/account/<workspace_id>/delete", methods=["DELETE"])
def delete_workspace_account(workspace_id):
    """删除工作台账户"""
    if workspace_id not in token_storage:
        return jsonify({"success": False, "message": "账户不存在"})
    
    try:
        del token_storage[workspace_id]
        return jsonify({"success": True, "message": "删除成功"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@account_bp.route("/api/account/<workspace_id>/local_accounts/add", methods=["POST"])
def add_local_account(workspace_id):
    """添加本地推账户"""
    if workspace_id not in token_storage:
        return jsonify({"success": False, "message": "工作台账户不存在"})
    
    data = request.get_json()
    local_id = str(data.get("local_account_id", ""))
    name = data.get("name", "本地推账户")
    
    # 验证ID格式
    if not local_id or not re.match(r'^\d{16,19}$', local_id):
        return jsonify({"success": False, "message": "本地推账户ID必须是16-19位数字"})
    
    if "local_accounts" not in token_storage[workspace_id]:
        token_storage[workspace_id]["local_accounts"] = {}
    
    token_storage[workspace_id]["local_accounts"][local_id] = {
        "id": local_id,
        "name": name,
        "added_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    return jsonify({"success": True, "message": "添加成功"})


@account_bp.route("/api/account/<workspace_id>/local_accounts/<local_id>/delete", methods=["DELETE"])
def delete_local_account(workspace_id, local_id):
    """删除本地推账户"""
    if workspace_id not in token_storage:
        return jsonify({"success": False, "message": "工作台账户不存在"})
    
    if "local_accounts" in token_storage[workspace_id] and local_id in token_storage[workspace_id]["local_accounts"]:
        del token_storage[workspace_id]["local_accounts"][local_id]
        return jsonify({"success": True, "message": "删除成功"})
    
    return jsonify({"success": False, "message": "本地推账户不存在"})