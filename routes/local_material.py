# routes/local_material.py - 本地推素材管理API路由

from flask import Blueprint, request, jsonify
import requests
import json
import hashlib
from urllib.parse import urlencode

local_material_bp = Blueprint('local_material', __name__, url_prefix='/api/local_material')

BASE_URL = "https://api.oceanengine.com"


# ==================== 工具函数 ====================

def get_any_valid_token():
    """获取任意一个有效的access_token（与local_delivery.py完全一致）"""
    try:
        import storage
        return storage.get_any_valid_token()
    except Exception as e:
        print(f"[ERROR] get_any_valid_token failed: {e}")
        return None


def _json_dumps_compact(obj):
    """生成无空格紧凑JSON字符串，避免urlencode把空格编码成+号"""
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))


# ========== 1. 异步上传本地推视频 ==========
@local_material_bp.route('/video/upload_task/create', methods=['POST'])
def create_video_upload_task():
    data = request.get_json() or {}
    local_account_id = data.get('local_account_id')
    filename = data.get('filename')
    video_url = data.get('video_url')

    if not all([local_account_id, filename, video_url]):
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id, filename, video_url"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    url = f"{BASE_URL}/open_api/v3.0/local/file/upload_task/create/"
    headers = {
        "Access-Token": token,
        "Content-Type": "application/json"
    }
    payload = {
        "local_account_id": int(local_account_id),
        "filename": filename,
        "video_url": video_url
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})


# ========== 2. 查询异步上传本地推视频结果 ==========
@local_material_bp.route('/video/upload_task/list', methods=['GET'])
def get_video_upload_task_list():
    local_account_id = request.args.get('local_account_id')
    task_ids = request.args.get('task_ids', '')

    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    try:
        task_ids_list = json.loads(task_ids) if task_ids else []
    except:
        return jsonify({"code": 400, "message": "task_ids格式错误，应为JSON数组字符串"})

    url = f"{BASE_URL}/open_api/v3.0/local/file/video/upload_task/list/"
    headers = {"Access-Token": token}
    params = {
        "local_account_id": int(local_account_id),
        "task_ids": task_ids_list
    }

    try:
        query_string = urlencode({k: v if isinstance(v, str) else _json_dumps_compact(v) for k, v in params.items()})
        resp = requests.get(f"{url}?{query_string}", headers=headers, timeout=30)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})


# ========== 3. 上传视频（multipart/form-data） ==========
@local_material_bp.route('/video/upload', methods=['POST'])
def upload_video():
    local_account_id = request.form.get('local_account_id')
    video_signature = request.form.get('video_signature')
    filename = request.form.get('filename')

    if not all([local_account_id, video_signature, filename]):
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id, video_signature, filename"})

    if 'video_file' not in request.files:
        return jsonify({"code": 400, "message": "缺少视频文件: video_file"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    video_file = request.files['video_file']

    url = f"{BASE_URL}/open_api/v3.0/local/file/video/upload/"
    headers = {"Access-Token": token}

    files = {
        'video_file': (video_file.filename, video_file.stream, video_file.content_type or 'video/mp4')
    }
    data = {
        'local_account_id': int(local_account_id),
        'video_signature': video_signature,
        'filename': filename
    }

    try:
        resp = requests.post(url, headers=headers, data=data, files=files, timeout=120)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})


# ========== 4. 获取素材库视频 ==========
@local_material_bp.route('/video/get', methods=['GET'])
def get_video_library():
    local_account_id = request.args.get('local_account_id')
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    filtering = {}
    if request.args.get('search_key_word'):
        filtering['search_key_word'] = request.args.get('search_key_word')

    for field in ['image_mode', 'material_source', 'analysis_type']:
        val = request.args.get(field)
        if val:
            try:
                filtering[field] = json.loads(val)
            except:
                filtering[field] = val.split(',')

    if request.args.get('start_time'):
        filtering['start_time'] = request.args.get('start_time')
    if request.args.get('end_time'):
        filtering['end_time'] = request.args.get('end_time')

    is_filter = request.args.get('is_filter_unqualified')
    if is_filter is not None:
        filtering['is_filter_unqualified'] = is_filter.lower() == 'true'

    params = {
        "local_account_id": int(local_account_id),
        "filtering": filtering
    }

    for field in ['order_field', 'order_type']:
        if request.args.get(field):
            params[field] = request.args.get(field)

    params['page'] = int(request.args.get('page', 1))
    params['page_size'] = int(request.args.get('page_size', 20))

    url = f"{BASE_URL}/open_api/v3.0/local/file/video/get/"
    headers = {"Access-Token": token}

    try:
        query_string = urlencode({k: v if isinstance(v, str) else _json_dumps_compact(v) for k, v in params.items()})
        resp = requests.get(f"{url}?{query_string}", headers=headers, timeout=30)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})


# ========== 5. 获取抖音主页视频 ==========
@local_material_bp.route('/video/aweme/get', methods=['GET'])
def get_aweme_video():
    local_account_id = request.args.get('local_account_id')
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    filtering = {}

    # anchor_info 是必填字段，必须始终存在
    anchor_types = request.args.get('anchor_types')
    if anchor_types:
        filtering['anchor_info'] = {'anchor_types': anchor_types.split(',')}
    else:
        # 用户未选择时，默认不限制锚点类型
        filtering['anchor_info'] = {'anchor_types': ['ALL_ANCHOR']}

    anchor_info = filtering['anchor_info']

    for field in ['poi_ids', 'product_ids']:
        val = request.args.get(field)
        if val:
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    nums = [int(x) for x in parsed if str(x).strip()]
                    if nums:
                        anchor_info[field] = nums
                else:
                    anchor_info[field] = [int(parsed)]
            except (json.JSONDecodeError, ValueError):
                try:
                    nums = [int(x) for x in val.split(',') if x.strip()]
                    if nums:
                        anchor_info[field] = nums
                except:
                    pass

    # aweme_ids、item_ids 作为 filtering 的直接字段
    for field in ['aweme_ids', 'item_ids']:
        val = request.args.get(field)
        if val:
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    if field == 'aweme_ids':
                        nums = [str(x) for x in parsed if str(x).strip()]
                    else:
                        nums = [int(x) for x in parsed if str(x).strip()]
                    if nums:
                        filtering[field] = nums
                else:
                    if field == 'aweme_ids':
                        filtering[field] = [str(parsed)]
                    else:
                        filtering[field] = [int(parsed)]
            except (json.JSONDecodeError, ValueError):
                try:
                    if field == 'aweme_ids':
                        nums = [x.strip() for x in val.split(',') if x.strip()]
                    else:
                        nums = [int(x) for x in val.split(',') if x.strip()]
                    if nums:
                        filtering[field] = nums
                except:
                    pass

    for field in ['item_status', 'start_time', 'end_time']:
        if request.args.get(field):
            filtering[field] = request.args.get(field)

 
    # ===== 后端校验：各锚点类型必填对应IDs =====
    anchor_types_list = anchor_info.get('anchor_types', [])
    if 'ALL_ANCHOR' in anchor_types_list and not filtering.get('aweme_ids'):
        return jsonify({"code": 400, "message": "查询全部锚点类型时，必须提供抖音号ID列表(aweme_ids)"})
    if 'PRODUCT_ANCHOR' in anchor_types_list and not anchor_info.get('product_ids'):
        return jsonify({"code": 400, "message": "查询商品锚点类型时，必须提供商品ID列表(product_ids)"})
    if 'POI_ANCHOR' in anchor_types_list and not anchor_info.get('poi_ids'):
        return jsonify({"code": 400, "message": "查询门店锚点类型时，必须提供门店ID列表(poi_ids)"})
    # ===== 校验结束 =====

    params = {
        "local_account_id": int(local_account_id),
        "filtering": filtering
    }

    for field in ['order_filed', 'external_action', 'page_size', 'cursor']:
        if request.args.get(field):
            params[field] = request.args.get(field) if field in ['order_filed', 'external_action', 'cursor'] else int(request.args.get(field))

    url = f"{BASE_URL}/open_api/v3.0/local/file/video/aweme/get/"
    headers = {"Access-Token": token}

    try:
        query_string = urlencode({k: v if isinstance(v, str) else _json_dumps_compact(v) for k, v in params.items()})
        resp = requests.get(f"{url}?{query_string}", headers=headers, timeout=30)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})

# ========== 6. 获取图文素材 ==========
@local_material_bp.route('/carousel/list', methods=['GET'])
def get_carousel_list():
    local_account_id = request.args.get('local_account_id')
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    params = {"local_account_id": int(local_account_id)}

    for field in ['keyword', 'start_time', 'end_time']:
        if request.args.get(field):
            params[field] = request.args.get(field)

    carousel_ids = request.args.get('carousel_ids')
    if carousel_ids:
        try:
            params['carousel_ids'] = json.loads(carousel_ids)
        except:
            params['carousel_ids'] = [int(x) for x in carousel_ids.split(',') if x.strip()]

    order_by = request.args.get('order_by')
    order_type = request.args.get('order_type')
    if order_by or order_type:
        params['order'] = {}
        if order_by:
            params['order']['order_by'] = order_by
        if order_type:
            params['order']['order_type'] = order_type

    params['page'] = int(request.args.get('page', 1))
    params['page_size'] = int(request.args.get('page_size', 20))

    url = f"{BASE_URL}/open_api/v3.0/local/file/carousel/list/"
    headers = {"Access-Token": token}

    try:
        query_string = urlencode({k: v if isinstance(v, str) else _json_dumps_compact(v) for k, v in params.items()})
        resp = requests.get(f"{url}?{query_string}", headers=headers, timeout=30)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})


# ========== 7. 上传图片素材（multipart/form-data） ==========
@local_material_bp.route('/image/upload', methods=['POST'])
def upload_image():
    local_account_id = request.form.get('local_account_id')
    upload_type = request.form.get('upload_type', 'UPLOAD_BY_FILE')
    image_signature = request.form.get('image_signature')
    is_aigc = request.form.get('is_aigc')

    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id"})

    if upload_type == 'UPLOAD_BY_FILE' and 'image_file' not in request.files:
        return jsonify({"code": 400, "message": "缺少图片文件: image_file"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    # 自动计算图片MD5（如果用户未提供）
    image_file = request.files.get('image_file')
    if image_file:
        file_content = image_file.read()
        if not image_signature:
            image_signature = hashlib.md5(file_content).hexdigest()
        image_file.seek(0)

    url = f"{BASE_URL}/open_api/v3.0/local/image/upload/"
    headers = {"Access-Token": token}

    data = {
        'local_account_id': int(local_account_id),
        'upload_type': upload_type
    }
    if image_signature:
        data['image_signature'] = image_signature
    if is_aigc is not None:
        data['is_aigc'] = 'true' if is_aigc.lower() == 'true' else 'false'

    files = {}
    if image_file:
        files['image_file'] = (image_file.filename, image_file.stream, image_file.content_type or 'image/jpeg')

    try:
        resp = requests.post(url, headers=headers, data=data, files=files, timeout=60)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})
        # ========== 8. 获取本地推创编可用抖音号 ==========
@local_material_bp.route('/aweme/authorized/get', methods=['GET'])
def get_aweme_authorized():
    local_account_id = request.args.get('local_account_id')
    if not local_account_id:
        return jsonify({"code": 400, "message": "缺少必要参数: local_account_id"})

    token = get_any_valid_token()
    if not token:
        return jsonify({"code": 401, "message": "未找到有效的Access-Token，请先完成授权"})

    params = {
        "local_account_id": int(local_account_id),
        "marketing_goal": request.args.get('marketing_goal', 'VIDEO_IMAGE')
    }

    filtering = {}
    if request.args.get('search_key_word'):
        filtering['search_key_word'] = request.args.get('search_key_word')
    if filtering:
        params['filtering'] = filtering

    params['page'] = int(request.args.get('page', 1))
    params['page_size'] = int(request.args.get('page_size', 20))

    url = f"{BASE_URL}/open_api/v3.0/local/aweme/authorized/get/"
    headers = {"Access-Token": token}

    try:
        query_string = urlencode({k: v if isinstance(v, str) else _json_dumps_compact(v) for k, v in params.items()})
        resp = requests.get(f"{url}?{query_string}", headers=headers, timeout=30)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"code": 500, "message": f"请求异常: {str(e)}"})