# storage.py - 全局数据存储（内存存储，重启后清空）

from datetime import datetime, timedelta

# 存储结构：{工作台账户ID: {access_token, refresh_token, local_accounts: {}, ...}}
token_storage = {}

def get_account_info(workspace_id):
    """获取账户信息"""
    return token_storage.get(workspace_id)

def get_access_token(workspace_id):
    """获取指定工作台的access_token"""
    info = token_storage.get(workspace_id)
    return info.get("access_token") if info else None

def get_any_valid_token():
    """获取任意一个有效的token（用于不需要指定工作台的接口）"""
    for acc_id, info in token_storage.items():
        if "access_token" in info and info["access_token"]:
            return info["access_token"]
    return None

def save_account(adv_id, access_token, refresh_token, expires_in, existing_local=None):
    """保存账户信息"""
    token_storage[adv_id] = {
        "advertiser_id": adv_id,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "type": "ADVERTISER",
        "obtained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "expires_at": (datetime.now() + timedelta(seconds=expires_in)).strftime("%Y-%m-%d %H:%M:%S"),
        "local_accounts": existing_local or {}
    }
    return True

def add_local_account(workspace_id, local_id, name="本地推账户"):
    """添加本地推账户"""
    if workspace_id not in token_storage:
        return False, "工作台不存在"
    
    if "local_accounts" not in token_storage[workspace_id]:
        token_storage[workspace_id]["local_accounts"] = {}
    
    token_storage[workspace_id]["local_accounts"][local_id] = {
        "id": local_id,
        "name": name,
        "added_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    return True, "添加成功"

def delete_local_account(workspace_id, local_id):
    """删除本地推账户"""
    if workspace_id not in token_storage:
        return False, "工作台不存在"
    
    if "local_accounts" in token_storage[workspace_id] and local_id in token_storage[workspace_id]["local_accounts"]:
        del token_storage[workspace_id]["local_accounts"][local_id]
        return True, "删除成功"
    
    return False, "本地推账户不存在"

def delete_account(workspace_id):
    """删除整个工作台账户"""
    if workspace_id in token_storage:
        del token_storage[workspace_id]
        return True
    return False