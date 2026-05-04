# routes/account_service.py - 账号服务模块
# 包含：工作台账户管理、客户信息、资质管理

from flask import Blueprint, request, jsonify
import requests
import json
from urllib.parse import urlencode

from storage import token_storage, get_any_valid_token

account_service_bp = Blueprint('account_service', __name__, url_prefix='')


@account_service_bp.route("/api/workspace/accounts")
def get_workspace_accounts():
    """
    获取旧版巨量引擎工作台下资产账户列表
    使用接口：/open_api/2/customer_center/advertiser/list/
    """
    workspace_id = request.args.get("workspace_id")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 20))
    account_source = request.args.get("account_source", "")
    search_name = request.args.get("search_name", "")
    
    if not workspace_id:
        return jsonify({"code": 400, "message": "缺少workspace_id参数"})
    
    if workspace_id not in token_storage:
        return jsonify({"code": 404, "message": "工作台不存在"})
    
    access_token = token_storage[workspace_id].get("access_token")
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    try:
        url = "https://ad.oceanengine.com/open_api/2/customer_center/advertiser/list/"
        params = {
            "cc_account_id": int(workspace_id),
            "page": page,
            "page_size": page_size
        }
        
        if account_source:
            params["account_source"] = account_source
            
        if search_name:
            params["filtering"] = json.dumps({"account_name": search_name})
        
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        
        # 如果返回成功，处理字段映射（确保前端能正确显示）
        if result.get("code") == 0 and "data" in result:
            data = result["data"]
            if "list" in data:
                for item in data["list"]:
                    # 确保字段一致性：如果account_name为空，尝试使用advertiser_name
                    if not item.get("account_name") and item.get("advertiser_name"):
                        item["account_name"] = item["advertiser_name"]
                    # 确保status字段存在
                    if "status" not in item:
                        item["status"] = "ENABLE"  # 默认有效
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

@account_service_bp.route("/api/account_service/marketing_accounts")
def get_marketing_accounts():
    """
    获取工作台下的营销账户列表（AD类型）
    使用接口：/open_api/2/customer/asset/list/
    """
    workspace_id = request.args.get("workspace_id")
    if not workspace_id:
        return jsonify({"code": 400, "message": "缺少workspace_id参数"})
    
    if workspace_id not in token_storage:
        return jsonify({"code": 404, "message": "工作台不存在"})
    
    access_token = token_storage[workspace_id].get("access_token")
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    try:
        url = "https://ad.oceanengine.com/open_api/2/customer/asset/list/"
        params = {
            "advertiser_id": int(workspace_id),
            "page": 1,
            "page_size": 100
        }
        
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        
        try:
            result = response.json()
        except json.JSONDecodeError:
            return jsonify({
                "code": 403, 
                "message": "无法自动获取营销账户列表（可能需要申请权限），请使用手动输入方式",
                "data": []
            })
        
        if result.get("code") == 0:
            data = result.get("data", {})
            asset_list = data.get("list", [])
            
            marketing_accounts = []
            for asset in asset_list:
                if asset.get("account_source") == "AD":
                    marketing_accounts.append({
                        "id": str(asset.get("advertiser_id")),
                        "advertiser_id": str(asset.get("advertiser_id")),
                        "name": asset.get("advertiser_name", "未命名"),
                        "advertiser_name": asset.get("advertiser_name", "未命名"),
                        "account_source": "AD"
                    })
            
            return jsonify({
                "code": 0,
                "message": "OK",
                "data": marketing_accounts
            })
        else:
            return jsonify(result)
            
    except Exception as e:
        return jsonify({
            "code": 500, 
            "message": str(e),
            "data": []
        })


@account_service_bp.route("/api/account_service/customer_info_full")
def get_customer_info_full():
    """
    获取客户完整信息（支持降级到公开信息）
    优先调用 advertiser/info/，失败时自动降级到 advertiser/public_info/
    """
    advertiser_ids = request.args.get("advertiser_ids", "")
    if not advertiser_ids:
        return jsonify({"code": 400, "message": "缺少advertiser_ids参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        id_list = [int(id.strip()) for id in advertiser_ids.split(",") if id.strip()]
        if not id_list:
            return jsonify({"code": 400, "message": "无效的advertiser_ids格式"})
        
        # 首先尝试获取完整信息
        url = "https://ad.oceanengine.com/open_api/2/advertiser/info/"
        fields = ["id", "name", "role", "status", "address", "reason", "license_url", "license_no", 
                 "license_province", "license_city", "company", "brand", "promotion_area", 
                 "promotion_center_province", "promotion_center_city", "industry", "create_time", "note",
                 "first_industry_name", "second_industry_name"]
        
        params = {
            "advertiser_ids": id_list,
            "fields": fields
        }
        
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode({k: json.dumps(v) if isinstance(v, list) else v for k, v in params.items()})
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        
        # 如果完整信息接口失败（权限错误），降级到公开信息
        if result.get("code") != 0 and ("permission" in result.get("message", "").lower() or result.get("code") in [403, 10002, 40001]):
            public_url = "https://ad.oceanengine.com/open_api/2/advertiser/public_info/"
            public_params = {"advertiser_ids": id_list}
            public_full_url = public_url + "?" + urlencode({k: json.dumps(v) if isinstance(v, list) else v for k, v in public_params.items()})
            public_response = requests.get(public_full_url, headers=headers, timeout=30)
            public_result = public_response.json()
            
            if public_result.get("code") == 0:
                # 统一返回格式，将数组包装为对象
                return jsonify({
                    "code": 0,
                    "message": "OK",
                    "data": {
                        "list": public_result.get("data", []),
                        "_is_public_info": True,
                        "_permission_notice": "当前账户仅展示公开信息（无完整信息查询权限）"
                    }
                })
            else:
                return jsonify(public_result)
        
        # 完整信息成功，也统一格式
        if result.get("code") == 0:
            # data可能是数组，包装成统一格式
            if isinstance(result.get("data"), list):
                return jsonify({
                    "code": 0,
                    "message": result.get("message", "OK"),
                    "data": {
                        "list": result["data"],
                        "_is_public_info": False
                    }
                })
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/subject_qualification")
def get_subject_qualification():
    """
    获取主体资质（本地推账户）
    使用接口：/open_api/v3.0/local/qualification/get/
    """
    local_account_id = request.args.get("local_account_id")
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/qualification/get/"
        params = {"local_account_id": int(local_account_id)}
        
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/delivery_qualification")
def get_delivery_qualification():
    """
    获取投放资质列表（本地推账户）
    使用接口：/open_api/v3.0/local/delivery_qualification/list/
    """
    local_account_id = request.args.get("local_account_id")
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/delivery_qualification/list/"
        params = {
            "local_account_id": int(local_account_id),
            "page": 1,
            "page_size": 100
        }
        
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


# ==================== 资金和流水管理 - 查询账户余额流水 ====================

@account_service_bp.route("/api/account_service/balance/single")
def get_single_balance():
    """查询账号余额（单账户）- 2/advertiser/fund/get/"""
    advertiser_id = request.args.get("advertiser_id")
    grant_type_split = request.args.get("grant_type_split", "OFF")
    
    if not advertiser_id:
        return jsonify({"code": 400, "message": "缺少advertiser_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://ad.oceanengine.com/open_api/2/advertiser/fund/get/"
        params = {
            "advertiser_id": int(advertiser_id),
            "grant_type_split": grant_type_split
        }
        headers = {"Access-Token": access_token}
        response = requests.get(url, params=params, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/balance/batch")
def get_batch_balance():
    """批量查询账户余额 - v3.0/account/fund/get/"""
    account_ids = request.args.get("account_ids")  # 逗号分隔
    account_type = request.args.get("account_type", "AD")
    grant_type_split = request.args.get("grant_type_split", "OFF")
    
    if not account_ids:
        return jsonify({"code": 400, "message": "缺少account_ids参数"})
    
    try:
        ids_list = [int(x.strip()) for x in account_ids.split(",") if x.strip()]
        if len(ids_list) > 50:
            return jsonify({"code": 400, "message": "最多支持50个账户"})
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "account_ids不能为空"})
    except:
        return jsonify({"code": 400, "message": "account_ids格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/account/fund/get/"
        params = {
            "account_ids": json.dumps(ids_list),
            "account_type": account_type,
            "grant_type_split": grant_type_split
        }
        headers = {"Access-Token": access_token}
        
        # 构建URL（处理数组参数）
        query_parts = []
        for k, v in params.items():
            if isinstance(v, list):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/daily_flow")
def get_daily_flow():
    """查询账户日流水 - 2/advertiser/fund/daily_stat/"""
    advertiser_id = request.args.get("advertiser_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    account_type = request.args.get("account_type", "AD")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 20))
    
    if not advertiser_id:
        return jsonify({"code": 400, "message": "缺少advertiser_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://ad.oceanengine.com/open_api/2/advertiser/fund/daily_stat/"
        params = {
            "advertiser_id": int(advertiser_id),
            "page": page,
            "page_size": min(page_size, 100)
        }
        
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        if account_type:
            params["account_type"] = account_type
            
        headers = {"Access-Token": access_token}
        response = requests.get(url, params=params, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/transaction_detail")
def get_transaction_detail():
    """查询账号流水明细 - 2/advertiser/fund/transaction/get/"""
    advertiser_id = request.args.get("advertiser_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    transaction_type = request.args.get("transaction_type", "RECHARGE")
    page = int(request.args.get("page", 1))
    page_size = min(int(request.args.get("page_size", 20)), 100)
    
    if not advertiser_id or not start_date or not end_date:
        return jsonify({"code": 400, "message": "缺少必要参数（advertiser_id, start_date, end_date）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://ad.oceanengine.com/open_api/2/advertiser/fund/transaction/get/"
        params = {
            "advertiser_id": int(advertiser_id),
            "start_date": start_date,
            "end_date": end_date,
            "transaction_type": transaction_type,
            "page": page,
            "page_size": page_size
        }
        headers = {"Access-Token": access_token}
        response = requests.get(url, params=params, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/return_goods_balance")
def get_return_goods_balance():
    """获取返货共享钱包余额 - 2/fund/shared_wallet_balance/get/"""
    advertiser_ids = request.args.get("advertiser_ids")  # 逗号分隔
    
    if not advertiser_ids:
        return jsonify({"code": 400, "message": "缺少advertiser_ids参数"})
    
    try:
        ids_list = [int(x.strip()) for x in advertiser_ids.split(",") if x.strip()]
        if len(ids_list) > 100:
            return jsonify({"code": 400, "message": "最多支持100个账户"})
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "advertiser_ids不能为空"})
    except:
        return jsonify({"code": 400, "message": "advertiser_ids格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://ad.oceanengine.com/open_api/2/fund/shared_wallet_balance/get/"
        params = {"advertiser_ids": json.dumps(ids_list)}
        headers = {"Access-Token": access_token}
        
        query_string = f"advertiser_ids={json.dumps(ids_list)}"
        full_url = url + "?" + query_string
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})