# routes/localpush.py - 本地推数据报表模块
# 包含：账户数据、项目数据、单元数据、素材数据、受众分析

from flask import Blueprint, request, jsonify
import requests
import json
from urllib.parse import urlencode

from storage import get_any_valid_token

localpush_bp = Blueprint('localpush', __name__, url_prefix='')


@localpush_bp.route("/api/localpush/account")
def get_localpush_account():
    """查询账户数据"""
    local_account_id = request.args.get("local_account_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    time_granularity = request.args.get("time_granularity", "TIME_GRANULARITY_DAILY")
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置，请先完成OAuth授权"})
    
    url = "https://api.oceanengine.com/open_api/v3.0/local/report/account/get/"
    params = {
        "local_account_id": local_account_id,
        "start_date": start_date,
        "end_date": end_date,
        "time_granularity": time_granularity,
        "metrics": json.dumps(["stat_cost", "show_cnt", "click_cnt", "ctr", "convert_cnt", "oto_pay_order_count", "conversion_rate"])
    }
    
    try:
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@localpush_bp.route("/api/localpush/project")
def get_localpush_project():
    """查询项目数据（修复ID精度）"""
    local_account_id = request.args.get("local_account_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    time_granularity = request.args.get("time_granularity", "TIME_GRANULARITY_DAILY")
    project_ids = request.args.get("project_ids", "")
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    url = "https://api.oceanengine.com/open_api/v3.0/local/report/project/get/"
    
    metrics = ["stat_cost", "show_cnt", "click_cnt", "convert_cnt", "ctr", "conversion_rate", "conversion_cost"]
    
    params = {
        "local_account_id": local_account_id,
        "start_date": start_date,
        "end_date": end_date,
        "time_granularity": time_granularity,
        "metrics": json.dumps(metrics),
        "page": 1,
        "page_size": 100
    }
    
    if project_ids:
        try:
            project_id_list = [int(pid.strip()) for pid in project_ids.split(",") if pid.strip()]
            if project_id_list:
                params["filtering"] = json.dumps({
                    "cdp_project_ids": project_id_list
                })
        except:
            pass
    
    try:
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        
        # 修复：将project_id转为字符串，避免JavaScript精度丢失
        if result.get("code") == 0 and "data" in result:
            project_list = result["data"].get("project_list", [])
            for item in project_list:
                if "project_id" in item:
                    item["project_id"] = str(item["project_id"])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@localpush_bp.route("/api/localpush/promotion")
def get_localpush_promotion():
    """查询单元数据（修复ID精度）"""
    local_account_id = request.args.get("local_account_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    time_granularity = request.args.get("time_granularity", "TIME_GRANULARITY_DAILY")
    promotion_ids = request.args.get("promotion_ids", "")
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    url = "https://api.oceanengine.com/open_api/v3.0/local/report/promotion/get/"
    
    metrics = ["stat_cost", "show_cnt", "click_cnt", "convert_cnt", "ctr", "conversion_rate", "conversion_cost"]
    
    params = {
        "local_account_id": local_account_id,
        "start_date": start_date,
        "end_date": end_date,
        "time_granularity": time_granularity,
        "metrics": json.dumps(metrics),
        "page": 1,
        "page_size": 100
    }
    
    if promotion_ids:
        try:
            promotion_id_list = [int(pid.strip()) for pid in promotion_ids.split(",") if pid.strip()]
            if promotion_id_list:
                params["filtering"] = json.dumps({
                    "promotion_ids": promotion_id_list
                })
        except:
            pass
    
    try:
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        
        # 修复：将promotion_id和project_id转为字符串，避免JavaScript精度丢失
        if result.get("code") == 0 and "data" in result:
            promotion_list = result["data"].get("promotion_list", [])
            for item in promotion_list:
                if "promotion_id" in item:
                    item["promotion_id"] = str(item["promotion_id"])
                if "project_id" in item:
                    item["project_id"] = str(item["project_id"])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@localpush_bp.route("/api/localpush/material")
def get_localpush_material():
    """查询素材数据（修复ID精度）"""
    local_account_id = request.args.get("local_account_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    time_granularity = request.args.get("time_granularity", "TIME_GRANULARITY_DAILY")
    material_ids = request.args.get("material_ids", "")
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    url = "https://api.oceanengine.com/open_api/v3.0/local/report/material/get/"
    
    metrics = ["stat_cost", "show_cnt", "click_cnt", "convert_cnt", "total_play", "ctr", "conversion_rate", "conversion_cost"]
    
    params = {
        "local_account_id": local_account_id,
        "start_date": start_date,
        "end_date": end_date,
        "time_granularity": time_granularity,
        "metrics": json.dumps(metrics),
        "page": 1,
        "page_size": 100
    }
    
    if material_ids:
        try:
            material_id_list = [int(mid.strip()) for mid in material_ids.split(",") if mid.strip()]
            if material_id_list:
                params["filtering"] = json.dumps({
                    "material_ids": material_id_list
                })
        except:
            pass
    
    try:
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        result = response.json()
        
        # 修复：将material_id转为字符串，避免JavaScript精度丢失
        if result.get("code") == 0 and "data" in result:
            material_list = result["data"].get("material_list", [])
            for item in material_list:
                if "material_id" in item:
                    item["material_id"] = str(item["material_id"])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})


@localpush_bp.route("/api/localpush/audience")
def get_localpush_audience():
    """查询受众分析数据"""
    local_account_id = request.args.get("local_account_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    audience_dimension = request.args.get("audience_dimension", "GENDER")
    data_dimension = request.args.get("data_dimension", "CDP_PROMOTION")
    
    access_token = get_any_valid_token()
    if not access_token:
        return jsonify({"code": 401, "message": "Access Token未设置"})
    
    url = "https://api.oceanengine.com/open_api/v3.0/local/report/audience/get/"
    fields = ["stat_cost", "show_cnt", "click_cnt", "convert_cnt", "conversion_cost"]
    
    params = {
        "local_account_id": local_account_id,
        "start_date": start_date,
        "end_date": end_date,
        "audience_dimension": audience_dimension,
        "data_dimension": data_dimension,
        "fields": json.dumps(fields),
        "order_type": "DESC",
        "order_field": "stat_cost",
        "page": 1,
        "page_size": 100
    }
    
    try:
        headers = {"Access-Token": access_token}
        full_url = url + "?" + urlencode(params)
        response = requests.get(full_url, headers=headers, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)})