# routes/local_delivery.py - 本地推投放能力 - 项目管理模块
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Blueprint, request, jsonify
import requests
import json
from urllib.parse import urlencode

# ==================== 工具函数 ====================

def get_any_valid_token():
    """获取任意一个有效的access_token"""
    try:
        import storage
        return storage.get_any_valid_token()
    except Exception as e:
        print(f"[ERROR] get_any_valid_token failed: {e}")
        return None

def fix_big_integers(data):
    """修复大整数精度问题（项目ID、单元ID、素材ID等转为字符串）"""
    if isinstance(data, dict):
        for key in ['project_id', 'promotion_id', 'material_id', 'advertiser_id',
                    'local_account_id', 'aweme_id', 'poi_id', 'product_id',
                    'tool_pack_id', 'market_page_id', 'multi_poi_id', 'sub_wallet_id',
                    'main_wallet_id', 'wallet_id', 'customer_id', 'agent_id',
                    'charge_target_id', 'account_id', 'anchor_id']:
            if key in data and data[key] is not None:
                data[key] = str(data[key])
        for value in data.values():
            fix_big_integers(value)
    elif isinstance(data, list):
        for item in data:
            fix_big_integers(item)
    return data

def build_query_url(base_url, params):
    """构建带查询参数的URL（处理列表和字典的JSON序列化，并正确编码）"""
    encoded_params = {}
    for k, v in params.items():
        if v is None:
            continue
        if isinstance(v, (list, dict)):
            encoded_params[k] = json.dumps(v, ensure_ascii=False)
        else:
            encoded_params[k] = v
    return base_url + "?" + urlencode(encoded_params)

# ==================== Blueprint ====================

local_delivery_bp = Blueprint('local_delivery', __name__)

# ==================== 1. 创建项目 ====================

@local_delivery_bp.route("/api/local_delivery/project/create", methods=["POST"])
def create_local_project():
    """创建项目 - v3.0/local/project/create/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id"):
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        # 修复：前端传来的 ID 字段如果是字符串，转回 int 再发给 API（避免JS精度丢失）
        for key in ['local_account_id']:
            if key in data and isinstance(data[key], str):
                try:
                    data[key] = int(data[key])
                except (ValueError, TypeError):
                    pass
        
        url = "https://api.oceanengine.com/open_api/v3.0/local/project/create/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 2. 更新项目 ====================

@local_delivery_bp.route("/api/local_delivery/project/update", methods=["POST"])
def update_local_project():
    """更新项目 - v3.0/local/project/update/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id") or not data.get("project_id"):
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, project_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/project/update/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 3. 获取项目列表 ====================

@local_delivery_bp.route("/api/local_delivery/project/list")
def get_local_project_list():
    """获取项目列表 - v3.0/local/project/list/"""
    local_account_id = request.args.get("local_account_id")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    filtering = request.args.get("filtering")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/project/list/"
        params = {
            "local_account_id": int(local_account_id),
            "page": page,
            "page_size": min(int(page_size), 100)
        }
        if filtering:
            params["filtering"] = filtering
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 4. 获取项目详情 ====================

@local_delivery_bp.route("/api/local_delivery/project/detail")
def get_local_project_detail():
    """获取项目详情 - v3.0/local/project/detail/"""
    local_account_id = request.args.get("local_account_id")
    project_id = request.args.get("project_id")
    
    if not local_account_id or not project_id:
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, project_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/project/detail/"
        params = {
            "local_account_id": int(local_account_id),
            "project_id": int(project_id)
        }
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 5. 批量更新项目状态 ====================

@local_delivery_bp.route("/api/local_delivery/project/status/update", methods=["POST"])
def batch_update_local_project_status():
    """批量更新项目状态 - v3.0/local/project/status/update/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id") or not data.get("data"):
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, data）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/project/status/update/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 6. 获取可投门店列表 ====================

@local_delivery_bp.route("/api/local_delivery/poi/get")
def get_local_poi_list():
    """获取可投门店列表 - v3.0/local/poi/get/"""
    local_account_id = request.args.get("local_account_id")
    local_delivery_scene = request.args.get("local_delivery_scene")
    search_key_word = request.args.get("search_key_word")
    province = request.args.get("province")
    city = request.args.get("city")
    product_id = request.args.get("product_id")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not local_delivery_scene:
        return jsonify({"code": 400, "message": "缺少local_delivery_scene参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/poi/get/"
        params = {
            "local_account_id": int(local_account_id),
            "local_delivery_scene": local_delivery_scene,
            "page": int(page),
            "page_size": min(int(page_size), 100)
        }
        
        filtering = {}
        if search_key_word:
            filtering["search_key_word"] = search_key_word
        if province:
            try:
                filtering["province"] = [int(x.strip()) for x in province.split(",") if x.strip()]
            except:
                return jsonify({"code": 400, "message": "province格式错误，应为逗号分隔的数字"})
        if city:
            try:
                filtering["city"] = [int(x.strip()) for x in city.split(",") if x.strip()]
            except:
                return jsonify({"code": 400, "message": "city格式错误，应为逗号分隔的数字"})
        if product_id:
            filtering["product_id"] = int(product_id)
        
        if filtering:
            params["filtering"] = filtering
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 7. 获取可投商品列表 ====================

@local_delivery_bp.route("/api/local_delivery/product/get")
def get_local_product_list():
    """获取可投商品列表 - v3.0/local/product/get/"""
    local_account_id = request.args.get("local_account_id")
    local_delivery_scene = request.args.get("local_delivery_scene")
    search_key_word = request.args.get("search_key_word")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not local_delivery_scene:
        return jsonify({"code": 400, "message": "缺少local_delivery_scene参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/product/get/"
        params = {
            "local_account_id": int(local_account_id),
            "local_delivery_scene": local_delivery_scene,
            "page": int(page),
            "page_size": min(int(page_size), 100)
        }
        
        filtering = {}
        if search_key_word:
            filtering["search_key_word"] = search_key_word
        
        if filtering:
            params["filtering"] = filtering
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 8. 获取本地推创编可用抖音号 ====================

@local_delivery_bp.route("/api/local_delivery/aweme/authorized/get")
def get_local_aweme_authorized():
    """获取本地推创编可用抖音号 - v3.0/local/aweme/authorized/get/"""
    local_account_id = request.args.get("local_account_id")
    marketing_goal = request.args.get("marketing_goal")
    search_key_word = request.args.get("search_key_word")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not marketing_goal:
        return jsonify({"code": 400, "message": "缺少marketing_goal参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/aweme/authorized/get/"
        params = {
            "local_account_id": int(local_account_id),
            "marketing_goal": marketing_goal,
            "page": int(page),
            "page_size": min(int(page_size), 100)
        }
        
        filtering = {}
        if search_key_word:
            filtering["search_key_word"] = search_key_word
        
        if filtering:
            params["filtering"] = filtering
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 9. 查询本地推创编可用人群包 ====================

@local_delivery_bp.route("/api/local_delivery/custom_audience/get")
def get_local_custom_audience():
    """查询本地推创编可用人群包 - v3.0/local/custom_audience/get/"""
    local_account_id = request.args.get("local_account_id")
    tags_type = request.args.get("tags_type")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "100")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not tags_type:
        return jsonify({"code": 400, "message": "缺少tags_type参数，请选择 CUSTOM 或 SYS_RECOMMEND"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/custom_audience/get/"
        params = {
            "local_account_id": int(local_account_id),
            "tags_type": tags_type,
            "page": int(page),
            "page_size": min(int(page_size), 1000)
        }
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        
        # JSON解析保护
        try:
            result = response.json()
        except Exception:
            return jsonify({"code": response.status_code, "message": f"API返回非JSON: {response.text[:200]}"})
        
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
    """查询本地推创编可用人群包 - v3.0/local/custom_audience/get/"""
    local_account_id = request.args.get("local_account_id")
    tags_type = request.args.get("tags_type")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "100")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/custom_audience/get/"
        params = {
            "local_account_id": int(local_account_id),
            "page": int(page),
            "page_size": min(int(page_size), 1000)
        }
        if tags_type:
            params["tags_type"] = tags_type
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 10. 根据多门店ID拉取门店ID ====================

@local_delivery_bp.route("/api/local_delivery/multi_poi_id/poi_ids/get")
def get_local_multi_poi_ids():
    """根据多门店ID拉取门店ID - v3.0/local/multi_poi_id/poi_ids/get/"""
    local_account_id = request.args.get("local_account_id")
    multi_poi_ids = request.args.get("multi_poi_ids")
    need_enable = request.args.get("need_enable", "false")
    
    if not local_account_id or not multi_poi_ids:
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, multi_poi_ids）"})
    
    try:
        ids_list = [int(x.strip()) for x in multi_poi_ids.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "multi_poi_ids不能为空"})
        if len(ids_list) > 50:
            return jsonify({"code": 400, "message": "multi_poi_ids最多50个"})
    except:
        return jsonify({"code": 400, "message": "multi_poi_ids格式错误"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/multi_poi_id/poi_ids/get/"
        params = {
            "local_account_id": int(local_account_id),
            "multi_poi_ids": ids_list,
            "need_enable": need_enable.lower() == "true"
        }
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 11. 获取可用留资组件列表 ====================

@local_delivery_bp.route("/api/local_delivery/tool_pack_list/get")
def get_local_tool_pack_list():
    """获取可用留资组件列表 - v3.0/local/tool_pack_list/get/"""
    local_account_id = request.args.get("local_account_id")
    delivery_goal = request.args.get("delivery_goal")
    poi_ids = request.args.get("poi_ids")
    product_ids = request.args.get("product_ids")
    # 关键修复：默认值改为完整枚举值
    intelligent_selection_mode = request.args.get("intelligent_selection_mode", "INTELLIGENT_SELECTION_MODE_OFF")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not delivery_goal:
        return jsonify({"code": 400, "message": "缺少delivery_goal参数"})
    
    # 条件必填校验
    if delivery_goal == "POI" and not poi_ids:
        return jsonify({"code": 400, "message": "delivery_goal为POI时，poi_ids必填"})
    if delivery_goal == "PRODUCT" and not product_ids:
        return jsonify({"code": 400, "message": "delivery_goal为PRODUCT时，product_ids必填"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/tool_pack_list/get/"
        params = {
            "local_account_id": int(local_account_id),
            "delivery_goal": delivery_goal,
            "intelligent_selection_mode": intelligent_selection_mode,
            "page": int(page),
            "page_size": min(int(page_size), 100)
        }
        
        if poi_ids:
            try:
                import json
                ids = json.loads(poi_ids)
                if isinstance(ids, list):
                    params["poi_ids"] = [int(x) for x in ids]
                else:
                    params["poi_ids"] = [int(x.strip()) for x in poi_ids.split(",") if x.strip()]
            except Exception as e:
                return jsonify({"code": 400, "message": f"poi_ids格式错误: {str(e)}"})
        
        if product_ids:
            try:
                import json
                ids = json.loads(product_ids)
                if isinstance(ids, list):
                    if len(ids) > 10:
                        return jsonify({"code": 400, "message": "product_ids最多10个"})
                    params["product_ids"] = [int(x) for x in ids]
                else:
                    params["product_ids"] = [int(x.strip()) for x in product_ids.split(",") if x.strip()]
            except Exception as e:
                return jsonify({"code": 400, "message": f"product_ids格式错误: {str(e)}"})
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        
        try:
            result = response.json()
        except Exception:
            return jsonify({"code": response.status_code, "message": f"API返回非JSON: {response.text[:200]}"})
        
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
    """获取可用留资组件列表 - v3.0/local/tool_pack_list/get/"""
    local_account_id = request.args.get("local_account_id")
    delivery_goal = request.args.get("delivery_goal")
    poi_ids = request.args.get("poi_ids")
    product_ids = request.args.get("product_ids")
    intelligent_selection_mode = request.args.get("intelligent_selection_mode", "OFF")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not delivery_goal:
        return jsonify({"code": 400, "message": "缺少delivery_goal参数"})
    
    # 条件必填校验
    if delivery_goal == "POI" and not poi_ids:
        return jsonify({"code": 400, "message": "delivery_goal为POI时，poi_ids必填"})
    if delivery_goal == "PRODUCT" and not product_ids:
        return jsonify({"code": 400, "message": "delivery_goal为PRODUCT时，product_ids必填"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/tool_pack_list/get/"
        params = {
            "local_account_id": int(local_account_id),
            "delivery_goal": delivery_goal,
            "intelligent_selection_mode": intelligent_selection_mode,
            "page": int(page),
            "page_size": min(int(page_size), 100)
        }
        
        if poi_ids:
            try:
                import json
                ids = json.loads(poi_ids)
                if isinstance(ids, list):
                    params["poi_ids"] = [int(x) for x in ids]
                else:
                    params["poi_ids"] = [int(x.strip()) for x in poi_ids.split(",") if x.strip()]
            except Exception as e:
                return jsonify({"code": 400, "message": f"poi_ids格式错误: {str(e)}"})
        
        if product_ids:
            try:
                import json
                ids = json.loads(product_ids)
                if isinstance(ids, list):
                    if len(ids) > 10:
                        return jsonify({"code": 400, "message": "product_ids最多10个"})
                    params["product_ids"] = [int(x) for x in ids]
                else:
                    params["product_ids"] = [int(x.strip()) for x in product_ids.split(",") if x.strip()]
            except Exception as e:
                return jsonify({"code": 400, "message": f"product_ids格式错误: {str(e)}"})
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        
        try:
            result = response.json()
        except Exception:
            return jsonify({"code": response.status_code, "message": f"API返回非JSON: {response.text[:200]}"})
        
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
    """获取可用留资组件列表 - v3.0/local/tool_pack/get/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id"):
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not data.get("delivery_goal"):
        return jsonify({"code": 400, "message": "缺少delivery_goal参数"})
    
    # 根据投放内容校验必填关联ID
    delivery_goal = data.get("delivery_goal")
    if delivery_goal == "POI" and not data.get("poi_ids"):
        return jsonify({"code": 400, "message": "delivery_goal为POI时，poi_ids必填"})
    if delivery_goal == "PRODUCT" and not data.get("product_ids"):
        return jsonify({"code": 400, "message": "delivery_goal为PRODUCT时，product_ids必填"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        # 注意：路径从 tool_pack_list/get 改为 tool_pack/get
        url = "https://api.oceanengine.com/open_api/v3.0/local/tool_pack_list/get/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        # JSON解析保护
        try:
            result = response.json()
        except Exception:
            return jsonify({"code": response.status_code, "message": f"API返回非JSON: {response.text[:200]}"})
        
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
    """获取可用留资组件列表 - v3.0/local/tool_pack_list/get/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id"):
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not data.get("delivery_goal"):
        return jsonify({"code": 400, "message": "缺少delivery_goal参数"})
    
    # 根据投放内容校验必填关联ID
    delivery_goal = data.get("delivery_goal")
    if delivery_goal == "POI" and not data.get("poi_ids"):
        return jsonify({"code": 400, "message": "delivery_goal为POI时，poi_ids必填"})
    if delivery_goal == "PRODUCT" and not data.get("product_ids"):
        return jsonify({"code": 400, "message": "delivery_goal为PRODUCT时，product_ids必填"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/tool_pack_list/get/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        # JSON解析保护
        try:
            result = response.json()
        except Exception:
            return jsonify({"code": response.status_code, "message": f"API返回非JSON: {response.text[:200]}"})
        
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
    """获取可用留资组件列表 - v3.0/local/tool_pack_list/get/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id"):
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/tool_pack_list/get/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 12. 获取可用留资组件详情 ====================

@local_delivery_bp.route("/api/local_delivery/tool_pack/detail")
def get_local_tool_pack_detail():
    """获取可用留资组件详情 - v3.0/local/tool_pack/detail/"""
    local_account_id = request.args.get("local_account_id")
    tool_pack_id = request.args.get("tool_pack_id")
    
    if not local_account_id or not tool_pack_id:
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, tool_pack_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/tool_pack/detail/"
        params = {
            "local_account_id": int(local_account_id),
            "tool_pack_id": int(tool_pack_id)
        }
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 13. 获取可用营销页列表 ====================

@local_delivery_bp.route("/api/local_delivery/market_page_list/get")
def get_local_market_page_list():
    """获取可用营销页列表 - v3.0/local/market_page_list/get/"""
    local_account_id = request.args.get("local_account_id")
    delivery_goal = request.args.get("delivery_goal")
    poi_ids = request.args.get("poi_ids")
    product_ids = request.args.get("product_ids")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    if not delivery_goal:
        return jsonify({"code": 400, "message": "缺少delivery_goal参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/market_page_list/get/"
        params = {
            "local_account_id": int(local_account_id),
            "delivery_goal": delivery_goal,
            "page": int(page),
            "page_size": min(int(page_size), 100)
        }
        
        if delivery_goal == "POI" and poi_ids:
            try:
                import json
                ids = json.loads(poi_ids)
                if isinstance(ids, list):
                    params["poi_ids"] = [int(x) for x in ids]
                else:
                    params["poi_ids"] = [int(x.strip()) for x in poi_ids.split(",") if x.strip()]
            except Exception as e:
                return jsonify({"code": 400, "message": f"poi_ids格式错误: {str(e)}"})
    
        if delivery_goal == "PRODUCT" and product_ids:
            try:
                import json
                ids = json.loads(product_ids)
                if isinstance(ids, list):
                    params["product_ids"] = [int(x) for x in ids]
                else:
                    params["product_ids"] = [int(x.strip()) for x in product_ids.split(",") if x.strip()]
            except Exception as e:
                return jsonify({"code": 400, "message": f"product_ids格式错误: {str(e)}"})
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 14. 查询营销页详情 ====================

@local_delivery_bp.route("/api/local_delivery/market_page/get")
def get_local_market_page_detail():
    """查询营销页详情 - v3.0/local/market_page/get/"""
    local_account_id = request.args.get("local_account_id")
    market_page_ids = request.args.get("market_page_ids")
    
    if not local_account_id or not market_page_ids:
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, market_page_ids）"})
    
    try:
        ids_list = [int(x.strip()) for x in market_page_ids.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "market_page_ids不能为空"})
        if len(ids_list) > 50:
            return jsonify({"code": 400, "message": "market_page_ids最多50个"})
    except:
        return jsonify({"code": 400, "message": "market_page_ids格式错误"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/market_page/get/"
        params = {
            "local_account_id": int(local_account_id),
            "market_page_ids": ids_list
        }
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 15. 获取私信接待抖音号 ====================

@local_delivery_bp.route("/api/local_delivery/consult_awame_list/get")
def get_local_consult_awame_list():
    """获取私信接待抖音号 - v3.0/local/consult_awame_list/get/"""
    local_account_id = request.args.get("local_account_id")
    delivery_goal = request.args.get("delivery_goal")
    poi_ids = request.args.get("poi_ids")
    product_ids = request.args.get("product_ids")
    search_key_word = request.args.get("search_key_word")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/consult_awame_list/get/"
        params = {
            "local_account_id": int(local_account_id),
            "page": int(page),
            "page_size": min(int(page_size), 100)
        }
        
        if delivery_goal:
            params["delivery_goal"] = delivery_goal
        if poi_ids:
            try:
                params["poi_ids"] = [int(x.strip()) for x in poi_ids.split(",") if x.strip()]
            except:
                return jsonify({"code": 400, "message": "poi_ids格式错误"})
        if product_ids:
            try:
                params["product_ids"] = [int(x.strip()) for x in product_ids.split(",") if x.strip()]
            except:
                return jsonify({"code": 400, "message": "product_ids格式错误"})
        
        filtering = {}
        if search_key_word:
            filtering["search_key_word"] = search_key_word
        if filtering:
            params["filtering"] = filtering
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 16. 列表批量更新项目投放时段 ====================

@local_delivery_bp.route("/api/local_delivery/project/week_schedule/update", methods=["POST"])
def batch_update_local_project_schedule():
    """列表批量更新项目投放时段 - v3.0/local/project/week_schedule/update/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id") or not data.get("data"):
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, data）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/project/week_schedule/update/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})
        # ==================== 17. 创建单元 ====================

@local_delivery_bp.route("/api/local_delivery/promotion/create", methods=["POST"])
def create_local_promotion():
    """创建单元 - v3.0/local/promotion/create/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id") or not data.get("project_id"):
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, project_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        # 修复1：顶层 ID 字段（前端传字符串避免JS精度丢失，后端转回 int）
        for key in ['project_id', 'promotion_id', 'local_account_id']:
            if key in data and isinstance(data[key], str):
                try:
                    data[key] = int(data[key])
                except (ValueError, TypeError):
                    pass
        
        # 修复2：customer_material_list 中的 aweme_item_id（19位大整数，必须转 int）
        if 'customer_material_list' in data and isinstance(data['customer_material_list'], list):
            for material in data['customer_material_list']:
                if isinstance(material, dict) and 'video_material' in material:
                    vm = material['video_material']
                    if isinstance(vm, dict) and 'aweme_item_id' in vm and isinstance(vm['aweme_item_id'], str):
                        try:
                            vm['aweme_item_id'] = int(vm['aweme_item_id'])
                        except (ValueError, TypeError):
                            pass
        
        # 调试：确认转换后的数据结构（开发阶段可打开，稳定后注释掉）
        # import json
        # print("[DEBUG] promotion/create payload:", json.dumps(data, indent=2))
        
        url = "https://api.oceanengine.com/open_api/v3.0/local/promotion/create/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 18. 更新单元 ====================

@local_delivery_bp.route("/api/local_delivery/promotion/update", methods=["POST"])
def update_local_promotion():
    """更新单元 - v3.0/local/promotion/update/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id") or not data.get("promotion_id"):
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, promotion_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        # 修复：前端传来的大整数ID是字符串，API要求数字类型，转回int
        for key in ['promotion_id', 'local_account_id']:
            if key in data and isinstance(data[key], str):
                try:
                    data[key] = int(data[key])
                except (ValueError, TypeError):
                    pass
        
        url = "https://api.oceanengine.com/open_api/v3.0/local/promotion/update/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 19. 获取单元列表 ====================

@local_delivery_bp.route("/api/local_delivery/promotion/list")
def get_local_promotion_list():
    """获取单元列表 - v3.0/local/promotion/list/"""
    local_account_id = request.args.get("local_account_id")
    page = request.args.get("page", "1")
    page_size = request.args.get("page_size", "10")
    filtering = request.args.get("filtering")
    
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少local_account_id参数"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/promotion/list/"
        params = {
            "local_account_id": int(local_account_id),
            "page": page,
            "page_size": min(int(page_size), 100)
        }
        if filtering:
            params["filtering"] = filtering
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 20. 获取单元详情 ====================

@local_delivery_bp.route("/api/local_delivery/promotion/detail")
def get_local_promotion_detail():
    """获取单元详情 - v3.0/local/promotion/detail/"""
    local_account_id = request.args.get("local_account_id")
    promotion_id = request.args.get("promotion_id")
    
    if not local_account_id or not promotion_id:
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, promotion_id）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/promotion/detail/"
        params = {
            "local_account_id": int(local_account_id),
            "promotion_id": int(promotion_id)
        }
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 21. 批量更新单元状态 ====================

@local_delivery_bp.route("/api/local_delivery/promotion/status/update", methods=["POST"])
def batch_update_local_promotion_status():
    """批量更新单元状态 - v3.0/local/promotion/status/update/"""
    data = request.get_json() or {}
    
    if not data.get("local_account_id") or not data.get("data"):
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, data）"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/promotion/status/update/"
        headers = {
            "Access-Token": access_token,
            "Content-Type": "application/json"
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 22. 批量获取广告审核建议 ====================

@local_delivery_bp.route("/api/local_delivery/promotion/reject_reason/get")
def get_local_promotion_reject_reason():
    """批量获取广告审核建议 - v3.0/local/promotion/reject_reason/get/"""
    local_account_id = request.args.get("local_account_id")
    promotion_ids = request.args.get("promotion_ids")
    
    if not local_account_id or not promotion_ids:
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, promotion_ids）"})
    
    try:
        ids_list = [int(x.strip()) for x in promotion_ids.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "promotion_ids不能为空"})
        if len(ids_list) > 10:
            return jsonify({"code": 400, "message": "promotion_ids最多10个"})
    except:
        return jsonify({"code": 400, "message": "promotion_ids格式错误"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/promotion/reject_reason/get/"
        params = {
            "local_account_id": int(local_account_id),
            "promotion_ids": ids_list
        }
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})

# ==================== 23. 根据门店ID拉取商品 ====================

@local_delivery_bp.route("/api/local_delivery/product/get_by_poiids")
def get_local_product_by_poiids():
    """根据门店ID拉取商品 - v3.0/local/product/get_by_poiids/"""
    local_account_id = request.args.get("local_account_id")
    poi_ids = request.args.get("poi_ids")
    local_delivery_scene = request.args.get("local_delivery_scene")
    
    if not local_account_id or not poi_ids:
        return jsonify({"code": 400, "message": "缺少必要参数（local_account_id, poi_ids）"})
    
    try:
        ids_list = [int(x.strip()) for x in poi_ids.split(",") if x.strip()]
        if len(ids_list) == 0:
            return jsonify({"code": 400, "message": "poi_ids不能为空"})
    except:
        return jsonify({"code": 400, "message": "poi_ids格式错误"})
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    try:
        url = "https://api.oceanengine.com/open_api/v3.0/local/product/get_by_poiids/"
        params = {
            "local_account_id": int(local_account_id),
            "poi_ids": ids_list
        }
        if local_delivery_scene:
            params["local_delivery_scene"] = local_delivery_scene
        
        headers = {"Access-Token": access_token}
        full_url = build_query_url(url, params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        fix_big_integers(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})