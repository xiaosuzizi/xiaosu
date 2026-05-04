# routes/account_service.py - 账号服务模块
# 包含：工作台账户管理、客户信息、资质管理

from flask import Blueprint, request, jsonify
import requests
import json
from urllib.parse import urlencode
import time 

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
        # ==================== 资金和流水管理 - 直客账户汇款码充值 ====================

@account_service_bp.route("/api/account_service/charge/verify")
def charge_verify():
    """投放账户充值校验 - v3.0/charge/verify/get/"""
    cc_account_id = request.args.get("cc_account_id")
    account_id = request.args.get("account_id")
    platform = request.args.get("platform", "NATIVE_LIFE_AD")
    charge_type = request.args.get("charge_type", "PREPAY")
    charge_source = request.args.get("charge_source", "ONLINE_CHARGE")
    request_id = request.args.get("request_id")
    
    if not cc_account_id or not account_id:
        return jsonify({"code": 400, "message": "缺少必要参数（cc_account_id, account_id）"})
    
    if not request_id:
        request_id = f"req_{int(time.time())}_{account_id}"
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/charge/verify/get/"
        params = {
            "cc_account_id": int(cc_account_id),
            "account_id": int(account_id),
            "platform": platform,
            "request_id": request_id,
            "charge_type": charge_type,
            "charge_source": charge_source,
            "caller": "MAPI"
        }
        
        headers = {"Access-Token": access_token}
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


@account_service_bp.route("/api/account_service/remittance/generate", methods=["POST"])
def generate_remittance_code():
    """投放账户对公充值生成固定码 - v3.0/prepay_charge/generate_fix_remiattance_code/create/"""
    data = request.get_json() or {}
    
    cc_account_id = data.get("cc_account_id")
    charge_target_id = data.get("charge_target_id")
    charge_type = data.get("charge_type", "PREPAY")
    charge_amount = data.get("charge_amount")
    platform = data.get("platform", "NATIVE_LIFE_AD")
    request_id = data.get("request_id")
    
    if not cc_account_id or not charge_target_id or not charge_amount:
        return jsonify({"code": 400, "message": "缺少必要参数（cc_account_id, charge_target_id, charge_amount）"})
    
    if not request_id:
        request_id = f"req_{int(time.time())}_{charge_target_id}"
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/prepay_charge/generate_fix_remiattance_code/create/"
        
        payload = {
            "cc_account_id": int(cc_account_id),
            "charge_target_id": int(charge_target_id),
            "charge_type": charge_type,
            "charge_target_type": "ACCOUNT",
            "request_id": request_id,
            "charge_amount": float(charge_amount),
            "caller": "MAPI",
            "platform": platform
        }
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/remittance/list")
def get_remittance_list():
    """投放账户查询汇款码列表 - v3.0/fix_remittance_code/list/get/"""
    cc_account_id = request.args.get("cc_account_id")
    account_id = request.args.get("account_id")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 20))
    
    if not cc_account_id or not account_id:
        return jsonify({"code": 400, "message": "缺少必要参数（cc_account_id, account_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/fix_remittance_code/list/get/"
        
        # 构建带数组参数的查询字符串
        params = {
            "cc_account_id": int(cc_account_id),
            "account_id": int(account_id),
            "page": page,
            "page_size": min(page_size, 100),
            "caller": "MAPI",
            "remittance_code_list": []  # 空数组查询全部
        }
        
        # 手动构建 URL（处理数组编码）
        query_parts = []
        for k, v in params.items():
            if isinstance(v, list):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        
        full_url = url + "?" + "&".join(query_parts)
        headers = {"Access-Token": access_token}
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
        # ==================== 资金和流水管理 - 代理商转账 ====================

@account_service_bp.route("/api/account_service/transfer/balance")
def query_transfer_balance():
    """查询账户转账余额（代理）- v3.0/cg_transfer/query_transfer_balance/"""
    agent_id = request.args.get("agent_id")
    account_ids = request.args.get("account_ids")  # 逗号分隔
    
    if not agent_id:
        return jsonify({"code": 400, "message": "缺少agent_id参数（代理商账户ID）"})
    
    if not account_ids:
        return jsonify({"code": 400, "message": "缺少account_ids参数（查询账户ID列表，逗号分隔）"})
    
    try:
        ids_list = [int(x.strip()) for x in account_ids.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "account_ids不能为空"})
    except:
        return jsonify({"code": 400, "message": "account_ids格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/query_transfer_balance/"
        
        params = {
            "biz_request_no": str(uuid.uuid4()),
            "agent_id": int(agent_id),
            "account_id_list": json.dumps(ids_list)
        }
        
        query_string = urlencode({k: v if isinstance(v, str) else v for k, v in params.items()})
        full_url = url + "?" + query_string
        headers = {"Access-Token": access_token}
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/transfer/can_transfer")
def query_can_transfer_balance():
    """获取最大可转余额（代理）- v3.0/cg_transfer/query_can_transfer_balance/"""
    agent_id = request.args.get("agent_id")
    account_id = request.args.get("account_id")  # 锚定账户ID（减款方）
    target_account_ids = request.args.get("target_account_ids")  # 目标账户ID列表，逗号分隔
    transfer_direction = request.args.get("transfer_direction", "TRANSFER_OUT")  # TRANSFER_IN/TRANSFER_OUT
    
    if not agent_id or not account_id:
        return jsonify({"code": 400, "message": "缺少必要参数（agent_id, account_id）"})
    
    if not target_account_ids:
        return jsonify({"code": 400, "message": "缺少target_account_ids参数（目标账户ID列表）"})
    
    try:
        target_ids_list = [int(x.strip()) for x in target_account_ids.split(",") if x.strip()]
        if len(target_ids_list) == 0:
            return jsonify({"code": 400, "message": "target_account_ids不能为空"})
        if len(target_ids_list) > 100:
            return jsonify({"code": 400, "message": "最多支持100个目标账户"})
    except:
        return jsonify({"code": 400, "message": "target_account_ids格式错误"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/query_can_transfer_balance/"
        
        params = {
            "biz_request_no": str(uuid.uuid4()),
            "agent_id": int(agent_id),
            "account_id": int(account_id),
            "target_account_id_list": json.dumps(target_ids_list),
            "transfer_direction": transfer_direction
        }
        
        query_string = urlencode({k: v if isinstance(v, str) else v for k, v in params.items()})
        full_url = url + "?" + query_string
        headers = {"Access-Token": access_token}
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/transfer/create", methods=["POST"])
def create_transfer():
    """发起转账（代理）- v3.0/cg_transfer/create_transfer/"""
    data = request.get_json() or {}
    
    agent_id = data.get("agent_id")
    account_id = data.get("account_id")  # 锚定账户ID（减款方）
    target_accounts = data.get("target_accounts", [])  # 目标账户列表 [{account_id, amount, capital_type}]
    transfer_direction = data.get("transfer_direction", "TRANSFER_OUT")
    remark = data.get("remark", "")
    
    if not agent_id or not account_id:
        return jsonify({"code": 400, "message": "缺少必要参数（agent_id, account_id）"})
    
    if not target_accounts or len(target_accounts) == 0:
        return jsonify({"code": 400, "message": "缺少target_accounts（目标账户转账明细）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/create_transfer/"
        
        # 构建target_account_detail_list
        target_detail_list = []
        for target in target_accounts:
            target_detail_list.append({
                "account_id": int(target.get("account_id")),
                "transfer_capital_detail_list": [{
                    "capital_type": target.get("capital_type", "PREPAY_BIDDING"),
                    "transfer_amount": int(target.get("amount", 0)),  # 单位：分
                    "capital_sub_type": target.get("capital_sub_type", "NORMAL")
                }]
            })
        
        payload = {
            "biz_request_no": str(uuid.uuid4()),
            "agent_id": int(agent_id),
            "account_id": int(account_id),
            "target_account_detail_list": target_detail_list,
            "transfer_direction": transfer_direction,
            "remark": remark
        }
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/transfer/detail")
def query_transfer_detail():
    """查询转账单信息（代理）- v3.0/cg_transfer/query_transfer_detail/"""
    agent_id = request.args.get("agent_id")
    transfer_biz_request_no = request.args.get("transfer_biz_request_no")  # 发起转账的幂等ID
    transfer_serial = request.args.get("transfer_serial")  # 转账单号
    
    if not agent_id:
        return jsonify({"code": 400, "message": "缺少agent_id参数"})
    
    if not transfer_biz_request_no and not transfer_serial:
        return jsonify({"code": 400, "message": "transfer_biz_request_no和transfer_serial至少传一个"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/query_transfer_detail/"
        
        params = {
            "biz_request_no": str(uuid.uuid4()),
            "agent_id": int(agent_id)
        }
        
        if transfer_biz_request_no:
            params["transfer_biz_request_no"] = transfer_biz_request_no
        if transfer_serial:
            params["transfer_serial"] = transfer_serial
        
        query_string = urlencode({k: v for k, v in params.items()})
        full_url = url + "?" + query_string
        headers = {"Access-Token": access_token}
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
        # ==================== 资金和流水管理 - 资金共享 ====================

@account_service_bp.route("/api/account_service/shared_wallet/balance/batch")
def get_shared_wallet_balance_batch():
    """批量查询钱包余额 - v3.0/shared_wallet/wallet_balance/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    wallet_id_list = request.args.get("wallet_id_list")  # 逗号分隔
    account_platform_type = request.args.get("account_platform_type", "NO_LIMIT")
    capital_type = request.args.get("capital_type", "NO_LIMIT")
    delivery_type = request.args.get("delivery_type", "NO_LIMIT")
    
    if not account_id or not wallet_id_list:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, wallet_id_list）"})
    
    try:
        ids_list = [int(x.strip()) for x in wallet_id_list.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "wallet_id_list不能为空"})
        if len(ids_list) > 200:
            return jsonify({"code": 400, "message": "最多支持200个钱包ID"})
    except:
        return jsonify({"code": 400, "message": "wallet_id_list格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/wallet_balance/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "wallet_id_list": json.dumps(ids_list)
        }
        if account_platform_type and account_platform_type != "NO_LIMIT":
            params["wallet_balance_filters"] = json.dumps({
                "account_platform_type": account_platform_type,
                "capital_type": capital_type,
                "delivery_type": delivery_type
            })
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/transaction_detail")
def get_shared_wallet_transaction_detail():
    """查询共享钱包流水明细 - v3.0/shared_wallet/transaction_detail/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    shared_wallet_id = request.args.get("shared_wallet_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 10))
    
    if not account_id or not shared_wallet_id or not start_date or not end_date:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, shared_wallet_id, start_date, end_date）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/transaction_detail/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "shared_wallet_id": int(shared_wallet_id),
            "start_date": start_date,
            "end_date": end_date,
            "page": page,
            "page_size": min(page_size, 100)
        }
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/daily_stat")
def get_shared_wallet_daily_stat():
    """查询共享钱包日流水 - v3.0/shared_wallet/daily_stat/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    shared_wallet_id = request.args.get("shared_wallet_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 10))
    
    if not account_id or not shared_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, shared_wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/daily_stat/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "shared_wallet_id": int(shared_wallet_id),
            "page": page,
            "page_size": min(page_size, 100)
        }
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
            
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/main_wallet")
def get_shared_wallet_main_wallet():
    """共享钱包信息查询 - v3.0/shared_wallet/main_wallet/get/"""
    account_id = request.args.get("account_id")
    main_wallet_id = request.args.get("main_wallet_id")
    account_type = request.args.get("account_type", "AD")
    
    if not account_id or not main_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, main_wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/main_wallet/get/"
        params = {
            "account_id": int(account_id),
            "main_wallet_id": int(main_wallet_id),
            "account_type": account_type
        }
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/wallet_info")
def get_shared_wallet_info_batch():
    """批量查询钱包信息 - v3.0/shared_wallet/wallet_info/get/"""
    account_id = request.args.get("account_id")
    wallet_id_list = request.args.get("wallet_id_list")  # 逗号分隔
    account_type = request.args.get("account_type", "AD")
    
    if not account_id or not wallet_id_list:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, wallet_id_list）"})
    
    try:
        ids_list = [int(x.strip()) for x in wallet_id_list.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "wallet_id_list不能为空"})
        if len(ids_list) > 200:
            return jsonify({"code": 400, "message": "最多支持200个钱包ID"})
    except:
        return jsonify({"code": 400, "message": "wallet_id_list格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/wallet_info/get/"
        params = {
            "account_id": int(account_id),
            "wallet_id_list": json.dumps(ids_list),
            "account_type": account_type
        }
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/wallet_relation")
def get_shared_wallet_wallet_relation():
    """查询子钱包下绑定的adv列表 - v3.0/shared_wallet/wallet_relation/get/"""
    account_id = request.args.get("account_id")
    shared_wallet_id = request.args.get("shared_wallet_id")
    account_type = request.args.get("account_type", "AD")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 10))
    
    if not account_id or not shared_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, shared_wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/wallet_relation/get/"
        params = {
            "account_id": int(account_id),
            "shared_wallet_id": int(shared_wallet_id),
            "account_type": account_type,
            "page": page,
            "page_size": min(page_size, 100)
        }
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/account_relation")
def get_shared_wallet_account_relation():
    """查询账户对应公司下的钱包关系 - v3.0/shared_wallet/account_relation/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    
    if not account_id:
        return jsonify({"code": 400, "message": "缺少account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/account_relation/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type
        }
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/budget")
def get_shared_wallet_budget():
    """查询子钱包预算 - v3.0/shared_wallet/budget/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    sub_wallet_id = request.args.get("sub_wallet_id")
    
    if not account_id or not sub_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, sub_wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/budget/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "sub_wallet_id": int(sub_wallet_id)
        }
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/budget/submit", methods=["POST"])
def submit_shared_wallet_budget():
    """设置子钱包预算 - v3.0/shared_wallet/budget/submit/"""
    data = request.get_json() or {}
    
    account_id = data.get("account_id")
    account_type = data.get("account_type", "AGENT")
    sub_wallet_id = data.get("sub_wallet_id")
    effective_mode = data.get("effective_mode", "IMMEDIATE")
    budget_mode = data.get("budget_mode", "DAY")
    budget = data.get("budget")
    
    if not account_id or not sub_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, sub_wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/budget/submit/"
        
        payload = {
            "account_id": int(account_id),
            "account_type": account_type,
            "sub_wallet_id": int(sub_wallet_id),
            "effective_mode": effective_mode,
            "budget": {
                "budget_mode": budget_mode
            }
        }
        if budget is not None and budget_mode != "INFINITE":
            payload["budget"]["budget"] = float(budget)
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/watch_rule")
def get_shared_wallet_watch_rule():
    """查询子钱包盯盘规则 - v3.0/shared_wallet/watch_rule/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    sub_wallet_id = request.args.get("sub_wallet_id")
    
    if not account_id or not sub_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, sub_wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/watch_rule/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "sub_wallet_id": int(sub_wallet_id)
        }
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/watch_rule/submit", methods=["POST"])
def submit_shared_wallet_watch_rule():
    """设置子钱包盯盘规则 - v3.0/shared_wallet/watch_rule/submit/"""
    data = request.get_json() or {}
    
    account_id = data.get("account_id")
    account_type = data.get("account_type", "AGENT")
    rule = data.get("rule", {})
    
    if not account_id or not rule.get("wallet_id"):
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, rule.wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/watch_rule/submit/"
        
        payload = {
            "account_id": int(account_id),
            "account_type": account_type,
            "rule": rule
        }
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/shared_relation/create", methods=["POST"])
def create_shared_wallet_relation():
    """共享钱包绑定/解绑 - v3.0/shared_wallet/shared_relation/create/"""
    data = request.get_json() or {}
    
    account_id = data.get("account_id")
    account_type = data.get("account_type", "AGENT")
    operation_id = data.get("operation_id")
    relation_change_mode = data.get("relation_change_mode", "bind")
    from_wallet_id = data.get("from_wallet_id", 0)
    to_wallet_id = data.get("to_wallet_id", 0)
    adv_range_parameter = data.get("adv_range_parameter", {})
    
    if not account_id or not operation_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, operation_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/shared_relation/create/"
        
        payload = {
            "account_id": int(account_id),
            "account_type": account_type,
            "operation_id": int(operation_id),
            "relation_change_mode": relation_change_mode,
            "from_wallet_id": int(from_wallet_id),
            "to_wallet_id": int(to_wallet_id),
            "adv_range_parameter": adv_range_parameter
        }
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/wallet_adv_operation_log")
def get_shared_wallet_adv_operation_log():
    """查询ADV粒度操作记录 - v3.0/shared_wallet/wallet_adv_operation_log/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AGENT")
    wallet_id = request.args.get("wallet_id")
    adv_id = request.args.get("adv_id")
    operation_id = request.args.get("operation_id")
    status_filter = request.args.get("status_filter", "all")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 10))
    
    if not account_id or not wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, wallet_id）"})
    
    if not adv_id and not operation_id:
        return jsonify({"code": 400, "message": "adv_id和operation_id至少传一个"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/wallet_adv_operation_log/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "wallet_id": int(wallet_id),
            "page": page,
            "page_size": min(page_size, 100)
        }
        
        filtering = {}
        if adv_id:
            filtering["adv_id"] = int(adv_id)
        if operation_id:
            filtering["operation_id"] = int(operation_id)
        if status_filter:
            filtering["status_filter"] = status_filter
        
        if filtering:
            params["filtering"] = json.dumps(filtering)
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/wallet_operation_log")
def get_shared_wallet_operation_log():
    """查询钱包粒度操作记录 - v3.0/shared_wallet/wallet_operation_log/get/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AGENT")
    wallet_id = request.args.get("wallet_id")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 10))
    operation_type_list = request.args.get("operation_type_list")  # 逗号分隔
    status_filter = request.args.get("status_filter", "all")
    operation_id = request.args.get("operation_id")
    
    if not account_id or not wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/wallet_operation_log/get/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "wallet_id": int(wallet_id),
            "page": page,
            "page_size": min(page_size, 100)
        }
        
        filtering = {}
        if operation_type_list:
            filtering["operation_type_list"] = [x.strip() for x in operation_type_list.split(",") if x.strip()]
        if status_filter:
            filtering["status_filter"] = status_filter
        if operation_id:
            filtering["operation_id"] = int(operation_id)
        
        if filtering:
            params["filtering"] = json.dumps(filtering)
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/shared_wallet/sub_wallet/create", methods=["POST"])
def create_shared_sub_wallet():
    """创建小钱包 - v3.0/shared_wallet/sub_wallet/create/"""
    data = request.get_json() or {}
    
    account_id = data.get("account_id")
    account_type = data.get("account_type", "AGENT")
    wallet_id = data.get("wallet_id")
    wallet_name = data.get("wallet_name")
    wallet_description = data.get("wallet_description", "")
    wallet_label = data.get("wallet_label", [])
    main_wallet_id = data.get("main_wallet_id")
    shared_range = data.get("shared_range", {})
    
    if not account_id or not wallet_id or not wallet_name or not main_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, wallet_id, wallet_name, main_wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/shared_wallet/sub_wallet/create/"
        
        payload = {
            "account_id": int(account_id),
            "account_type": account_type,
            "wallet_id": int(wallet_id),
            "wallet_name": wallet_name,
            "main_wallet_id": int(main_wallet_id),
            "shared_range": shared_range
        }
        if wallet_description:
            payload["wallet_description"] = wallet_description
        if wallet_label and len(wallet_label) > 0:
            payload["wallet_label"] = wallet_label
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
        # ==================== 资金和流水管理 - 资金共享-直客充值能力 ====================

@account_service_bp.route("/api/account_service/wallet/charge/verify")
def get_wallet_charge_verify():
    """钱包充值校验 - v3.0/wallet/charge/verify/get/"""
    account_id = request.args.get("account_id")
    wallet_id = request.args.get("wallet_id")
    charge_type = request.args.get("charge_type", "PREPAY")
    
    if not account_id or not wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, wallet_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/wallet/charge/verify/get/"
        params = {
            "account_id": int(account_id),
            "wallet_id": int(wallet_id),
            "charge_type": charge_type
        }
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/wallet/prepay_charge/remittance_code", methods=["POST"])
def create_wallet_prepay_charge_remittance_code():
    """钱包对公充值并获取汇款码 - v3.0/wallet/prepay_charge/generate_remittance_code/create/"""
    data = request.get_json() or {}
    
    account_id = data.get("account_id")
    charge_target_id = data.get("charge_target_id")
    charge_target_type = data.get("charge_target_type", "WALLET")
    platform = data.get("platform", "AD")
    request_id_str = data.get("request_id")
    charge_amount = data.get("charge_amount")
    delivery_type = data.get("delivery_type", "GENERAL")
    caller = data.get("caller", "MAPI")
    
    if not account_id or not charge_target_id or not charge_amount:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, charge_target_id, charge_amount）"})
    
    if not request_id_str:
        import uuid
        request_id_str = str(uuid.uuid4())
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/wallet/prepay_charge/generate_remittance_code/create/"
        
        payload = {
            "account_id": int(account_id),
            "charge_target_id": int(charge_target_id),
            "charge_target_type": charge_target_type,
            "platform": platform,
            "request_id": request_id_str,
            "charge_amount": float(charge_amount),
            "delivery_type": delivery_type,
            "caller": caller
        }
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/wallet/remittance_code/list")
def get_wallet_remittance_code_list():
    """钱包查询汇款码列表 - v3.0/wallet/remittance_code/list/get/"""
    account_id = request.args.get("account_id")
    charge_target_id = request.args.get("charge_target_id")
    charge_target_type = request.args.get("charge_target_type", "WALLET")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 10))
    remittance_code_list = request.args.get("remittance_code_list")  # 逗号分隔
    
    if not account_id or not charge_target_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, charge_target_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/wallet/remittance_code/list/get/"
        params = {
            "account_id": int(account_id),
            "charge_target_id": int(charge_target_id),
            "charge_target_type": charge_target_type,
            "page": page,
            "page_size": min(page_size, 100)
        }
        
        if remittance_code_list:
            codes = [x.strip() for x in remittance_code_list.split(",") if x.strip()]
            if codes:
                params["remittance_code_list"] = json.dumps(codes)
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
        # ==================== 资金和流水管理 - 资金共享-转账能力 ====================

@account_service_bp.route("/api/account_service/wallet/transfer/can_transfer_balance")
def get_wallet_transfer_can_transfer_balance():
    """资金共享-最大可转余额查询 - v3.0/cg_transfer/wallet/transfer/can_transfer_balance/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    main_wallet_id = request.args.get("main_wallet_id")
    sub_wallet_list = request.args.get("sub_wallet_list")  # 逗号分隔
    transfer_direction = request.args.get("transfer_direction", "TRANSFER_OUT")
    
    if not account_id or not main_wallet_id or not sub_wallet_list:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, main_wallet_id, sub_wallet_list）"})
    
    try:
        ids_list = [int(x.strip()) for x in sub_wallet_list.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "sub_wallet_list不能为空"})
    except:
        return jsonify({"code": 400, "message": "sub_wallet_list格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/wallet/transfer/can_transfer_balance/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "biz_request_no": str(uuid.uuid4()),
            "main_wallet_id": int(main_wallet_id),
            "sub_wallet_list": json.dumps(ids_list),
            "transfer_direction": transfer_direction
        }
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/wallet/transfer/create", methods=["POST"])
def create_wallet_transfer():
    """资金共享-发起转账 - v3.0/cg_transfer/wallet/transfer/create/"""
    data = request.get_json() or {}
    
    account_id = data.get("account_id")
    account_type = data.get("account_type", "AD")
    main_wallet_id = data.get("main_wallet_id")
    transfer_direction = data.get("transfer_direction", "TRANSFER_OUT")
    remark = data.get("remark", "")
    target_wallet_details = data.get("target_wallet_details", [])  # [{sub_wallet_id, capital_type, platform, transfer_amount, capital_sub_type}]
    
    if not account_id or not main_wallet_id:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, main_wallet_id）"})
    
    if not target_wallet_details or len(target_wallet_details) == 0:
        return jsonify({"code": 400, "message": "缺少target_wallet_details（转账目标钱包列表）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/wallet/transfer/create/"
        
        # 构建target_wallet_detail_list
        target_list = []
        for target in target_wallet_details:
            target_list.append({
                "sub_wallet_id": int(target.get("sub_wallet_id")),
                "transfer_capital_detail_list": [{
                    "capital_type": target.get("capital_type", "PREPAY_GENERAL"),
                    "platform": target.get("platform", "AD"),
                    "transfer_amount": int(target.get("transfer_amount", 0)),
                    "capital_sub_type": target.get("capital_sub_type", "NORMAL")
                }]
            })
        
        payload = {
            "account_id": int(account_id),
            "account_type": account_type,
            "biz_request_no": str(uuid.uuid4()),
            "main_wallet_id": int(main_wallet_id),
            "target_wallet_detail_list": target_list,
            "transfer_direction": transfer_direction,
            "remark": remark
        }
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/wallet/transfer/list")
def get_wallet_transfer_list():
    """资金共享-查询转账列表 - v3.0/cg_transfer/wallet/transfer/list/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    query_begin_time = request.args.get("query_begin_time")
    query_end_time = request.args.get("query_end_time")
    query_wallet_id_list = request.args.get("query_wallet_id_list")  # 逗号分隔
    payee_id = request.args.get("payee_id")
    remitter_id = request.args.get("remitter_id")
    page_size = int(request.args.get("page_size", 20))
    page_num = int(request.args.get("page_num", 1))
    
    if not account_id or not query_begin_time or not query_end_time or not query_wallet_id_list:
        return jsonify({"code": 400, "message": "缺少必要参数（account_id, query_begin_time, query_end_time, query_wallet_id_list）"})
    
    try:
        ids_list = [int(x.strip()) for x in query_wallet_id_list.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "query_wallet_id_list不能为空"})
    except:
        return jsonify({"code": 400, "message": "query_wallet_id_list格式错误"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/wallet/transfer/list/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "biz_request_no": str(uuid.uuid4()),
            "query_begin_time": query_begin_time,
            "query_end_time": query_end_time,
            "query_wallet_id_list": json.dumps(ids_list),
            "page_info": json.dumps({
                "page_size": min(page_size, 100),
                "page_num": page_num
            })
        }
        
        if payee_id:
            params["payee_id"] = int(payee_id)
        if remitter_id:
            params["remitter_id"] = int(remitter_id)
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/wallet/transfer/detail")
def get_wallet_transfer_detail():
    """资金共享-查询转账单信息 - v3.0/cg_transfer/wallet/transfer/detail/"""
    account_id = request.args.get("account_id")
    account_type = request.args.get("account_type", "AD")
    transfer_biz_request_no = request.args.get("transfer_biz_request_no")
    transfer_serial = request.args.get("transfer_serial")
    
    if not account_id:
        return jsonify({"code": 400, "message": "缺少account_id参数"})
    
    if not transfer_biz_request_no and not transfer_serial:
        return jsonify({"code": 400, "message": "transfer_biz_request_no和transfer_serial至少传一个"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        import uuid
        url = "https://api.oceanengine.com/open_api/v3.0/cg_transfer/wallet/transfer/detail/"
        params = {
            "account_id": int(account_id),
            "account_type": account_type,
            "biz_request_no": str(uuid.uuid4())
        }
        
        if transfer_biz_request_no:
            params["transfer_biz_request_no"] = transfer_biz_request_no
        if transfer_serial:
            params["transfer_serial"] = transfer_serial
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
        # ==================== 资金和流水管理 - 结算（for品牌） ====================

@account_service_bp.route("/api/account_service/brand/query/project")
def query_brand_project():
    """查询项目信息 - /open_api/2/query/project/"""
    agent_id = request.args.get("agent_id")
    customer_id = request.args.get("customer_id")
    platform_list = request.args.get("platform_list")  # 逗号分隔
    serving_type_list = request.args.get("serving_type_list")  # 逗号分隔
    project_status_list = request.args.get("project_status_list")  # 逗号分隔
    project_start_date_begin = request.args.get("project_start_date_begin")
    project_start_date_end = request.args.get("project_start_date_end")
    project_end_date_begin = request.args.get("project_end_date_begin")
    project_end_date_end = request.args.get("project_end_date_end")
    receipt_status_list = request.args.get("receipt_status_list")  # 逗号分隔
    deadline = request.args.get("deadline")
    advertiser_id = request.args.get("advertiser_id")
    count = int(request.args.get("count", 100))
    cursor = int(request.args.get("cursor", -1))
    
    if not agent_id:
        return jsonify({"code": 400, "message": "缺少agent_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/2/query/project/"
        params = {
            "agent_id": int(agent_id),
            "count": min(count, 1000),
            "cursor": cursor
        }
        
        filtering = {}
        if customer_id:
            filtering["customer_id"] = int(customer_id)
        if platform_list:
            filtering["platform_list"] = [x.strip() for x in platform_list.split(",") if x.strip()]
        if serving_type_list:
            filtering["serving_type_list"] = [x.strip() for x in serving_type_list.split(",") if x.strip()]
        if project_status_list:
            filtering["project_status_list"] = [x.strip() for x in project_status_list.split(",") if x.strip()]
        if project_start_date_begin:
            filtering["project_start_date_begin"] = project_start_date_begin
        if project_start_date_end:
            filtering["project_start_date_end"] = project_start_date_end
        if project_end_date_begin:
            filtering["project_end_date_begin"] = project_end_date_begin
        if project_end_date_end:
            filtering["project_end_date_end"] = project_end_date_end
        if receipt_status_list:
            filtering["receipt_status_list"] = [x.strip() for x in receipt_status_list.split(",") if x.strip()]
        if deadline:
            filtering["deadline"] = deadline
        if advertiser_id:
            filtering["advertiser_id"] = int(advertiser_id)
        
        if filtering:
            params["filtering"] = json.dumps(filtering)
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/brand/query/statement")
def query_brand_statement():
    """查询项目关联结算单信息 - /open_api/2/query/statement/"""
    agent_id = request.args.get("agent_id")
    project_id_list = request.args.get("project_id_list")  # 逗号分隔
    
    if not agent_id or not project_id_list:
        return jsonify({"code": 400, "message": "缺少必要参数（agent_id, project_id_list）"})
    
    try:
        ids_list = [int(x.strip()) for x in project_id_list.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "project_id_list不能为空"})
        if len(ids_list) > 1000:
            return jsonify({"code": 400, "message": "最多支持1000个项目ID"})
    except:
        return jsonify({"code": 400, "message": "project_id_list格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/2/query/statement/"
        params = {
            "agent_id": int(agent_id),
            "project_id_list": json.dumps(ids_list)
        }
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/brand/query/booking/business_entity_id")
def query_brand_booking_business_entity_id():
    """排期—查询业务实体ID - /open_api/2/query/booking/business_entity_id/get/"""
    agent_id = request.args.get("agent_id")
    order_ids = request.args.get("order_ids")  # 逗号分隔
    
    if not agent_id or not order_ids:
        return jsonify({"code": 400, "message": "缺少必要参数（agent_id, order_ids）"})
    
    try:
        ids_list = [int(x.strip()) for x in order_ids.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "order_ids不能为空"})
    except:
        return jsonify({"code": 400, "message": "order_ids格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/2/query/booking/business_entity_id/get/"
        params = {
            "agent_id": int(agent_id),
            "order_ids": json.dumps(ids_list)
        }
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/brand/create/statement_invoice", methods=["POST"])
def create_brand_statement_invoice():
    """开票-新建开票申请单（代理商版） - /open_api/2/create/statement_invoice/"""
    data = request.get_json() or {}
    
    agent_ids = data.get("agent_ids", [])
    customer_id_list = data.get("customer_id_list", [])
    statement_serial = data.get("statement_serial")
    rebate_item_list = data.get("rebate_item_list", [])
    invoice_type = data.get("invoice_type", "GENERAL")
    unprintable_remark = data.get("unprintable_remark", "")
    customer_subject_name = data.get("customer_subject_name")
    customer_tax_no = data.get("customer_tax_no")
    customer_address = data.get("customer_address", "")
    customer_phone = data.get("customer_phone", "")
    customer_bank = data.get("customer_bank", "")
    customer_bank_account = data.get("customer_bank_account", "")
    invoice_bill_list = data.get("invoice_bill_list", [])
    select_address_and_phone = data.get("select_address_and_phone", False)
    select_bank_and_account = data.get("select_bank_and_account", False)
    customer_email = data.get("customer_email")
    customer_sms_phone = data.get("customer_sms_phone", "")
    
    if not agent_ids or not statement_serial or not customer_subject_name or not customer_tax_no or not customer_email:
        return jsonify({"code": 400, "message": "缺少必要参数（agent_ids, statement_serial, customer_subject_name, customer_tax_no, customer_email）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/2/create/statement_invoice/"
        
        payload = {
            "agent_ids": agent_ids if isinstance(agent_ids, list) else [int(agent_ids)],
            "statement_serial": statement_serial,
            "invoice_type": invoice_type,
            "customer_subject_name": customer_subject_name,
            "customer_tax_no": customer_tax_no,
            "customer_email": customer_email,
            "invoice_bill_list": invoice_bill_list
        }
        
        if customer_id_list and len(customer_id_list) > 0:
            payload["customer_id_list"] = customer_id_list if isinstance(customer_id_list, list) else [int(customer_id_list)]
        if rebate_item_list and len(rebate_item_list) > 0:
            payload["rebate_item_list"] = rebate_item_list
        if unprintable_remark:
            payload["unprintable_remark"] = unprintable_remark
        if customer_address:
            payload["customer_address"] = customer_address
        if customer_phone:
            payload["customer_phone"] = customer_phone
        if customer_bank:
            payload["customer_bank"] = customer_bank
        if customer_bank_account:
            payload["customer_bank_account"] = customer_bank_account
        if select_address_and_phone:
            payload["select_address_and_phone"] = bool(select_address_and_phone)
        if select_bank_and_account:
            payload["select_bank_and_account"] = bool(select_bank_and_account)
        if customer_sms_phone:
            payload["customer_sms_phone"] = customer_sms_phone
        
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/brand/query/invoice")
def query_brand_invoice():
    """开票-查询开票单数据（代理商版） - /open_api/2/query/invoice/"""
    agent_id = request.args.get("agent_id")
    statement_serials = request.args.get("statement_serials")  # 逗号分隔
    project_serials = request.args.get("project_serials")  # 逗号分隔
    invoice_statuses = request.args.get("invoice_statuses")  # 逗号分隔
    invoice_serial_list = request.args.get("invoice_serial_list")  # 逗号分隔
    contract_serial = request.args.get("contract_serial")
    submit_start_time = request.args.get("submit_start_time")
    submit_end_time = request.args.get("submit_end_time")
    invoice_start_date = request.args.get("invoice_start_date")
    invoice_end_date = request.args.get("invoice_end_date")
    invoice_type = request.args.get("invoice_type")
    difference_invoice = request.args.get("difference_invoice")
    revert_status_list = request.args.get("revert_status_list")  # 逗号分隔
    platform = request.args.get("platform")
    page_size = int(request.args.get("page_size", 20))
    page = int(request.args.get("page", 1))
    
    if not agent_id:
        return jsonify({"code": 400, "message": "缺少agent_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/2/query/invoice/"
        params = {
            "agent_id": int(agent_id),
            "page_size": min(page_size, 100),
            "page": page
        }
        
        filtering = {}
        if statement_serials:
            filtering["statement_serials"] = [x.strip() for x in statement_serials.split(",") if x.strip()]
        if project_serials:
            filtering["project_serials"] = [x.strip() for x in project_serials.split(",") if x.strip()]
        if invoice_statuses:
            filtering["invoice_statuses"] = [int(x.strip()) for x in invoice_statuses.split(",") if x.strip()]
        if invoice_serial_list:
            filtering["invoice_serial_list"] = [x.strip() for x in invoice_serial_list.split(",") if x.strip()]
        if contract_serial:
            filtering["contract_serial"] = contract_serial
        if submit_start_time:
            filtering["submit_start_time"] = submit_start_time
        if submit_end_time:
            filtering["submit_end_time"] = submit_end_time
        if invoice_start_date:
            filtering["invoice_start_date"] = invoice_start_date
        if invoice_end_date:
            filtering["invoice_end_date"] = invoice_end_date
        if invoice_type:
            filtering["invoice_type"] = invoice_type
        if difference_invoice:
            filtering["difference_invoice"] = difference_invoice
        if revert_status_list:
            filtering["revert_status_list"] = [int(x.strip()) for x in revert_status_list.split(",") if x.strip()]
        if platform:
            filtering["platform"] = platform
        
        if filtering:
            params["filtering"] = json.dumps(filtering)
        
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@account_service_bp.route("/api/account_service/brand/query/invoice_electronic_url")
def query_brand_invoice_electronic_url():
    """开票-获取电子发票文件接口（代理商版） - /open_api/2/query/invoice_electronic_url/"""
    agent_ids = request.args.get("agent_ids")  # 逗号分隔
    invoice_serial = request.args.get("invoice_serial")
    
    if not agent_ids or not invoice_serial:
        return jsonify({"code": 400, "message": "缺少必要参数（agent_ids, invoice_serial）"})
    
    try:
        ids_list = [int(x.strip()) for x in agent_ids.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "agent_ids不能为空"})
    except:
        return jsonify({"code": 400, "message": "agent_ids格式错误，应为逗号分隔的数字"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/2/query/invoice_electronic_url/"
        params = {
            "agent_ids": json.dumps(ids_list),
            "invoice_serial": invoice_serial
        }
        headers = {"Access-Token": access_token}
        query_parts = []
        for k, v in params.items():
            if isinstance(v, (list, dict)):
                query_parts.append(f"{k}={json.dumps(v)}")
            else:
                query_parts.append(f"{k}={v}")
        full_url = url + "?" + "&".join(query_parts)
        
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})