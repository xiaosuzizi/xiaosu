// static/js/app.js - 前端应用逻辑

let accounts = [];
let currentTab = 'account';
let currentCustomerTab = 'workspace';
let marketingAccountsCache = {};
let workspaceAccountsData = [];
let currentPage = 1;
let currentPageSize = 20;
let currentWorkspaceId = '';
let currentAccountTypeFilter = '';
let currentSearchName = '';
let currentDetailAdvertiserId = '';

const appId = window.APP_ID || '{{APP_ID}}';
const redirectUri = window.location.origin + '/callback';

// 页面初始化
window.onload = function() {
    loadStats();
    const today = new Date();
    const lastMonth = new Date(Date.now() - 30*24*60*60*1000);
    const startEl = document.getElementById('lp-start-date');
    const endEl = document.getElementById('lp-end-date');
    if(startEl) startEl.value = lastMonth.toISOString().split('T')[0];
    if(endEl) endEl.value = today.toISOString().split('T')[0];
};

// 切换菜单展开/收起
function toggleAccountService(el) {
    const submenu = document.getElementById('account-service-submenu');
    const arrow = el.querySelector('span:last-child');
    if(submenu.classList.contains('show')) {
        submenu.classList.remove('show');
        arrow.textContent = '▼';
    } else {
        submenu.classList.add('show');
        arrow.textContent = '▲';
    }
}

// 显示指定页面
function showSection(id, el, parentSection) {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.submenu-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    
    if(el) {
        if(el.classList.contains('submenu-item')) {
            el.classList.add('active');
            const parent = document.querySelector('.menu-item[data-section="' + parentSection + '"]');
            if(parent) parent.classList.add('active');
        } else {
            el.classList.add('active');
        }
    }
    
    const target = document.getElementById('section-' + id);
    if(target) target.classList.add('active');
    
    const titles = {
        'dashboard': '📊 数据概览',
        'customer-info': '👤 客户信息与资质管理',
        'workspace-mgmt': '🏢 工作台账户管理',
        'accounts': '👤 账户管理',
        'localpush': '📈 本地推数据报表',
        'auth': '🔐 授权设置'
    };
    document.getElementById('pageTitle').textContent = titles[id] || '未知页面';
    
    if(id === 'accounts') loadAccounts();
    if(id === 'dashboard') loadStats();
    if(id === 'customer-info') initCustomerInfoPage();
    if(id === 'workspace-mgmt') initWorkspaceMgmtPage();
    if(id === 'localpush') initLocalPushPage();
    if(id === 'balance-flow') initBalanceFlowPage();
}

// ==================== 客户信息与资质管理 ====================

function switchCustomerTab(type, el) {
    currentCustomerTab = type;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    
    document.getElementById('customer-workspace-area').style.display = type === 'workspace' ? 'block' : 'none';
    document.getElementById('customer-local-area').style.display = type === 'local' ? 'block' : 'none';
    
    hideCustomerResults();
    document.getElementById('permission-notice').style.display = 'none';
}

function hideCustomerResults() {
    document.getElementById('customer-info-card').style.display = 'none';
    document.getElementById('subject-qual-card').style.display = 'none';
    document.getElementById('delivery-qual-card').style.display = 'none';
}

function initCustomerInfoPage() {
    const workspaceSelect = document.getElementById('customer-workspace-select');
    if(workspaceSelect) {
        let html = '<option value="">请选择已授权的工作台</option>';
        accounts.forEach(acc => {
            html += `<option value="${acc.id}">${acc.id}</option>`;
        });
        workspaceSelect.innerHTML = html;
    }
    
    const localSelect = document.getElementById('customer-local-select');
    if(localSelect) {
        let html = '<option value="">请选择已添加的本地推账户</option>';
        accounts.forEach(acc => {
            if(acc.local_accounts) {
                Object.entries(acc.local_accounts).forEach(([localId, localData]) => {
                    html += `<option value="${localId}">${localId} (${localData.name || '本地推账户'})</option>`;
                });
            }
        });
        localSelect.innerHTML = html;
    }
    
    document.getElementById('marketing-account-wrapper').style.display = 'none';
    document.getElementById('btn-query-workspace').disabled = true;
    document.getElementById('step2-indicator').classList.remove('active');
    hideCustomerResults();
    document.getElementById('permission-notice').style.display = 'none';
}

async function onWorkspaceChange(workspaceId) {
    const marketingWrapper = document.getElementById('marketing-account-wrapper');
    const marketingSelect = document.getElementById('customer-marketing-select');
    const manualHint = document.getElementById('manual-input-hint');
    const manualGroup = document.getElementById('manual-marketing-group');
    const btn = document.getElementById('btn-query-workspace');
    const step2 = document.getElementById('step2-indicator');
    
    if(!workspaceId) {
        marketingWrapper.style.display = 'none';
        btn.disabled = true;
        step2.classList.remove('active');
        return;
    }
    
    marketingWrapper.style.display = 'block';
    marketingSelect.innerHTML = '<option value="">加载中...</option>';
    manualHint.style.display = 'none';
    manualGroup.style.display = 'none';
    
    try {
        const res = await fetch(`/api/account_service/marketing_accounts?workspace_id=${workspaceId}`);
        const data = await res.json();
        
        let html = '<option value="">请选择或手动输入</option>';
        
        if(data.code === 0 && data.data && data.data.length > 0) {
            data.data.forEach(acc => {
                html += `<option value="${acc.advertiser_id}">${acc.name} (${acc.advertiser_id})</option>`;
            });
            marketingAccountsCache[workspaceId] = data.data;
            manualHint.style.display = 'none';
        } else {
            html += '<option value="manual">➕ 手动输入营销账户ID</option>';
            manualHint.style.display = 'block';
        }
        
        marketingSelect.innerHTML = html;
        step2.classList.add('active');
        btn.disabled = true;
        
    } catch(e) {
        marketingSelect.innerHTML = '<option value="">加载失败</option><option value="manual">➕ 手动输入营销账户ID</option>';
        manualHint.style.display = 'block';
    }
}

function onMarketingAccountChange() {
    const select = document.getElementById('customer-marketing-select');
    const manualGroup = document.getElementById('manual-marketing-group');
    const btn = document.getElementById('btn-query-workspace');
    const manualInput = document.getElementById('manual-marketing-id');
    
    if(select.value === 'manual') {
        manualGroup.style.display = 'flex';
        btn.disabled = true;
        if(manualInput) {
            manualInput.oninput = function() {
                btn.disabled = !this.value.trim();
            };
        }
    } else if(select.value) {
        manualGroup.style.display = 'none';
        btn.disabled = false;
    } else {
        manualGroup.style.display = 'none';
        btn.disabled = true;
    }
}

async function queryCustomerFullInfo() {
    const workspaceId = document.getElementById('customer-workspace-select').value;
    const marketingSelect = document.getElementById('customer-marketing-select');
    const manualInput = document.getElementById('manual-marketing-id');
    
    let advertiserId = '';
    if(marketingSelect.value === 'manual') {
        advertiserId = manualInput ? manualInput.value.trim() : '';
    } else {
        advertiserId = marketingSelect.value;
    }
    
    if(!advertiserId) {
        alert('请选择或输入营销账户ID');
        return;
    }
    
    hideCustomerResults();
    document.getElementById('permission-notice').style.display = 'none';
    
    const btn = document.getElementById('btn-query-workspace');
    const originalText = btn ? btn.textContent : '';
    if(btn) {
        btn.textContent = '⏳ 查询中...';
        btn.disabled = true;
    }
    
    try {
        const customerRes = await fetch(`/api/account_service/customer_info_full?advertiser_ids=${advertiserId}`);
        const customerData = await customerRes.json();
        
        if(customerData.code === 0 && customerData.data && customerData.data.list && customerData.data.list.length > 0) {
            renderCustomerInfo(customerData.data.list[0], customerData.data._is_public_info, customerData.data._permission_notice);
        } else {
            document.getElementById('customer-info-content').innerHTML = `<div class="error-box">查询客户信息失败: ${customerData.message || '未知错误'}</div>`;
            document.getElementById('customer-info-card').style.display = 'block';
        }
        
    } catch(e) {
        document.getElementById('customer-info-content').innerHTML = `<div class="error-box">请求异常: ${e.message}</div>`;
        document.getElementById('customer-info-card').style.display = 'block';
    } finally {
        if(btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}

function renderCustomerInfo(info, isPublic, notice) {
    const card = document.getElementById('customer-info-card');
    const content = document.getElementById('customer-info-content');
    
    if(notice) {
        const noticeEl = document.getElementById('permission-notice');
        const textEl = document.getElementById('permission-text');
        if(textEl) textEl.textContent = notice;
        if(noticeEl) noticeEl.style.display = 'block';
    }
    
    let html = '';
    
    html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">账户ID</div>
        <div style="font-size: 14px; color: #001529; font-weight: 500; word-break: break-all;">${info.id || '-'}</div>
    </div>`;
    
    html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">账户名称</div>
        <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.name || '-'}</div>
    </div>`;
    
    html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">公司名称</div>
        <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.company || '-'}</div>
    </div>`;
    
    if(!isPublic) {
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">角色</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.role === 'ROLE_ADVERTISER' ? '广告主' : (info.role || '-')}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid ${info.status === 'STATUS_ENABLE' ? '#52c41a' : '#f5222d'};">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">状态</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${formatStatus(info.status)}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">品牌/经营类别</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.brand || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">推广地区</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.promotion_area || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">执照编号</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.license_no || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">详细地址</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.address || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">创建时间</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.create_time || '-'}</div>
        </div>`;
        
        if(info.reason) {
            html += `<div class="info-item" style="background: #fff1f0; padding: 12px; border-radius: 4px; border-left: 3px solid #f5222d; grid-column: 1 / -1;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">拒绝原因</div>
                <div style="font-size: 14px; color: #cf1322; font-weight: 500;">${info.reason}</div>
            </div>`;
        }
    } else {
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">一级行业</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.first_industry_name || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">二级行业</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.second_industry_name || '-'}</div>
        </div>`;
    }
    
    html += '</div>';
    if(content) content.innerHTML = html;
    if(card) card.style.display = 'block';
}

function formatStatus(status) {
    const statusMap = {
        'STATUS_ENABLE': '正常',
        'STATUS_PENDING_CONFIRM': '待确认',
        'STATUS_CONFIRM': '审核通过',
        'STATUS_CONFIRM_FAIL': '审核不通过',
        'STATUS_NOT_SUBMIT': '未提交',
        'STATUS_DISABLE': '已停用'
    };
    return statusMap[status] || status || '-';
}

async function queryLocalQualification() {
    const localSelect = document.getElementById('customer-local-select');
    const manualInput = document.getElementById('manual-customer-local-id');
    
    let localAccountId = localSelect ? localSelect.value : '';
    if(!localAccountId && manualInput) {
        localAccountId = manualInput.value.trim();
    }
    
    if(!localAccountId) {
        alert('请选择或输入本地推账户ID');
        return;
    }
    
    if(!/^\d{16,19}$/.test(localAccountId)) {
        alert('本地推账户ID必须是16-19位数字');
        return;
    }
    
    hideCustomerResults();
    const noticeEl = document.getElementById('permission-notice');
    if(noticeEl) noticeEl.style.display = 'none';
    
    try {
        const subjectRes = await fetch(`/api/account_service/subject_qualification?local_account_id=${localAccountId}`);
        const subjectData = await subjectRes.json();
        
        if(subjectData.code === 0 && subjectData.data) {
            renderSubjectQualification(subjectData.data);
        } else {
            const subjectContent = document.getElementById('subject-qual-content');
            const subjectCard = document.getElementById('subject-qual-card');
            if(subjectContent) subjectContent.innerHTML = `<div class="error-box">查询主体资质失败: ${subjectData.message || '未知错误'}</div>`;
            if(subjectCard) subjectCard.style.display = 'block';
        }
        
        const deliveryRes = await fetch(`/api/account_service/delivery_qualification?local_account_id=${localAccountId}`);
        const deliveryData = await deliveryRes.json();
        
        if(deliveryData.code === 0 && deliveryData.data) {
            renderDeliveryQualification(deliveryData.data);
        } else {
            const deliveryContent = document.getElementById('delivery-qual-content');
            const deliveryCard = document.getElementById('delivery-qual-card');
            if(deliveryContent) deliveryContent.innerHTML = `<div class="error-box">查询投放资质失败: ${deliveryData.message || '未知错误'}</div>`;
            if(deliveryCard) deliveryCard.style.display = 'block';
        }
        
    } catch(e) {
        alert('请求异常: ' + e.message);
    }
}

function renderSubjectQualification(data) {
    const card = document.getElementById('subject-qual-card');
    const content = document.getElementById('subject-qual-content');
    if(!card || !content) return;
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">';
    
    if(data.subject) {
        const s = data.subject;
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">资质ID</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.qualification_id || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">公司名称</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.company_name || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">公司类型</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${formatCompanyType(s.company_type)}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">资质类型</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.qualification_type || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">资质编号</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.qualification_code || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">法人</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.proprietor_name || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">注册城市</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.registered_city_name || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">详细地址</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.address || '-'}</div>
        </div>`;
        
        html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid ${s.status === 'STATUS_CONFIRM' ? '#52c41a' : '#f5222d'};">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">状态</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${formatQualStatus(s.status)}</div>
        </div>`;
        
        if(s.effective_date) {
            html += `<div class="info-item" style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">有效期至</div>
                <div style="font-size: 14px; color: #001529; font-weight: 500;">${s.effective_date}</div>
            </div>`;
        }
    }
    
    html += '</div>';
    content.innerHTML = html;
    card.style.display = 'block';
}

function renderDeliveryQualification(data) {
    const card = document.getElementById('delivery-qual-card');
    const content = document.getElementById('delivery-qual-content');
    if(!card || !content) return;
    
    let html = '';
    const list = data.qualifications || [];
    
    if(list.length === 0) {
        html = '<div style="text-align: center; padding: 40px; color: #999;">暂无投放资质</div>';
    } else {
        list.forEach(q => {
            let statusColor = '#d46b08';
            let statusBg = '#fff7e6';
            if(q.status === 'STATUS_CONFIRM' || q.status === 1) {
                statusColor = '#389e0d';
                statusBg = '#f6ffed';
            } else if(q.status === 'STATUS_CONFIRM_FAIL' || q.status === 2) {
                statusColor = '#cf1322';
                statusBg = '#fff1f0';
            }
            
            html += `
                <div style="margin-bottom: 15px; padding: 15px; background: #fafafa; border-radius: 4px; border-left: 3px solid #1890ff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 14px; color: #001529;">${q.qualification_type_name || '未知类型'}</strong>
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${statusBg}; color: ${statusColor};">
                            ${formatQualStatus(q.status)}
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">资质ID: ${q.qualification_id || '-'}</div>
                    ${q.reject_reason ? `<div style="font-size: 12px; color: #cf1322; margin-top: 5px;">拒绝原因: ${q.reject_reason}</div>` : ''}
                </div>
            `;
        });
    }
    
    content.innerHTML = html;
    card.style.display = 'block';
}

function formatCompanyType(type) {
    const typeMap = {
        'COMPANY': '企业',
        'INDIVIDUAL': '个人',
        'SELF_EMPLOY': '个体工商户',
        'GOVERNMENT': '政府组织机构/事业单位',
        'HK_MACAO_TAIWAN': '港澳台',
        'OVERSEA': '海外',
        'OTHERS': '其他机构'
    };
    return typeMap[type] || type || '-';
}

function formatQualStatus(status) {
    if(typeof status === 'number') {
        const numMap = {0: '审核通过', 1: '审核不通过', 2: '审核中', 3: '未提交', 4: '待审核'};
        return numMap[status] || status;
    }
    const statusMap = {
        'STATUS_CONFIRM': '审核通过',
        'STATUS_CONFIRM_FAIL': '审核不通过',
        'STATUS_NOT_SUBMIT': '未提交',
        'STATUS_PENDING_CONFIRM': '审核中',
        'STATUS_WAIT_CONFIRM': '待审核'
    };
    return statusMap[status] || status || '-';
}

// ==================== 账户详情弹窗功能 ====================

function viewAccountDetail(advertiserId) {
    currentDetailAdvertiserId = advertiserId;
    const modal = document.getElementById('account-detail-modal');
    const content = document.getElementById('modal-content');
    
    if(modal) modal.style.display = 'flex';
    if(content) content.innerHTML = '<div class="loading-box">正在加载账户详情...</div>';
    
    loadAccountDetail(advertiserId);
}

function closeDetailModal() {
    const modal = document.getElementById('account-detail-modal');
    if(modal) modal.style.display = 'none';
    currentDetailAdvertiserId = '';
}

function refreshDetail() {
    if(currentDetailAdvertiserId) {
        const content = document.getElementById('modal-content');
        if(content) content.innerHTML = '<div class="loading-box">正在刷新...</div>';
        loadAccountDetail(currentDetailAdvertiserId);
    }
}

async function loadAccountDetail(advertiserId) {
    const content = document.getElementById('modal-content');
    if(!content) return;
    
    try {
        const res = await fetch(`/api/account_service/customer_info_full?advertiser_ids=${advertiserId}`);
        const data = await res.json();
        
        if(data.code === 0 && data.data && data.data.list && data.data.list.length > 0) {
            const info = data.data.list[0];
            const isPublic = data.data._is_public_info;
            const notice = data.data._permission_notice;
            
            renderDetailContent(info, isPublic, notice);
        } else {
            content.innerHTML = `<div class="error-box">查询账户详情失败: ${data.message || '未知错误'}</div>`;
        }
        
    } catch(e) {
        content.innerHTML = `<div class="error-box">请求异常: ${e.message}</div>`;
    }
}

function renderDetailContent(info, isPublic, notice) {
    const content = document.getElementById('modal-content');
    if(!content) return;
    
    let html = '';
    
    if(isPublic && notice) {
        html += `<div style="background: #fff7e6; border: 1px solid #ffd591; color: #d46b08; padding: 12px; border-radius: 4px; margin-bottom: 20px;">⚠️ ${notice}</div>`;
    }
    
    html += `<div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <div style="font-weight: 600; color: #001529; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">📋 基本信息</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">`;
    
    html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">账户ID</div>
        <div style="font-size: 14px; color: #001529; font-weight: 500; word-break: break-all;">${info.id || '-'}</div>
    </div>`;
    
    html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">账户名称</div>
        <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.name || '-'}</div>
    </div>`;
    
    html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">公司名称</div>
        <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.company || '-'}</div>
    </div>`;
    
    if(!isPublic) {
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">角色</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.role === 'ROLE_ADVERTISER' ? '广告主' : (info.role || '-')}</div>
        </div>`;
        
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid ${info.status === 'STATUS_ENABLE' ? '#52c41a' : '#f5222d'};">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">状态</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${formatStatus(info.status)}</div>
        </div>`;
        
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">品牌/经营类别</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.brand || '-'}</div>
        </div>`;
        
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">推广地区</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.promotion_area || '-'}</div>
        </div>`;
        
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">执照编号</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.license_no || '-'}</div>
        </div>`;
        
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">详细地址</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.address || '-'}</div>
        </div>`;
        
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">创建时间</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.create_time || '-'}</div>
        </div>`;
        
        if(info.reason) {
            html += `<div style="background: #fff1f0; padding: 12px; border-radius: 4px; border-left: 3px solid #f5222d; grid-column: 1 / -1;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">拒绝原因</div>
                <div style="font-size: 14px; color: #cf1322; font-weight: 500;">${info.reason}</div>
            </div>`;
        }
    } else {
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">一级行业</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.first_industry_name || '-'}</div>
        </div>`;
        
        html += `<div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #1890ff;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">二级行业</div>
            <div style="font-size: 14px; color: #001529; font-weight: 500;">${info.second_industry_name || '-'}</div>
        </div>`;
    }
    
    html += `</div></div>`;
    
    if(info.license_url) {
        html += `<div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="font-weight: 600; color: #001529; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">📄 营业执照</div>
            <div style="text-align: center;">
                <img src="${info.license_url}" style="max-width: 100%; max-height: 300px; border: 1px solid #f0f0f0; border-radius: 4px;" alt="营业执照" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display: none; padding: 20px; color: #999;">图片加载失败或链接已过期</div>
            </div>
        </div>`;
    }
    
    content.innerHTML = html;
}

// 点击弹窗外部关闭
document.addEventListener('click', function(e) {
    const modal = document.getElementById('account-detail-modal');
    if(e.target === modal) {
        closeDetailModal();
    }
});

// ==================== 工作台账户管理 ====================

function initWorkspaceMgmtPage() {
    const select = document.getElementById('mgmt-workspace-select');
    if(select) {
        let html = '<option value="">请选择已授权的工作台</option>';
        accounts.forEach(acc => {
            html += `<option value="${acc.id}">${acc.id}</option>`;
        });
        select.innerHTML = html;
    }
}

function handleSearchInput(e) {
    if(e.key === 'Enter') {
        loadWorkspaceAccounts();
    }
}

async function loadWorkspaceAccounts() {
    const workspaceId = document.getElementById('mgmt-workspace-select').value;
    const accountType = document.getElementById('mgmt-account-type').value;
    const searchName = document.getElementById('mgmt-search-name').value;
    
    if(!workspaceId) {
        const resultDiv = document.getElementById('workspace-accounts-result');
        if(resultDiv) resultDiv.innerHTML = '<div class="error-box">请先选择一个工作台</div>';
        return;
    }
    
    currentWorkspaceId = workspaceId;
    currentAccountTypeFilter = accountType;
    currentSearchName = searchName;
    currentPage = 1;
    
    await fetchWorkspaceAccounts();
}

async function fetchWorkspaceAccounts() {
    const resultDiv = document.getElementById('workspace-accounts-result');
    if(!resultDiv) return;
    
    resultDiv.innerHTML = '<div class="loading-box">正在加载数据...</div>';
    
    try {
        let url = `/api/workspace/accounts?workspace_id=${currentWorkspaceId}&page=${currentPage}&page_size=${currentPageSize}`;
        if(currentAccountTypeFilter) {
            url += `&account_source=${currentAccountTypeFilter}`;
        }
        if(currentSearchName) {
            url += `&search_name=${encodeURIComponent(currentSearchName)}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code !== 0) {
            let errorMsg = data.message || '未知错误';
            if(data.code === 403 || errorMsg.includes('权限')) {
                errorMsg += '<br><br>提示：该接口需要申请 "工作台组织管理权限" (scope: CUSTOMER_CENTER)，请在巨量引擎开放平台申请该权限后重试。<br>当前您可以先使用"客户信息与资质管理"功能查询单账户信息。';
            }
            resultDiv.innerHTML = `<div class="error-box">查询失败: ${errorMsg}</div>`;
            const pagination = document.getElementById('workspace-pagination');
            if(pagination) pagination.style.display = 'none';
            return;
        }
        
        const list = data.data?.list || [];
        const pagination = data.data?.page_info || {};
        
        if(list.length === 0) {
            resultDiv.innerHTML = '<div class="empty-state">暂无符合条件的账户</div>';
            const paginationEl = document.getElementById('workspace-pagination');
            if(paginationEl) paginationEl.style.display = 'none';
            return;
        }
        
        let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
        html += '<th style="padding: 12px; text-align: left; font-weight: 600;">账户ID</th><th style="padding: 12px; text-align: left; font-weight: 600;">账户名称</th><th style="padding: 12px; text-align: left; font-weight: 600;">账户类型</th><th style="padding: 12px; text-align: left; font-weight: 600;">状态</th><th style="padding: 12px; text-align: left; font-weight: 600;">操作</th></tr></thead><tbody>';
        
        list.forEach(item => {
            let typeBg = '#e6f7ff';
            let typeColor = '#096dd9';
            let typeText = '巨量营销';
            
            if(item.account_source === 'ENTERPRISE') {
                typeBg = '#f6ffed';
                typeColor = '#389e0d';
                typeText = '企业号';
            } else if(item.account_source === 'LOCAL') {
                typeBg = '#fff7e6';
                typeColor = '#d46b08';
                typeText = '本地推';
            } else if(item.account_source === 'DOU+') {
                typeBg = '#f9f0ff';
                typeColor = '#722ed1';
                typeText = 'Dou+';
            }
            
            let statusText = '未知';
            if(item.status === 'ENABLE') statusText = '有效';
            else if(item.status === 'DISABLE') statusText = '已停用';
            else if(item.status) statusText = item.status;
            
            html += `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 12px; font-family: monospace; font-size: 12px;">${item.advertiser_id || '-'}</td>
                    <td style="padding: 12px;">${item.account_name || '-'}</td>
                    <td style="padding: 12px;"><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${typeBg}; color: ${typeColor}; border: 1px solid ${typeColor}20;">${typeText}</span></td>
                    <td style="padding: 12px;">${statusText}</td>
                    <td style="padding: 12px;"><button style="background: transparent; color: #1890ff; border: 1px solid #1890ff; padding: 4px 12px; font-size: 13px; border-radius: 4px; cursor: pointer;" onclick="viewAccountDetail('${item.advertiser_id}')">查看详情</button></td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        resultDiv.innerHTML = html;
        
        const totalPage = Math.ceil((pagination.total_count || 0) / currentPageSize) || 1;
        const pageInfo = document.getElementById('page-info');
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        const paginationEl = document.getElementById('workspace-pagination');
        
        if(pageInfo) pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPage} 页`;
        if(btnPrev) btnPrev.disabled = currentPage <= 1;
        if(btnNext) btnNext.disabled = currentPage >= totalPage;
        if(paginationEl) paginationEl.style.display = 'flex';
        
    } catch(e) {
        resultDiv.innerHTML = `<div class="error-box">请求异常: ${e.message}</div>`;
        const pagination = document.getElementById('workspace-pagination');
        if(pagination) pagination.style.display = 'none';
    }
}

function changePage(delta) {
    currentPage += delta;
    if(currentPage < 1) currentPage = 1;
    fetchWorkspaceAccounts();
}

function changePageSize() {
    const select = document.getElementById('page-size');
    if(select) {
        currentPageSize = parseInt(select.value);
    }
    currentPage = 1;
    fetchWorkspaceAccounts();
}

// ==================== 账户管理（原有功能保留） ====================

async function loadStats() {
    try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        accounts = data.accounts || [];
        
        const statWorkspaces = document.getElementById('statWorkspaces');
        const statValidTokens = document.getElementById('statValidTokens');
        const statExpiring = document.getElementById('statExpiring');
        const statLocalAccounts = document.getElementById('statLocalAccounts');
        const accountInfo = document.getElementById('accountInfo');
        
        if(statWorkspaces) statWorkspaces.textContent = accounts.length;
        
        let valid = 0, expiring = 0, localCount = 0;
        const now = new Date();
        
        accounts.forEach(acc => {
            const exp = new Date(acc.expires_at);
            if(exp > now) valid++;
            if(exp > now && exp < new Date(now.getTime() + 2*60*60*1000)) expiring++;
            if(acc.local_accounts) localCount += Object.keys(acc.local_accounts).length;
        });
        
        if(statValidTokens) statValidTokens.textContent = valid;
        if(statExpiring) statExpiring.textContent = expiring;
        if(statLocalAccounts) statLocalAccounts.textContent = localCount;
        if(accountInfo) accountInfo.textContent = accounts.length > 0 ? `已授权 ${accounts.length} 个工作台` : '未授权';
        
    } catch(e) {
        console.error('Load stats error:', e);
    }
}

function startAuth() {
    window.open(`https://open.oceanengine.com/audit/oauth.html?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`, '_blank');
}

async function loadAccounts() {
    const container = document.getElementById('accountsList');
    if(container) container.innerHTML = '<div class="loading-box">加载中...</div>';
    
    try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        accounts = data.accounts || [];
        
        if(accounts.length === 0) {
            if(container) container.innerHTML = '<div class="empty-state">暂无授权账户，请先进行授权</div>';
            return;
        }
        
        let html = '';
        accounts.forEach(acc => {
            const isExpired = new Date(acc.expires_at) < new Date();
            const statusColor = isExpired ? '#cf1322' : '#389e0d';
            const statusBg = isExpired ? '#fff1f0' : '#f6ffed';
            const statusText = isExpired ? '已过期' : '有效';
            
            let localAccountsHtml = '';
            if(acc.local_accounts && Object.keys(acc.local_accounts).length > 0) {
                localAccountsHtml = '<div style="margin-top: 10px; font-size: 12px; color: #666;">';
                localAccountsHtml += '<div style="margin-bottom: 5px; font-weight: 600;">关联本地推账户:</div>';
                Object.entries(acc.local_accounts).forEach(([localId, localData]) => {
                    localAccountsHtml += `<div style="margin-left: 10px;">• ${localId}</div>`;
                });
                localAccountsHtml += '</div>';
            }
            
            html += `
                <div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 20px; margin-bottom: 15px; position: relative; border-top: 3px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <strong>工作台账户</strong>
                            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}40; margin-left: 10px;">${statusText}</span>
                        </div>
                        <div style="font-size: 12px; color: #999;">${acc.obtained_at} 授权</div>
                    </div>
                    <div style="font-family: monospace; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-size: 13px; color: #666; margin: 8px 0; display: inline-block;">ID: ${acc.id}</div>
                    <div onclick="this.classList.toggle('token-masked')" style="background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 4px; padding: 12px; margin: 12px 0; font-family: monospace; font-size: 12px; word-break: break-all; cursor: pointer; filter: blur(4px);">
                        <div style="font-size: 11px; color: #999; margin-bottom: 4px;">Access Token (点击切换显示)</div>
                        <div>${acc.access_token}</div>
                    </div>
                    <div style="font-size: 12px; color: #999;">过期时间: ${acc.expires_at}</div>
                    ${localAccountsHtml}
                    <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
                        <button onclick="refreshToken('${acc.id}')" style="padding: 4px 12px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">🔄 刷新Token</button>
                        <button onclick="deleteAccount('${acc.id}')" style="padding: 4px 12px; background: #fa8c16; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">🗑️ 删除</button>
                        <button onclick="showAddLocalAccount('${acc.id}')" style="padding: 4px 12px; background: #52c41a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">➕ 添加本地推账户</button>
                    </div>
                </div>
            `;
        });
        if(container) container.innerHTML = html;
    } catch(e) {
        if(container) container.innerHTML = `<div class="error-box">加载失败: ${e.message}</div>`;
    }
}

async function refreshToken(advId) {
    if(!confirm('确定要刷新该账户的Token吗？')) return;
    try {
        const res = await fetch(`/api/token/${advId}/refresh`, {method: 'POST'});
        const data = await res.json();
        alert(data.success ? '刷新成功！' : ('刷新失败: ' + data.message));
        if(data.success) loadAccounts();
    } catch(e) {
        alert('请求异常: ' + e.message);
    }
}

async function deleteAccount(advId) {
    if(!confirm(`确定要删除工作台账户 ${advId} 吗？此操作不可恢复。`)) return;
    
    try {
        const res = await fetch(`/api/account/${advId}/delete`, {method: 'DELETE'});
        const data = await res.json();
        
        if(data.success) {
            alert('✅ 删除成功');
            loadAccounts();
            loadStats();
        } else {
            alert('删除失败: ' + data.message);
        }
    } catch(e) {
        alert('请求异常: ' + e.message);
    }
}

function showAddLocalAccount(advId) {
    const localId = prompt('请输入本地推账户ID（16-19位数字）:');
    if(!localId) return;
    
    if(!/^\d{16,19}$/.test(localId)) {
        alert('本地推账户ID必须是16-19位数字');
        return;
    }
    
    if(localId.trim()) {
        addLocalAccount(advId, localId.trim());
    }
}

async function addLocalAccount(advId, localId) {
    try {
        const res = await fetch(`/api/account/${advId}/local_accounts/add`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({local_account_id: localId})
        });
        const data = await res.json();
        
        if(data.success) {
            alert('✅ 添加成功');
            loadAccounts();
            loadStats();
        } else {
            alert('添加失败: ' + data.message);
        }
    } catch(e) {
        alert('请求异常: ' + e.message);
    }
}

// ==================== 本地推数据报表（原有功能保留） ====================

function initLocalPushPage() {
    const container = document.getElementById('localpush-container');
    if(!container) return;
    
    container.innerHTML = `
        <style>
            .lp-header { padding: 20px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
            .lp-header h2 { font-size: 18px; color: #001529; margin: 0; }
            .lp-filter { padding: 20px 24px; background: #fafafa; border-bottom: 1px solid #f0f0f0; }
            .lp-filter-row { display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-end; }
            .lp-filter-item { display: flex; flex-direction: column; gap: 5px; }
            .lp-filter-item label { font-size: 12px; color: #666; font-weight: 500; }
            .lp-filter-item input, .lp-filter-item select { padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px; min-width: 150px; font-size: 14px; }
            .lp-tabs { display: flex; border-bottom: 1px solid #f0f0f0; background: white; }
            .lp-tab-btn { padding: 14px 24px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 14px; color: #666; font-weight: 500; }
            .lp-tab-btn:hover { color: #1890ff; background: #f5f5f5; }
            .lp-tab-btn.active { color: #1890ff; border-bottom-color: #1890ff; background: #e6f7ff; }
            .lp-content { padding: 24px; min-height: 400px; }
            .lp-tab-content { display: none; }
            .lp-tab-content.active { display: block; }
            .lp-audience-opts { background: #e6f7ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #91d5ff; display: none; }
            .lp-audience-opts.show { display: block; }
            .lp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .lp-table th { background: #fafafa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #f0f0f0; white-space: nowrap; }
            .lp-table td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
            .lp-table tr:hover { background: #f5f5f5; }
            .lp-num { font-family: monospace; text-align: right; }
            .lp-money { color: #cf1322; font-weight: 500; }
            .lp-empty { text-align: center; padding: 60px; color: #999; }
            .lp-alert { padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
            .lp-alert-error { background: #fff2f0; border: 1px solid #ffccc7; color: #cf1322; }
            .lp-loading { text-align: center; padding: 40px; color: #1890ff; }
        </style>
        
        <div class="lp-header">
            <h2>📊 本地推数据报表</h2>
        </div>
        <div class="lp-filter">
            <div class="lp-filter-row">
                <div class="lp-filter-item">
                    <label>本地推账户ID</label>
                    <select id="lp-account-select" style="min-width: 280px;">
                        <option value="">请选择账户</option>
                    </select>
                </div>
                <div class="lp-filter-item">
                    <label>开始日期</label>
                    <input type="date" id="lp-start-date">
                </div>
                <div class="lp-filter-item">
                    <label>结束日期</label>
                    <input type="date" id="lp-end-date">
                </div>
                <div class="lp-filter-item">
                    <label>时间粒度</label>
                    <select id="lp-granularity">
                        <option value="TIME_GRANULARITY_DAILY">按天</option>
                        <option value="TIME_GRANULARITY_HOURLY">按小时</option>
                        <option value="TIME_GRANULARITY_TOTAL">汇总</option>
                    </select>
                </div>
                <div class="lp-filter-item" id="project-filter" style="display: none;">
                    <label>项目ID筛选（可选）</label>
                    <input type="text" id="lp-project-ids" placeholder="多个ID用逗号分隔" style="width: 180px;">
                </div>
                <div class="lp-filter-item" id="promotion-filter" style="display: none;">
                    <label>单元ID筛选（可选）</label>
                    <input type="text" id="lp-promotion-ids" placeholder="多个ID用逗号分隔" style="width: 180px;">
                </div>
                <div class="lp-filter-item" id="material-filter" style="display: none;">
                    <label>素材ID筛选（可选）</label>
                    <input type="text" id="lp-material-ids" placeholder="多个ID用逗号分隔" style="width: 180px;">
                </div>
                <div class="lp-filter-item">
                    <button class="btn btn-success" onclick="lpQueryData()">🔍 查询数据</button>
                </div>
            </div>
        </div>
        <div class="lp-tabs">
            <button class="lp-tab-btn active" onclick="lpSwitchTab('account', this)">账户数据</button>
            <button class="lp-tab-btn" onclick="lpSwitchTab('project', this)">项目数据</button>
            <button class="lp-tab-btn" onclick="lpSwitchTab('promotion', this)">单元数据</button>
            <button class="lp-tab-btn" onclick="lpSwitchTab('material', this)">素材数据</button>
            <button class="lp-tab-btn" onclick="lpSwitchTab('audience', this)">受众分析</button>
        </div>
        <div class="lp-content">
            <div id="lp-audience-opts" class="lp-audience-opts">
                <div style="font-weight: 600; margin-bottom: 10px; color: #096dd9; font-size: 13px;">受众分析特有选项</div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="lp-filter-item">
                        <label>分析维度</label>
                        <select id="lp-audience-dim">
                            <option value="GENDER">性别</option>
                            <option value="PROVINCE">省份</option>
                            <option value="CITY">城市</option>
                            <option value="DISTRICT">区县</option>
                            <option value="PLATFORM">平台</option>
                            <option value="AGE">年龄</option>
                            <option value="AC">网络</option>
                            <option value="EIGHT_GROUP_LABEL">八大人群</option>
                        </select>
                    </div>
                    <div class="lp-filter-item">
                        <label>数据维度</label>
                        <select id="lp-data-dim">
                            <option value="CDP_PROMOTION">标准投放</option>
                            <option value="AD">持续投</option>
                            <option value="ORDER">灵活投</option>
                            <option value="ROI2_PROMOTION">全域投放</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="lp-tab-account" class="lp-tab-content active"><div id="lp-table-account" class="lp-empty">请选择查询条件并点击"查询数据"</div></div>
            <div id="lp-tab-project" class="lp-tab-content"><div id="lp-table-project" class="lp-empty">请选择查询条件并点击"查询数据"</div></div>
            <div id="lp-tab-promotion" class="lp-tab-content"><div id="lp-table-promotion" class="lp-empty">请选择查询条件并点击"查询数据"</div></div>
            <div id="lp-tab-material" class="lp-tab-content"><div id="lp-table-material" class="lp-empty">请选择查询条件并点击"查询数据"</div></div>
            <div id="lp-tab-audience" class="lp-tab-content"><div id="lp-table-audience" class="lp-empty">请选择查询条件并点击"查询数据"</div></div>
        </div>
    `;
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startEl = document.getElementById('lp-start-date');
    const endEl = document.getElementById('lp-end-date');
    if(startEl) startEl.value = weekAgo.toISOString().split('T')[0];
    if(endEl) endEl.value = today.toISOString().split('T')[0];
    
    updateLpAccountSelect();
}

function updateLpAccountSelect() {
    const select = document.getElementById('lp-account-select');
    if(!select) return;
    
    let html = '<option value="">请选择账户</option>';
    accounts.forEach(acc => {
        const locals = acc.local_accounts || {};
        const ids = Object.keys(locals);
        if(ids.length > 0) {
            html += `<optgroup label="工作台: ${acc.id}">`;
            ids.forEach(id => {
                html += `<option value="${id}" data-workspace="${acc.id}">${locals[id].name || '本地推账户'} (${id})</option>`;
            });
            html += '</optgroup>';
        }
    });
    select.innerHTML = html;
}

function lpSwitchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.lp-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.lp-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('lp-tab-' + tab).classList.add('active');
    
    const audienceOpts = document.getElementById('lp-audience-opts');
    if(audienceOpts) audienceOpts.classList.toggle('show', tab === 'audience');
    
    const projectFilter = document.getElementById('project-filter');
    const promotionFilter = document.getElementById('promotion-filter');
    const materialFilter = document.getElementById('material-filter');
    
    if(projectFilter) projectFilter.style.display = tab === 'project' ? 'flex' : 'none';
    if(promotionFilter) promotionFilter.style.display = tab === 'promotion' ? 'flex' : 'none';
    if(materialFilter) materialFilter.style.display = tab === 'material' ? 'flex' : 'none';
}

async function lpQueryData() {
    const select = document.getElementById('lp-account-select');
    if(!select) return;
    
    const localId = select.value;
    const selectedOption = select.options[select.selectedIndex];
    const workspaceId = selectedOption ? selectedOption.getAttribute('data-workspace') : '';
    const startDate = document.getElementById('lp-start-date').value;
    const endDate = document.getElementById('lp-end-date').value;
    const granularity = document.getElementById('lp-granularity').value;
    
    if(!localId) { alert('请选择本地推账户'); return; }
    if(!startDate || !endDate) { alert('请选择日期范围'); return; }
    
    const container = document.getElementById('lp-table-' + currentTab);
    if(container) container.innerHTML = '<div class="lp-loading">数据加载中...</div>';
    
    try {
        let url = `/api/localpush/${currentTab}?local_account_id=${localId}&start_date=${startDate}&end_date=${endDate}`;
        
        if(currentTab !== 'audience') {
            url += `&time_granularity=${granularity}`;
        }
        
        if(currentTab === 'project') {
            const projectIds = document.getElementById('lp-project-ids')?.value || '';
            if(projectIds) url += `&project_ids=${encodeURIComponent(projectIds)}`;
        }
        if(currentTab === 'promotion') {
            const promotionIds = document.getElementById('lp-promotion-ids')?.value || '';
            if(promotionIds) url += `&promotion_ids=${encodeURIComponent(promotionIds)}`;
        }
        if(currentTab === 'material') {
            const materialIds = document.getElementById('lp-material-ids')?.value || '';
            if(materialIds) url += `&material_ids=${encodeURIComponent(materialIds)}`;
        }
        if(currentTab === 'audience') {
            const audienceDim = document.getElementById('lp-audience-dim')?.value;
            const dataDim = document.getElementById('lp-data-dim')?.value;
            if(audienceDim) url += `&audience_dimension=${audienceDim}`;
            if(dataDim) url += `&data_dimension=${dataDim}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code !== 0) {
            if(container) container.innerHTML = `<div class="lp-alert lp-alert-error">查询失败: ${data.message || '未知错误'}</div>`;
            return;
        }
        
        lpRenderTable(currentTab, data.data);
    } catch(e) {
        if(container) container.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function lpRenderTable(tab, data) {
    let list = [];
    if(tab === 'account') list = data.data_list || [];
    else if(tab === 'project') list = data.project_list || [];
    else if(tab === 'promotion') list = data.promotion_list || [];
    else if(tab === 'material') list = data.material_list || [];
    else if(tab === 'audience') list = data.list || [];
    
    const container = document.getElementById('lp-table-' + tab);
    if(!container) return;
    
    if(list.length === 0) {
        container.innerHTML = '<div class="lp-empty">暂无数据</div>';
        return;
    }
    
    let html = '<table class="lp-table"><thead><tr>';
    
    if(tab === 'account') {
        html += '<th>日期</th><th>消耗(元)</th><th>展示次数</th><th>点击次数</th><th>点击率</th><th>转化数</th><th>成交订单数</th></tr></thead><tbody>';
        list.forEach(item => {
            html += `<tr>
                <td>${item.stat_time_day || '-'}</td>
                <td class="lp-num lp-money">¥${(item.stat_cost || 0).toFixed(2)}</td>
                <td class="lp-num">${item.show_cnt || 0}</td>
                <td class="lp-num">${item.click_cnt || 0}</td>
                <td class="lp-num">${((item.ctr || 0) * 100).toFixed(2)}%</td>
                <td class="lp-num">${item.convert_cnt || 0}</td>
                <td class="lp-num">${item.oto_pay_order_count || 0}</td>
            </tr>`;
        });
    } else if(tab === 'project') {
        html += '<th>项目ID</th><th>项目名称</th><th>日期</th><th>消耗(元)</th><th>展示次数</th><th>点击次数</th><th>转化数</th><th>转化率</th></tr></thead><tbody>';
        list.forEach(item => {
            const projectId = item.project_id || '-';
            html += `<tr>
                <td class="lp-num" style="font-family: monospace; font-size: 12px;" title="${projectId}">${projectId}</td>
                <td>${item.project_name || '-'}</td>
                <td>${item.stat_time_day || '-'}</td>
                <td class="lp-num lp-money">¥${(item.stat_cost || 0).toFixed(2)}</td>
                <td class="lp-num">${item.show_cnt || 0}</td>
                <td class="lp-num">${item.click_cnt || 0}</td>
                <td class="lp-num">${item.convert_cnt || 0}</td>
                <td class="lp-num">${((item.conversion_rate || 0) * 100).toFixed(2)}%</td>
            </tr>`;
        });
    } else if(tab === 'promotion') {
        html += '<th>单元ID</th><th>单元名称</th><th>项目ID</th><th>日期</th><th>消耗(元)</th><th>展示次数</th><th>点击次数</th><th>转化数</th></tr></thead><tbody>';
        list.forEach(item => {
            const promotionId = item.promotion_id || '-';
            const projectId = item.project_id || '-';
            html += `<tr>
                <td class="lp-num" style="font-family: monospace; font-size: 12px;" title="${promotionId}">${promotionId}</td>
                <td>${item.promotion_name || '-'}</td>
                <td class="lp-num" style="font-family: monospace; font-size: 12px;" title="${projectId}">${projectId}</td>
                <td>${item.stat_time_day || '-'}</td>
                <td class="lp-num lp-money">¥${(item.stat_cost || 0).toFixed(2)}</td>
                <td class="lp-num">${item.show_cnt || 0}</td>
                <td class="lp-num">${item.click_cnt || 0}</td>
                <td class="lp-num">${item.convert_cnt || 0}</td>
            </tr>`;
        });
    } else if(tab === 'material') {
        html += '<th>素材ID</th><th>素材名称</th><th>素材类型</th><th>日期</th><th>消耗(元)</th><th>展示次数</th><th>点击次数</th><th>播放次数</th></tr></thead><tbody>';
        list.forEach(item => {
            const materialId = item.material_id || '-';
            let materialType = item.material_type || '-';
            if(materialType === 'CASURAL') materialType = '图文';
            else if(materialType === 'VIDEO') materialType = '视频';
            html += `<tr>
                <td class="lp-num" style="font-family: monospace; font-size: 12px;" title="${materialId}">${materialId}</td>
                <td>${item.material_name || '-'}</td>
                <td>${materialType}</td>
                <td>${item.stat_time_day || '-'}</td>
                <td class="lp-num lp-money">¥${(item.stat_cost || 0).toFixed(2)}</td>
                <td class="lp-num">${item.show_cnt || 0}</td>
                <td class="lp-num">${item.click_cnt || 0}</td>
                <td class="lp-num">${item.total_play || 0}</td>
            </tr>`;
        });
    } else if(tab === 'audience') {
        html += '<th>维度值</th><th>消耗(元)</th><th>展示次数</th><th>点击次数</th><th>转化数</th><th>转化成本(元)</th></tr></thead><tbody>';
        list.forEach(item => {
            let dimValue = '-';
            if(item.gender) dimValue = item.gender === 'FEMALE' ? '女' : item.gender === 'MALE' ? '男' : item.gender;
            else if(item.province_name) dimValue = item.province_name;
            else if(item.city_name) dimValue = item.city_name;
            else if(item.district_name) dimValue = item.district_name;
            else if(item.platform) dimValue = item.platform;
            else if(item.age) dimValue = item.age;
            else if(item.ac) dimValue = item.ac;
            else if(item.eight_group_label) dimValue = item.eight_group_label;
            const f = item.fields || {};
            html += `<tr>
                <td>${dimValue}</td>
                <td class="lp-num lp-money">¥${(f.stat_cost || 0).toFixed(2)}</td>
                <td class="lp-num">${f.show_cnt || 0}</td>
                <td class="lp-num">${f.click_cnt || 0}</td>
                <td class="lp-num">${f.convert_cnt || 0}</td>
                <td class="lp-num">¥${(f.conversion_cost || 0).toFixed(2)}</td>
            </tr>`;
        });
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ==================== 资金和流水管理 - 查询账户余额流水 ====================

function toggleFundSubmenu(el) {
    const submenu = document.getElementById('fund-submenu');
    const arrow = el.querySelector('span:last-child');
    if(!submenu || !arrow) return;
    
    if(submenu.style.display === 'block') {
        submenu.style.display = 'none';
        arrow.textContent = '▼';
    } else {
        submenu.style.display = 'block';
        arrow.textContent = '▲';
    }
}

let currentBalanceMode = 'single';
let currentBalanceTab = 'overview';
let currentFlowData = [];

function initBalanceFlowPage() {
    switchBalanceMode('single');
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startEl = document.getElementById('flow-start-date');
    const endEl = document.getElementById('flow-end-date');
    if(startEl) startEl.value = weekAgo.toISOString().split('T')[0];
    if(endEl) endEl.value = today.toISOString().split('T')[0];
}

function switchBalanceMode(mode) {
    currentBalanceMode = mode;
    
    const singleArea = document.getElementById('balance-single-area');
    const batchArea = document.getElementById('balance-batch-area');
    const flowArea = document.getElementById('balance-flow-area');
    const btnSingle = document.getElementById('btn-single-mode');
    const btnBatch = document.getElementById('btn-batch-mode');
    const btnFlow = document.getElementById('btn-flow-mode');
    
    if(singleArea) singleArea.style.display = mode === 'single' ? 'block' : 'none';
    if(batchArea) batchArea.style.display = mode === 'batch' ? 'block' : 'none';
    if(flowArea) flowArea.style.display = mode === 'flow' ? 'block' : 'none';
    
    if(btnSingle) {
        btnSingle.style.background = mode === 'single' ? '#1890ff' : 'white';
        btnSingle.style.color = mode === 'single' ? 'white' : '#666';
        btnSingle.style.border = mode === 'single' ? 'none' : '1px solid #d9d9d9';
    }
    if(btnBatch) {
        btnBatch.style.background = mode === 'batch' ? '#1890ff' : 'white';
        btnBatch.style.color = mode === 'batch' ? 'white' : '#666';
        btnBatch.style.border = mode === 'batch' ? 'none' : '1px solid #d9d9d9';
    }
    if(btnFlow) {
        btnFlow.style.background = mode === 'flow' ? '#1890ff' : 'white';
        btnFlow.style.color = mode === 'flow' ? 'white' : '#666';
        btnFlow.style.border = mode === 'flow' ? 'none' : '1px solid #d9d9d9';
    }
}

function switchBalanceTab(tab) {
    currentBalanceTab = tab;
    
    const overviewPanel = document.getElementById('balance-overview-panel');
    const detailPanel = document.getElementById('balance-detail-panel');
    const returnPanel = document.getElementById('balance-return-panel');
    const tabOverview = document.getElementById('tab-overview');
    const tabDetail = document.getElementById('tab-detail');
    const tabReturn = document.getElementById('tab-return');
    
    if(overviewPanel) overviewPanel.style.display = tab === 'overview' ? 'block' : 'none';
    if(detailPanel) detailPanel.style.display = tab === 'detail' ? 'block' : 'none';
    if(returnPanel) returnPanel.style.display = tab === 'return' ? 'block' : 'none';
    
    const activeStyle = { bg: '#e6f7ff', color: '#1890ff', border: '2px solid #1890ff' };
    const inactiveStyle = { bg: 'white', color: '#666', border: '2px solid transparent' };
    
    if(tabOverview) {
        tabOverview.style.background = tab === 'overview' ? activeStyle.bg : inactiveStyle.bg;
        tabOverview.style.color = tab === 'overview' ? activeStyle.color : inactiveStyle.color;
        tabOverview.style.borderBottom = tab === 'overview' ? activeStyle.border : inactiveStyle.border;
    }
    if(tabDetail) {
        tabDetail.style.background = tab === 'detail' ? activeStyle.bg : inactiveStyle.bg;
        tabDetail.style.color = tab === 'detail' ? activeStyle.color : inactiveStyle.color;
        tabDetail.style.borderBottom = tab === 'detail' ? activeStyle.border : inactiveStyle.border;
    }
    if(tabReturn) {
        tabReturn.style.background = tab === 'return' ? activeStyle.bg : inactiveStyle.bg;
        tabReturn.style.color = tab === 'return' ? activeStyle.color : inactiveStyle.color;
        tabReturn.style.borderBottom = tab === 'return' ? activeStyle.border : inactiveStyle.border;
    }
}

async function querySingleBalance() {
    const accountId = document.getElementById('single-balance-account-id').value.trim();
    const grantSplit = document.getElementById('single-grant-split').value;
    const resultDiv = document.getElementById('single-balance-result');
    
    if(!accountId) {
        alert('请输入AD营销账户ID（如：1854276532861964）\n\n注意：工作台ID（如：17844...）不能用于查询余额');
        return;
    }
    
    if(accountId.startsWith('178') || accountId.startsWith('180') || accountId.startsWith('523') || accountId.startsWith('738')) {
        alert('❌ 输入错误！\n\n您输入的是工作台ID或用户主体ID，不是AD营销账户ID。\n\n✅ 正确操作：\n1. 去"工作台账户管理"查看投放账户列表\n2. 复制AD营销账户ID（通常以185/186开头）\n3. 回到此处粘贴查询');
        return;
    }
    
    if(resultDiv) resultDiv.style.display = 'block';
    
    const overviewContent = document.getElementById('balance-overview-content');
    const detailContent = document.getElementById('balance-detail-content');
    const returnContent = document.getElementById('balance-return-content');
    
    if(overviewContent) overviewContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    if(detailContent) detailContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    if(returnContent) returnContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        const [balanceRes, returnRes] = await Promise.all([
            fetch(`/api/account_service/balance/single?advertiser_id=${accountId}&grant_type_split=${grantSplit}`),
            fetch(`/api/account_service/return_goods_balance?advertiser_ids=${accountId}`)
        ]);
        
        const balanceData = await balanceRes.json();
        const returnData = await returnRes.json();
        
        if(balanceData.code === 0 && balanceData.data) {
            const d = balanceData.data;
            if(overviewContent) {
                overviewContent.innerHTML = `
                    <div style="background: #fafafa; padding: 15px; border-radius: 8px; border-left: 4px solid #1890ff;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">账户总余额</div>
                        <div style="font-size: 24px; font-weight: 600; color: #001529;">¥${(d.balance || 0).toFixed(2)}</div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 8px; border-left: 4px solid #52c41a;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">可用总余额</div>
                        <div style="font-size: 24px; font-weight: 600; color: #52c41a;">¥${(d.valid_balance || 0).toFixed(2)}</div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 8px; border-left: 4px solid #fa8c16;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">现金余额</div>
                        <div style="font-size: 20px; font-weight: 500; color: #001529;">¥${(d.cash || 0).toFixed(2)}</div>
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">可用: ¥${(d.valid_cash || 0).toFixed(2)}</div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 8px; border-left: 4px solid #722ed1;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">赠款余额</div>
                        <div style="font-size: 20px; font-weight: 500; color: #001529;">¥${(d.grant || 0).toFixed(2)}</div>
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">可用: ¥${(d.valid_grant || 0).toFixed(2)}</div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 8px; border-left: 4px solid #eb2f96;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">返货余额</div>
                        <div style="font-size: 20px; font-weight: 500; color: #001529;">¥${(d.return_goods_abs || 0).toFixed(2)}</div>
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">可用: ¥${(d.valid_return_goods_abs || 0).toFixed(2)}</div>
                    </div>
                    <div style="background: #fafafa; padding: 15px; border-radius: 8px; border-left: 4px solid #13c2c2;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">共享钱包可用余额</div>
                        <div style="font-size: 20px; font-weight: 500; color: #001529;">¥${(d.wallet_total_balance_valid || 0).toFixed(2)}</div>
                        <div style="font-size: 12px; color: #999; margin-top: 5px;">${d.wallet_name || '-'}</div>
                    </div>
                `;
            }
            
            if(detailContent) {
                let detailHtml = '';
                detailHtml += `<div style="grid-column: 1 / -1; font-weight: 600; color: #001529; margin: 10px 0 5px 0; font-size: 14px;">💵 现金分类</div>`;
                detailHtml += createInfoItem('通用现金', d.general_cash, '#1890ff');
                detailHtml += createInfoItem('品牌现金', d.brand_cash, '#1890ff');
                detailHtml += createInfoItem('竞价现金', d.bidding_cash, '#1890ff');
                
                detailHtml += `<div style="grid-column: 1 / -1; font-weight: 600; color: #001529; margin: 10px 0 5px 0; font-size: 14px;">🎁 赠款分类</div>`;
                detailHtml += createInfoItem('通用赠款', d.common_grant || d.default_grant, '#722ed1');
                detailHtml += createInfoItem('搜索赠款', d.search_grant, '#722ed1');
                detailHtml += createInfoItem('穿山甲赠款', d.union_grant, '#722ed1');
                detailHtml += createInfoItem('赔付赠款', d.compensation_grant, '#722ed1');
                detailHtml += createInfoItem('返货赠款', d.return_goods_grant, '#722ed1');
                
                detailHtml += `<div style="grid-column: 1 / -1; font-weight: 600; color: #001529; margin: 10px 0 5px 0; font-size: 14px;">💳 资金类型</div>`;
                detailHtml += createInfoItem('预付总余额', d.prepay_balance, '#fa8c16');
                detailHtml += createInfoItem('授信总余额', d.credit_balance, '#fa8c16');
                detailHtml += createInfoItem('预借款总余额', d.preloan_balance, '#fa8c16');
                detailHtml += createInfoItem('预付可用余额', d.prepay_valid_balance, '#52c41a');
                detailHtml += createInfoItem('授信可用余额', d.credit_valid_balance, '#52c41a');
                detailHtml += createInfoItem('预借款可用余额', d.preloan_valid_balance, '#52c41a');
                
                detailContent.innerHTML = detailHtml;
            }
        } else {
            if(overviewContent) overviewContent.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">查询失败: ${balanceData.message || '未知错误'}</div>`;
            if(detailContent) detailContent.innerHTML = '';
        }
        
        if(returnData.code === 0 && returnData.data && returnData.data.list) {
            const list = returnData.data.list;
            if(returnContent) {
                if(list.length === 0) {
                    returnContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无返货共享钱包数据</div>';
                } else {
                    let html = '';
                    list.forEach(item => {
                        const statusColor = item.status === 'SUCCESS' ? '#52c41a' : '#f5222d';
                        html += `
                            <div style="background: #fafafa; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid ${statusColor};">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <strong style="font-size: 14px; color: #001529;">账户ID: ${item.advertiser_id}</strong>
                                    <span style="color: ${statusColor}; font-weight: 500;">${item.status === 'SUCCESS' ? '成功' : (item.status_message || item.status)}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
                        `;
                        if(item.balance_detail) {
                            item.balance_detail.forEach(bd => {
                                let typeName = bd.billing_inventory || '未知';
                                if(typeName === 'DEFAULT') typeName = '通用';
                                else if(typeName === 'SEARCH') typeName = '搜索';
                                else if(typeName === 'UNION') typeName = '穿山甲';
                                else if(typeName === 'COMMON') typeName = '信息流';
                                
                                html += `
                                    <div style="background: white; padding: 10px; border-radius: 4px;">
                                        <div style="font-size: 12px; color: #666;">${typeName}</div>
                                        <div style="font-size: 16px; font-weight: 500; color: #001529;">¥${(bd.balance || 0).toFixed(2)}</div>
                                    </div>
                                `;
                            });
                        }
                        html += `</div></div>`;
                    });
                    returnContent.innerHTML = html;
                }
            }
        } else {
            if(returnContent) returnContent.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">返货查询: ${returnData.message || '无数据'}</div>`;
        }
        
    } catch(e) {
        if(overviewContent) overviewContent.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

function createInfoItem(label, value, color) {
    const val = value !== undefined ? value : 0;
    return `
        <div style="background: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid ${color};">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${label}</div>
            <div style="font-size: 16px; font-weight: 500; color: #001529;">¥${typeof val === 'number' ? val.toFixed(2) : val}</div>
        </div>
    `;
}

async function queryBatchBalance() {
    const accountIds = document.getElementById('batch-balance-account-ids').value.trim();
    const accountType = document.getElementById('batch-account-type').value;
    const resultDiv = document.getElementById('batch-balance-result');
    
    if(!accountIds) {
        alert('请输入账户IDs');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/balance/batch?account_ids=${encodeURIComponent(accountIds)}&account_type=${accountType}`);
        const data = await res.json();
        
        if(data.code === 0 && data.data && data.data.list) {
            const list = data.data.list;
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无数据</div>';
                return;
            }
            
            let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
            html += '<th style="padding: 12px; text-align: left; font-weight: 600;">账户ID</th>';
            html += '<th style="padding: 12px; text-align: right; font-weight: 600;">总余额</th>';
            html += '<th style="padding: 12px; text-align: right; font-weight: 600;">可用余额</th>';
            html += '<th style="padding: 12px; text-align: right; font-weight: 600;">现金</th>';
            html += '<th style="padding: 12px; text-align: right; font-weight: 600;">赠款</th>';
            html += '<th style="padding: 12px; text-align: right; font-weight: 600;">返货</th>';
            html += '<th style="padding: 12px; text-align: right; font-weight: 600;">共享钱包</th>';
            html += '</tr></thead><tbody>';
            
            list.forEach(item => {
                html += `
                    <tr style="border-bottom: 1px solid #f0f0f0;">
                        <td style="padding: 12px; font-family: monospace; font-size: 12px;">${item.account_id || '-'}</td>
                        <td style="padding: 12px; text-align: right; font-weight: 500;">¥${((item.balance || 0) / 100).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; color: #52c41a;">¥${((item.valid_balance || 0) / 100).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right;">¥${((item.cash || 0) / 100).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; color: #722ed1;">¥${((item.grant || 0) / 100).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; color: #eb2f96;">¥${((item.return_goods_abs || 0) / 100).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; color: #13c2c2;">¥${((item.wallet_total_balance_valid || 0) / 100).toFixed(2)}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            if(resultDiv) resultDiv.innerHTML = html;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

async function queryDailyFlow() {
    const accountId = document.getElementById('flow-account-id').value.trim();
    const startDate = document.getElementById('flow-start-date').value;
    const endDate = document.getElementById('flow-end-date').value;
    const accountType = document.getElementById('flow-account-type').value;
    const resultDiv = document.getElementById('daily-flow-result');
    
    if(!accountId) {
        alert('请输入账户ID');
        return;
    }
    if(!startDate || !endDate) {
        alert('请选择日期范围');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    currentFlowData = [];
    
    try {
        const res = await fetch(`/api/account_service/daily_flow?advertiser_id=${accountId}&start_date=${startDate}&end_date=${endDate}&account_type=${accountType}&page=1&page_size=100`);
        const data = await res.json();
        
        if(data.code === 0 && data.data && data.data.list) {
            const list = data.data.list;
            currentFlowData = list;
            
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">该日期范围内暂无流水数据</div>';
                return;
            }
            
            let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
            
            list.forEach((item, index) => {
                html += `
                    <div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden;">
                        <div onclick="toggleFlowDetail(${index})" style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span style="font-weight: 600; color: #001529; font-size: 14px;">${item.date || '-'}</span>
                                <span style="color: #666; font-size: 13px;">日终结余: <strong style="color: #1890ff;">¥${(item.balance || 0).toFixed(2)}</strong></span>
                                <span style="color: #666; font-size: 13px;">总支出: <strong style="color: #f5222d;">¥${(item.cost || 0).toFixed(2)}</strong></span>
                                <span style="color: #666; font-size: 13px;">总存入: <strong style="color: #52c41a;">¥${(item.income || 0).toFixed(2)}</strong></span>
                            </div>
                            <span id="flow-arrow-${index}" style="color: #999; font-size: 12px;">▼ 查看明细</span>
                        </div>
                        <div id="flow-detail-${index}" style="display: none; padding: 0 15px 15px 15px; border-top: 1px solid #f0f0f0;">
                            <div style="padding: 15px; background: #fafafa; border-radius: 4px; margin-top: 10px;">
                                <div style="font-weight: 600; margin-bottom: 10px; color: #001529; font-size: 13px;">当日汇总</div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; font-size: 12px;">
                                    <div>现金支出: ¥${(item.cash_cost || 0).toFixed(2)}</div>
                                    <div>赠款支出: ¥${(item.reward_cost || 0).toFixed(2)}</div>
                                    <div>冻结: ¥${(item.frozen || 0).toFixed(2)}</div>
                                    <div>转入: ¥${(item.transfer_in || 0).toFixed(2)}</div>
                                    <div>转出: ¥${(item.transfer_out || 0).toFixed(2)}</div>
                                    <div>共享支出: ¥${(item.shared_wallet_cost || 0).toFixed(2)}</div>
                                    <div>立减红包: ¥${(item.realtime_coupon_cost || 0).toFixed(2)}</div>
                                    <div>消返红包: ¥${(item.deduction_cost || 0).toFixed(2)}</div>
                                    <div>赔付赠款: ¥${(item.compensation_reward_cost || 0).toFixed(2)}</div>
                                    <div>返货赠款: ¥${(item.return_goods_reward_cost || 0).toFixed(2)}</div>
                                </div>
                                <div style="margin-top: 10px; text-align: right;">
                                    <button onclick="queryTransactionDetail('${accountId}', '${item.date}', '${item.date}', 'RECHARGE')" style="padding: 4px 12px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">查看充值明细</button>
                                    <button onclick="queryTransactionDetail('${accountId}', '${item.date}', '${item.date}', 'TRANSFER')" style="padding: 4px 12px; background: #52c41a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 8px;">查看转账明细</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            if(resultDiv) resultDiv.innerHTML = html;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

function toggleFlowDetail(index) {
    const detailDiv = document.getElementById(`flow-detail-${index}`);
    const arrow = document.getElementById(`flow-arrow-${index}`);
    if(!detailDiv || !arrow) return;
    
    if(detailDiv.style.display === 'block') {
        detailDiv.style.display = 'none';
        arrow.textContent = '▼ 查看明细';
    } else {
        detailDiv.style.display = 'block';
        arrow.textContent = '▲ 收起明细';
    }
}

async function queryTransactionDetail(accountId, startDate, endDate, transType) {
    const modal = document.createElement('div');
    modal.id = 'transaction-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    modal.innerHTML = `
        <div style="background: white; border-radius: 8px; width: 90%; max-width: 900px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
            <div style="padding: 20px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #001529;">${transType === 'RECHARGE' ? '充值' : '转账'}明细 (${startDate})</h3>
                <button onclick="document.getElementById('transaction-modal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
            </div>
            <div id="transaction-modal-content" style="padding: 20px; overflow-y: auto; flex: 1;">
                <div style="text-align: center; padding: 40px; color: #1890ff;">加载中...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    try {
        const res = await fetch(`/api/account_service/transaction_detail?advertiser_id=${accountId}&start_date=${startDate}&end_date=${endDate}&transaction_type=${transType}&page=1&page_size=100`);
        const data = await res.json();
        const contentDiv = document.getElementById('transaction-modal-content');
        
        if(data.code === 0 && data.data && data.data.list) {
            const list = data.data.list;
            if(list.length === 0) {
                contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无明细数据</div>';
                return;
            }
            
            let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">时间</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">类型</th>';
            html += '<th style="padding: 10px; text-align: right; font-weight: 600;">金额</th>';
            html += '<th style="padding: 10px; text-align: right; font-weight: 600;">现金</th>';
            html += '<th style="padding: 10px; text-align: right; font-weight: 600;">赠款</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">付款方</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">收款方</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">流水号</th>';
            html += '</tr></thead><tbody>';
            
            list.forEach(item => {
                const amountColor = (item.amount || 0) >= 0 ? '#52c41a' : '#f5222d';
                const typeText = item.transaction_type === 'RECHARGE' ? '充值' : '转账';
                html += `
                    <tr style="border-bottom: 1px solid #f0f0f0;">
                        <td style="padding: 10px; font-size: 12px;">${item.create_time || '-'}</td>
                        <td style="padding: 10px;"><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${item.transaction_type === 'RECHARGE' ? '#e6f7ff' : '#f6ffed'}; color: ${item.transaction_type === 'RECHARGE' ? '#1890ff' : '#52c41a'};">${typeText}</span></td>
                        <td style="padding: 10px; text-align: right; font-weight: 500; color: ${amountColor};">¥${(item.amount || 0).toFixed(2)}</td>
                        <td style="padding: 10px; text-align: right;">¥${(item.cash || 0).toFixed(2)}</td>
                        <td style="padding: 10px; text-align: right;">¥${(item.grant || 0).toFixed(2)}</td>
                        <td style="padding: 10px; font-size: 12px;">${item.remitter || '-'}</td>
                        <td style="padding: 10px; font-size: 12px;">${item.payee || '-'}</td>
                        <td style="padding: 10px; font-family: monospace; font-size: 11px;">${item.transaction_seq || '-'}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            contentDiv.innerHTML = html;
        } else {
            contentDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
        }
    } catch(e) {
        const contentDiv = document.getElementById('transaction-modal-content');
        if(contentDiv) contentDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}