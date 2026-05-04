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
let allAwemeVideos = []; // 存储弹窗内已加载的全部视频

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
function toggleLocalDeliverySubmenu(el) {
    const submenu = document.getElementById('local-delivery-submenu');
    const arrow = document.getElementById('local-delivery-arrow');
    if(!submenu || !arrow) return;
    
    if(submenu.style.display === 'block') {
        submenu.style.display = 'none';
        arrow.textContent = '▼';
    } else {
        submenu.style.display = 'block';
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
        'auth': '🔐 授权设置',
        'agent-transfer': '💸 代理商转账',
        'shared-wallet': '💰 资金共享',
        'brand-settlement': '📋 结算for品牌',
        'local-delivery-project': '📁 项目管理',
        'local-delivery-promotion': '📁 单元管理',
        'local-material': '🎬 本地推素材管理',
        
    };
    document.getElementById('pageTitle').textContent = titles[id] || '未知页面';
    
    if(id === 'accounts') loadAccounts();
    if(id === 'dashboard') loadStats();
    if(id === 'customer-info') initCustomerInfoPage();
    if(id === 'workspace-mgmt') initWorkspaceMgmtPage();
    if(id === 'localpush') initLocalPushPage();
    if(id === 'balance-flow') initBalanceFlowPage();
    if(id === 'remittance') {
        loadRemittanceTargetAccounts();
        switchRemittanceTab('generate');
    }
    if(id === 'agent-transfer') {
    initAgentTransferPage();
}
 if(id === 'shared-wallet') {
        initSharedWalletPage();
    }
        if(id === 'local-delivery-promotion') {
        initLocalDeliveryPromotionPage();
    }
    if(id === 'local-material') {
    // 初始化素材管理页面
}
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
  fetch('/api/accounts').then(r => r.json()).then(data => {
        const accs = data.accounts || [];
        document.getElementById('statWorkspaces').textContent = accs.length;
        let valid = 0, expiring = 0, localCount = 0;
        const now = new Date();
        accs.forEach(acc => {
            const exp = new Date(acc.expires_at);
            if(exp > now) valid++;
            if((exp - now) / (1000 * 60 * 60) < 2 && exp > now) expiring++;
            localCount += Object.keys(acc.local_accounts || {}).length;
        });
        document.getElementById('statValidTokens').textContent = valid;
        document.getElementById('statExpiring').textContent = expiring;
        document.getElementById('statLocalAccounts').textContent = localCount;
        document.getElementById('accountInfo').textContent = `已授权 ${accs.length} 个工作台`;
    });
}

function startAuth() {
    window.open(`https://open.oceanengine.com/audit/oauth.html?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`, '_blank');
}

async function loadAccounts() {
    const res = await fetch('/api/accounts');
    const data = await res.json();
    accounts = data.accounts || [];
    const listEl = document.getElementById('accountsList');
    if(accounts.length === 0) {
        listEl.innerHTML = '<div class="empty-state">暂无授权账户，请先完成授权设置</div>';
        return;
    }
    listEl.innerHTML = accounts.map(acc => {
        const exp = new Date(acc.expires_at);
        const isExp = exp < new Date();
        const localAccounts = acc.local_accounts || {};
        const localIds = Object.keys(localAccounts);
        return `
        <div class="account-card ${isExp ? 'expired' : ''}">
            <div class="account-header">
                <div>
                    <div style="font-weight: 600;">工作台账户</div>
                    <div class="account-id">${acc.id}</div>
                </div>
                <span class="status-tag ${isExp ? 'status-expired' : 'status-active'}">${isExp ? '已过期' : '有效'}</span>
            </div>
            <div class="token-box">
                <div style="font-size: 11px; color: #389e0d; margin-bottom: 4px; font-weight: 600;">ACCESS TOKEN（点击显示/隐藏）</div>
                <div class="token-masked" onclick="toggleToken(this, '${acc.access_token}')">${acc.access_token.substring(0, 30)}...</div>
            </div>
            <div class="token-actions">
                <button class="btn btn-sm" onclick="copyToken('${acc.access_token}')">📋 复制Token</button>
                <button class="btn btn-sm btn-warning" onclick="refreshToken('${acc.id}')">🔄 刷新Token</button>
                <button class="btn btn-sm btn-success" onclick="toggleExpand('${acc.id}')">📂 投放账户 (${localIds.length}个)</button>
            </div>
            <div id="expand-${acc.id}" class="expand-section">
                <div style="font-weight: 600; margin-bottom: 10px; color: #333; font-size: 14px;">本地推账户列表（16-19位ID）</div>
                <div id="local-list-${acc.id}">
                    ${localIds.length > 0 ? localIds.map(id => `
                        <div class="local-account-item">
                            <div>
                                <div style="font-family: monospace; font-size: 13px; color: #666;">${id}</div>
                                <div style="font-size: 12px; color: #999;">${localAccounts[id].name || '本地推账户'}</div>
                            </div>
                            <button class="btn btn-sm btn-warning" onclick="deleteLocalAccount('${acc.id}', '${id}')">删除</button>
                        </div>
                    `).join('') : '<div style="color: #999; font-size: 13px;">暂无本地推账户</div>'}
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #d9d9d9;">
                    <div style="font-size: 13px; color: #666; margin-bottom: 8px;">添加本地推账户（16-19位数字）：</div>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="manual-${acc.id}" placeholder="输入本地推账户ID" style="flex: 1; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px;">
                        <button class="btn btn-sm btn-success" onclick="addManualLocalAccount('${acc.id}')">➕ 添加</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleToken(el, token) {
    if(el.classList.contains('token-masked')) {
        el.textContent = token;
        el.classList.remove('token-masked');
    } else {
        el.textContent = token.substring(0, 30) + '...';
        el.classList.add('token-masked');
    }
}

function toggleExpand(accId) {
    document.getElementById('expand-' + accId).classList.toggle('show');
}

function copyToken(token) {
    navigator.clipboard.writeText(token).then(() => alert('已复制到剪贴板'));
}

async function addManualLocalAccount(accId) {
    const input = document.getElementById('manual-' + accId);
    const localId = input.value.trim();
    if(!/^\d{16,19}$/.test(localId)) {
        alert('请输入有效的本地推账户ID（16-19位数字）');
        return;
    }
    const res = await fetch(`/api/account/${accId}/local_accounts/add`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({local_account_id: localId, name: '本地推账户'})
    });
    const data = await res.json();
    if(data.success) {
        alert('添加成功！');
        input.value = '';
        loadAccounts();
        loadStats();
    } else {
        alert('添加失败: ' + data.message);
    }
}

async function deleteLocalAccount(accId, localId) {
    if(!confirm('确定删除该本地推账户吗？')) return;
    const res = await fetch(`/api/account/${accId}/local_accounts/${localId}/delete`, {method: 'DELETE'});
    const data = await res.json();
    if(data.success) {
        loadAccounts();
        loadStats();
    } else {
        alert('删除失败: ' + data.message);
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
    container.innerHTML = `
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
    document.getElementById('lp-end-date').value = today.toISOString().split('T')[0];
    document.getElementById('lp-start-date').value = weekAgo.toISOString().split('T')[0];
    updateLpAccountSelect();
}

function updateLpAccountSelect() {
    const select = document.getElementById('lp-account-select');
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
    document.getElementById('lp-audience-opts').classList.toggle('show', tab === 'audience');
    const projectFilter = document.getElementById('project-filter');
    const promotionFilter = document.getElementById('promotion-filter');
    const materialFilter = document.getElementById('material-filter');
    if(projectFilter) projectFilter.style.display = tab === 'project' ? 'flex' : 'none';
    if(promotionFilter) promotionFilter.style.display = tab === 'promotion' ? 'flex' : 'none';
    if(materialFilter) materialFilter.style.display = tab === 'material' ? 'flex' : 'none';
}

async function lpQueryData() {
    const select = document.getElementById('lp-account-select');
    const localId = select.value;
    const workspaceId = select.options[select.selectedIndex].getAttribute('data-workspace');
    const startDate = document.getElementById('lp-start-date').value;
    const endDate = document.getElementById('lp-end-date').value;
    const granularity = document.getElementById('lp-granularity').value;
    
    if(!localId) { alert('请选择本地推账户'); return; }
    if(!startDate || !endDate) { alert('请选择日期范围'); return; }
    
    const container = document.getElementById('lp-table-' + currentTab);
    container.innerHTML = '<div class="lp-loading">数据加载中...</div>';
    
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
            url += `&audience_dimension=${document.getElementById('lp-audience-dim').value}&data_dimension=${document.getElementById('lp-data-dim').value}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if(data.code !== 0) {
            container.innerHTML = `<div class="lp-alert lp-alert-error">查询失败: ${data.message || '未知错误'}</div>`;
            return;
        }
        lpRenderTable(currentTab, data.data);
    } catch(e) {
        container.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
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
// ==================== 资金和流水管理 - 直客账户汇款码充值 ====================

let currentRemittancePage = 1;
let currentRemittanceData = [];

// 标签页切换
function switchRemittanceTab(tab) {
    const generateArea = document.getElementById('remittance-generate-area');
    const listArea = document.getElementById('remittance-list-area');
    const btnGenerate = document.getElementById('btn-generate-tab');
    const btnList = document.getElementById('btn-list-tab');
    
    if(!generateArea || !listArea || !btnGenerate || !btnList) return;
    
    if(tab === 'generate') {
        generateArea.style.display = 'block';
        listArea.style.display = 'none';
        btnGenerate.style.background = '#1890ff';
        btnGenerate.style.color = 'white';
        btnGenerate.style.border = 'none';
        btnList.style.background = 'white';
        btnList.style.color = '#666';
        btnList.style.border = '1px solid #d9d9d9';
    } else {
        generateArea.style.display = 'none';
        listArea.style.display = 'block';
        btnList.style.background = '#1890ff';
        btnList.style.color = 'white';
        btnList.style.border = 'none';
        btnGenerate.style.background = 'white';
        btnGenerate.style.color = '#666';
        btnGenerate.style.border = '1px solid #d9d9d9';
        loadRemittanceListTargetAccounts();
    }
}

// 加载工作台账户到生成页面下拉菜单
function loadRemittanceTargetAccounts() {
    const select = document.getElementById('remittance-cc-account');
    if(!select) return;
    
    let html = '<option value="">请选择已授权的工作台</option>';
    accounts.forEach(acc => {
        html += `<option value="${acc.id}">${acc.id}</option>`;
    });
    select.innerHTML = html;
}

// 加载工作台账户到列表页面下拉菜单
function loadRemittanceListTargetAccounts() {
    const select = document.getElementById('list-cc-account');
    if(!select) return;
    
    let html = '<option value="">请选择已授权的工作台</option>';
    accounts.forEach(acc => {
        html += `<option value="${acc.id}">${acc.id}</option>`;
    });
    select.innerHTML = html;
}

// 充值校验
async function verifyCharge() {
    const ccAccountId = document.getElementById('remittance-cc-account').value;
    const platform = document.getElementById('remittance-platform').value;
    const chargeType = document.getElementById('remittance-charge-type').value;
    const chargeSource = document.getElementById('remittance-charge-source').value;
    const targetId = document.getElementById('remittance-target-id').value.trim();
    
    const resultDiv = document.getElementById('verify-result');
    const infoDiv = document.getElementById('verify-info');
    const step2Div = document.getElementById('remittance-step2');
    
    if(!ccAccountId) {
        alert('请选择鉴权账户（工作台）');
        return;
    }
    if(!targetId) {
        alert('请输入投放账户ID');
        return;
    }
    
    // 显示加载中
    if(resultDiv) {
        resultDiv.style.display = 'block';
        if(infoDiv) infoDiv.innerHTML = '<div style="text-align: center; color: #1890ff;">校验中...</div>';
    }
    if(step2Div) step2Div.style.display = 'none';
    
    try {
        const url = `/api/account_service/charge/verify?cc_account_id=${ccAccountId}&account_id=${targetId}&platform=${platform}&charge_type=${chargeType}&charge_source=${chargeSource}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const d = data.data;
            if(infoDiv) {
                let html = '';
                html += `<div style="background: #f6ffed; padding: 8px; border-radius: 4px; border-left: 3px solid #52c41a; margin-bottom: 10px;">
                    <strong>校验状态：</strong> ${d.can_charge === true ? '✅ 可充值' : '❌ 不可充值'}
                </div>`;
                
                if(d.min_charge_amount > 0) {
                    html += `<div><strong>最小充值金额：</strong>¥${d.min_charge_amount.toFixed(2)}</div>`;
                }
                
                if(d.contract_info) {
                    const c = d.contract_info;
                    html += `<div style="margin-top: 10px; padding: 10px; background: white; border-radius: 4px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">合同信息</div>
                        <div>合同编号：${c.contract_no || '-'}</div>
                        <div>客户名称：${c.customer_name || '-'}</div>
                        <div>合同主体：${c.contract_subject_name || '-'}</div>
                    </div>`;
                }
                
                if(d.allow_charge_types && d.allow_charge_types.length > 0) {
                    html += `<div style="margin-top: 5px;"><strong>允许的充值类型：</strong>${d.allow_charge_types.join(', ')}</div>`;
                }
                
                infoDiv.innerHTML = html;
            }
            
            // 如果校验通过，显示第二步
            if(d.can_charge === true && step2Div) {
                step2Div.style.display = 'block';
                step2Div.style.opacity = '1';
                step2Div.style.pointerEvents = 'auto';
            }
            
        } else {
            if(infoDiv) {
                infoDiv.innerHTML = `<div style="color: #cf1322;">校验失败: ${data.message || '未知错误'}</div>`;
            }
            if(step2Div) step2Div.style.display = 'none';
        }
    } catch(e) {
        if(infoDiv) {
            infoDiv.innerHTML = `<div style="color: #cf1322;">请求异常: ${e.message}</div>`;
        }
        if(step2Div) step2Div.style.display = 'none';
    }
}

// 生成汇款码
async function generateRemittanceCode() {
    const ccAccountId = document.getElementById('remittance-cc-account').value;
    const platform = document.getElementById('remittance-platform').value;
    const chargeType = document.getElementById('remittance-charge-type').value;
    const chargeAmount = document.getElementById('remittance-amount').value;
    const targetId = document.getElementById('remittance-target-id').value.trim();
    const resultDiv = document.getElementById('remittance-result');
    const detailDiv = document.getElementById('remittance-detail');
    
    if(!ccAccountId || !targetId || !chargeAmount) {
        alert('请填写完整信息（鉴权账户、投放账户ID、充值金额）');
        return;
    }
    
    if(resultDiv) resultDiv.style.display = 'block';
    if(detailDiv) detailDiv.innerHTML = '<div style="text-align: center; color: #1890ff;">生成中...</div>';
    
    try {
        const res = await fetch('/api/account_service/remittance/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                cc_account_id: ccAccountId,
                charge_target_id: targetId,
                charge_type: chargeType,
                charge_amount: parseFloat(chargeAmount),
                platform: platform
            })
        });
        
        const data = await res.json();
        
        if(data.code === 0 && data.data && data.data.remittance_info) {
            const r = data.data.remittance_info;
            if(detailDiv) {
                let html = `
                    <div style="background: #f6ffed; padding: 15px; border-radius: 4px; border-left: 3px solid #52c41a; margin-bottom: 15px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">汇款码</div>
                        <div style="font-size: 24px; font-weight: 600; color: #1890ff; font-family: monospace; letter-spacing: 2px;">${r.remittance_code || '-'}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
                        <div style="background: #fafafa; padding: 10px; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666;">收款账户名</div>
                            <div style="font-weight: 500;">${r.receiver_name || '-'}</div>
                        </div>
                        <div style="background: #fafafa; padding: 10px; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666;">收款账号</div>
                            <div style="font-weight: 500; font-family: monospace;">${r.bank_account || '-'}</div>
                        </div>
                        <div style="background: #fafafa; padding: 10px; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666;">开户行</div>
                            <div style="font-weight: 500;">${r.bank_name || '-'}</div>
                        </div>
                        <div style="background: #fafafa; padding: 10px; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666;">联行号</div>
                            <div style="font-weight: 500; font-family: monospace;">${r.bank_number || '-'}</div>
                        </div>
                        <div style="background: #fff7e6; padding: 10px; border-radius: 4px; border-left: 3px solid #faad14;">
                            <div style="font-size: 12px; color: #666;">充值金额</div>
                            <div style="font-weight: 600; color: #cf1322; font-size: 16px;">¥${parseFloat(chargeAmount).toFixed(2)}</div>
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding: 10px; background: #fff7e6; border-radius: 4px; font-size: 12px; color: #d46b08;">
                        ⚠️ 请使用对公账户向上述收款账号转账，备注中务必填写汇款码。转账成功后款项将自动充值到投放账户。
                    </div>
                `;
                detailDiv.innerHTML = html;
            }
        } else {
            if(detailDiv) {
                detailDiv.innerHTML = `<div style="color: #cf1322;">生成失败: ${data.message || '未知错误'}</div>`;
            }
        }
    } catch(e) {
        if(detailDiv) {
            detailDiv.innerHTML = `<div style="color: #cf1322;">请求异常: ${e.message}</div>`;
        }
    }
}

// 查询汇款码列表
async function queryRemittanceList() {
    const ccAccountId = document.getElementById('list-cc-account').value;
    const targetId = document.getElementById('list-target-id').value.trim();
    const resultDiv = document.getElementById('remittance-list-result');
    const paginationDiv = document.getElementById('remittance-pagination');
    
    if(!ccAccountId || !targetId) {
        alert('请选择鉴权账户并输入投放账户ID');
        return;
    }
    
    currentRemittancePage = 1;
    await fetchRemittanceList(ccAccountId, targetId);
}

async function fetchRemittanceList(ccAccountId, targetId) {
    const resultDiv = document.getElementById('remittance-list-result');
    const paginationDiv = document.getElementById('remittance-pagination');
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        const url = `/api/account_service/remittance/list?cc_account_id=${ccAccountId}&account_id=${targetId}&page=${currentRemittancePage}&page_size=20`;
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.list || [];
            
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无汇款码记录</div>';
                if(paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            
            let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
            html += '<th style="padding: 12px; text-align: left; font-weight: 600;">汇款码</th>';
            html += '<th style="padding: 12px; text-align: right; font-weight: 600;">充值金额</th>';
            html += '<th style="padding: 12px; text-align: center; font-weight: 600;">状态</th>';
            html += '<th style="padding: 12px; text-align: left; font-weight: 600;">创建时间</th>';
            html += '<th style="padding: 12px; text-align: left; font-weight: 600;">备注</th>';
            html += '</tr></thead><tbody>';
            
            list.forEach(item => {
                let statusText = '未知';
                let statusColor = '#999';
                if(item.status === 'NOT_USED' || item.status === 'VALID') {
                    statusText = '未使用';
                    statusColor = '#52c41a';
                } else if(item.status === 'CHARGE_SUCCESS' || item.status === 'USED') {
                    statusText = '已使用';
                    statusColor = '#1890ff';
                } else if(item.status === 'CHARGE_FAILED' || item.status === 'INVALID' || item.status === 'ABANDON') {
                    statusText = '已失效';
                    statusColor = '#f5222d';
                }
                
                html += `<tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 12px; font-family: monospace; font-size: 14px; color: #1890ff; font-weight: 600;">${item.remittance_code || '-'}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 500; color: #cf1322;">¥${(item.charge_amount || 0).toFixed(2)}</td>
                    <td style="padding: 12px; text-align: center;"><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor};">${statusText}</span></td>
                    <td style="padding: 12px; font-size: 12px; color: #666;">${item.create_time || '-'}</td>
                    <td style="padding: 12px; font-size: 12px; color: #666;">${item.remark || '-'}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            if(resultDiv) resultDiv.innerHTML = html;
            
            // 分页控件
            const totalCount = data.data.total_count || list.length;
            const totalPage = Math.ceil(totalCount / 20) || 1;
            const pageInfoSpan = document.getElementById('remit-page-info');
            const btnPrev = document.getElementById('btn-remit-prev');
            const btnNext = document.getElementById('btn-remit-next');
            
            if(pageInfoSpan) pageInfoSpan.textContent = `第 ${currentRemittancePage} 页 / 共 ${totalPage} 页`;
            if(btnPrev) btnPrev.disabled = currentRemittancePage <= 1;
            if(btnNext) btnNext.disabled = currentRemittancePage >= totalPage;
            if(paginationDiv) paginationDiv.style.display = 'flex';
            
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
            if(paginationDiv) paginationDiv.style.display = 'none';
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
        if(paginationDiv) paginationDiv.style.display = 'none';
    }
}

// 分页切换
function changeRemittancePage(delta) {
    currentRemittancePage += delta;
    if(currentRemittancePage < 1) currentRemittancePage = 1;
    
    const ccAccountId = document.getElementById('list-cc-account').value;
    const targetId = document.getElementById('list-target-id').value.trim();
    
    if(ccAccountId && targetId) {
        fetchRemittanceList(ccAccountId, targetId);
    }
}

// ==================== 资金和流水管理 - 代理商转账 ====================

let transferTargetAccounts = []; // 存储已添加的目标账户
let currentTransferStep = 1;
let maxTransferBalanceData = null; // 存储最大可转余额查询结果
let lastTransferBizRequestNo = null; // 存储上次转账的幂等ID

// 修改showSection函数支持代理商转账（在原有if-else链中添加）
// 请在app.js中找到showSection函数，在if(id === 'remittance')后面添加：
/*
if(id === 'agent-transfer') {
    initAgentTransferPage();
}
*/

function initAgentTransferPage() {
    // 加载工作台账户到下拉菜单
    const select = document.getElementById('transfer-target-select');
    if(select) {
        let html = '<option value="">从已有账户选择（可选）</option>';
        accounts.forEach(acc => {
            if(acc.local_accounts) {
                Object.entries(acc.local_accounts).forEach(([id, data]) => {
                    html += `<option value="${id}">${data.name || '本地推账户'} (${id})</option>`;
                });
            }
        });
        select.innerHTML = html;
    }
    
    // 重置状态
    transferTargetAccounts = [];
    currentTransferStep = 1;
    updateTransferTargetList();
    goToTransferStep(1);
}

function addTargetAccount() {
    const select = document.getElementById('transfer-target-select');
    const id = select.value;
    if(!id) {
        alert('请选择一个账户');
        return;
    }
    if(transferTargetAccounts.includes(id)) {
        alert('该账户已添加');
        return;
    }
    transferTargetAccounts.push(id);
    updateTransferTargetList();
    select.value = '';
}

function addManualTarget() {
    const input = document.getElementById('transfer-target-manual');
    const id = input.value.trim();
    if(!id) {
        alert('请输入账户ID');
        return;
    }
    if(!/^\d{16,19}$/.test(id)) {
        alert('账户ID必须是16-19位数字');
        return;
    }
    if(transferTargetAccounts.includes(id)) {
        alert('该账户已添加');
        return;
    }
    transferTargetAccounts.push(id);
    updateTransferTargetList();
    input.value = '';
}

function removeTargetAccount(id) {
    transferTargetAccounts = transferTargetAccounts.filter(item => item !== id);
    updateTransferTargetList();
}

function updateTransferTargetList() {
    const container = document.getElementById('transfer-target-list');
    if(!container) return;
    
    if(transferTargetAccounts.length === 0) {
        container.innerHTML = '<span style="color: #999; font-size: 13px;">暂未添加目标账户</span>';
        return;
    }
    
    let html = '';
    transferTargetAccounts.forEach(id => {
        html += `
            <span style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 4px; font-size: 13px; color: #096dd9;">
                ${id}
                <button onclick="removeTargetAccount('${id}')" style="background: none; border: none; color: #f5222d; cursor: pointer; font-size: 12px; padding: 0;">×</button>
            </span>
        `;
    });
    container.innerHTML = html;
}

async function queryTransferBalance() {
    const agentId = document.getElementById('transfer-agent-id').value.trim();
    const anchorId = document.getElementById('transfer-anchor-id').value.trim();
    
    if(!agentId || !anchorId) {
        alert('请输入代理商账户ID和锚定账户ID');
        return;
    }
    
    const resultDiv = document.getElementById('transfer-balance-result');
    resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    goToTransferStep(2);
    
    try {
        const url = `/api/account_service/transfer/balance?agent_id=${agentId}&account_ids=${anchorId}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data && data.data.accont_amount_detail_list) {
            const list = data.data.accont_amount_detail_list;
            let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">';
            
            list.forEach(item => {
                html += `
                    <div style="background: #fafafa; border-radius: 8px; padding: 15px; border-left: 4px solid #1890ff;">
                        <div style="font-weight: 600; margin-bottom: 10px; color: #001529;">账户: ${item.account_id}</div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">总可转金额: <strong style="color: #cf1322; font-size: 16px;">¥${((item.total_transfer_amount || 0) / 100).toFixed(2)}</strong></div>
                        <div style="font-size: 12px; color: #999; margin-bottom: 10px;">竞价保证金: ¥${((item.deposit_amount || 0) / 100).toFixed(2)}</div>
                `;
                
                if(item.capital_detail_list) {
                    html += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d9d9d9;">';
                    item.capital_detail_list.forEach(capital => {
                        const typeMap = {
                            'CREDIT_BIDDING': '授信竞价',
                            'CREDIT_BRAND': '授信品牌',
                            'CREDIT_GENERAL': '授信通用',
                            'PREPAY_BIDDING': '预付竞价',
                            'PREPAY_BRAND': '预付品牌',
                            'PREPAY_GENERAL': '预付通用'
                        };
                        html += `<div style="font-size: 12px; margin-bottom: 5px;">${typeMap[capital.capital_type] || capital.capital_type}: ¥${((capital.transfer_balance || 0) / 100).toFixed(2)}</div>`;
                    });
                    html += '</div>';
                }
                
                html += '</div>';
            });
            
            html += '</div>';
            resultDiv.innerHTML = html;
        } else {
            resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">查询失败: ${data.message || '未知错误'}</div>`;
        }
    } catch(e) {
        resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryCanTransferBalance() {
    const agentId = document.getElementById('transfer-agent-id').value.trim();
    const anchorId = document.getElementById('transfer-anchor-id').value.trim();
    const direction = document.getElementById('transfer-direction').value;
    
    if(!agentId || !anchorId) {
        alert('请输入代理商账户ID和锚定账户ID');
        return;
    }
    
    if(transferTargetAccounts.length === 0) {
        alert('请至少添加一个目标账户');
        return;
    }
    
    const resultDiv = document.getElementById('transfer-balance-result');
    resultDiv.innerHTML = '<div class="lp-loading">查询最大可转余额中...</div>';
    goToTransferStep(2);
    
    try {
        const targetIds = transferTargetAccounts.join(',');
        const url = `/api/account_service/transfer/can_transfer?agent_id=${agentId}&account_id=${anchorId}&target_account_ids=${targetIds}&transfer_direction=${direction}`;
        const res = await fetch(url);
        const data = await res.json();
        
        maxTransferBalanceData = data;
        
        if(data.code === 0 && data.data && data.data.can_transfer_detail_list) {
            const list = data.data.can_transfer_detail_list;
            let html = '<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 4px; margin-bottom: 20px; color: #389e0d; font-size: 14px;">✅ 已获取最大可转余额，可在下一步调整转账金额</div>';
            
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 15px;">';
            
            list.forEach(detail => {
                html += `
                    <div style="background: #fafafa; border-radius: 8px; padding: 15px; border-left: 4px solid #52c41a;">
                        <div style="font-weight: 600; margin-bottom: 10px; color: #001529; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px;">
                            ${detail.remitter_account_id === parseInt(anchorId) ? '减款方' : '加款方'}: ${detail.remitter_account_id}
                        </div>
                `;
                
                if(detail.capital_detail_list) {
                    detail.capital_detail_list.forEach(capital => {
                        const typeMap = {
                            'CREDIT_BIDDING': '授信竞价',
                            'CREDIT_BRAND': '授信品牌',
                            'CREDIT_GENERAL': '授信通用',
                            'PREPAY_BIDDING': '预付竞价',
                            'PREPAY_BRAND': '预付品牌',
                            'PREPAY_GENERAL': '预付通用'
                        };
                        html += `
                            <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px;">
                                <div style="font-size: 12px; color: #666;">${typeMap[capital.capital_type] || capital.capital_type}</div>
                                <div style="font-size: 16px; font-weight: 600; color: #52c41a;">¥${((capital.transfer_balance || 0) / 100).toFixed(2)}</div>
                            </div>
                        `;
                    });
                }
                
                html += '</div>';
            });
            
            html += '</div>';
            resultDiv.innerHTML = html;
            
            // 自动填充转账金额输入框（在步骤3）
            generateTransferAmountInputs(list);
        } else {
            resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">查询失败: ${data.message || '未知错误'}</div>`;
        }
    } catch(e) {
        resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function generateTransferAmountInputs(canTransferData) {
    const container = document.getElementById('transfer-amount-list');
    if(!container) return;
    
    let html = '';
    transferTargetAccounts.forEach((targetId, index) => {
        // 查找对应的目标账户可转余额
        let maxAmount = 0;
        let capitalOptions = '';
        
        if(canTransferData && canTransferData.length > 0) {
            // 查找匹配的目标账户数据
            const targetData = canTransferData[0].payee_transfer_amount_detail_list?.find(p => p.payee_account_id === parseInt(targetId));
            if(targetData && targetData.capital_detail_list) {
                targetData.capital_detail_list.forEach(capital => {
                    const typeMap = {
                        'CREDIT_BIDDING': '授信竞价',
                        'CREDIT_BRAND': '授信品牌',
                        'CREDIT_GENERAL': '授信通用',
                        'PREPAY_BIDDING': '预付竞价',
                        'PREPAY_BRAND': '预付品牌',
                        'PREPAY_GENERAL': '预付通用'
                    };
                    const amount = (capital.transfer_balance || 0) / 100;
                    if(amount > maxAmount) maxAmount = amount;
                    capitalOptions += `<option value="${capital.capital_type}" data-max="${amount}">${typeMap[capital.capital_type] || capital.capital_type} (最大¥${amount.toFixed(2)})</option>`;
                });
            }
        }
        
        html += `
            <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #1890ff;">
                <div style="font-weight: 600; margin-bottom: 10px; color: #001529;">目标账户: ${targetId}</div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; align-items: center;">
                    <div>
                        <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">资金类型</label>
                        <select id="transfer-capital-type-${index}" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; width: 100%; font-size: 13px;" onchange="updateMaxAmountHint(${index})">
                            ${capitalOptions || '<option value="PREPAY_BIDDING">预付竞价</option>'}
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">转账金额(元)</label>
                        <input type="number" id="transfer-amount-${index}" placeholder="0.00" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; width: 100%; font-size: 13px;" max="${maxAmount}" step="0.01">
                    </div>
                    <div>
                        <button onclick="fillMaxAmount(${index}, ${maxAmount})" style="padding: 6px 12px; background: #52c41a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 20px;">填充最大额</button>
                    </div>
                </div>
                <div id="max-amount-hint-${index}" style="font-size: 12px; color: #999; margin-top: 5px;">最大可转: ¥${maxAmount.toFixed(2)}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateMaxAmountHint(index) {
    const select = document.getElementById(`transfer-capital-type-${index}`);
    const option = select.options[select.selectedIndex];
    const maxAmount = option.getAttribute('data-max') || 0;
    const hint = document.getElementById(`max-amount-hint-${index}`);
    const amountInput = document.getElementById(`transfer-amount-${index}`);
    if(hint) hint.textContent = `最大可转: ¥${parseFloat(maxAmount).toFixed(2)}`;
    if(amountInput) amountInput.max = maxAmount;
}

function fillMaxAmount(index, amount) {
    const input = document.getElementById(`transfer-amount-${index}`);
    if(input) input.value = amount.toFixed(2);
}

function goToTransferStep(step) {
    currentTransferStep = step;
    
    // 更新步骤指示器
    for(let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`transfer-step${i}`);
        if(stepEl) {
            if(i === step) {
                stepEl.classList.add('active');
            } else {
                stepEl.classList.remove('active');
            }
        }
    }
    
    // 显示对应面板
    for(let i = 1; i <= 4; i++) {
        const panel = document.getElementById(`transfer-step${i}-panel`);
        if(panel) {
            panel.style.display = i === step ? 'block' : 'none';
        }
    }
}

function backToTransferStep(step) {
    goToTransferStep(step);
}

function showTransferConfirm() {
    const anchorId = document.getElementById('transfer-anchor-id').value.trim();
    const agentId = document.getElementById('transfer-agent-id').value.trim();
    const direction = document.getElementById('transfer-direction').value;
    const remark = document.getElementById('transfer-remark').value.trim();
    
    // 收集转账明细
    const targetAccounts = [];
    for(let i = 0; i < transferTargetAccounts.length; i++) {
        const targetId = transferTargetAccounts[i];
        const capitalType = document.getElementById(`transfer-capital-type-${i}`)?.value || 'PREPAY_BIDDING';
        const amount = parseFloat(document.getElementById(`transfer-amount-${i}`)?.value || 0);
        
        if(!amount || amount <= 0) {
            alert(`请输入目标账户 ${targetId} 的转账金额`);
            return;
        }
        
        targetAccounts.push({
            account_id: targetId,
            capital_type: capitalType,
            amount: Math.round(amount * 100), // 转换为分
            capital_sub_type: 'NORMAL'
        });
    }
    
    // 构建确认信息
    const dirText = direction === 'TRANSFER_OUT' ? '转出' : '转入';
    let confirmMsg = `确认发起转账？\n\n`;
    confirmMsg += `锚定账户: ${anchorId}\n`;
    confirmMsg += `转账方向: ${dirText}\n`;
    confirmMsg += `目标账户数: ${targetAccounts.length}个\n`;
    confirmMsg += `总转账金额: ¥${(targetAccounts.reduce((sum, t) => sum + t.amount, 0) / 100).toFixed(2)}\n`;
    confirmMsg += `\n详细:\n`;
    targetAccounts.forEach(t => {
        confirmMsg += `  ${t.account_id}: ¥${(t.amount / 100).toFixed(2)}\n`;
    });
    
    if(confirm(confirmMsg)) {
        createTransfer(agentId, anchorId, targetAccounts, direction, remark);
    }
}

async function createTransfer(agentId, anchorId, targetAccounts, direction, remark) {
    try {
        const res = await fetch('/api/account_service/transfer/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                agent_id: agentId,
                account_id: anchorId,
                target_accounts: targetAccounts,
                transfer_direction: direction,
                remark: remark
            })
        });
        
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            lastTransferBizRequestNo = data.data.transfer_serial;
            alert(`✅ 转账发起成功！\n转账单号: ${data.data.transfer_serial}`);
            goToTransferStep(4);
            // 自动查询转账状态
            setTimeout(() => queryTransferDetail(), 1000);
        } else {
            // 智能重试：网络错误自动重试1次
            if(data.code >= 500 && data.code < 600) {
                if(confirm('网络错误，是否自动重试一次？')) {
                    setTimeout(() => createTransfer(agentId, anchorId, targetAccounts, direction, remark), 1000);
                    return;
                }
            }
            alert(`转账失败: ${data.message || '未知错误'}`);
        }
    } catch(e) {
        if(confirm(`请求异常: ${e.message}\n是否自动重试一次？`)) {
            setTimeout(() => createTransfer(agentId, anchorId, targetAccounts, direction, remark), 1000);
        }
    }
}

async function queryTransferDetail() {
    const agentId = document.getElementById('transfer-agent-id').value.trim();
    const serialInput = document.getElementById('transfer-query-serial');
    const serial = serialInput ? serialInput.value.trim() : '';
    const resultDiv = document.getElementById('transfer-detail-result');
    
    if(!agentId) {
        alert('请输入代理商账户ID');
        return;
    }
    
    const bizNo = serial || lastTransferBizRequestNo;
    if(!bizNo) {
        alert('请输入转账单号或先发起转账');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        let url = `/api/account_service/transfer/detail?agent_id=${agentId}`;
        if(bizNo.startsWith('TS')) {
            url += `&transfer_serial=${bizNo}`;
        } else {
            url += `&transfer_biz_request_no=${bizNo}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const d = data.data;
            const statusMap = {
                'NO_TRANSFER': '未转账',
                'TRANSFER_FAILED': '转账失败',
                'TRANSFER_ING': '转账中',
                'TRANSFER_PART': '部分成功',
                'TRANSFER_SUCCESS': '转账成功'
            };
            const statusColor = d.transfer_status === 'TRANSFER_SUCCESS' ? '#52c41a' : 
                               d.transfer_status === 'TRANSFER_FAILED' ? '#f5222d' : '#faad14';
            
            let html = `
                <div style="background: #fafafa; border-radius: 8px; padding: 20px; border-left: 4px solid ${statusColor}; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px;">
                        <div style="font-weight: 600; font-size: 16px; color: #001529;">转账单详情</div>
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}; font-weight: 600;">
                            ${statusMap[d.transfer_status] || d.transfer_status}
                        </span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; font-size: 13px;">
                        <div><strong>转账单号:</strong> ${d.transfer_serial || '-'}</div>
                        <div><strong>转账金额:</strong> ¥${((d.transfer_amount || 0) / 100).toFixed(2)}</div>
                        <div><strong>转账方向:</strong> ${d.transfer_direction === 'TRANSFER_IN' ? '转入' : '转出'}</div>
                        <div><strong>创建时间:</strong> ${d.transfer_create_time || '-'}</div>
                        <div><strong>完成时间:</strong> ${d.transfer_finish_time || '-'}</div>
                        <div><strong>备注:</strong> ${d.remark || '-'}</div>
                    </div>
                </div>
            `;
            
            if(d.transfer_target_record_list && d.transfer_target_record_list.length > 0) {
                html += '<div style="margin-top: 20px;"><div style="font-weight: 600; margin-bottom: 10px; color: #001529;">目标账户转账记录</div>';
                html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
                html += '<th style="padding: 10px; text-align: left;">目标账户</th><th style="padding: 10px; text-align: right;">金额</th><th style="padding: 10px; text-align: center;">状态</th><th style="padding: 10px; text-align: left;">失败原因</th></tr></thead><tbody>';
                
                d.transfer_target_record_list.forEach(record => {
                    const recordStatus = record.transfer_status || 'NO_TRANSFER';
                    const recordStatusColor = recordStatus === 'TRANSFER_SUCCESS' ? '#52c41a' : recordStatus === 'TRANSFER_FAILED' ? '#f5222d' : '#faad14';
                    html += `<tr style="border-bottom: 1px solid #f0f0f0;">
                        <td style="padding: 10px;">${record.target_account_id}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 500;">¥${((record.transfer_amount || 0) / 100).toFixed(2)}</td>
                        <td style="padding: 10px; text-align: center;"><span style="color: ${recordStatusColor}; font-weight: 500;">${statusMap[recordStatus] || recordStatus}</span></td>
                        <td style="padding: 10px; color: #cf1322; font-size: 12px;">${record.fail_reason || '-'}</td>
                    </tr>`;
                });
                
                html += '</tbody></table></div>';
            }
            
            if(resultDiv) resultDiv.innerHTML = html;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">查询失败: ${data.message || '未知错误'}</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function initNewTransfer() {
    // 重置所有状态
    transferTargetAccounts = [];
    currentTransferStep = 1;
    maxTransferBalanceData = null;
    lastTransferBizRequestNo = null;
    
    // 清空输入
    document.getElementById('transfer-agent-id').value = '';
    document.getElementById('transfer-anchor-id').value = '';
    document.getElementById('transfer-target-manual').value = '';
    document.getElementById('transfer-remark').value = '';
    document.getElementById('transfer-query-serial').value = '';
    
    updateTransferTargetList();
    goToTransferStep(1);
    
    // 清空结果显示
    const resultDiv = document.getElementById('transfer-balance-result');
    if(resultDiv) resultDiv.innerHTML = '';
    const detailDiv = document.getElementById('transfer-detail-result');
    if(detailDiv) detailDiv.innerHTML = '';
    const amountList = document.getElementById('transfer-amount-list');
    if(amountList) amountList.innerHTML = '';
}
// ==================== 资金和流水管理 - 资金共享 ====================

let currentSharedWalletTab = 'info';
let swBalanceRules = [];
let swUsageRules = [];
let swBudgetRules = [];

function initSharedWalletPage() {
    // 初始化日期
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startEl = document.getElementById('sw-flow-start-date');
    const endEl = document.getElementById('sw-flow-end-date');
    if(startEl) startEl.value = weekAgo.toISOString().split('T')[0];
    if(endEl) endEl.value = today.toISOString().split('T')[0];
    
    // 默认显示第一个标签
    switchSharedWalletTab('info');
}

function switchSharedWalletTab(tab) {
    currentSharedWalletTab = tab;
    
          const tabs = ['info', 'relation', 'flow', 'budget', 'watch', 'charge', 'transfer'];
    const btnIds = {
        'info': 'btn-sw-tab-info',
        'relation': 'btn-sw-tab-relation',
        'flow': 'btn-sw-tab-flow',
        'budget': 'btn-sw-tab-budget',
        'watch': 'btn-sw-tab-watch',
        'charge': 'btn-sw-tab-charge',
        'transfer': 'btn-sw-tab-transfer'
    };
    
    // 更新按钮样式
    tabs.forEach(t => {
        const btn = document.getElementById(btnIds[t]);
        if(btn) {
            if(t === tab) {
                btn.style.background = '#1890ff';
                btn.style.color = 'white';
                btn.style.border = 'none';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#666';
                btn.style.border = '1px solid #d9d9d9';
            }
        }
    });
    
    // 显示对应内容
    tabs.forEach(t => {
        const content = document.getElementById('sw-tab-' + t);
        if(content) content.style.display = t === tab ? 'block' : 'none';
    });
}

// ---------- 标签1：钱包信息 ----------

async function querySharedWalletMainInfo() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const mainWalletId = document.getElementById('sw-main-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-info-result');
    
    if(!accountId || !mainWalletId) {
        alert('请输入账户ID和大钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/main_wallet?account_id=${accountId}&main_wallet_id=${mainWalletId}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '大钱包信息');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function querySharedWalletInfoBatch() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletIdList = document.getElementById('sw-wallet-id-list').value.trim();
    const resultDiv = document.getElementById('sw-info-result');
    
    if(!accountId || !walletIdList) {
        alert('请输入账户ID和钱包ID列表');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/wallet_info?account_id=${accountId}&wallet_id_list=${encodeURIComponent(walletIdList)}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '批量钱包信息');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function querySharedWalletBalanceBatch() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletIdList = document.getElementById('sw-wallet-id-list').value.trim();
    const resultDiv = document.getElementById('sw-info-result');
    
    if(!accountId || !walletIdList) {
        alert('请输入账户ID和钱包ID列表');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/balance/batch?account_id=${accountId}&wallet_id_list=${encodeURIComponent(walletIdList)}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '批量钱包余额');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function querySharedWalletAccountRelation() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const resultDiv = document.getElementById('sw-info-result');
    
    if(!accountId) {
        alert('请输入账户ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/account_relation?account_id=${accountId}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '账户钱包关系');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

// ---------- 标签2：绑定关系 ----------

async function querySharedWalletRelation() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletId = document.getElementById('sw-relation-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-relation-result');
    
    if(!accountId || !walletId) {
        alert('请输入账户ID和共享钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/wallet_relation?account_id=${accountId}&shared_wallet_id=${walletId}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '子钱包绑定关系');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function showSharedWalletBindPanel() {
    const panel = document.getElementById('sw-bind-panel');
    if(panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function showCreateSubWalletPanel() {
    const panel = document.getElementById('sw-create-panel');
    if(panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function submitSharedWalletRelation() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const operationId = document.getElementById('sw-operation-id').value.trim();
    const relationMode = document.getElementById('sw-relation-mode').value;
    const fromWalletId = document.getElementById('sw-from-wallet-id').value.trim() || '0';
    const toWalletId = document.getElementById('sw-to-wallet-id').value.trim() || '0';
    const advIds = document.getElementById('sw-adv-ids').value.trim();
    const resultDiv = document.getElementById('sw-relation-result');
    
    if(!accountId || !operationId) {
        alert('请输入账户ID和操作ID');
        return;
    }
    
    if(!advIds) {
        alert('请输入ADV ID列表');
        return;
    }
    
    const advIdList = advIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">提交中...</div>';
    
    try {
        const res = await fetch('/api/account_service/shared_wallet/shared_relation/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                account_id: accountId,
                account_type: accountType,
                operation_id: parseInt(operationId),
                relation_change_mode: relationMode,
                from_wallet_id: parseInt(fromWalletId),
                to_wallet_id: parseInt(toWalletId),
                adv_range_parameter: {adv_ids: advIdList}
            })
        });
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '绑定/解绑结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function submitCreateSubWallet() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletId = document.getElementById('sw-create-wallet-id').value.trim();
    const walletName = document.getElementById('sw-create-wallet-name').value.trim();
    const mainWalletId = document.getElementById('sw-create-main-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-relation-result');
    
    if(!accountId || !walletId || !walletName || !mainWalletId) {
        alert('请填写完整信息');
        return;
    }
    
    const platforms = [];
    if(document.getElementById('sw-platform-ad').checked) platforms.push('AD');
    if(document.getElementById('sw-platform-ecp').checked) platforms.push('ECP');
    if(document.getElementById('sw-platform-local').checked) platforms.push('LOCAL_ADS');
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">创建中...</div>';
    
    try {
        const res = await fetch('/api/account_service/shared_wallet/sub_wallet/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                account_id: accountId,
                account_type: accountType,
                wallet_id: parseInt(walletId),
                wallet_name: walletName,
                main_wallet_id: parseInt(mainWalletId),
                shared_range: {account_platform_list: platforms}
            })
        });
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '创建小钱包结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

// ---------- 标签3：流水查询 ----------

async function querySharedWalletTransactionDetail() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletId = document.getElementById('sw-flow-wallet-id').value.trim();
    const startDate = document.getElementById('sw-flow-start-date').value;
    const endDate = document.getElementById('sw-flow-end-date').value;
    const resultDiv = document.getElementById('sw-flow-result');
    
    if(!accountId || !walletId || !startDate || !endDate) {
        alert('请输入账户ID、钱包ID和日期范围');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/transaction_detail?account_id=${accountId}&shared_wallet_id=${walletId}&start_date=${startDate}&end_date=${endDate}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '流水明细');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function querySharedWalletDailyStat() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletId = document.getElementById('sw-flow-wallet-id').value.trim();
    const startDate = document.getElementById('sw-flow-start-date').value;
    const endDate = document.getElementById('sw-flow-end-date').value;
    const resultDiv = document.getElementById('sw-flow-result');
    
    if(!accountId || !walletId) {
        alert('请输入账户ID和钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        let url = `/api/account_service/shared_wallet/daily_stat?account_id=${accountId}&shared_wallet_id=${walletId}&account_type=${accountType}`;
        if(startDate) url += `&start_date=${startDate}`;
        if(endDate) url += `&end_date=${endDate}`;
        const res = await fetch(url);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '日流水');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function querySharedWalletAdvLog() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletId = document.getElementById('sw-flow-wallet-id').value.trim();
    const advId = document.getElementById('sw-flow-adv-id').value.trim();
    const operationId = document.getElementById('sw-flow-operation-id').value.trim();
    const resultDiv = document.getElementById('sw-flow-result');
    
    if(!accountId || !walletId) {
        alert('请输入账户ID和钱包ID');
        return;
    }
    
    if(!advId && !operationId) {
        alert('请输入ADV ID或操作ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        let url = `/api/account_service/shared_wallet/wallet_adv_operation_log?account_id=${accountId}&wallet_id=${walletId}&account_type=${accountType}`;
        if(advId) url += `&adv_id=${advId}`;
        if(operationId) url += `&operation_id=${operationId}`;
        const res = await fetch(url);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, 'ADV操作记录');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function querySharedWalletWalletLog() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const walletId = document.getElementById('sw-flow-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-flow-result');
    
    if(!accountId || !walletId) {
        alert('请输入账户ID和钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/wallet_operation_log?account_id=${accountId}&wallet_id=${walletId}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '钱包操作记录');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

// ---------- 标签4：预算管理 ----------

async function querySharedWalletBudget() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const subWalletId = document.getElementById('sw-budget-sub-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-budget-result');
    
    if(!accountId || !subWalletId) {
        alert('请输入账户ID和子钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/budget?account_id=${accountId}&sub_wallet_id=${subWalletId}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '子钱包预算');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function showSetBudgetPanel() {
    const panel = document.getElementById('sw-set-budget-panel');
    if(panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function submitSharedWalletBudget() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const subWalletId = document.getElementById('sw-budget-sub-wallet-id').value.trim();
    const effectiveMode = document.getElementById('sw-budget-effective-mode').value;
    const budgetMode = document.getElementById('sw-budget-mode').value;
    const budgetAmount = document.getElementById('sw-budget-amount').value.trim();
    const resultDiv = document.getElementById('sw-budget-result');
    
    if(!accountId || !subWalletId) {
        alert('请输入账户ID和子钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">保存中...</div>';
    
    try {
        const payload = {
            account_id: accountId,
            account_type: accountType,
            sub_wallet_id: parseInt(subWalletId),
            effective_mode: effectiveMode,
            budget_mode: budgetMode
        };
        if(budgetAmount && budgetMode !== 'INFINITE') {
            payload.budget = parseFloat(budgetAmount);
        }
        
        const res = await fetch('/api/account_service/shared_wallet/budget/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '设置预算结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

// ---------- 标签5：盯盘规则 ----------

async function querySharedWalletWatchRule() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const subWalletId = document.getElementById('sw-watch-sub-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-watch-result');
    
    if(!accountId || !subWalletId) {
        alert('请输入账户ID和子钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/shared_wallet/watch_rule?account_id=${accountId}&sub_wallet_id=${subWalletId}&account_type=${accountType}`);
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '盯盘规则');
        
        // 如果查询成功，填充到编辑面板
        if(data.code === 0 && data.data && data.data.rule) {
            fillWatchRuleToPanel(data.data.rule);
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function showSetWatchRulePanel() {
    const panel = document.getElementById('sw-set-watch-panel');
    if(panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function addWatchBalanceRule() {
    const container = document.getElementById('sw-watch-balance-rules');
    if(!container) return;
    const index = swBalanceRules.length;
    swBalanceRules.push({threshold: 0, level: 'A_LEVEL'});
    
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 8px;';
    div.innerHTML = `
        <input type="number" id="sw-balance-threshold-${index}" placeholder="阈值(元)" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; width: 100px; font-size: 13px;">
        <select id="sw-balance-level-${index}" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;">
            <option value="S_LEVEL">S级</option>
            <option value="A_LEVEL" selected>A级</option>
            <option value="B_LEVEL">B级</option>
        </select>
        <button onclick="this.parentElement.remove(); swBalanceRules.splice(${index}, 1);" style="background: none; border: none; color: #f5222d; cursor: pointer; font-size: 16px;">×</button>
    `;
    container.appendChild(div);
}

function addWatchUsageRule() {
    const container = document.getElementById('sw-watch-usage-rules');
    if(!container) return;
    const index = swUsageRules.length;
    swUsageRules.push({threshold: 80, level: 'A_LEVEL'});
    
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 8px;';
    div.innerHTML = `
        <select id="sw-usage-threshold-${index}" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;">
            <option value="30">30%</option>
            <option value="50">50%</option>
            <option value="80" selected>80%</option>
            <option value="100">100%</option>
        </select>
        <select id="sw-usage-level-${index}" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;">
            <option value="S_LEVEL">S级</option>
            <option value="A_LEVEL" selected>A级</option>
            <option value="B_LEVEL">B级</option>
        </select>
        <button onclick="this.parentElement.remove(); swUsageRules.splice(${index}, 1);" style="background: none; border: none; color: #f5222d; cursor: pointer; font-size: 16px;">×</button>
    `;
    container.appendChild(div);
}

function addWatchBudgetRule() {
    const container = document.getElementById('sw-watch-budget-rules');
    if(!container) return;
    const index = swBudgetRules.length;
    swBudgetRules.push({threshold: 0, level: 'A_LEVEL'});
    
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 8px;';
    div.innerHTML = `
        <input type="number" id="sw-budget-threshold-${index}" placeholder="阈值(元)" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; width: 100px; font-size: 13px;">
        <select id="sw-budget-level-${index}" style="padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;">
            <option value="S_LEVEL">S级</option>
            <option value="A_LEVEL" selected>A级</option>
            <option value="B_LEVEL">B级</option>
        </select>
        <button onclick="this.parentElement.remove(); swBudgetRules.splice(${index}, 1);" style="background: none; border: none; color: #f5222d; cursor: pointer; font-size: 16px;">×</button>
    `;
    container.appendChild(div);
}

function fillWatchRuleToPanel(rule) {
    // 清空现有规则
    document.getElementById('sw-watch-balance-rules').innerHTML = '';
    document.getElementById('sw-watch-usage-rules').innerHTML = '';
    document.getElementById('sw-watch-budget-rules').innerHTML = '';
    swBalanceRules = [];
    swUsageRules = [];
    swBudgetRules = [];
    
    // 填充余额预警
    if(rule.balance_alert_rules) {
        rule.balance_alert_rules.forEach((r, i) => {
            addWatchBalanceRule();
            document.getElementById(`sw-balance-threshold-${i}`).value = r.threshold || 0;
            document.getElementById(`sw-balance-level-${i}`).value = r.level || 'A_LEVEL';
        });
    }
    
    // 填充使用率预警
    if(rule.budget_usage_alert_rules) {
        rule.budget_usage_alert_rules.forEach((r, i) => {
            addWatchUsageRule();
            document.getElementById(`sw-usage-threshold-${i}`).value = r.threshold || 80;
            document.getElementById(`sw-usage-level-${i}`).value = r.level || 'A_LEVEL';
        });
    }
    
    // 填充预算剩余预警
    if(rule.budget_alert_rules) {
        rule.budget_alert_rules.forEach((r, i) => {
            addWatchBudgetRule();
            document.getElementById(`sw-budget-threshold-${i}`).value = r.threshold || 0;
            document.getElementById(`sw-budget-level-${i}`).value = r.level || 'A_LEVEL';
        });
    }
    
    // 填充邮箱
    if(rule.alert_emails) {
        document.getElementById('sw-watch-emails').value = rule.alert_emails.join(',');
    }
}

async function submitSharedWalletWatchRule() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const subWalletId = document.getElementById('sw-watch-sub-wallet-id').value.trim();
    const emails = document.getElementById('sw-watch-emails').value.trim();
    const resultDiv = document.getElementById('sw-watch-result');
    
    if(!accountId || !subWalletId) {
        alert('请输入账户ID和子钱包ID');
        return;
    }
    
    // 收集规则
    const balanceRules = [];
    const usageRules = [];
    const budgetRules = [];
    
    for(let i = 0; i < swBalanceRules.length; i++) {
        const threshold = document.getElementById(`sw-balance-threshold-${i}`)?.value;
        const level = document.getElementById(`sw-balance-level-${i}`)?.value;
        if(threshold !== undefined && threshold !== '') {
            balanceRules.push({threshold: parseFloat(threshold), level: level || 'A_LEVEL'});
        }
    }
    
    for(let i = 0; i < swUsageRules.length; i++) {
        const threshold = document.getElementById(`sw-usage-threshold-${i}`)?.value;
        const level = document.getElementById(`sw-usage-level-${i}`)?.value;
        if(threshold !== undefined) {
            usageRules.push({threshold: parseInt(threshold), level: level || 'A_LEVEL'});
        }
    }
    
    for(let i = 0; i < swBudgetRules.length; i++) {
        const threshold = document.getElementById(`sw-budget-threshold-${i}`)?.value;
        const level = document.getElementById(`sw-budget-level-${i}`)?.value;
        if(threshold !== undefined && threshold !== '') {
            budgetRules.push({threshold: parseFloat(threshold), level: level || 'A_LEVEL'});
        }
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">保存中...</div>';
    
    try {
        const rule = {
            wallet_id: parseInt(subWalletId),
            balance_alert_rules: balanceRules,
            budget_usage_alert_rules: usageRules,
            budget_alert_rules: budgetRules
        };
        if(emails) {
            rule.alert_emails = emails.split(',').map(e => e.trim()).filter(e => e);
        }
        
        const res = await fetch('/api/account_service/shared_wallet/watch_rule/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                account_id: accountId,
                account_type: accountType,
                rule: rule
            })
        });
        const data = await res.json();
        renderSharedWalletResult(resultDiv, data, '设置盯盘规则结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

// ---------- 通用渲染函数 ----------

function renderSharedWalletResult(container, data, title) {
    if(!container) return;
    
    if(data.code === 0) {
        let html = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 12px; border-radius: 4px; margin-bottom: 15px; color: #389e0d; font-size: 13px;">✅ ${title}查询成功</div>`;
        html += `<div style="background: #fafafa; border-radius: 8px; padding: 20px; border: 1px solid #f0f0f0;"><pre style="margin: 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #333;">${JSON.stringify(data.data || {}, null, 2)}</pre></div>`;
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div class="lp-alert lp-alert-error">${title}查询失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
    }
}
// ---------- 标签6：直客充值 ----------

let currentChargeStep = 1;

function goToChargeStep(step) {
    currentChargeStep = step;
    
    // 隐藏所有步骤面板
    document.getElementById('charge-step1-panel').style.display = 'none';
    document.getElementById('charge-step2-panel').style.display = 'none';
    document.getElementById('charge-step3-panel').style.display = 'none';
    
    // 显示目标步骤
    const targetPanel = document.getElementById('charge-step' + step + '-panel');
    if(targetPanel) {
        targetPanel.style.display = 'block';
        targetPanel.style.opacity = '1';
        targetPanel.style.pointerEvents = 'auto';
    }
    
    // 更新步骤指示器
    updateChargeStepIndicator(step);
}

function updateChargeStepIndicator(step) {
    const steps = [1, 2, 3];
    steps.forEach(s => {
        const indicator = document.getElementById('charge-step' + s + '-indicator');
        if(indicator) {
            const circle = indicator.querySelector('span:first-child');
            const text = indicator.querySelector('span:last-child');
            if(s <= step) {
                circle.style.background = '#1890ff';
                text.style.color = '#1890ff';
                text.style.fontWeight = '500';
            } else {
                circle.style.background = '#d9d9d9';
                text.style.color = '#999';
                text.style.fontWeight = 'normal';
            }
        }
    });
}

function backToChargeStep(step) {
    goToChargeStep(step);
    if(step === 1) {
        // 重置步骤2状态
        const step2 = document.getElementById('charge-step2-panel');
        if(step2) {
            step2.style.opacity = '0.5';
            step2.style.pointerEvents = 'none';
        }
    }
}

async function verifyWalletCharge() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const walletId = document.getElementById('sw-charge-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-charge-verify-result');
    
    if(!accountId || !walletId) {
        alert('请输入账户ID和钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">校验中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/wallet/charge/verify?account_id=${accountId}&wallet_id=${walletId}&charge_type=PREPAY`);
        const data = await res.json();
        
        if(data.code === 0) {
            // 校验通过，激活步骤2
            const step2 = document.getElementById('charge-step2-panel');
            if(step2) {
                step2.style.opacity = '1';
                step2.style.pointerEvents = 'auto';
            }
            updateChargeStepIndicator(2);
            renderChargeResult(resultDiv, data, '充值校验成功');
        } else {
            renderChargeResult(resultDiv, data, '充值校验失败');
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function generateWalletRemittanceCode() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const walletId = document.getElementById('sw-charge-wallet-id').value.trim();
    const amount = document.getElementById('sw-charge-amount').value.trim();
    const platform = document.getElementById('sw-charge-platform').value;
    const deliveryType = document.getElementById('sw-charge-delivery-type').value;
    const resultDiv = document.getElementById('sw-charge-generate-result');
    
    if(!accountId || !walletId || !amount) {
        alert('请填写完整充值信息');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">生成中...</div>';
    
    try {
        const res = await fetch('/api/account_service/wallet/prepay_charge/remittance_code', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                account_id: accountId,
                charge_target_id: parseInt(walletId),
                charge_target_type: 'WALLET',
                platform: platform,
                charge_amount: parseFloat(amount),
                delivery_type: deliveryType,
                caller: 'MAPI'
            })
        });
        const data = await res.json();
        renderChargeResult(resultDiv, data, '生成汇款码结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryWalletRemittanceList() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const walletId = document.getElementById('sw-charge-wallet-id').value.trim();
    const resultDiv = document.getElementById('sw-charge-list-result');
    
    if(!accountId || !walletId) {
        alert('请输入账户ID和钱包ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/wallet/remittance_code/list?account_id=${accountId}&charge_target_id=${walletId}&charge_target_type=WALLET`);
        const data = await res.json();
        renderChargeResult(resultDiv, data, '汇款码列表');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function renderChargeResult(container, data, title) {
    if(!container) return;
    
    if(data.code === 0) {
        let html = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 12px; border-radius: 4px; margin-bottom: 15px; color: #389e0d; font-size: 13px;">✅ ${title}</div>`;
        html += `<div style="background: #fafafa; border-radius: 8px; padding: 20px; border: 1px solid #f0f0f0;"><pre style="margin: 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #333;">${JSON.stringify(data.data || {}, null, 2)}</pre></div>`;
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div class="lp-alert lp-alert-error">${title}: ${data.message || '未知错误'} (code: ${data.code})</div>`;
    }
}
// ---------- 标签7：资金共享-转账能力 ----------

let currentWalletTransferStep = 1;

function goToWalletTransferStep(step) {
    currentWalletTransferStep = step;
    
    // 隐藏所有步骤面板
    document.getElementById('wallet-transfer-step1-panel').style.display = 'none';
    document.getElementById('wallet-transfer-step2-panel').style.display = 'none';
    document.getElementById('wallet-transfer-step3-panel').style.display = 'none';
    
    // 显示目标步骤
    const targetPanel = document.getElementById('wallet-transfer-step' + step + '-panel');
    if(targetPanel) {
        targetPanel.style.display = 'block';
        targetPanel.style.opacity = '1';
        targetPanel.style.pointerEvents = 'auto';
    }
    
    // 更新步骤指示器
    updateWalletTransferStepIndicator(step);
}

function updateWalletTransferStepIndicator(step) {
    const steps = [1, 2, 3];
    steps.forEach(s => {
        const indicator = document.getElementById('transfer-step' + s + '-indicator');
        if(indicator) {
            const circle = indicator.querySelector('span:first-child');
            const text = indicator.querySelector('span:last-child');
            if(s <= step) {
                circle.style.background = '#1890ff';
                text.style.color = '#1890ff';
                text.style.fontWeight = '500';
            } else {
                circle.style.background = '#d9d9d9';
                text.style.color = '#999';
                text.style.fontWeight = 'normal';
            }
        }
    });
}

function backToWalletTransferStep(step) {
    goToWalletTransferStep(step);
    if(step === 1) {
        const step2 = document.getElementById('wallet-transfer-step2-panel');
        if(step2) {
            step2.style.opacity = '0.5';
            step2.style.pointerEvents = 'none';
        }
    }
}

async function queryWalletTransferBalance() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const mainWalletId = document.getElementById('sw-transfer-main-wallet-id').value.trim();
    const subWalletList = document.getElementById('sw-transfer-sub-wallet-list').value.trim();
    const transferDirection = document.getElementById('sw-transfer-direction').value;
    const resultDiv = document.getElementById('sw-transfer-balance-result');
    
    if(!accountId || !mainWalletId || !subWalletList) {
        alert('请输入账户ID、大钱包ID和小钱包ID列表');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/wallet/transfer/can_transfer_balance?account_id=${accountId}&account_type=${accountType}&main_wallet_id=${mainWalletId}&sub_wallet_list=${encodeURIComponent(subWalletList)}&transfer_direction=${transferDirection}`);
        const data = await res.json();
        
        if(data.code === 0) {
            // 激活步骤2
            const step2 = document.getElementById('wallet-transfer-step2-panel');
            if(step2) {
                step2.style.opacity = '1';
                step2.style.pointerEvents = 'auto';
            }
            updateWalletTransferStepIndicator(2);
            renderTransferResult(resultDiv, data, '最大可转余额查询成功');
        } else {
            renderTransferResult(resultDiv, data, '最大可转余额查询失败');
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function createWalletTransfer() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const mainWalletId = document.getElementById('sw-transfer-main-wallet-id').value.trim();
    const transferDirection = document.getElementById('sw-transfer-direction').value;
    const targetWalletId = document.getElementById('sw-transfer-target-wallet-id').value.trim();
    const amount = document.getElementById('sw-transfer-amount').value.trim();
    const capitalType = document.getElementById('sw-transfer-capital-type').value;
    const platform = document.getElementById('sw-transfer-platform').value;
    const capitalSubType = document.getElementById('sw-transfer-capital-sub-type').value;
    const remark = document.getElementById('sw-transfer-remark').value.trim();
    const resultDiv = document.getElementById('sw-transfer-create-result');
    
    if(!accountId || !mainWalletId || !targetWalletId || !amount) {
        alert('请填写完整转账信息');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">发起转账中...</div>';
    
    try {
        const res = await fetch('/api/account_service/wallet/transfer/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                account_id: accountId,
                account_type: accountType,
                main_wallet_id: parseInt(mainWalletId),
                transfer_direction: transferDirection,
                remark: remark,
                target_wallet_details: [{
                    sub_wallet_id: parseInt(targetWalletId),
                    capital_type: capitalType,
                    platform: platform,
                    transfer_amount: parseInt(amount),
                    capital_sub_type: capitalSubType
                }]
            })
        });
        const data = await res.json();
        renderTransferResult(resultDiv, data, '发起转账结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryWalletTransferList() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const queryBeginTime = document.getElementById('sw-transfer-query-begin').value;
    const queryEndTime = document.getElementById('sw-transfer-query-end').value;
    const queryWalletIds = document.getElementById('sw-transfer-query-wallet-ids').value.trim();
    const resultDiv = document.getElementById('sw-transfer-list-result');
    
    if(!accountId || !queryBeginTime || !queryEndTime || !queryWalletIds) {
        alert('请输入查询开始时间、结束时间和钱包ID列表');
        return;
    }
    
    // 转换 datetime-local 格式为 yyyy-MM-dd HH:mm:ss
    const formatDateTime = (dt) => {
        if(!dt) return '';
        return dt.replace('T', ' ') + ':00';
    };
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const beginTime = formatDateTime(queryBeginTime);
        const endTime = formatDateTime(queryEndTime);
        const res = await fetch(`/api/account_service/wallet/transfer/list?account_id=${accountId}&account_type=${accountType}&query_begin_time=${encodeURIComponent(beginTime)}&query_end_time=${encodeURIComponent(endTime)}&query_wallet_id_list=${encodeURIComponent(queryWalletIds)}&page_size=20&page_num=1`);
        const data = await res.json();
        renderTransferResult(resultDiv, data, '转账列表查询结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryWalletTransferDetail() {
    const accountId = document.getElementById('sw-account-id').value.trim();
    const accountType = document.getElementById('sw-account-type').value;
    const resultDiv = document.getElementById('sw-transfer-list-result');
    
    // 尝试从结果中获取转账单号，或提示用户输入
    const serial = prompt('请输入转账单号（transfer_serial）或幂等ID（transfer_biz_request_no）：');
    if(!serial) return;
    
    if(!accountId) {
        alert('请输入账户ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        let url = `/api/account_service/wallet/transfer/detail?account_id=${accountId}&account_type=${accountType}`;
        if(serial.startsWith('TS')) {
            url += `&transfer_serial=${serial}`;
        } else {
            url += `&transfer_biz_request_no=${serial}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        renderTransferResult(resultDiv, data, '转账单详情查询结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function renderTransferResult(container, data, title) {
    if(!container) return;
    
    if(data.code === 0) {
        let html = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 12px; border-radius: 4px; margin-bottom: 15px; color: #389e0d; font-size: 13px;">✅ ${title}</div>`;
        html += `<div style="background: #fafafa; border-radius: 8px; padding: 20px; border: 1px solid #f0f0f0;"><pre style="margin: 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #333;">${JSON.stringify(data.data || {}, null, 2)}</pre></div>`;
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div class="lp-alert lp-alert-error">${title}: ${data.message || '未知错误'} (code: ${data.code})</div>`;
    }
}
// ==================== 资金和流水管理 - 结算（for品牌） ====================

let currentBrandTab = 'project';

function switchBrandSettlementTab(tab) {
    currentBrandTab = tab;
    
    const tabs = ['project', 'invoice', 'manage'];
    const btnIds = {
        'project': 'btn-brand-tab-project',
        'invoice': 'btn-brand-tab-invoice',
        'manage': 'btn-brand-tab-manage'
    };
    
    tabs.forEach(t => {
        const btn = document.getElementById(btnIds[t]);
        if(btn) {
            if(t === tab) {
                btn.style.background = '#1890ff';
                btn.style.color = 'white';
                btn.style.border = 'none';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#666';
                btn.style.border = '1px solid #d9d9d9';
            }
        }
    });
    
    tabs.forEach(t => {
        const content = document.getElementById('brand-tab-' + t);
        if(content) content.style.display = t === tab ? 'block' : 'none';
    });
}

async function queryBrandProject() {
    const agentId = document.getElementById('brand-agent-id').value.trim();
    const customerId = document.getElementById('brand-customer-id').value.trim();
    const platformList = document.getElementById('brand-platform-list').value.trim();
    const projectStatus = document.getElementById('brand-project-status').value.trim();
    const resultDiv = document.getElementById('brand-project-result');
    
    if(!agentId) {
        alert('请输入代理商ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        let url = `/api/account_service/brand/query/project?agent_id=${agentId}&count=100&cursor=-1`;
        if(customerId) url += `&customer_id=${customerId}`;
        if(platformList) url += `&platform_list=${encodeURIComponent(platformList)}`;
        if(projectStatus) url += `&project_status_list=${encodeURIComponent(projectStatus)}`;
        
        const res = await fetch(url);
        const data = await res.json();
        renderBrandResult(resultDiv, data, '项目信息查询结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryBrandStatement() {
    const agentId = document.getElementById('brand-agent-id').value.trim();
    const projectIdList = document.getElementById('brand-project-id-list').value.trim();
    const resultDiv = document.getElementById('brand-project-result');
    
    if(!agentId || !projectIdList) {
        alert('请输入代理商ID和项目ID列表');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/brand/query/statement?agent_id=${agentId}&project_id_list=${encodeURIComponent(projectIdList)}`);
        const data = await res.json();
        renderBrandResult(resultDiv, data, '项目关联结算单查询结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryBrandBookingEntityId() {
    const agentId = document.getElementById('brand-agent-id').value.trim();
    const orderIds = document.getElementById('brand-order-ids').value.trim();
    const resultDiv = document.getElementById('brand-project-result');
    
    if(!agentId || !orderIds) {
        alert('请输入代理商ID和主订单ID列表');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/brand/query/booking/business_entity_id?agent_id=${agentId}&order_ids=${encodeURIComponent(orderIds)}`);
        const data = await res.json();
        renderBrandResult(resultDiv, data, '排期业务实体ID查询结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function createBrandStatementInvoice() {
    const agentId = document.getElementById('brand-agent-id').value.trim();
    const statementSerial = document.getElementById('brand-statement-serial').value.trim();
    const invoiceType = document.getElementById('brand-invoice-type').value;
    const customerSubjectName = document.getElementById('brand-customer-subject-name').value.trim();
    const customerTaxNo = document.getElementById('brand-customer-tax-no').value.trim();
    const customerEmail = document.getElementById('brand-customer-email').value.trim();
    const customerSmsPhone = document.getElementById('brand-customer-sms-phone').value.trim();
    const customerAddress = document.getElementById('brand-customer-address').value.trim();
    const customerPhone = document.getElementById('brand-customer-phone').value.trim();
    const customerBank = document.getElementById('brand-customer-bank').value.trim();
    const customerBankAccount = document.getElementById('brand-customer-bank-account').value.trim();
    const invoiceBillListStr = document.getElementById('brand-invoice-bill-list').value.trim();
    const selectAddressPhone = document.getElementById('brand-select-address-phone').checked;
    const selectBankAccount = document.getElementById('brand-select-bank-account').checked;
    const resultDiv = document.getElementById('brand-invoice-result');
    
    if(!agentId || !statementSerial || !customerSubjectName || !customerTaxNo || !customerEmail) {
        alert('请填写必要信息（代理商ID、结算单编号、客户名称、税号、邮箱）');
        return;
    }
    
    let invoiceBillList = [];
    if(invoiceBillListStr) {
        try {
            invoiceBillList = JSON.parse(invoiceBillListStr);
        } catch(e) {
            alert('开票项目信息JSON格式错误');
            return;
        }
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">提交中...</div>';
    
    try {
        const payload = {
            agent_ids: [parseInt(agentId)],
            statement_serial: statementSerial,
            invoice_type: invoiceType,
            customer_subject_name: customerSubjectName,
            customer_tax_no: customerTaxNo,
            customer_email: customerEmail,
            invoice_bill_list: invoiceBillList.length > 0 ? invoiceBillList : [{
                invoice_bill_project_list: [{
                    invoice_project_name: '广告费',
                    apply_amount: 0
                }]
            }]
        };
        
        if(customerSmsPhone) payload.customer_sms_phone = customerSmsPhone;
        if(customerAddress) payload.customer_address = customerAddress;
        if(customerPhone) payload.customer_phone = customerPhone;
        if(customerBank) payload.customer_bank = customerBank;
        if(customerBankAccount) payload.customer_bank_account = customerBankAccount;
        if(selectAddressPhone) payload.select_address_and_phone = true;
        if(selectBankAccount) payload.select_bank_and_account = true;
        
        const res = await fetch('/api/account_service/brand/create/statement_invoice', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        renderBrandResult(resultDiv, data, '开票申请结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryBrandInvoice() {
    const agentId = document.getElementById('brand-agent-id').value.trim();
    const statementSerials = document.getElementById('brand-query-statement-serials').value.trim();
    const projectSerials = document.getElementById('brand-query-project-serials').value.trim();
    const invoiceSerials = document.getElementById('brand-query-invoice-serials').value.trim();
    const invoiceStatuses = document.getElementById('brand-query-invoice-statuses').value.trim();
    const resultDiv = document.getElementById('brand-manage-result');
    
    if(!agentId) {
        alert('请输入代理商ID');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        let url = `/api/account_service/brand/query/invoice?agent_id=${agentId}&page=1&page_size=20`;
        if(statementSerials) url += `&statement_serials=${encodeURIComponent(statementSerials)}`;
        if(projectSerials) url += `&project_serials=${encodeURIComponent(projectSerials)}`;
        if(invoiceSerials) url += `&invoice_serial_list=${encodeURIComponent(invoiceSerials)}`;
        if(invoiceStatuses) url += `&invoice_statuses=${encodeURIComponent(invoiceStatuses)}`;
        
        const res = await fetch(url);
        const data = await res.json();
        renderBrandResult(resultDiv, data, '开票单数据查询结果');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

async function queryBrandInvoiceElectronicUrl() {
    const agentId = document.getElementById('brand-agent-id').value.trim();
    const invoiceSerial = document.getElementById('brand-download-invoice-serial').value.trim();
    const resultDiv = document.getElementById('brand-manage-result');
    
    if(!agentId || !invoiceSerial) {
        alert('请输入代理商ID和开票单编号');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div class="lp-loading">查询中...</div>';
    
    try {
        const res = await fetch(`/api/account_service/brand/query/invoice_electronic_url?agent_ids=${agentId}&invoice_serial=${invoiceSerial}`);
        const data = await res.json();
        renderBrandResult(resultDiv, data, '电子发票下载链接');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div class="lp-alert lp-alert-error">请求异常: ${e.message}</div>`;
    }
}

function renderBrandResult(container, data, title) {
    if(!container) return;
    
    if(data.code === 0) {
        let html = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 12px; border-radius: 4px; margin-bottom: 15px; color: #389e0d; font-size: 13px;">✅ ${title}</div>`;
        html += `<div style="background: #fafafa; border-radius: 8px; padding: 20px; border: 1px solid #f0f0f0;"><pre style="margin: 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #333;">${JSON.stringify(data.data || {}, null, 2)}</pre></div>`;
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div class="lp-alert lp-alert-error">${title}: ${data.message || '未知错误'} (code: ${data.code})</div>`;
    }
}// ==================== 本地推项目管理 ====================

let ldCurrentTab = 'list';
let ldCurrentPage = 1;
let ldPageSize = 20;
let ldTotalPage = 1;
let ldSelectedProjectIds = [];
let ldScheduleMode = 'table';

// 标签页切换
function switchLocalDeliveryProjectTab(tab) {
    ldCurrentTab = tab;
    const tabs = ['list', 'create', 'update', 'aux'];
    const btnIds = {
        'list': 'btn-ld-tab-list',
        'create': 'btn-ld-tab-create',
        'update': 'btn-ld-tab-update',
        'aux': 'btn-ld-tab-aux'
    };
    
    tabs.forEach(t => {
        const btn = document.getElementById(btnIds[t]);
        const content = document.getElementById('ld-tab-' + t);
        if(btn) {
            if(t === tab) {
                btn.style.background = '#1890ff';
                btn.style.color = 'white';
                btn.style.border = 'none';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#666';
                btn.style.border = '1px solid #d9d9d9';
            }
        }
        if(content) content.style.display = t === tab ? 'block' : 'none';
    });
    
    if(tab === 'create') {
        setTimeout(initScheduleTable, 100);
    }
}

// 高级面板折叠
function toggleAdvancedPanel(panelId, arrowId) {
    const panel = document.getElementById(panelId);
    const arrow = document.getElementById(arrowId);
    if(!panel || !arrow) return;
    if(panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        arrow.textContent = '▲';
    } else {
        panel.style.display = 'none';
        arrow.textContent = '▼';
    }
}

// ==================== 创建项目 - 条件联动 ====================

function onCreateSceneChange() {
    const marketingGoal = document.getElementById('ld-create-marketing-goal').value;
    const localDeliveryScene = document.getElementById('ld-create-local-delivery-scene').value;
    
    // 投放内容：仅 VIDEO_IMAGE 时显示
    const deliveryGoalGroup = document.getElementById('ld-create-delivery-goal-group');
    if(deliveryGoalGroup) {
        deliveryGoalGroup.style.display = marketingGoal === 'VIDEO_IMAGE' ? 'block' : 'none';
    }
    
    // 抖音号：仅 LIVE + (CONTENT_HEAT/PRODUCT_PAY) 时显示
    const awemeGroup = document.getElementById('ld-create-aweme-id-group');
    if(awemeGroup) {
        const showAweme = marketingGoal === 'LIVE' && (localDeliveryScene === 'CONTENT_HEAT' || localDeliveryScene === 'PRODUCT_PAY');
        awemeGroup.style.display = showAweme ? 'block' : 'none';
    }
    
    // 门店模式：VIDEO_IMAGE + POI 时显示
    const poiModeGroup = document.getElementById('ld-create-delivery-poi-mode-group');
    if(poiModeGroup) {
        const deliveryGoal = document.getElementById('ld-create-delivery-goal').value;
        poiModeGroup.style.display = (marketingGoal === 'VIDEO_IMAGE' && deliveryGoal === 'POI') ? 'block' : 'none';
    }
    onPoiModeChange();
    
    // 优化目标
    const externalActionGroup = document.getElementById('ld-create-external-action-group');
    const externalActionSelect = document.getElementById('ld-create-external-action');
    if(externalActionGroup && externalActionSelect) {
        let showExternal = false;
        let options = '<option value="">请选择</option>';
        
        if(marketingGoal === 'VIDEO_IMAGE') {
            if(localDeliveryScene === 'CONTENT_HEAT') {
                showExternal = true;
                options += '<option value="NATIVE_ACTION">用户互动 (NATIVE_ACTION)</option>';
                options += '<option value="FOLLOW_ACTION">粉丝增长 (FOLLOW_ACTION)</option>';
                options += '<option value="SHOW">展示量 (SHOW)</option>';
                options += '<option value="POI_RECOMMEND">门店浏览 (POI_RECOMMEND)</option>';
            } else if(localDeliveryScene === 'EXTERNAL') {
                showExternal = true;
                options += '<option value="CLUE_ACQUISITION">获取线索 (CLUE_ACQUISITION)</option>';
                options += '<option value="CLUE_CONFIRM">确认意向 (CLUE_CONFIRM)</option>';
                options += '<option value="CLUE_HIGH_INTENTION">预付定金 (CLUE_HIGH_INTENTION)</option>';
            }
        } else if(marketingGoal === 'LIVE') {
            if(localDeliveryScene === 'PRODUCT_PAY') {
                showExternal = true;
                options += '<option value="LIVE_OTO_GROUP_BUYING">直播间团购购买 (LIVE_OTO_GROUP_BUYING)</option>';
                options += '<option value="LIVE_OTO_CLICK">商品点击 (LIVE_OTO_CLICK)</option>';
            } else if(localDeliveryScene === 'CONTENT_HEAT') {
                showExternal = true;
                options += '<option value="LIVE_ENGAGEMENT">直播加热 (LIVE_ENGAGEMENT)</option>';
                options += '<option value="FOLLOW_ACTION">粉丝增长 (FOLLOW_ACTION)</option>';
                options += '<option value="SHOW">展示量 (SHOW)</option>';
            } else if(localDeliveryScene === 'EXTERNAL') {
                showExternal = true;
                options += '<option value="CLUE_ACQUISITION">获取线索 (CLUE_ACQUISITION)</option>';
                options += '<option value="CLUE_CONFIRM">确认意向 (CLUE_CONFIRM)</option>';
                options += '<option value="CLUE_HIGH_INTENTION">预付定金 (CLUE_HIGH_INTENTION)</option>';
                options += '<option value="PRIVATE_MESSAGE">私信消息 (PRIVATE_MESSAGE)</option>';
            }
        }
        
        externalActionGroup.style.display = showExternal ? 'block' : 'none';
        externalActionSelect.innerHTML = options;
    }
    
    // 线索配置面板
    const leadsConfigGroup = document.getElementById('ld-create-leads-config-group');
    if(leadsConfigGroup) {
        leadsConfigGroup.style.display = localDeliveryScene === 'EXTERNAL' ? 'block' : 'none';
    }
    
    // 行为兴趣面板（仅线索）
    const interestActionGroup = document.getElementById('ld-create-interest-action-group');
    if(interestActionGroup) {
        interestActionGroup.style.display = localDeliveryScene === 'EXTERNAL' ? 'block' : 'none';
    }
    
    // 高峰日预算（仅 VIDEO_IMAGE + 团购/到店）
    const peakBudgetGroup = document.getElementById('ld-create-is-set-peak-budget-group');
    if(peakBudgetGroup) {
        const showPeak = marketingGoal === 'VIDEO_IMAGE' && (localDeliveryScene === 'PRODUCT_PAY' || localDeliveryScene === 'POI_RECOMMEND');
        peakBudgetGroup.style.display = showPeak ? 'block' : 'none';
    }
    
    // 单元类型限制
    const adTypeSelect = document.getElementById('ld-create-ad-type');
    if(adTypeSelect) {
        if(marketingGoal === 'VIDEO_IMAGE' && localDeliveryScene === 'CONTENT_HEAT') {
            // 移除 SEARCHING
            adTypeSelect.innerHTML = '<option value="GENERAL">通投 (GENERAL)</option>';
        } else if(localDeliveryScene === 'EXTERNAL') {
            adTypeSelect.innerHTML = '<option value="GENERAL">通投 (GENERAL)</option>';
        } else {
            adTypeSelect.innerHTML = '<option value="GENERAL">通投 (GENERAL)</option><option value="SEARCHING">搜索 (SEARCHING)</option>';
        }
    }
    
    // 投放时段类型限制
    const scheduleTypeSelect = document.getElementById('ld-create-schedule-type');
    if(scheduleTypeSelect) {
        let options = '';
        options += '<option value="FROM_NOW_ON">从今天起长期投放</option>';
        options += '<option value="START_TO_END">设置开始结束时间</option>';
        options += '<option value="FIXED_TIME">固定时长</option>';
        if(localDeliveryScene === 'EXTERNAL' && marketingGoal === 'VIDEO_IMAGE') {
            options += '<option value="DELIVERY_7DAY">7天稳投</option>';
        }
        if(localDeliveryScene === 'EXTERNAL' && marketingGoal === 'LIVE') {
            options += '<option value="DAILY_DELIVERY_DURATION">每日投放时长</option>';
        }
        scheduleTypeSelect.innerHTML = options;
    }
}

function onDeliveryGoalChange() {
    const deliveryGoal = document.getElementById('ld-create-delivery-goal').value;
    const marketingGoal = document.getElementById('ld-create-marketing-goal').value;
    
    // 门店模式
    const poiModeGroup = document.getElementById('ld-create-delivery-poi-mode-group');
    if(poiModeGroup) {
        poiModeGroup.style.display = (marketingGoal === 'VIDEO_IMAGE' && deliveryGoal === 'POI') ? 'block' : 'none';
    }
    
    // 商品ID
    const productIdGroup = document.getElementById('ld-create-product-id-group');
    if(productIdGroup) {
        productIdGroup.style.display = (marketingGoal === 'VIDEO_IMAGE' && deliveryGoal === 'PRODUCT') ? 'block' : 'none';
    }
    
    onPoiModeChange();
}

function onPoiModeChange() {
    const poiMode = document.getElementById('ld-create-delivery-poi-mode')?.value || 'ALL';
    const marketingGoal = document.getElementById('ld-create-marketing-goal').value;
    const deliveryGoal = document.getElementById('ld-create-delivery-goal').value;
    
    const poiIdsGroup = document.getElementById('ld-create-promotion-poi-ids-group');
    const autoUpdateGroup = document.getElementById('ld-create-auto-update-pois-group');
    
    if(poiIdsGroup) {
        const showPoiIds = marketingGoal === 'VIDEO_IMAGE' && deliveryGoal === 'POI' && poiMode === 'PART';
        poiIdsGroup.style.display = showPoiIds ? 'block' : 'none';
    }
    if(autoUpdateGroup) {
        const showAuto = marketingGoal === 'VIDEO_IMAGE' && deliveryGoal === 'POI' && poiMode === 'ALL';
        autoUpdateGroup.style.display = showAuto ? 'block' : 'none';
    }
}

function onBidTypeChange() {
    const bidType = document.getElementById('ld-create-bid-type').value;
    const bidGroup = document.getElementById('ld-create-bid-group');
    const bidInput = document.getElementById('ld-create-bid');
    if(bidGroup) {
        const showBid = (bidType === 'MANUAL' || bidType === 'STABILIZE_COSTS');
        bidGroup.style.display = showBid ? 'block' : 'none';
        // 隐藏时清空出价，防止残留值被提交
        if(!showBid && bidInput) {
            bidInput.value = '';
        }
    }
}

function onPeakBudgetChange() {
    const isSet = document.getElementById('ld-create-is-set-peak-budget').value === 'true';
    document.getElementById('ld-create-peak-week-days-group').style.display = isSet ? 'block' : 'none';
    document.getElementById('ld-create-peak-holidays-group').style.display = isSet ? 'block' : 'none';
    document.getElementById('ld-create-high-budget-rate-group').style.display = isSet ? 'block' : 'none';
}

function onScheduleTypeChange() {
    const type = document.getElementById('ld-create-schedule-type').value;
    document.getElementById('ld-create-start-time-group').style.display = (type === 'START_TO_END' || type === 'DELIVERY_7DAY') ? 'block' : 'none';
    document.getElementById('ld-create-end-time-group').style.display = (type === 'START_TO_END') ? 'block' : 'none';
    document.getElementById('ld-create-schedule-fixed-seconds-group').style.display = (type === 'FIXED_TIME') ? 'block' : 'none';
    document.getElementById('ld-create-daily-delivery-seconds-group').style.display = (type === 'DAILY_DELIVERY_DURATION') ? 'block' : 'none';
    document.getElementById('ld-create-schedule-time-group').style.display = (type !== 'FIXED_TIME') ? 'block' : 'none';
}

function onDistrictChange() {
    const district = document.getElementById('ld-create-district').value;
    document.getElementById('ld-create-region-group').style.display = district === 'REGION' ? 'block' : 'none';
    document.getElementById('ld-create-poi-around-group').style.display = district === 'POI' ? 'block' : 'none';
}

function onInterestActionChange() {
    const mode = document.getElementById('ld-create-customized-interest-action').value;
    document.getElementById('ld-create-interest-custom-group').style.display = mode === 'INTERESTACTION_CUSTOM' ? 'block' : 'none';
}

function onIntelligentModeChange() {
    const mode = document.getElementById('ld-create-intelligent-selection-mode').value;
    const assetGroup = document.getElementById('ld-create-local-asset-type-group');
    if(assetGroup) {
        assetGroup.style.display = mode === 'INTELLIGENT_SELECTION_MODE_OFF' ? 'block' : 'none';
    }
}

// ==================== 48×7 时段表格 ====================
// ==================== 24×7 投放时段表格（兼容336位API） ====================

// ==================== 24×7 投放时段表格（兼容336位API） ====================

let scheduleMode = 'unlimited'; // 'unlimited' | 'custom'

function initScheduleTable() {
    const tbody = document.getElementById('ld-schedule-table-body');
    if(!tbody) return;
    
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    let html = '';
    
    days.forEach((day, dayIndex) => {
        html += `<tr>`;
        html += `<td style="padding: 4px; border: 1px solid #d9d9d9; background: #fafafa; font-weight: 600; text-align: center;">${day}</td>`;
        for(let h = 0; h < 24; h++) {
            html += `<td style="padding: 2px; border: 1px solid #d9d9d9; text-align: center;">
                <div class="schedule-hour-cell off" data-day="${dayIndex}" data-hour="${h}"></div>
            </td>`;
        }
        html += `</tr>`;
    });
    
    tbody.innerHTML = html;
    
    // 绑定拖拽事件（关键）
    bindDragEvents();
    
    updateScheduleTextFromTable();
    updateSelectedTimeDisplay();
}

function switchScheduleMode(mode) {
    const btnUnlimited = document.getElementById('btn-schedule-unlimited');
    const btnCustom = document.getElementById('btn-schedule-custom');
    const panel = document.getElementById('schedule-custom-panel');
    const hidden = document.getElementById('ld-create-schedule-time-text');
    
    if(!btnUnlimited || !btnCustom || !panel) return;
    
    scheduleMode = mode;
    
    if(mode === 'unlimited') {
        btnUnlimited.style.background = '#1890ff';
        btnUnlimited.style.color = 'white';
        btnCustom.style.background = 'transparent';
        btnCustom.style.color = '#666';
        panel.style.display = 'none';
        if(hidden) hidden.value = '1'.repeat(336);
    } else {
        btnCustom.style.background = '#1890ff';
        btnCustom.style.color = 'white';
        btnUnlimited.style.background = 'transparent';
        btnUnlimited.style.color = '#666';
        panel.style.display = 'block';
        updateScheduleTextFromTable();
    }
    updateSelectedTimeDisplay();
}

// 绑定拖拽事件
function bindDragEvents() {
    const table = document.getElementById('ld-schedule-table');
    if(!table) return;
    
    let isDragging = false;
    let dragStartState = null;
    
    table.addEventListener('mousedown', function(e) {
        const cell = e.target.closest('.schedule-hour-cell');
        if(!cell) return;
        e.preventDefault();
        isDragging = true;
        dragStartState = !cell.classList.contains('on');
        cell.className = dragStartState ? 'schedule-hour-cell on' : 'schedule-hour-cell off';
        updateScheduleTextFromTable();
        updateSelectedTimeDisplay();
    });
    
    table.addEventListener('mouseover', function(e) {
        if(!isDragging) return;
        const cell = e.target.closest('.schedule-hour-cell');
        if(!cell) return;
        cell.className = dragStartState ? 'schedule-hour-cell on' : 'schedule-hour-cell off';
    });
    
    document.addEventListener('mouseup', function() {
        if(isDragging) {
            isDragging = false;
            updateScheduleTextFromTable();
            updateSelectedTimeDisplay();
        }
    });
}

// 保留点击兼容（单独点击也生效，通过 mousedown 已支持）
function toggleScheduleCell(cell) {
    cell.classList.toggle('on');
    cell.classList.toggle('off');
    updateScheduleTextFromTable();
    updateSelectedTimeDisplay();
}

function setAllSchedule(val) {
    document.querySelectorAll('.schedule-hour-cell').forEach(cell => {
        cell.className = val ? 'schedule-hour-cell on' : 'schedule-hour-cell off';
    });
    updateScheduleTextFromTable();
    updateSelectedTimeDisplay();
}

function copyScheduleToAllDays() {
    const mondayCells = document.querySelectorAll('.schedule-hour-cell[data-day="0"]');
    const states = Array.from(mondayCells).map(cell => cell.classList.contains('on'));
    
    for(let day = 1; day < 7; day++) {
        const cells = document.querySelectorAll(`.schedule-hour-cell[data-day="${day}"]`);
        cells.forEach((cell, idx) => {
            cell.className = states[idx] ? 'schedule-hour-cell on' : 'schedule-hour-cell off';
        });
    }
    updateScheduleTextFromTable();
    updateSelectedTimeDisplay();
}

// 快捷选择：凌晨不投放 00:00-06:00（6-23点默认投放）
function selectEarlyMorning() {
    document.querySelectorAll('.schedule-hour-cell').forEach(cell => {
        const h = parseInt(cell.dataset.hour);
        cell.className = (h >= 0 && h < 6) ? 'schedule-hour-cell off' : 'schedule-hour-cell on';
    });
    updateScheduleTextFromTable();
    updateSelectedTimeDisplay();
}

// 快捷选择：下班时间不投放 18:00-次日09:00（9-17点默认投放）
function selectOffHours() {
    document.querySelectorAll('.schedule-hour-cell').forEach(cell => {
        const h = parseInt(cell.dataset.hour);
        cell.className = (h >= 18 || h < 9) ? 'schedule-hour-cell off' : 'schedule-hour-cell on';
    });
    updateScheduleTextFromTable();
    updateSelectedTimeDisplay();
}

function updateScheduleTextFromTable() {
    if(scheduleMode === 'unlimited') {
        const hidden = document.getElementById('ld-create-schedule-time-text');
        if(hidden) hidden.value = '1'.repeat(336);
        return;
    }
    
    let result = '';
    for(let day = 0; day < 7; day++) {
        for(let h = 0; h < 24; h++) {
            const cell = document.querySelector(`.schedule-hour-cell[data-day="${day}"][data-hour="${h}"]`);
            const isOn = cell && cell.classList.contains('on');
            result += isOn ? '11' : '00';
        }
    }
    const hidden = document.getElementById('ld-create-schedule-time-text');
    if(hidden) hidden.value = result;
}

function updateSelectedTimeDisplay() {
    const container = document.getElementById('schedule-selected-list');
    if(!container) return;
    
    if(scheduleMode === 'unlimited') {
        container.innerHTML = '<div style="color:#999; font-size:13px;">全时段投放</div>';
        return;
    }
    
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    let html = '';
    let hasAny = false;
    
    for(let day = 0; day < 7; day++) {
        const slots = [];
        let start = null;
        
        for(let h = 0; h <= 24; h++) {
            const cell = document.querySelector(`.schedule-hour-cell[data-day="${day}"][data-hour="${h}"]`);
            const isOn = h < 24 && cell && cell.classList.contains('on');
            
            if(isOn && start === null) {
                start = h;
            } else if((!isOn || h === 24) && start !== null) {
                const fmt = (n) => String(n).padStart(2, '0') + ':00';
                slots.push(`${fmt(start)}-${fmt(h)}`);
                start = null;
            }
        }
        
        if(slots.length > 0) {
            hasAny = true;
            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:13px;">
                <span><span style="color:#666; margin-right:8px;">${days[day]}</span><span style="color:#333;">${slots.join('、')}</span></span>
            </div>`;
        }
    }
    
    if(!hasAny) {
        container.innerHTML = '<div style="color:#999; font-size:13px;">未选择投放时段</div>';
    } else {
        container.innerHTML = html;
    }
}

function clearSelectedTime() {
    setAllSchedule(0);
}

// 监听隐藏域变化（用于调试）
document.addEventListener('input', function(e) {
    if(e.target.id === 'ld-create-schedule-time-text') {
        const hint = document.getElementById('ld-schedule-text-hint');
        if(hint) {
            const len = e.target.value.length;
            hint.textContent = `长度: ${len} / 336`;
            hint.style.color = len === 336 ? '#52c41a' : (len > 336 ? '#f5222d' : '#999');
        }
    }
});

// ==================== 创建项目 ====================

function resetCreateForm() {
    document.getElementById('ld-create-local-account-id').value = '';
    document.getElementById('ld-create-name').value = '';
    document.getElementById('ld-create-marketing-goal').value = '';
    document.getElementById('ld-create-local-delivery-scene').value = '';
    document.getElementById('ld-create-ad-type').value = 'GENERAL';
    document.getElementById('ld-create-delivery-goal').value = 'POI';
    document.getElementById('ld-create-delivery-poi-mode').value = 'ALL';
    document.getElementById('ld-create-promotion-poi-ids').value = '';
    document.getElementById('ld-create-auto-update-pois').value = 'ON';
    document.getElementById('ld-create-product-id').value = '';
    document.getElementById('ld-create-aweme-id').value = '';
    document.getElementById('ld-create-external-action').value = '';
    document.getElementById('ld-create-bid-type').value = 'MANUAL';
    document.getElementById('ld-create-bid').value = '';
    document.getElementById('ld-create-budget-mode').value = 'BUDGET_MODE_DAY';
    document.getElementById('ld-create-budget').value = '';
    document.getElementById('ld-create-is-set-peak-budget').value = 'false';
    document.getElementById('ld-create-high-budget-rate').value = '';
    document.getElementById('ld-create-schedule-type').value = 'FROM_NOW_ON';
    document.getElementById('ld-create-start-time').value = '';
    document.getElementById('ld-create-end-time').value = '';
    document.getElementById('ld-create-schedule-fixed-seconds').value = '';
    document.getElementById('ld-create-daily-delivery-seconds').value = '';
    document.getElementById('ld-create-district').value = 'ALL';
    document.getElementById('ld-create-region-city').value = '';
    document.getElementById('ld-create-city-divide').value = 'BY_LOCATION';
    document.getElementById('ld-create-location-type').value = 'CURRENT';
    document.getElementById('ld-create-region-ver').value = '2.3.2';
    document.getElementById('ld-create-poi-around-ids').value = '';
    document.getElementById('ld-create-poi-around-radius').value = 'KM_10';
    document.getElementById('ld-create-gender').value = 'NONE';
    document.getElementById('ld-create-retargeting-tags').value = '';
    document.getElementById('ld-create-retargeting-tags-exclude').value = '';
    document.getElementById('ld-create-hide-if-converted').value = 'NO_EXCLUDE';
    document.getElementById('ld-create-customized-interest-action').value = 'INTERESTACTION_OFF';
    document.getElementById('ld-create-interest-categories').value = '';
    document.getElementById('ld-create-interest-words').value = '';
    document.getElementById('ld-create-action-categories').value = '';
    document.getElementById('ld-create-action-words').value = '';
    document.getElementById('ld-create-action-days').value = 'ACTIONDAYS_DAY30';
    document.getElementById('ld-create-intelligent-selection-mode').value = 'INTELLIGENT_SELECTION_MODE_OFF';
    document.getElementById('ld-create-local-asset-type').value = 'LOCAL_ASSET_TYPE_AWEME_PAGE';
    document.getElementById('ld-create-tool-pack-id').value = '';
    document.getElementById('ld-create-market-page-ids').value = '';
    document.getElementById('ld-create-consult-aweme-uid').value = '';
    document.getElementById('ld-create-delivery-package').value = 'DELIVERY_PACKAGE_NORMAL';
    document.getElementById('ld-create-aigc-dynamic-creative-switch').value = 'AIGC_DYNAMIC_CREATIVE_SWITCH_OFF';
    document.getElementById('ld-create-schedule-time-text').value = '';
    
    // 重置复选框
    document.querySelectorAll('#ld-create-peak-week-days-group input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#ld-create-peak-holidays-group input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#ld-audience-panel input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('.schedule-hour-cell').forEach(cell => cell.className = 'schedule-hour-cell off');
if(typeof switchScheduleMode === 'function') switchScheduleMode('unlimited');
    
    onCreateSceneChange();
    onPeakBudgetChange();
    onScheduleTypeChange();
    onDistrictChange();
    onInterestActionChange();
    document.getElementById('ld-create-result').innerHTML = '';
}

async function createLocalProject() {
        // 步骤6校验：单元名称必填
    const promotionName = document.getElementById('ld-create-promotion-name').value.trim();
    if(!promotionName) {
        alert('请输入单元名称');
        return;
    }
    const localAccountId = document.getElementById('ld-create-local-account-id').value.trim();
    const name = document.getElementById('ld-create-name').value.trim();
    const marketingGoal = document.getElementById('ld-create-marketing-goal').value;
    const localDeliveryScene = document.getElementById('ld-create-local-delivery-scene').value;
    const adType = document.getElementById('ld-create-ad-type').value;
    
    if(!localAccountId || !name || !marketingGoal || !localDeliveryScene || !adType) {
        alert('请填写核心必填信息（本地推账户ID、项目名称、营销场景、营销目的、单元类型）');
        return;
    }
    
    const payload = {
        local_account_id: parseInt(localAccountId),
        name: name,
        marketing_goal: marketingGoal,
        local_delivery_scene: localDeliveryScene,
        ad_type: adType
    };
    
    // 投放内容（VIDEO_IMAGE时必填）
    if(marketingGoal === 'VIDEO_IMAGE') {
        const deliveryGoal = document.getElementById('ld-create-delivery-goal').value;
        payload.delivery_goal = deliveryGoal;
        
        if(deliveryGoal === 'POI') {
            const poiMode = document.getElementById('ld-create-delivery-poi-mode').value;
            payload.delivery_poi_mode = poiMode;
            if(poiMode === 'PART') {
                const poiIds = document.getElementById('ld-create-promotion-poi-ids').value.trim();
                if(!poiIds) { alert('请输入门店ID列表'); return; }
                payload.promotion_poi_ids = poiIds.split(',').map(x => parseInt(x.trim()));
            } else {
                payload.auto_update_pois = document.getElementById('ld-create-auto-update-pois').value;
            }
        } else if(deliveryGoal === 'PRODUCT') {
            const productId = document.getElementById('ld-create-product-id').value.trim();
            if(!productId) { alert('请输入商品ID'); return; }
            payload.product_id = parseInt(productId);
        }
    }
    
    // 抖音号（LIVE时）
    if(marketingGoal === 'LIVE' && (localDeliveryScene === 'CONTENT_HEAT' || localDeliveryScene === 'PRODUCT_PAY')) {
        const awemeId = document.getElementById('ld-create-aweme-id').value.trim();
        if(!awemeId) { alert('请输入抖音号ID'); return; }
        payload.aweme_id = awemeId;
    }
    
   
    // 优化目标（部分场景不支持，需判断）
    const goal = document.getElementById('ld-create-marketing-goal').value;
    const scene = document.getElementById('ld-create-local-delivery-scene').value;
    const externalAction = document.getElementById('ld-create-external-action').value;
    
    // VIDEO_IMAGE + PRODUCT_PAY/POI_RECOMMEND 不支持优化目标
    const skipExternalAction = (goal === 'VIDEO_IMAGE' && (scene === 'PRODUCT_PAY' || scene === 'POI_RECOMMEND'));
    if(externalAction && !skipExternalAction) {
        payload.external_action = externalAction;
    }
    
    // 定向设置
    const district = document.getElementById('ld-create-district').value;
    const audience = { district: district };
    
    if(district === 'REGION') {
        const cityStr = document.getElementById('ld-create-region-city').value.trim();
        if(cityStr) {
            audience.region = {
                city: cityStr.split(',').map(x => parseInt(x.trim())),
                city_divide: document.getElementById('ld-create-city-divide').value,
                location_type: document.getElementById('ld-create-location-type').value,
                region_ver: document.getElementById('ld-create-region-ver').value
            };
        }
    } else if(district === 'POI') {
        const poiAroundIds = document.getElementById('ld-create-poi-around-ids').value.trim();
        audience.poi_around = {
            poi_around_radius: document.getElementById('ld-create-poi-around-radius').value
        };
        if(poiAroundIds) {
            audience.poi_around.poi_around_ids = poiAroundIds.split(',').map(x => parseInt(x.trim()));
        }
    }
    
    // 年龄
      // 年龄（兼容新UI）
    let ageValues = [];
    document.querySelectorAll('#ld-audience-panel input[type="checkbox"]:checked').forEach(cb => {
        if(cb.value !== 'all') ageValues.push(cb.value);
    });
    document.querySelectorAll('#age-detail input:checked').forEach(cb => {
        if(!ageValues.includes(cb.value)) ageValues.push(cb.value);
    });
    if(ageValues.length > 0) {
        audience.age = ageValues;
    }
    
    // 性别
    const gender = document.getElementById('ld-create-gender').value;
    if(gender && gender !== 'NONE') {
        audience.gender = gender;
    }
    
    // 人群包
    const retargetingTags = document.getElementById('ld-create-retargeting-tags').value.trim();
    if(retargetingTags) {
        audience.retargeting_tags = retargetingTags.split(',').map(x => parseInt(x.trim()));
    }
    const retargetingExclude = document.getElementById('ld-create-retargeting-tags-exclude').value.trim();
    if(retargetingExclude) {
        audience.retargeting_tags_exclude = retargetingExclude.split(',').map(x => parseInt(x.trim()));
    }
    
    // 过滤已转化
    const hideIfConverted = document.getElementById('ld-create-hide-if-converted').value;
    if(hideIfConverted && hideIfConverted !== 'NO_EXCLUDE') {
        audience.hide_if_converted = hideIfConverted;
    }
    
    // 行为兴趣（仅线索场景）
    if(localDeliveryScene === 'EXTERNAL') {
        const interestAction = document.getElementById('ld-create-customized-interest-action').value;
        audience.customized_interest_action = interestAction;
        
        if(interestAction === 'INTERESTACTION_CUSTOM') {
            const interestCategories = document.getElementById('ld-create-interest-categories').value.trim();
            const interestWords = document.getElementById('ld-create-interest-words').value.trim();
            const actionCategories = document.getElementById('ld-create-action-categories').value.trim();
            const actionWords = document.getElementById('ld-create-action-words').value.trim();
            
            if(interestCategories || interestWords) {
                audience.interest_config = {};
                if(interestCategories) audience.interest_config.interest_categories = interestCategories.split(',').map(x => parseInt(x.trim()));
                if(interestWords) audience.interest_config.interest_words = interestWords.split(',').map(x => parseInt(x.trim()));
            }
            if(actionCategories || actionWords) {
                audience.action_config = {};
                if(actionCategories) audience.action_config.action_categories = actionCategories.split(',').map(x => parseInt(x.trim()));
                if(actionWords) audience.action_config.action_words = actionWords.split(',').map(x => parseInt(x.trim()));
                audience.action_config.action_days = document.getElementById('ld-create-action-days').value;
            }
        }
    }
    
    payload.audience = audience;
    
    // 投放时段
    const scheduleType = document.getElementById('ld-create-schedule-type').value;
    payload.schedule_type = scheduleType;
    
    if(scheduleType === 'START_TO_END' || scheduleType === 'DELIVERY_7DAY') {
        const startTime = document.getElementById('ld-create-start-time').value;
        if(!startTime) { alert('请输入开始时间'); return; }
        payload.start_time = startTime;
    }
    if(scheduleType === 'START_TO_END') {
        const endTime = document.getElementById('ld-create-end-time').value;
        if(!endTime) { alert('请输入结束时间'); return; }
        payload.end_time = endTime;
    }
    if(scheduleType === 'FIXED_TIME') {
        const fixedSeconds = document.getElementById('ld-create-schedule-fixed-seconds').value.trim();
        if(!fixedSeconds) { alert('请输入固定投放时长'); return; }
        payload.schedule_fixed_seconds = parseInt(fixedSeconds);
    }
    if(scheduleType === 'DAILY_DELIVERY_DURATION') {
        const dailySeconds = document.getElementById('ld-create-daily-delivery-seconds').value.trim();
        if(!dailySeconds) { alert('请输入每日投放时长'); return; }
        payload.daily_delivery_seconds = parseInt(dailySeconds);
    }
       if(scheduleType !== 'FIXED_TIME') {
        let scheduleTime = document.getElementById('ld-create-schedule-time-text').value.trim();
        // 全0或全1视为全时段，不传
        if(scheduleTime && scheduleTime !== '0'.repeat(336) && scheduleTime !== '1'.repeat(336)) {
            if(!validateScheduleString(scheduleTime)) {
                alert('投放时段字符串格式错误，必须是336位0/1字符串');
                return;
            }
            payload.schedule_time = scheduleTime;
        }
    }
    
    // 预算出价
     const bidType = document.getElementById('ld-create-bid-type').value;
    payload.bid_type = bidType;
    const bid = document.getElementById('ld-create-bid').value.trim();
    // bid 仅在 MANUAL 和 STABILIZE_COSTS 时有效，SMART/MAX_CONVERSION 不可传
    if(bid && (bidType === 'MANUAL' || bidType === 'STABILIZE_COSTS')) {
             payload.bid = parseInt(bid) * 100;
    }
    payload.budget_mode = document.getElementById('ld-create-budget-mode').value;
    const budget = document.getElementById('ld-create-budget').value.trim();
    if(!budget) { alert('请输入项目预算'); return; }
        payload.budget = parseInt(budget) * 100;
    
    // 高峰日预算
    const isSetPeak = document.getElementById('ld-create-is-set-peak-budget').value === 'true';
    if(isSetPeak) {
        payload.is_set_peak_budget = true;
        const weekDays = Array.from(document.querySelectorAll('#ld-create-peak-week-days-group input:checked')).map(cb => cb.value);
        const holidays = Array.from(document.querySelectorAll('#ld-create-peak-holidays-group input:checked')).map(cb => cb.value);
        if(weekDays.length === 0 && holidays.length === 0) {
            alert('请至少选择一个高峰日（自然周或节假日）');
            return;
        }
        if(weekDays.length > 0) payload.peak_week_days = weekDays;
        if(holidays.length > 0) payload.peak_holidays = holidays;
        const rate = document.getElementById('ld-create-high-budget-rate').value.trim();
        if(!rate) { alert('请输入高峰日预算上调比例'); return; }
        payload.high_budget_rate = parseInt(rate);
    } else {
        payload.is_set_peak_budget = false;
    }
    
    // 线索配置（仅线索场景）
    if(localDeliveryScene === 'EXTERNAL' && marketingGoal === 'VIDEO_IMAGE') {
        payload.intelligent_selection_mode = document.getElementById('ld-create-intelligent-selection-mode').value;
        const assetType = document.getElementById('ld-create-local-asset-type').value;
        if(payload.intelligent_selection_mode === 'INTELLIGENT_SELECTION_MODE_OFF') {
            payload.local_asset_type = assetType;
        }
        const toolPackId = document.getElementById('ld-create-tool-pack-id').value.trim();
        if(toolPackId) payload.tool_pack_id = parseInt(toolPackId);
        const marketPageIds = document.getElementById('ld-create-market-page-ids').value.trim();
        if(marketPageIds) payload.market_page_ids = marketPageIds.split(',').map(x => parseInt(x.trim()));
        const consultAweme = document.getElementById('ld-create-consult-aweme-uid').value.trim();
        if(consultAweme) payload.consult_aweme_uid = consultAweme;
        payload.delivery_package = document.getElementById('ld-create-delivery-package').value;
        payload.aigc_dynamic_creative_switch = document.getElementById('ld-create-aigc-dynamic-creative-switch').value;
    }
    
    // 提交
    const resultDiv = document.getElementById('ld-create-result');
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">创建中...</div>';
    
    try {
        const res = await fetch('/api/local_delivery/project/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
           if(data.code === 0) {
            const projectId = data.data?.project_id;
            if(projectId) {
                // 项目创建成功，继续链式创建单元
                await createLocalPromotionAfterProject(projectId, resultDiv);
            } else {
                if(resultDiv) {
                    resultDiv.innerHTML = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 4px; color: #389e0d;">
                        ✅ 项目创建成功！但未能获取项目ID，单元创建跳过。
                    </div>`;
                }
            }
        } else {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 15px; border-radius: 4px; color: #cf1322;">
                    ❌ 创建失败: ${data.message || '未知错误'} (code: ${data.code})
                </div>`;
            }
        }
    } catch(e) {
        if(resultDiv) {
            resultDiv.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 15px; border-radius: 4px; color: #cf1322;">
                请求异常: ${e.message}
            </div>`;
        }
    }
}
async function createLocalPromotionAfterProject(projectId, resultDiv) {
    const localAccountId = document.getElementById('ld-create-local-account-id').value.trim();
    const promotionName = document.getElementById('ld-create-promotion-name').value.trim();
    
    const payload = {
        local_account_id: localAccountId,
        project_id: projectId,
        name: promotionName
    };
    
    // 收集已选素材，区分抖音主页视频和素材库视频
    if(step6SelectedMaterials.length > 0) {
        // 关键修复：只有素材库视频/上传视频时才需要传 aweme_id
        // 抖音主页视频自带抖音号信息，传 aweme_id 会导致 API 误判为素材库视频
        const hasLibraryVideo = step6SelectedMaterials.some(m => m.type === 'library_video');
        if(hasLibraryVideo) {
            const modalAwemeSelect = document.getElementById('modal-aweme-select');
            const selectedAwemeId = modalAwemeSelect ? modalAwemeSelect.value : '';
            if(selectedAwemeId) {
                payload.aweme_id = selectedAwemeId;
            }
        }
        
        payload.customer_material_list = step6SelectedMaterials.map(mat => {
            if(mat.type === 'aweme_video') {
                // 抖音主页视频：用 aweme_item_id（对应API返回的item_id）
                // 不传 aweme_id，避免API误判为素材库视频
                const material = {
                    image_mode: 'IMAGE_MODE_VIDEO_VERTICAL',
                    video_material: {},
                    title_material: { title: mat.title || promotionName }
                };
                if(mat.aweme_item_id) {
                    material.video_material.aweme_item_id = mat.aweme_item_id;  // 字符串，后端转int
                }
                return material;
            } else if(mat.type === 'library_video') {
                // 素材库视频：用 video_id，必须带 title_material
                // aweme_id 已在上面统一传入
                return {
                    image_mode: 'IMAGE_MODE_VIDEO_VERTICAL',
                    video_material: {
                        video_id: mat.video_id
                    },
                    title_material: { title: mat.title || promotionName }
                };
            }
            return null;
        }).filter(Boolean);
    }
    
    if(resultDiv) {
        resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">✅ 项目创建成功，正在创建单元...</div>';
    }
    
    try {
        const res = await fetch('/api/local_delivery/promotion/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if(data.code === 0) {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 4px; color: #389e0d;">
                    ✅ 项目与单元创建成功！<br>
                    项目ID: <strong>${projectId}</strong><br>
                    单元ID: <strong>${data.data?.promotion_id || '-'}</strong>
                </div>`;
            }
        } else {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #fff7e6; border: 1px solid #ffd591; padding: 15px; border-radius: 4px; color: #d46b08;">
                    ⚠️ 项目创建成功，但单元创建失败: ${data.message || '未知错误'} (code: ${data.code})<br>
                    项目ID: <strong>${projectId}</strong>
                </div>`;
            }
        }
    } catch(e) {
        if(resultDiv) {
            resultDiv.innerHTML = `<div style="background: #fff7e6; border: 1px solid #ffd591; padding: 15px; border-radius: 4px; color: #d46b08;">
                ⚠️ 项目创建成功，但单元请求异常: ${e.message}<br>
                项目ID: <strong>${projectId}</strong>
            </div>`;
        }
    }
}
// ==================== 创建项目步骤6 - 单元设置交互 ====================
let step6SelectedMaterials = [];
let step6CurrentMaterialTab = 'aweme';

function updatePromotionNameCount(input) {
    const count = input ? input.value.length : 0;
    const el = document.getElementById('ld-promotion-name-count');
    if(el) el.textContent = count + '/50';
}

function switchMaterialTab(tab) {
    step6CurrentMaterialTab = tab;
    const tabAweme = document.getElementById('tab-aweme-material');
    const tabLibrary = document.getElementById('tab-library-material');
    if(tabAweme) {
        tabAweme.style.borderBottom = tab === 'aweme' ? '2px solid #1890ff' : '2px solid transparent';
        tabAweme.style.color = tab === 'aweme' ? '#1890ff' : '#666';
        tabAweme.style.fontWeight = tab === 'aweme' ? '500' : 'normal';
    }
    if(tabLibrary) {
        tabLibrary.style.borderBottom = tab === 'library' ? '2px solid #1890ff' : '2px solid transparent';
        tabLibrary.style.color = tab === 'library' ? '#1890ff' : '#666';
        tabLibrary.style.fontWeight = tab === 'library' ? '500' : 'normal';
    }
}

function selectAigcSwitch(value) {
    const btnOn = document.getElementById('btn-aigc-on');
    const btnOff = document.getElementById('btn-aigc-off');
    const hidden = document.getElementById('ld-create-aigc-switch');
    if(hidden) hidden.value = value;
    if(btnOn) {
        btnOn.style.background = value === 'AIGC_DYNAMIC_CREATIVE_SWITCH_ON' ? '#e6f7ff' : 'white';
        btnOn.style.color = value === 'AIGC_DYNAMIC_CREATIVE_SWITCH_ON' ? '#1890ff' : '#666';
        btnOn.style.border = value === 'AIGC_DYNAMIC_CREATIVE_SWITCH_ON' ? '1px solid #1890ff' : '1px solid #d9d9d9';
    }
    if(btnOff) {
        btnOff.style.background = value === 'AIGC_DYNAMIC_CREATIVE_SWITCH_OFF' ? '#e6f7ff' : 'white';
        btnOff.style.color = value === 'AIGC_DYNAMIC_CREATIVE_SWITCH_OFF' ? '#1890ff' : '#666';
        btnOff.style.border = value === 'AIGC_DYNAMIC_CREATIVE_SWITCH_OFF' ? '1px solid #1890ff' : '1px solid #d9d9d9';
    }
}

function openMaterialModal() {
    const overlay = document.getElementById('material-modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        switchModalTab('aweme');

        // 重置状态
        modalVideoCursor = '0';
        modalVideoCursorHistory = ['0'];
        modalVideoCurrentPageIndex = 0;
        modalVideoHasMore = false;
        modalVideoList = [];
        allAwemeVideos = [];

        // 打开弹窗后立即自动加载全部视频和抖音号
        loadAllAwemeVideos();
    }
}
async function loadAllAwemeVideos() {
    const container = document.getElementById('modal-aweme-list');
    if (container) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#1890ff;">正在加载全部视频...</div>';
    }

    allAwemeVideos = [];
    
    const localAccountId = document.getElementById('ld-create-local-account-id')?.value?.trim() || '';
    if (!localAccountId) {
        if (container) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#f5222d;">请先填写本地推账户ID（步骤1）</div>';
        }
        return;
    }

    // ===== 读取步骤2配置，根据投放目标设置查询参数 =====
    const deliveryGoalEl = document.getElementById('ld-create-delivery-goal');
    const poiModeEl = document.getElementById('ld-create-delivery-poi-mode');
    const productIdEl = document.getElementById('ld-create-product-id');
    const poiIdsEl = document.getElementById('ld-create-promotion-poi-ids');

    const deliveryGoal = deliveryGoalEl?.value || '';
    const poiMode = poiModeEl?.value || '';
    const productId = productIdEl?.value?.trim() || '';
    const poiIds = poiIdsEl?.value?.trim() || '';

    let anchorType = 'PRODUCT_ANCHOR';
    let poiIdsParam = '';
    let productIdsParam = '';
    let anchorLabel = '商品锚点';

    if (deliveryGoal === 'PRODUCT' && productId) {
        // 推商品：查商品锚点，必须传product_ids
        anchorType = 'PRODUCT_ANCHOR';
        productIdsParam = productId;
        anchorLabel = '商品锚点';
    } else if (deliveryGoal === 'POI') {
        anchorLabel = '门店锚点';
        if (poiMode === 'PART' && poiIds) {
            // 指定门店：查门店锚点
            anchorType = 'POI_ANCHOR';
            poiIdsParam = poiIds;
        } else {
            // 推门店未指定具体门店：同时查门店锚点+商品锚点
            anchorType = 'POI_ANCHOR';
        }
    }

    // 同步提示栏
    const hintBar = document.getElementById('modal-hint-bar');
    if (hintBar) {
        hintBar.innerHTML = `<span>当前投放仅支持 <span style="display:inline-block; padding:2px 8px; background:#e6f7ff; color:#1890ff; border:1px solid #91d5ff; border-radius:4px; font-weight:500; margin:0 4px;">${anchorLabel}</span> 视频投放 | 已为你过滤不可用素材</span>`;
    }

    const orderField = document.getElementById('modal-order-field')?.value || 'ESTIMATE';

    // 构建查询配置列表
    const queryConfigs = [];
    
    if (deliveryGoal === 'PRODUCT' && productId) {
        // 推商品：查商品锚点
        queryConfigs.push({
            anchor_types: 'PRODUCT_ANCHOR',
            product_ids: productId,
            poi_ids: ''
        });
    } else if (deliveryGoal === 'POI') {
        if (poiMode === 'PART' && poiIds) {
            // 指定门店：查POI锚点 + 商品锚点（官方后台两种都支持）
            queryConfigs.push({
                anchor_types: 'POI_ANCHOR',
                poi_ids: poiIds,
                product_ids: ''
            });
            queryConfigs.push({
                anchor_types: 'PRODUCT_ANCHOR',
                poi_ids: '',
                product_ids: ''
            });
        } else {
            // 全部门店：查POI锚点
            queryConfigs.push({
                anchor_types: 'POI_ANCHOR',
                poi_ids: '',
                product_ids: ''
            });
        }
    } else {
        // 默认：查商品锚点
        queryConfigs.push({
            anchor_types: 'PRODUCT_ANCHOR',
            poi_ids: '',
            product_ids: ''
        });
    }

    // 对每种查询配置，循环加载所有页（限制100页，防止极端情况死循环）
    for (const config of queryConfigs) {
        let cursor = '0';
        let hasMore = true;
        let page = 0;

        while (hasMore && page < 100) {
            let url = `/api/local_material/video/aweme/get?local_account_id=${localAccountId}&anchor_types=${config.anchor_types}&cursor=${cursor}&page_size=50&order_filed=${orderField}`;

            if (config.poi_ids && config.anchor_types === 'POI_ANCHOR') {
                const arr = config.poi_ids.split(',').map(x => x.trim()).filter(x => x);
                url += `&poi_ids=${encodeURIComponent(JSON.stringify(arr))}`;
            }
            if (config.product_ids && config.anchor_types === 'PRODUCT_ANCHOR') {
                url += `&product_ids=${encodeURIComponent(JSON.stringify([config.product_ids]))}`;
            }

            try {
                const res = await fetch(url);
                const data = await res.json();

                if (data.code === 0 && data.data && data.data.video_list) {
                    const list = data.data.video_list;
                    allAwemeVideos = allAwemeVideos.concat(list);
                    hasMore = data.data.page_info?.has_more || false;
                    cursor = data.data.page_info?.cursor || '0';
                    page++;
                } else {
                    hasMore = false;
                }
            } catch (e) {
                console.error('加载视频失败', e);
                hasMore = false;
            }
        }
    }

    // 按 video_id 去重
    const seen = new Set();
    allAwemeVideos = allAwemeVideos.filter(v => {
        if (seen.has(v.video_id)) return false;
        seen.add(v.video_id);
        return true;
    });

    // 加载完成后：1.填充左侧抖音号列表  2.显示第1页视频
    fillAwemeSelectFromVideos(allAwemeVideos);

    modalVideoList = allAwemeVideos.slice(0, 50);
    modalVideoHasMore = allAwemeVideos.length > 50;
    modalVideoCursor = '0';
    modalVideoCurrentPageIndex = 0;
    renderAwemeVideoCards(modalVideoList);
    updateModalPagination();
}

function openCarouselModal() {
    alert('图文素材选择功能正在开发中。');
}

function updateSelectedCount() {
    const countAweme = step6SelectedMaterials.filter(m => m.type === 'aweme_video').length;
    const countLibrary = step6SelectedMaterials.filter(m => m.type === 'library_video').length;
    const countCarousel = step6SelectedMaterials.filter(m => m.type === 'carousel').length;
    const countVideo = countAweme + countLibrary;
    
    const elAweme = document.getElementById('count-aweme');
    const elLibrary = document.getElementById('count-library');
    const elVideoTotal = document.getElementById('count-video-total');
    const elCarouselTotal = document.getElementById('count-carousel-total');
    
    if(elAweme) elAweme.textContent = countAweme;
    if(elLibrary) elLibrary.textContent = countLibrary;
    if(elVideoTotal) elVideoTotal.textContent = countVideo;
    if(elCarouselTotal) elCarouselTotal.textContent = countCarousel;
}
// ==================== 步骤6素材弹窗交互 ====================

let modalAwemeAccountPage = 1;
let modalAwemeAccountLoading = false;
let modalAwemeAccountHasMore = true;
let modalVideoCursor = '0';
let modalVideoCursorHistory = ['0'];
let modalVideoCurrentPageIndex = 0;
let modalVideoHasMore = false;
let modalVideoList = [];

function closeMaterialModal() {
    const overlay = document.getElementById('material-modal-overlay');
    if(overlay) overlay.style.display = 'none';
}

function switchModalTab(tab) {
    const tabAweme = document.getElementById('modal-tab-aweme');
    const tabLibrary = document.getElementById('modal-tab-library');
    const listAweme = document.getElementById('modal-aweme-list');
    const listLibrary = document.getElementById('modal-library-list');
    const pagination = document.getElementById('modal-pagination');
    
    if(tab === 'aweme') {
        tabAweme.style.borderBottom = '2px solid #1890ff'; tabAweme.style.color = '#1890ff'; tabAweme.style.fontWeight = '500';
        tabLibrary.style.borderBottom = '2px solid transparent'; tabLibrary.style.color = '#666'; tabLibrary.style.fontWeight = 'normal';
        listAweme.style.display = 'grid';
        listLibrary.style.display = 'none';
        if(pagination) pagination.style.display = 'flex';
    } else {
        tabLibrary.style.borderBottom = '2px solid #1890ff'; tabLibrary.style.color = '#1890ff'; tabLibrary.style.fontWeight = '500';
        tabAweme.style.borderBottom = '2px solid transparent'; tabAweme.style.color = '#666'; tabAweme.style.fontWeight = 'normal';
        listLibrary.style.display = 'grid';
        listAweme.style.display = 'none';
        if(pagination) pagination.style.display = 'none';
    }
}

// ---------- 抖音号下拉框加载 ----------
// ---------- 视频列表加载与分页 ----------
function searchModalVideos() {
    // 获取左侧勾选的抖音号
    const checkedIds = Array.from(document.querySelectorAll('.aweme-filter-checkbox:checked')).map(cb => cb.value);

    if (checkedIds.length === 0) {
        // 未勾选：显示全部视频的第1页
        modalVideoList = allAwemeVideos.slice(0, 50);
        modalVideoHasMore = allAwemeVideos.length > 50;
    } else {
        // 勾选了：本地过滤后显示第1页
        const filtered = allAwemeVideos.filter(v => checkedIds.includes(v.aweme_id));
        modalVideoList = filtered.slice(0, 50);
        modalVideoHasMore = filtered.length > 50;
    }

    modalVideoCursor = '0';
    modalVideoCursorHistory = ['0'];
    modalVideoCurrentPageIndex = 0;
    renderAwemeVideoCards(modalVideoList);
    updateModalPagination();
}
// 关键新增：从视频列表中提取抖音号信息，填充下拉框
function fillAwemeSelectFromVideos(videoList) {
    const container = document.getElementById('modal-aweme-checkbox-list');
    if (!container) return;

    // 从所有已加载视频中提取抖音号，去重
    const awemeMap = new Map();
    videoList.forEach(item => {
        if (item.aweme_id && !awemeMap.has(item.aweme_id)) {
            awemeMap.set(item.aweme_id, {
                name: item.aweme_name || '未命名',
                id: item.aweme_id
            });
        }
    });

    if (awemeMap.size === 0) {
        container.innerHTML = '<div style="color:#999; font-size:12px; text-align:center; padding:20px;">暂无抖音号</div>';
        return;
    }

     let html = '';
    awemeMap.forEach((info, id) => {
        html += `
            <label style="display:flex; align-items:flex-start; gap:6px; padding:6px 8px; cursor:pointer; border-radius:4px; transition:background 0.2s; font-size:13px; color:#333;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" class="aweme-filter-checkbox" value="${id}" style="cursor:pointer; margin-top:2px;">
                <span style="flex:1; word-break:break-all; line-height:1.4;" title="${info.name}（ID: ${id}）">${info.name}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}


function renderAwemeVideoCards(list) {
    const container = document.getElementById('modal-aweme-list');
    if(!container) return;
    
    if(list.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">暂无视频数据</div>';
        return;
    }
    
    const typeMap = {'IMAGE_MODE_VIDEO':'横版','IMAGE_MODE_VIDEO_VERTICAL':'竖版','IMAGE_MODE_LOCAL_ADGRAPHIC':'团购卡'};
    
    let html = '';
    list.forEach(item => {
        const isSelected = step6SelectedMaterials.some(m => m.video_id === item.video_id && m.type === 'aweme_video');
        const canDelivery = item.can_delivery !== false;
        const disabledStyle = canDelivery ? '' : 'opacity:0.45; pointer-events:none;';
        const cursorStyle = canDelivery ? 'pointer' : 'not-allowed';
        
        // 更易成交标签
        const dealTag = (item.deal_tag || item.is_easy_deal) ? `<div style="position:absolute; bottom:4px; left:4px; background:#ff4d4f; color:white; font-size:11px; padding:2px 6px; border-radius:2px; z-index:2;">更易成交</div>` : '';
        
        // 关键修复：onclick 只保留函数调用，不混入其他 HTML
        const onclickCall = canDelivery ? `selectStep6Material('aweme_video', '${item.video_id}', '${(item.title || '').replace(/'/g, "\\'")}', '${item.aweme_video_url || ''}', '${item.aweme_id || ''}', '${(item.aweme_name || '').replace(/'/g, "\\'")}', '${item.cover_image_url || ''}', '${item.item_id || ''}')` : '';
        
        html += `
            <div ${onclickCall ? `onclick="${onclickCall}"` : ''} 
                 style="border:2px solid ${isSelected ? '#1890ff' : '#f0f0f0'}; border-radius:8px; overflow:hidden; cursor:${cursorStyle}; transition:all 0.2s; background:white; ${disabledStyle}">
                <div style="aspect-ratio:16/9; background:#f5f5f5; position:relative; overflow:hidden;">
                    ${item.cover_image_url ? `<img src="${item.cover_image_url}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">` : '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#999; font-size:12px;">无封面</div>'}
                    ${isSelected ? '<div style="position:absolute; top:6px; right:6px; width:22px; height:22px; background:#1890ff; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; z-index:2;">✓</div>' : ''}
                    <div style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.6); color:white; font-size:11px; padding:2px 6px; border-radius:2px; z-index:2;">${item.duration || '-'}</div>
                    ${dealTag}
                </div>
                <div style="padding:10px;">
                    <div style="font-size:13px; color:#333; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px;">${item.title || '未命名'}</div>
                    <div style="font-size:12px; color:#999; display:flex; justify-content:space-between; align-items:center;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100px;">${item.aweme_name || '-'}</span>
                        <span style="flex-shrink:0;">${typeMap[item.image_mode] || item.image_mode || '-'}</span>
                    </div>
                    <div style="font-size:11px; color:#bbb; margin-top:4px; display:flex; gap:10px;">
                        <span>👍 ${item.like_cnt !== undefined ? item.like_cnt : '-'}</span>
                        <span>💬 ${item.comment_cnt !== undefined ? item.comment_cnt : '-'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}
function changeModalPage(delta) {
    const newIndex = modalVideoCurrentPageIndex + delta;
    if (newIndex < 0) return;

    // 获取当前过滤条件
    const checkedIds = Array.from(document.querySelectorAll('.aweme-filter-checkbox:checked')).map(cb => cb.value);
    const sourceList = checkedIds.length > 0
        ? allAwemeVideos.filter(v => checkedIds.includes(v.aweme_id))
        : allAwemeVideos;

    const totalPages = Math.ceil(sourceList.length / 50);
    if (newIndex >= totalPages) return;

    modalVideoCurrentPageIndex = newIndex;
    const start = newIndex * 50;
    const end = start + 50;
    modalVideoList = sourceList.slice(start, end);
    modalVideoHasMore = end < sourceList.length;
    renderAwemeVideoCards(modalVideoList);
    updateModalPagination();
}

function updateModalPagination() {
    const pageInfo = document.getElementById('modal-page-info');
    const btnPrev = document.getElementById('btn-modal-prev');
    const btnNext = document.getElementById('btn-modal-next');

    // 计算总页数
    const checkedIds = Array.from(document.querySelectorAll('.aweme-filter-checkbox:checked')).map(cb => cb.value);
    const sourceList = checkedIds.length > 0
        ? allAwemeVideos.filter(v => checkedIds.includes(v.aweme_id))
        : allAwemeVideos;
    const totalPages = Math.max(1, Math.ceil(sourceList.length / 50));

    if (pageInfo) pageInfo.textContent = `第 ${modalVideoCurrentPageIndex + 1} 页 / 共 ${totalPages} 页`;
    if (btnPrev) btnPrev.disabled = modalVideoCurrentPageIndex <= 0;
    if (btnNext) btnNext.disabled = !modalVideoHasMore;
    if (btnNext) btnNext.style.opacity = modalVideoHasMore ? '1' : '0.5';
}

function selectTop10Videos() {
    let count = 0;
    modalVideoList.forEach(item => {
        if(count >= 10) return;
        if(item.can_delivery === false) return;
        const exists = step6SelectedMaterials.some(m => m.video_id === item.video_id);
        if(!exists) {
            step6SelectedMaterials.push({
                type: 'aweme_video',
                video_id: item.video_id,
                title: item.title || item.video_id,
                video_url: item.aweme_video_url || '',
                aweme_id: item.aweme_id || '',
                aweme_name: item.aweme_name || '',
                cover_url: item.cover_image_url || '',
                duration: item.duration || ''
            });
            count++;
        }
    });
    renderAwemeVideoCards(modalVideoList);
    updateModalSelectedCount();
    updateSelectedCount();
}

// ---------- 素材选择/取消 ----------
function selectStep6Material(type, videoId, title, videoUrl, awemeId, awemeName, coverUrl, awemeItemId) {
    const existingIndex = step6SelectedMaterials.findIndex(m => m.video_id === videoId);
    if(existingIndex >= 0) {
        step6SelectedMaterials.splice(existingIndex, 1);
    } else {
        if(step6SelectedMaterials.length >= 10) {
            alert('最多只能选择10个素材');
            return;
        }
        step6SelectedMaterials.push({
            type: type,
            video_id: videoId,
            title: title,
            video_url: videoUrl,
            aweme_id: awemeId || '',
            aweme_name: awemeName || '',
            cover_url: coverUrl || '',
            aweme_item_id: awemeItemId || ''  // 抖音主页视频专用：对应API的item_id
        });
    }
    
    if(document.getElementById('modal-aweme-list').style.display !== 'none') {
        renderAwemeVideoCards(modalVideoList);
    }
    
    updateModalSelectedCount();
    updateSelectedCount();
    renderSelectedMaterials();
}

function updateModalSelectedCount() {
    const el = document.getElementById('modal-selected-count');
    if(el) el.textContent = step6SelectedMaterials.length;
}

function confirmStep6MaterialSelection() {
    closeMaterialModal();
    renderSelectedMaterials();
    updateSelectedCount();
}

// ---------- 渲染已选素材到步骤6主界面 ----------
function renderSelectedMaterials() {
    const container = document.getElementById('selected-materials-container');
    if(!container) return;
    
    if(step6SelectedMaterials.length === 0) {
        container.innerHTML = '<div style="color:#999; font-size:13px;">暂无素材，请先 <a onclick="openMaterialModal()" style="color:#1890ff; cursor:pointer;">添加</a></div>';
        return;
    }
    
    let html = '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
    step6SelectedMaterials.forEach((mat, idx) => {
        const label = mat.type === 'aweme_video' ? '抖音' : (mat.type === 'library_video' ? '素材库' : '图文');
        html += `
            <div style="display:flex; align-items:center; gap:6px; padding:6px 10px; background:#e6f7ff; border:1px solid #91d5ff; border-radius:4px; font-size:13px; color:#096dd9;">
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${mat.title || mat.video_id}</span>
                <span style="font-size:11px; color:#999; flex-shrink:0;">(${label}${mat.aweme_name ? ' · ' + mat.aweme_name : ''})</span>
                <span onclick="removeStep6Material(${idx})" style="cursor:pointer; color:#f5222d; font-size:14px; flex-shrink:0; margin-left:2px;">×</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function removeStep6Material(index) {
    step6SelectedMaterials.splice(index, 1);
    renderSelectedMaterials();
    updateSelectedCount();
    updateModalSelectedCount();
    const overlay = document.getElementById('material-modal-overlay');
    if(overlay && overlay.style.display === 'flex') {
        if(document.getElementById('modal-aweme-list').style.display !== 'none') {
            renderAwemeVideoCards(modalVideoList);
        }
    }
}
// ==================== 更新项目 ====================

async function updateLocalProject() {
    const localAccountId = document.getElementById('ld-update-local-account-id').value.trim();
    const projectId = document.getElementById('ld-update-project-id').value.trim();
    
    if(!localAccountId || !projectId) {
        alert('请输入本地推账户ID和项目ID');
        return;
    }
    
    const payload = {
        local_account_id: parseInt(localAccountId),
        project_id: parseInt(projectId)
    };
    
    // 增量更新：只传有值的字段
    const name = document.getElementById('ld-update-name').value.trim();
    if(name) payload.name = name;
    
    const budget = document.getElementById('ld-update-budget').value.trim();
    if(budget) payload.budget = parseInt(budget) * 100;
    
    const bid = document.getElementById('ld-update-bid').value.trim();
    if(bid) payload.bid = parseInt(bid) * 100;
    
    const endTime = document.getElementById('ld-update-end-time').value;
    if(endTime) payload.end_time = endTime;
    
    const scheduleTime = document.getElementById('ld-update-schedule-time').value.trim();
    if(scheduleTime) {
        if(scheduleTime === '0') {
            payload.schedule_time = "";
        } else {
            if(!validateScheduleString(scheduleTime)) {
                alert('投放时段字符串格式错误，必须是336位0/1字符串');
                return;
            }
            payload.schedule_time = scheduleTime;
        }
    }
    
    const resultDiv = document.getElementById('ld-update-result');
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">更新中...</div>';
    
    try {
        const res = await fetch('/api/local_delivery/project/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if(data.code === 0) {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 4px; color: #389e0d;">
                    ✅ 项目更新成功！
                </div>`;
            }
        } else {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 15px; border-radius: 4px; color: #cf1322;">
                    ❌ 更新失败: ${data.message || '未知错误'} (code: ${data.code})
                </div>`;
            }
        }
    } catch(e) {
        if(resultDiv) {
            resultDiv.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 15px; border-radius: 4px; color: #cf1322;">
                请求异常: ${e.message}
            </div>`;
        }
    }
}

// ==================== 项目列表查询 ====================

async function queryLocalProjectList() {
    const localAccountId = document.getElementById('ld-list-local-account-id').value.trim();
    if(!localAccountId) {
        alert('请输入本地推账户ID');
        return;
    }
    
    ldCurrentPage = 1;
    await fetchLocalProjectList(localAccountId);
}

async function fetchLocalProjectList(localAccountId) {
    const resultDiv = document.getElementById('ld-list-result');
    const paginationDiv = document.getElementById('ld-list-pagination');
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        const projectName = document.getElementById('ld-list-project-name').value.trim();
        const statusFirst = document.getElementById('ld-list-status-first').value;
        const marketingGoal = document.getElementById('ld-list-marketing-goal').value;
        const localDeliveryScene = document.getElementById('ld-list-local-delivery-scene').value;
        
        let url = `/api/local_delivery/project/list?local_account_id=${localAccountId}&page=${ldCurrentPage}&page_size=${ldPageSize}`;
        
        // 构建 filtering
        const filtering = {};
        if(projectName) filtering.project_name = projectName;
        if(statusFirst) filtering.project_status_first = statusFirst;
        if(marketingGoal) filtering.marketing_goal = marketingGoal;
        if(localDeliveryScene) filtering.local_delivery_scene = localDeliveryScene;
        
        if(Object.keys(filtering).length > 0) {
            url += `&filtering=${encodeURIComponent(JSON.stringify(filtering))}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.project_list || [];
            const pageInfo = data.data.page_info || {};
            ldTotalPage = Math.ceil((pageInfo.total_number || 0) / ldPageSize) || 1;
            
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无项目数据</div>';
                if(paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            
            let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
            html += '<th style="padding: 10px; text-align: left;"><input type="checkbox" id="ld-select-all" onclick="toggleSelectAllProjects()" style="cursor: pointer;"></th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">项目ID</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">项目名称</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">营销场景</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">营销目的</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">单元类型</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">状态</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">预算</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">操作</th>';
            html += '</tr></thead><tbody>';
            
            list.forEach(item => {
                const projectId = item.project_id || '-';
                const statusFirst = item.project_status_first || '-';
                let statusColor = '#999';
                let statusText = statusFirst;
                if(statusFirst === 'PROJECT_STATUS_ENABLE') { statusColor = '#52c41a'; statusText = '启用中'; }
                else if(statusFirst === 'PROJECT_STATUS_DISABLE') { statusColor = '#faad14'; statusText = '未投放'; }
                else if(statusFirst === 'PROJECT_STATUS_DELETE') { statusColor = '#f5222d'; statusText = '已删除'; }
                
                const goalMap = {'LIVE': '直播', 'VIDEO_IMAGE': '短视频/图文'};
                const sceneMap = {'CONTENT_HEAT': '线上互动', 'POI_RECOMMEND': '线下到店', 'PRODUCT_PAY': '团购成交', 'EXTERNAL': '获取线索'};
                
                html += `<tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 10px;"><input type="checkbox" class="ld-project-checkbox" value="${projectId}" style="cursor: pointer;"></td>
                    <td style="padding: 10px; font-family: monospace; font-size: 12px;">${projectId}</td>
                    <td style="padding: 10px;">${item.name || '-'}</td>
                    <td style="padding: 10px;">${goalMap[item.marketing_goal] || item.marketing_goal || '-'}</td>
                    <td style="padding: 10px;">${sceneMap[item.local_delivery_scene] || item.local_delivery_scene || '-'}</td>
                    <td style="padding: 10px;">${item.ad_type === 'GENERAL' ? '通投' : (item.ad_type === 'SEARCHING' ? '搜索' : item.ad_type || '-')}</td>
                    <td style="padding: 10px;"><span style="color: ${statusColor}; font-weight: 500;">${statusText}</span></td>
                    <td style="padding: 10px;">${item.project_budget ? '¥' + item.project_budget : '-'}</td>
                    <td style="padding: 10px;">
                        <button onclick="viewProjectDetail('${localAccountId}', '${projectId}')" style="padding: 4px 10px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">详情</button>
                        <button onclick="loadProjectForUpdate('${localAccountId}', '${projectId}')" style="padding: 4px 10px; background: #52c41a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">编辑</button>
                    </td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            
            // 批量操作栏
            html += `<div style="margin-top: 15px; padding: 10px; background: #fafafa; border-radius: 4px; display: flex; gap: 10px; align-items: center;">
                <span style="font-size: 13px; color: #666;">批量操作：</span>
                <button onclick="batchUpdateProjectStatus('ENABLE')" style="padding: 6px 12px; background: #52c41a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">启用</button>
                <button onclick="batchUpdateProjectStatus('PAUSED')" style="padding: 6px 12px; background: #faad14; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">暂停</button>
            </div>`;
            
            if(resultDiv) resultDiv.innerHTML = html;
            
            // 分页
            if(paginationDiv) paginationDiv.style.display = 'flex';
            const pageInfoSpan = document.getElementById('ld-page-info');
            const btnPrev = document.getElementById('btn-ld-prev');
            const btnNext = document.getElementById('btn-ld-next');
            if(pageInfoSpan) pageInfoSpan.textContent = `第 ${ldCurrentPage} 页 / 共 ${ldTotalPage} 页`;
            if(btnPrev) btnPrev.disabled = ldCurrentPage <= 1;
            if(btnNext) btnNext.disabled = ldCurrentPage >= ldTotalPage;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
            if(paginationDiv) paginationDiv.style.display = 'none';
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
        if(paginationDiv) paginationDiv.style.display = 'none';
    }
}

function changeLocalProjectPage(delta) {
    const localAccountId = document.getElementById('ld-list-local-account-id').value.trim();
    if(!localAccountId) return;
    ldCurrentPage += delta;
    if(ldCurrentPage < 1) ldCurrentPage = 1;
    fetchLocalProjectList(localAccountId);
}

function toggleSelectAllProjects() {
    const allCb = document.getElementById('ld-select-all');
    const cbs = document.querySelectorAll('.ld-project-checkbox');
    cbs.forEach(cb => cb.checked = allCb.checked);
}

function getSelectedProjectIds() {
    return Array.from(document.querySelectorAll('.ld-project-checkbox:checked')).map(cb => cb.value);
}

async function batchUpdateProjectStatus(status) {
    const ids = getSelectedProjectIds();
    if(ids.length === 0) {
        alert('请至少选择一个项目');
        return;
    }
    if(ids.length > 50) {
        alert('批量操作最多50个项目');
        return;
    }
    
    const localAccountId = document.getElementById('ld-list-local-account-id').value.trim();
    if(!localAccountId) {
        alert('请输入本地推账户ID');
        return;
    }
    
    if(!confirm(`确定要${status === 'ENABLE' ? '启用' : '暂停'}选中的 ${ids.length} 个项目吗？`)) return;
    
    try {
        const res = await fetch('/api/local_delivery/project/status/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                local_account_id: parseInt(localAccountId),
                data: ids.map(id => ({project_id: parseInt(id), opt_status: status}))
            })
        });
        const data = await res.json();
        
        if(data.code === 0) {
            alert(`✅ 批量${status === 'ENABLE' ? '启用' : '暂停'}成功！`);
            fetchLocalProjectList(localAccountId);
        } else {
            alert(`❌ 批量操作失败: ${data.message || '未知错误'}`);
        }
    } catch(e) {
        alert(`请求异常: ${e.message}`);
    }
}
// 将 48×7 时段字符串解析为可读时间段
function parseScheduleTime(scheduleStr) {
    if (!scheduleStr || scheduleStr.length !== 336) return null;
    
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const result = [];
    
    for (let day = 0; day < 7; day++) {
        const dayStr = scheduleStr.substring(day * 48, (day + 1) * 48);
        const slots = [];
        let start = null;
        
        for (let i = 0; i <= 48; i++) {
            const isOn = i < 48 && dayStr[i] === '1';
            
            if (isOn && start === null) {
                start = i;  // 连续块开始
            } else if ((!isOn || i === 48) && start !== null) {
                // 连续块结束，生成时间段
                const startMin = start * 30;
                const endMin = i * 30;
                const fmt = (m) => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
                slots.push(`${fmt(startMin)}-${fmt(endMin)}`);
                start = null;
            }
        }
        
        if (slots.length > 0) {
            result.push({day: days[day], slots: slots});
        }
    }
    return result;
}

async function viewProjectDetail(localAccountId, projectId) {
    try {
        const res = await fetch(`/api/local_delivery/project/detail?local_account_id=${localAccountId}&project_id=${projectId}`);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const d = data.data;
            
            // 映射表
            const statusMap = {
                'PROJECT_STATUS_ENABLE': {text: '启用中', color: '#52c41a', bg: '#f6ffed'},
                'PROJECT_STATUS_DISABLE': {text: '未投放', color: '#faad14', bg: '#fff7e6'},
                'PROJECT_STATUS_DONE': {text: '已完成', color: '#1890ff', bg: '#e6f7ff'},
                'PROJECT_STATUS_DELETE': {text: '已删除', color: '#f5222d', bg: '#fff2f0'}
            };
            const st = statusMap[d.project_status_first] || {text: d.project_status_first || '-', color: '#666', bg: '#f5f5f5'};
            const goalMap = {'LIVE': '直播', 'VIDEO_IMAGE': '短视频/图文'};
            const sceneMap = {'CONTENT_HEAT': '线上互动', 'POI_RECOMMEND': '线下到店', 'PRODUCT_PAY': '团购成交', 'EXTERNAL': '获取线索'};
            const adTypeMap = {'GENERAL': '通投', 'SEARCHING': '搜索'};
            const deliveryMap = {'POI': '门店', 'PRODUCT': '商品'};
            
            let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">`;
            
            // 顶部标题
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0;">
                <div>
                    <div style="font-size: 20px; font-weight: 600; color: #001529; margin-bottom: 6px;">${d.name || '未命名项目'}</div>
                    <div style="font-size: 13px; color: #999; font-family: monospace;">ID: ${d.project_id || '-'}</div>
                </div>
                <span style="display: inline-block; padding: 6px 16px; border-radius: 4px; font-size: 14px; font-weight: 500; color: ${st.color}; background: ${st.bg}; border: 1px solid ${st.color}30;">${st.text}</span>
            </div>`;
            
            // 辅助函数：生成信息块
            const section = (title, color, items) => {
                let validItems = items.filter(i => i.value && i.value !== '-' && i.value !== 'undefined');
                if(validItems.length === 0) return '';
                let s = `<div style="margin-bottom: 20px;">
                    <div style="font-size: 15px; font-weight: 600; color: #001529; margin-bottom: 12px; padding-left: 10px; border-left: 4px solid ${color};">${title}</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; background: #fafafa; padding: 16px; border-radius: 8px;">`;
                validItems.forEach(item => {
                    s += `<div>
                        <div style="font-size: 12px; color: #999; margin-bottom: 4px;">${item.label}</div>
                        <div style="font-size: 14px; color: #333; font-weight: 500; word-break: break-all;">${item.value}</div>
                    </div>`;
                });
                s += `</div></div>`;
                return s;
            };
            
            // 基本信息
            html += section('📋 基本信息', '#1890ff', [
                {label: '营销场景', value: goalMap[d.marketing_goal] || d.marketing_goal},
                {label: '营销目的', value: sceneMap[d.local_delivery_scene] || d.local_delivery_scene},
                {label: '单元类型', value: adTypeMap[d.ad_type] || d.ad_type},
                {label: '投放内容', value: deliveryMap[d.delivery_goal] || d.delivery_goal},
                {label: '门店模式', value: d.delivery_poi_mode},
                {label: '优化目标', value: d.external_action},
                {label: '抖音号', value: d.aweme_id},
                {label: '商品ID', value: d.product_id},
                {label: '自动更新门店', value: d.auto_update_pois},
                {label: '门店ID列表', value: d.promotion_poi_ids ? d.promotion_poi_ids.join(', ') : null},
            ]);
            
            // 预算出价
            const budgetModeMap = {BUDGET_MODE_DAY:'日预算', BUDGET_MODE_TOTAL:'总预算', BUDGET_MODE_7DAY_TOTAL:'7日总预算'};
            const bidTypeMap = {MANUAL:'手动出价', SMART:'智能出价', STABILIZE_COSTS:'稳定成本', MAX_CONVERSION:'最大转化'};
            
            html += section('💰 预算与出价', '#52c41a', [
                {label: '预算模式', value: budgetModeMap[d.budget_mode] || d.budget_mode},
                {label: '项目预算', value: d.budget ? `¥${(d.budget/100).toFixed(2)}` : null},
                {label: '出价方式', value: bidTypeMap[d.bid_type] || d.bid_type},
                {label: '出价', value: d.bid ? `¥${(d.bid/100).toFixed(2)}` : null},
            ]);
            
            // 投放时段
                      // 投放时段
            const scheduleTypeMap = {
                FROM_NOW_ON:'从今天起长期投放',
                START_TO_END:'设置开始结束时间',
                FIXED_TIME:'固定时长',
                DELIVERY_7DAY:'7天稳投',
                DAILY_DELIVERY_DURATION:'每日投放时长'
            };
            
            if(d.schedule_type || d.start_time || d.schedule_time) {
                html += section('📅 投放时段', '#fa8c16', [
                    {label: '日期类型', value: scheduleTypeMap[d.schedule_type] || d.schedule_type},
                    {label: '开始时间', value: d.start_time},
                    {label: '结束时间', value: d.end_time},
                    {label: '固定时长(秒)', value: d.schedule_fixed_seconds},
                    {label: '每日时长(秒)', value: d.daily_delivery_seconds},
                ]);
                                // 投放时段 - 可读化展示
                if(d.schedule_time) {
                    const parsed = parseScheduleTime(d.schedule_time);
                    if (parsed && parsed.length > 0) {
                        html += `<div style="margin-bottom: 20px;">
                            <div style="background: #fafafa; padding: 12px 16px; border-radius: 8px;">
                                <div style="font-size: 12px; color: #999; margin-bottom: 10px;">📅 投放时段明细</div>`;
                        parsed.forEach(day => {
                            html += `<div style="display: flex; margin-bottom: 6px; align-items: baseline;">
                                <span style="display: inline-block; min-width: 36px; font-size: 13px; color: #333; font-weight: 500;">${day.day}</span>
                                <span style="font-size: 13px; color: #666;">${day.slots.join('、')}</span>
                            </div>`;
                        });
                        html += `</div></div>`;
                    }
                    // 原始字符串折叠保留（调试用）
                    html += `<details style="margin-bottom: 20px; background: white; border-radius: 4px; border: 1px solid #e8e8e8;">
                        <summary style="padding: 8px 12px; cursor: pointer; font-size: 12px; color: #999; font-family: monospace;">原始 336 位字符串</summary>
                        <div style="padding: 8px 12px; font-size: 11px; color: #666; font-family: monospace; word-break: break-all; border-top: 1px solid #e8e8e8;">${d.schedule_time}</div>
                    </details>`;
                }
            }
            
            // 定向设置
                       // 定向设置
            if(d.audience && Object.keys(d.audience).length > 0) {
                const aud = d.audience;
                
                // 映射表
                const districtMap = {ALL:'不限', REGION:'按行政区域', LOCAL:'自定义/商圈', POI:'门店附近'};
                const genderMap = {NONE:'不限', MALE:'男', FEMALE:'女'};
                const hideMap = {NO_EXCLUDE:'不过滤', ADVERTISER:'投放账户', CUSTOMER:'公司账户', PROJECT:'项目', PROMOTION:'单元', ORGANIZATION:'组织账户'};
                const interestMap = {INTERESTACTION_OFF:'不限', INTERESTACTION_AUTO:'系统推荐', INTERESTACTION_CUSTOM:'自定义'};
                const locationMap = {CURRENT:'正在该地区的用户', ALL:'该地区的所有用户', HOME:'居住在该地区的用户', TRAVEL:'到该地区旅行的用户'};
                const divideMap = {BY_LOCATION:'按地理划分', BY_LEVEL:'按发展等级划分'};
                                const ageMap = {
                    'AGE_BETWEEN_18_23':'18-23岁',
                    'AGE_BETWEEN_24_30':'24-30岁',
                    'AGE_BETWEEN_31_35':'31-35岁',
                    'AGE_BETWEEN_36_40':'36-40岁',
                    'AGE_BETWEEN_41_45':'41-45岁',
                    'AGE_BETWEEN_46_50':'46-50岁',
                    'AGE_BETWEEN_51_55':'51-55岁',
                    'AGE_ABOVE_50':'50岁以上',
                    'AGE_ABOVE_55':'55岁以上'
                };
                
                let audItems = [
                    {label: '地域类型', value: districtMap[aud.district] || aud.district},
                    {label: '性别', value: genderMap[aud.gender] || aud.gender},
                    {label: '年龄', value: aud.age ? aud.age.map(a => ageMap[a] || a).join('、') : null},
                    {label: '定向人群包', value: aud.retargeting_tags ? aud.retargeting_tags.join(', ') : null},
                    {label: '排除人群包', value: aud.retargeting_tags_exclude ? aud.retargeting_tags_exclude.join(', ') : null},
                    {label: '过滤已转化', value: hideMap[aud.hide_if_converted] || aud.hide_if_converted},
                    {label: '行为兴趣', value: interestMap[aud.customized_interest_action] || aud.customized_interest_action},
                ];
                html += section('🎯 定向设置', '#722ed1', audItems);
                
                if(aud.region && aud.region.city && aud.region.city.length > 0) {
                    html += `<div style="margin-bottom: 20px;"><div style="background: #f6ffed; padding: 12px 16px; border-radius: 8px; border: 1px solid #b7eb8f;">
                        <div style="font-size: 13px; color: #389e0d; margin-bottom: 4px; font-weight: 500;">🗺️ 行政区域定向</div>
                        <div style="font-size: 13px; color: #333; line-height: 1.6;">
                            <span style="display: inline-block; margin-right: 16px;"><strong>城市ID：</strong>${aud.region.city.join(', ')}</span>
                            <span style="display: inline-block; margin-right: 16px;"><strong>划分：</strong>${divideMap[aud.region.city_divide] || aud.region.city_divide || '-'}</span>
                            <span style="display: inline-block; margin-right: 16px;"><strong>人群：</strong>${locationMap[aud.region.location_type] || aud.region.location_type || '-'}</span>
                            <span style="display: inline-block;"><strong>版本：</strong>${aud.region.region_ver || '-'}</span>
                        </div>
                    </div></div>`;
                }
                if(aud.poi_around && aud.poi_around.poi_around_ids && aud.poi_around.poi_around_ids.length > 0) {
                    const radiusMap = {KM_6:'6km', KM_8:'8km', KM_10:'10km', KM_12:'12km', KM_15:'15km', KM_20:'20km', KM_25:'25km', KM_30:'30km'};
                    html += `<div style="margin-bottom: 20px;"><div style="background: #e6f7ff; padding: 12px 16px; border-radius: 8px; border: 1px solid #91d5ff;">
                        <div style="font-size: 13px; color: #096dd9; margin-bottom: 4px; font-weight: 500;">🏪 门店附近定向</div>
                        <div style="font-size: 13px; color: #333; line-height: 1.6;">
                            <span style="display: inline-block; margin-right: 16px;"><strong>门店ID：</strong>${aud.poi_around.poi_around_ids.join(', ')}</span>
                            <span style="display: inline-block;"><strong>半径：</strong>${radiusMap[aud.poi_around.poi_around_radius] || aud.poi_around.poi_around_radius || '-'}</span>
                        </div>
                    </div></div>`;
                }
                
                // 行为兴趣自定义详情
                if(aud.customized_interest_action === 'INTERESTACTION_CUSTOM') {
                    let interestHtml = '';
                    if(aud.interest_config && (aud.interest_config.interest_categories || aud.interest_config.interest_words)) {
                        interestHtml += `<div style="margin-bottom: 8px;">
                            <span style="color: #eb2f96; font-weight: 500;">兴趣</span>：
                            ${aud.interest_config.interest_categories ? `类目 ${aud.interest_config.interest_categories.join(', ')}` : ''}
                            ${aud.interest_config.interest_words ? `关键词 ${aud.interest_config.interest_words.join(', ')}` : ''}
                        </div>`;
                    }
                    if(aud.action_config && (aud.action_config.action_categories || aud.action_config.action_words)) {
                        const daysMap = {ACTIONDAYS_DAY7:'7天', ACTIONDAYS_DAY15:'15天', ACTIONDAYS_DAY30:'30天', ACTIONDAYS_DAY60:'60天', ACTIONDAYS_DAY90:'90天', ACTIONDAYS_DAY180:'180天', ACTIONDAYS_DAY365:'365天'};
                        interestHtml += `<div style="margin-bottom: 8px;">
                            <span style="color: #1890ff; font-weight: 500;">行为</span>：
                            ${aud.action_config.action_categories ? `类目 ${aud.action_config.action_categories.join(', ')}` : ''}
                            ${aud.action_config.action_words ? `关键词 ${aud.action_config.action_words.join(', ')}` : ''}
                            <span style="color: #999; margin-left: 8px;">(${daysMap[aud.action_config.action_days] || aud.action_config.action_days || '30天'})</span>
                        </div>`;
                    }
                    if(interestHtml) {
                        html += `<div style="margin-bottom: 20px;"><div style="background: #fff7e6; padding: 12px 16px; border-radius: 8px; border: 1px solid #ffd591; font-size: 13px; color: #333;">
                            <div style="font-size: 12px; color: #d46b08; margin-bottom: 6px; font-weight: 500;">🎯 自定义行为兴趣</div>
                            ${interestHtml}
                        </div></div>`;
                    }
                }
            }
            
          
                       // 线索配置
                        // 线索配置
            if(d.intelligent_selection_mode || d.local_asset_type || d.tool_pack_id || d.market_page_ids || d.consult_aweme_uid || d.delivery_package || d.aigc_dynamic_creative_switch) {
                const modeMap = {INTELLIGENT_SELECTION_MODE_OFF:'自定义', INTELLIGENT_SELECTION_MODE_ON:'智能优选'};
                const assetMap = {
                    LOCAL_ASSET_TYPE_AWEME_PAGE:'推抖音私信页',
                    LOCAL_ASSET_TYPE_MARKET_PAGE:'推营销页',
                    LOCAL_ASSET_TYPE_PRODUCT_PAGE:'商品投放详情页',
                    LOCAL_ASSET_TYPE_SHOP_PAGE:'推门店页'
                };
                const packageMap = {DELIVERY_PACKAGE_NORMAL:'常规投放', DELIVERY_PACKAGE_UBL:'周期稳投'};
                const aigcMap = {AIGC_DYNAMIC_CREATIVE_SWITCH_OFF:'关闭', AIGC_DYNAMIC_CREATIVE_SWITCH_ON:'打开'};
                
                let leadsItems = [
                    {label: '获取线索方式', value: modeMap[d.intelligent_selection_mode] || d.intelligent_selection_mode || '-'},
                    {label: '营销跳转页', value: assetMap[d.local_asset_type] || d.local_asset_type || '-'},
                    {label: '留资组件ID', value: d.tool_pack_id || '-'},
                    {label: '营销页ID', value: d.market_page_ids && d.market_page_ids.length > 0 ? d.market_page_ids.join(', ') : '-'},
                    {label: '私信接待抖音号', value: d.consult_aweme_uid || '-'},
                    {label: '投放类型', value: packageMap[d.delivery_package] || d.delivery_package || '-'},
                    {label: 'AIGC动态创意', value: aigcMap[d.aigc_dynamic_creative_switch] || d.aigc_dynamic_creative_switch || '-'},
                ];
                html += section('📞 线索配置', '#eb2f96', leadsItems);
            }
            
            // 高峰日预算
            if(d.is_set_peak_budget) {
                html += section('📈 高峰日预算', '#faad14', [
                    {label: '自然周高峰日', value: d.peak_week_days ? d.peak_week_days.join(', ') : null},
                    {label: '节假日高峰日', value: d.peak_holidays ? d.peak_holidays.join(', ') : null},
                    {label: '上调比例', value: d.high_budget_rate ? `${d.high_budget_rate}%` : null},
                ]);
            }
            
            // 原始JSON折叠
            html += `<div style="margin-top: 10px;">
                <details style="background: #fafafa; border-radius: 8px; border: 1px solid #f0f0f0;">
                    <summary style="padding: 12px 16px; cursor: pointer; font-size: 13px; color: #666; font-weight: 500; user-select: none;">📄 查看原始JSON数据（调试用）</summary>
                    <pre style="margin: 0; padding: 16px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #333; background: white; border-top: 1px solid #f0f0f0; max-height: 350px; overflow-y: auto;">${JSON.stringify(d, null, 2)}</pre>
                </details>
            </div>`;
            
            html += `</div>`;
            
            // 弹窗
            const modal = document.createElement('div');
            modal.className = 'fixed-modal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
            modal.innerHTML = `
                <div style="background: white; width: 85%; max-width: 900px; max-height: 85vh; overflow: hidden; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <div style="padding: 20px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
                        <h3 style="margin: 0; font-size: 18px; color: #001529;">📋 项目详情</h3>
                        <button onclick="this.closest('.fixed-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; line-height: 1;">&times;</button>
                    </div>
                    <div style="padding: 24px; overflow-y: auto; flex: 1;">${html}</div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            alert(`查询详情失败: ${data.message || '未知错误'}`);
        }
    } catch(e) {
        alert(`请求异常: ${e.message}`);
    }
}

function loadProjectForUpdate(localAccountId, projectId) {
    document.getElementById('ld-update-local-account-id').value = localAccountId;
    document.getElementById('ld-update-project-id').value = projectId;
    switchLocalDeliveryProjectTab('update');
    alert(`已加载项目 ${projectId} 到更新表单，请填写需要更新的字段后提交。`);
}
// ==================== 辅助数据查询 ====================

async function queryLocalPoiList() {
    const localAccountId = document.getElementById('ld-aux-poi-local-account-id').value.trim();
    const localDeliveryScene = document.getElementById('ld-aux-poi-local-delivery-scene').value;
    const keyword = document.getElementById('ld-aux-poi-keyword').value.trim();
    const resultDiv = document.getElementById('ld-aux-poi-result');
    
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_delivery/poi/get?local_account_id=${localAccountId}&local_delivery_scene=${localDeliveryScene}`;
        if(keyword) url += `&search_key_word=${encodeURIComponent(keyword)}`;
        
        const res = await fetch(url);
        const data = await res.json();
       renderAuxResult(resultDiv, data, 'poi_list', ['poi_id', 'poi_name', 'province', 'city', 'exists_product'], {'poi_id':'门店ID','poi_name':'门店名称','province':'省份','city':'城市','exists_product':'有商品'});
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

async function queryLocalProductList() {
    const localAccountId = document.getElementById('ld-aux-product-local-account-id').value.trim();
    const localDeliveryScene = document.getElementById('ld-aux-product-local-delivery-scene').value;
    const keyword = document.getElementById('ld-aux-product-keyword').value.trim();
    const resultDiv = document.getElementById('ld-aux-product-result');
    
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_delivery/product/get?local_account_id=${localAccountId}&local_delivery_scene=${localDeliveryScene}`;
        if(keyword) url += `&search_key_word=${encodeURIComponent(keyword)}`;
        
        const res = await fetch(url);
        const data = await res.json();
       renderAuxResult(resultDiv, data, 'products', ['product_id', 'product_name', 'price', 'applicable_poi_num'], {'product_id':'商品ID','product_name':'商品名称','price':'价格(分)','applicable_poi_num':'适用门店数'});
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

async function queryLocalAwemeList() {
    const localAccountId = document.getElementById('ld-aux-aweme-local-account-id').value.trim();
    const marketingGoal = document.getElementById('ld-aux-aweme-marketing-goal').value;
    const keyword = document.getElementById('ld-aux-aweme-keyword').value.trim();
    const resultDiv = document.getElementById('ld-aux-aweme-result');
    
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_delivery/aweme/authorized/get?local_account_id=${localAccountId}&marketing_goal=${marketingGoal}`;
        if(keyword) url += `&search_key_word=${encodeURIComponent(keyword)}`;
        
        const res = await fetch(url);
        const data = await res.json();
        renderAuxResult(resultDiv, data, 'aweme_id_list', ['aweme_id', 'aweme_name', 'auth_type', 'can_create_roi2_ad'], {'aweme_id':'抖音号ID','aweme_name':'抖音号名称','auth_type':'授权类型','can_create_roi2_ad':'支持ROI2广告'});
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

async function queryLocalCustomAudience() {
    const localAccountId = document.getElementById('ld-aux-audience-local-account-id').value.trim();
    const tagsType = document.getElementById('ld-aux-audience-tags-type').value;
    const resultDiv = document.getElementById('ld-aux-audience-result');
    
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_delivery/custom_audience/get?local_account_id=${localAccountId}`;
        if(tagsType) url += `&tags_type=${tagsType}`;
        
        const res = await fetch(url);
        const data = await res.json();
        renderAuxResult(resultDiv, data, 'custom_audience_list', ['custom_audience_id', 'name', 'tags_type', 'create_time'], {'custom_audience_id':'人群包ID','name':'人群包名称','tags_type':'人群包类型','create_time':'创建时间'});
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}
function onToolDeliveryGoalChange() {
    const goal = document.getElementById('ld-aux-tool-delivery-goal').value;
    const poiBox = document.getElementById('ld-aux-tool-poi-ids');
    const productBox = document.getElementById('ld-aux-tool-product-ids');
    if(goal === 'POI') {
        poiBox.style.display = 'block';
        productBox.style.display = 'none';
        productBox.value = '';
    } else {
        poiBox.style.display = 'none';
        productBox.style.display = 'block';
        poiBox.value = '';
    }
}
async function queryLocalToolPackList() {
    const localAccountId = document.getElementById('ld-aux-tool-local-account-id').value.trim();
    const deliveryGoal = document.getElementById('ld-aux-tool-delivery-goal').value;
    const intelligentMode = document.getElementById('ld-aux-tool-intelligent-mode').value;
    const poiIds = document.getElementById('ld-aux-tool-poi-ids').value.trim();
    const productIds = document.getElementById('ld-aux-tool-product-ids').value.trim();
    const resultDiv = document.getElementById('ld-aux-tool-result');
    
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    if(!deliveryGoal) { alert('请选择投放内容'); return; }
    if(deliveryGoal === 'POI' && !poiIds) { alert('门店模式下请输入门店ID列表'); return; }
    if(deliveryGoal === 'PRODUCT' && !productIds) { alert('商品模式下请输入商品ID列表'); return; }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_delivery/tool_pack_list/get?local_account_id=${localAccountId}&delivery_goal=${deliveryGoal}&intelligent_selection_mode=${intelligentMode}&page=1&page_size=10`;
        
        // 关键修复：ID 保持字符串，避免 JS 精度丢失
        if(poiIds) {
            const arr = poiIds.split(',').map(x => x.trim()).filter(x => x);
            url += `&poi_ids=${encodeURIComponent(JSON.stringify(arr))}`;
        }
        if(productIds) {
            const arr = productIds.split(',').map(x => x.trim()).filter(x => x);
            if(arr.length > 10) { alert('商品ID最多10个'); return; }
            url += `&product_ids=${encodeURIComponent(JSON.stringify(arr))}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        renderAuxResult(resultDiv, data, 'tool_pack_list', ['tool_pack_id', 'tool_pack_name', 'tool_pack_types', 'enable'], {
            'tool_pack_id':'留资组件ID',
            'tool_pack_name':'留资组件名称',
            'tool_pack_types':'留资方式',
            'enable':'是否可用'
        });
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}
function onPageDeliveryGoalChange() {
    const goal = document.getElementById('ld-aux-page-delivery-goal').value;
    const poiBox = document.getElementById('ld-aux-page-poi-ids');
    const productBox = document.getElementById('ld-aux-page-product-ids');
    if(goal === 'POI') {
        poiBox.style.display = 'block';
        productBox.style.display = 'none';
        productBox.value = '';
    } else {
        poiBox.style.display = 'none';
        productBox.style.display = 'block';
        poiBox.value = '';
    }
}
async function queryLocalMarketPageList() {
    const localAccountId = document.getElementById('ld-aux-page-local-account-id').value.trim();
    const deliveryGoal = document.getElementById('ld-aux-page-delivery-goal').value;
    const poiIds = document.getElementById('ld-aux-page-poi-ids').value.trim();
    const productIds = document.getElementById('ld-aux-page-product-ids').value.trim();
    const resultDiv = document.getElementById('ld-aux-page-result');
    
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    if(!deliveryGoal) { alert('请选择投放内容'); return; }
    if(deliveryGoal === 'POI' && !poiIds) { alert('门店模式下请输入门店ID列表'); return; }
    if(deliveryGoal === 'PRODUCT' && !productIds) { alert('商品模式下请输入商品ID列表'); return; }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_delivery/market_page_list/get?local_account_id=${localAccountId}&delivery_goal=${deliveryGoal}`;
            if(poiIds) {
            const arr = poiIds.split(',').map(x => x.trim()).filter(x => x);
            url += `&poi_ids=${encodeURIComponent(JSON.stringify(arr))}`;
        }
            if(productIds) {
        const arr = productIds.split(',').map(x => x.trim()).filter(x => x);
        url += `&product_ids=${encodeURIComponent(JSON.stringify(arr))}`;
    }
        
        const res = await fetch(url);
        const data = await res.json();
        renderAuxResult(resultDiv, data, 'mark_page_id_list', ['market_page_id', 'market_page_name', 'status', 'cover_image_url'], {'market_page_id':'营销页ID','market_page_name':'营销页名称','status':'状态','cover_image_url':'封面图'});
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

// 通用辅助结果渲染
function renderAuxResult(container, data, listKey, fields, fieldLabels = {}) {
    if(!container) return;
    
    if(data.code === 0 && data.data) {
        const list = data.data[listKey] || [];
        if(list.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无数据</div>';
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
        list.forEach(item => {
            html += `<div style="padding: 10px; background: #fafafa; border-radius: 4px; border-left: 3px solid #1890ff; font-size: 13px;">`;
            fields.forEach(field => {
                let value = item[field];
                if(Array.isArray(value)) value = value.join(', ');
                if(value === true) value = '是';
                if(value === false) value = '否';
                if(value === undefined || value === null) value = '-';
                const label = fieldLabels[field] || field;
                html += `<div><strong>${label}:</strong> ${value}</div>`;
            });
            html += `</div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div style="color: #f5222d;">查询失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
    }
}
// ==================== 本地推单元管理 ====================

let ldPromoCurrentTab = 'list';
let ldPromoCurrentPage = 1;
let ldPromoPageSize = 20;
let ldPromoTotalPage = 1;

// 标签页切换
function switchLocalDeliveryPromotionTab(tab) {
    ldPromoCurrentTab = tab;
    const tabs = ['list', 'create', 'update', 'aux'];
    const btnIds = {
        'list': 'btn-ld-promo-tab-list',
        'create': 'btn-ld-promo-tab-create',
        'update': 'btn-ld-promo-tab-update',
        'aux': 'btn-ld-promo-tab-aux'
    };
    
    tabs.forEach(t => {
        const btn = document.getElementById(btnIds[t]);
        const content = document.getElementById('ld-promo-tab-' + t);
        if(btn) {
            if(t === tab) {
                btn.style.background = '#1890ff';
                btn.style.color = 'white';
                btn.style.border = 'none';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#666';
                btn.style.border = '1px solid #d9d9d9';
            }
        }
        if(content) content.style.display = t === tab ? 'block' : 'none';
    });
}

function initLocalDeliveryPromotionPage() {
    // 初始化可在此扩展
}

// ==================== 单元列表查询 ====================

async function queryLocalPromotionList() {
    const localAccountId = document.getElementById('ld-promo-list-local-account-id').value.trim();
    if(!localAccountId) {
        alert('请输入本地推账户ID');
        return;
    }
    ldPromoCurrentPage = 1;
    await fetchLocalPromotionList(localAccountId);
}

async function fetchLocalPromotionList(localAccountId) {
    const resultDiv = document.getElementById('ld-promo-list-result');
    const paginationDiv = document.getElementById('ld-promo-list-pagination');
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        const promotionName = document.getElementById('ld-promo-list-promotion-name').value.trim();
        const projectId = document.getElementById('ld-promo-list-project-id').value.trim();
        const statusFirst = document.getElementById('ld-promo-list-status-first').value;
        const marketingGoal = document.getElementById('ld-promo-list-marketing-goal').value;
        
        let url = `/api/local_delivery/promotion/list?local_account_id=${localAccountId}&page=${ldPromoCurrentPage}&page_size=${ldPromoPageSize}`;
        
        const filtering = {};
        if(promotionName) filtering.promotion_name = promotionName;
        if(projectId) filtering.project_id = parseInt(projectId);
        if(statusFirst) filtering.promotion_status_first = statusFirst;
        if(marketingGoal) filtering.marketing_goal = marketingGoal;
        
        if(Object.keys(filtering).length > 0) {
            url += `&filtering=${encodeURIComponent(JSON.stringify(filtering))}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.promotion_list || [];
            const pageInfo = data.data.page_info || {};
            ldPromoTotalPage = Math.ceil((pageInfo.total_number || 0) / ldPromoPageSize) || 1;
            
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无单元数据</div>';
                if(paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            
            let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
            html += '<th style="padding: 10px; text-align: left;"><input type="checkbox" id="ld-promo-select-all" onclick="toggleSelectAllPromotions()" style="cursor: pointer;"></th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">单元ID</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">单元名称</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">项目ID</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">营销场景</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">状态</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">学习期</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">操作</th>';
            html += '</tr></thead><tbody>';
            
            const statusMap = {
                'PROMOTION_STATUS_ENABLE': {text: '投放中', color: '#52c41a'},
                'PROMOTION_STATUS_DISABLE': {text: '未投放', color: '#faad14'},
                'PROMOTION_STATUS_DONE': {text: '已完成', color: '#1890ff'},
                'PROMOTION_STATUS_DELETED': {text: '已删除', color: '#f5222d'},
                'PROMOTION_STATUS_FROZEN': {text: '已终止', color: '#999'}
            };
            const goalMap = {'LIVE': '直播', 'VIDEO_IMAGE': '短视频/图文'};
            const learningMap = {'LEARNED': '学习期结束', 'LEARNING': '学习中', 'LEARN_FAILED': '学习失败'};
            
            list.forEach(item => {
                const promotionId = item.promotion_id || '-';
                const projectId = item.project_id || '-';
                const st = statusMap[item.promotion_status_first] || {text: item.promotion_status_first || '-', color: '#666'};
                
                html += `<tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 10px;"><input type="checkbox" class="ld-promo-checkbox" value="${promotionId}" style="cursor: pointer;"></td>
                    <td style="padding: 10px; font-family: monospace; font-size: 12px;">${promotionId}</td>
                    <td style="padding: 10px;">${item.promotion_name || '-'}</td>
                    <td style="padding: 10px; font-family: monospace; font-size: 12px;">${projectId}</td>
                    <td style="padding: 10px;">${goalMap[item.marketing_goal] || item.marketing_goal || '-'}</td>
                    <td style="padding: 10px;"><span style="color: ${st.color}; font-weight: 500;">${st.text}</span></td>
                    <td style="padding: 10px;">${learningMap[item.learning_phase] || item.learning_phase || '-'}</td>
                    <td style="padding: 10px;">
                        <button onclick="viewPromotionDetail('${localAccountId}', '${promotionId}')" style="padding: 4px 10px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">详情</button>
                        <button onclick="loadPromotionForUpdate('${localAccountId}', '${promotionId}')" style="padding: 4px 10px; background: #52c41a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">编辑</button>
                    </td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            
            // 批量操作栏
            html += `<div style="margin-top: 15px; padding: 10px; background: #fafafa; border-radius: 4px; display: flex; gap: 10px; align-items: center;">
                <span style="font-size: 13px; color: #666;">批量操作：</span>
                <button onclick="batchUpdatePromotionStatus('ENABLE')" style="padding: 6px 12px; background: #52c41a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">启用</button>
                <button onclick="batchUpdatePromotionStatus('PAUSED')" style="padding: 6px 12px; background: #faad14; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">暂停</button>
            </div>`;
            
            if(resultDiv) resultDiv.innerHTML = html;
            
            if(paginationDiv) paginationDiv.style.display = 'flex';
            const pageInfoSpan = document.getElementById('ld-promo-page-info');
            const btnPrev = document.getElementById('btn-ld-promo-prev');
            const btnNext = document.getElementById('btn-ld-promo-next');
            if(pageInfoSpan) pageInfoSpan.textContent = `第 ${ldPromoCurrentPage} 页 / 共 ${ldPromoTotalPage} 页`;
            if(btnPrev) btnPrev.disabled = ldPromoCurrentPage <= 1;
            if(btnNext) btnNext.disabled = ldPromoCurrentPage >= ldPromoTotalPage;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
            if(paginationDiv) paginationDiv.style.display = 'none';
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
        if(paginationDiv) paginationDiv.style.display = 'none';
    }
}

function changeLocalPromotionPage(delta) {
    const localAccountId = document.getElementById('ld-promo-list-local-account-id').value.trim();
    if(!localAccountId) return;
    ldPromoCurrentPage += delta;
    if(ldPromoCurrentPage < 1) ldPromoCurrentPage = 1;
    fetchLocalPromotionList(localAccountId);
}

function toggleSelectAllPromotions() {
    const allCb = document.getElementById('ld-promo-select-all');
    const cbs = document.querySelectorAll('.ld-promo-checkbox');
    cbs.forEach(cb => cb.checked = allCb.checked);
}

function getSelectedPromotionIds() {
    return Array.from(document.querySelectorAll('.ld-promo-checkbox:checked')).map(cb => cb.value);
}

async function batchUpdatePromotionStatus(status) {
    const ids = getSelectedPromotionIds();
    if(ids.length === 0) {
        alert('请至少选择一个单元');
        return;
    }
    if(ids.length > 50) {
        alert('批量操作最多50个单元');
        return;
    }
    
    const localAccountId = document.getElementById('ld-promo-list-local-account-id').value.trim();
    if(!localAccountId) {
        alert('请输入本地推账户ID');
        return;
    }
    
    if(!confirm(`确定要${status === 'ENABLE' ? '启用' : '暂停'}选中的 ${ids.length} 个单元吗？`)) return;
    
    try {
        const res = await fetch('/api/local_delivery/promotion/status/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                local_account_id: parseInt(localAccountId),
                data: ids.map(id => ({promotion_id: parseInt(id), opt_status: status}))
            })
        });
        const data = await res.json();
        
        if(data.code === 0) {
            alert(`✅ 批量${status === 'ENABLE' ? '启用' : '暂停'}成功！`);
            fetchLocalPromotionList(localAccountId);
        } else {
            alert(`❌ 批量操作失败: ${data.message || '未知错误'}`);
        }
    } catch(e) {
        alert(`请求异常: ${e.message}`);
    }
}

// ==================== 单元详情弹窗 ====================

async function viewPromotionDetail(localAccountId, promotionId) {
    try {
        const res = await fetch(`/api/local_delivery/promotion/detail?local_account_id=${localAccountId}&promotion_id=${promotionId}`);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const d = data.data;
            
            let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">`;
            
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0;">
                <div>
                    <div style="font-size: 20px; font-weight: 600; color: #001529; margin-bottom: 6px;">${d.name || '未命名单元'}</div>
                    <div style="font-size: 13px; color: #999; font-family: monospace;">ID: ${d.promotion_id || '-'}</div>
                </div>
            </div>`;
            
            const section = (title, color, items) => {
                let validItems = items.filter(i => i.value && i.value !== '-' && i.value !== 'undefined');
                if(validItems.length === 0) return '';
                let s = `<div style="margin-bottom: 20px;">
                    <div style="font-size: 15px; font-weight: 600; color: #001529; margin-bottom: 12px; padding-left: 10px; border-left: 4px solid ${color};">${title}</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; background: #fafafa; padding: 16px; border-radius: 8px;">`;
                validItems.forEach(item => {
                    s += `<div>
                        <div style="font-size: 12px; color: #999; margin-bottom: 4px;">${item.label}</div>
                        <div style="font-size: 14px; color: #333; font-weight: 500; word-break: break-all;">${item.value}</div>
                    </div>`;
                });
                s += `</div></div>`;
                return s;
            };
            
            const goalMap = {'LIVE': '直播', 'VIDEO_IMAGE': '短视频/图文'};
            const visibilityMap = {'ALWAYS_VISIBLE': '主页始终可见', 'HIDE_VIDEO_ON_HP': '仅单次展示可见'};
            const liveTypeMap = {'LIVE': '直播间画面', 'VIDEO': '短视频'};
            
            html += section('📋 基本信息', '#1890ff', [
                {label: '项目ID', value: d.project_id},
                {label: '抖音号', value: d.aweme_id},
                {label: '抖音号昵称', value: d.aweme_name},
                {label: '是否开启团购卡', value: d.enable_graphic_delivery === true ? '是' : (d.enable_graphic_delivery === false ? '否' : '-')},
                {label: '主页视频可见性', value: visibilityMap[d.video_hp_visibility] || d.video_hp_visibility},
                {label: '直播素材类型', value: liveTypeMap[d.live_material_type] || d.live_material_type},
            ]);
            
            // 素材信息
            if(d.customer_material_list && d.customer_material_list.length > 0) {
                html += `<div style="margin-bottom: 20px;">
                    <div style="font-size: 15px; font-weight: 600; color: #001529; margin-bottom: 12px; padding-left: 10px; border-left: 4px solid #52c41a;">🎬 视频素材</div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">`;
                d.customer_material_list.forEach((mat, idx) => {
                    html += `<div style="background: #fafafa; padding: 12px; border-radius: 8px; font-size: 13px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">素材 ${idx + 1}</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                            <div><strong>素材类型：</strong>${mat.image_mode || '-'}</div>
                            <div><strong>视频ID：</strong>${mat.video_material?.video_id || '-'}</div>
                            <div><strong>抖音视频ID：</strong>${mat.video_material?.aweme_item_id || '-'}</div>
                            <div><strong>标题：</strong>${mat.title_material?.title || '-'}</div>
                        </div>
                    </div>`;
                });
                html += `</div></div>`;
            }
            
            // 线索素材
            if(d.procedural_material) {
                const pm = d.procedural_material;
                html += section('📞 线索素材', '#eb2f96', [
                    {label: '标题素材数', value: pm.title_material_list ? pm.title_material_list.length + '个' : '-'},
                    {label: '视频素材数', value: pm.video_material_list ? pm.video_material_list.length + '个' : '-'},
                ]);
            }
            
            // 投放卡片
            if(d.promotion_card_info) {
                const card = d.promotion_card_info;
                html += section('💳 投放卡片', '#faad14', [
                    {label: '卡片标题', value: card.product_name},
                    {label: '卖点数', value: card.product_selling_points ? card.product_selling_points.length + '个' : '-'},
                    {label: '行动号召数', value: card.call_to_actions ? card.call_to_actions.length + '个' : '-'},
                    {label: '智能生成号召', value: card.enable_personal_call_to_action === true ? '开启' : (card.enable_personal_call_to_action === false ? '关闭' : '-')},
                ]);
            }
            
            // 原始JSON
            html += `<div style="margin-top: 10px;">
                <details style="background: #fafafa; border-radius: 8px; border: 1px solid #f0f0f0;">
                    <summary style="padding: 12px 16px; cursor: pointer; font-size: 13px; color: #666; font-weight: 500; user-select: none;">📄 查看原始JSON数据（调试用）</summary>
                    <pre style="margin: 0; padding: 16px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #333; background: white; border-top: 1px solid #f0f0f0; max-height: 350px; overflow-y: auto;">${JSON.stringify(d, null, 2)}</pre>
                </details>
            </div>`;
            
            html += `</div>`;
            
            const modal = document.createElement('div');
            modal.className = 'fixed-modal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
            modal.innerHTML = `
                <div style="background: white; width: 85%; max-width: 900px; max-height: 85vh; overflow: hidden; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <div style="padding: 20px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
                        <h3 style="margin: 0; font-size: 18px; color: #001529;">📋 单元详情</h3>
                        <button onclick="this.closest('.fixed-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; line-height: 1;">&times;</button>
                    </div>
                    <div style="padding: 24px; overflow-y: auto; flex: 1;">${html}</div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            alert(`查询详情失败: ${data.message || '未知错误'}`);
        }
    } catch(e) {
        alert(`请求异常: ${e.message}`);
    }
}

function loadPromotionForUpdate(localAccountId, promotionId) {
    document.getElementById('ld-promo-update-local-account-id').value = localAccountId;
    document.getElementById('ld-promo-update-promotion-id').value = promotionId;
    switchLocalDeliveryPromotionTab('update');
    alert(`已加载单元 ${promotionId} 到更新表单，请填写需要更新的字段后提交。`);
}

// ==================== 创建单元 ====================

function resetPromotionCreateForm() {
    document.getElementById('ld-promo-create-local-account-id').value = '';
    document.getElementById('ld-promo-create-project-id').value = '';
    document.getElementById('ld-promo-create-name').value = '';
    document.getElementById('ld-promo-create-aweme-id').value = '';
    document.getElementById('ld-promo-create-enable-graphic').value = '';
    document.getElementById('ld-promo-create-video-hp-visibility').value = '';
    document.getElementById('ld-promo-create-live-material-type').value = '';
    document.getElementById('ld-promo-create-image-mode').value = 'IMAGE_MODE_VIDEO_VERTICAL';
    document.getElementById('ld-promo-create-video-title').value = '';
    document.getElementById('ld-promo-create-video-id').value = '';
    document.getElementById('ld-promo-create-aweme-item-id').value = '';
    document.getElementById('ld-promo-create-cover-uri').value = '';
    document.getElementById('ld-promo-create-lead-title').value = '';
    document.getElementById('ld-promo-create-lead-video-id').value = '';
    document.getElementById('ld-promo-create-lead-video-mode').value = 'IMAGE_MODE_VIDEO_VERTICAL';
    document.getElementById('ld-promo-create-card-title').value = '';
    document.getElementById('ld-promo-create-card-image').value = '';
    document.getElementById('ld-promo-create-card-selling').value = '';
    document.getElementById('ld-promo-create-card-action').value = '';
    document.getElementById('ld-promo-create-card-smart-action').value = 'false';
    document.getElementById('ld-promo-create-result').innerHTML = '';
}

async function createLocalPromotion() {
    const localAccountId = document.getElementById('ld-promo-create-local-account-id').value.trim();
    const projectId = document.getElementById('ld-promo-create-project-id').value.trim();
    const name = document.getElementById('ld-promo-create-name').value.trim();
    
    if(!localAccountId || !projectId || !name) {
        alert('请填写核心必填信息（本地推账户ID、项目ID、单元名称）');
        return;
    }
    
    const payload = {
        local_account_id: parseInt(localAccountId),
        project_id: parseInt(projectId),
        name: name
    };
    
    const awemeId = document.getElementById('ld-promo-create-aweme-id').value.trim();
    if(awemeId) payload.aweme_id = awemeId;
    
    const enableGraphic = document.getElementById('ld-promo-create-enable-graphic').value;
    if(enableGraphic) payload.enable_graphic_delivery = enableGraphic === 'true';
    
    const videoHp = document.getElementById('ld-promo-create-video-hp-visibility').value;
    if(videoHp) payload.video_hp_visibility = videoHp;
    
    const liveType = document.getElementById('ld-promo-create-live-material-type').value;
    if(liveType) payload.live_material_type = liveType;
    
        // 视频素材
    const imageMode = document.getElementById('ld-promo-create-image-mode').value;
    const videoTitle = document.getElementById('ld-promo-create-video-title').value.trim();
    const videoId = document.getElementById('ld-promo-create-video-id').value.trim();
    const awemeItemId = document.getElementById('ld-promo-create-aweme-item-id').value.trim();
    const coverUri = document.getElementById('ld-promo-create-cover-uri').value.trim();
    
    if(videoId || videoTitle) {
        const material = {
            image_mode: imageMode,
            title_material: { title: videoTitle },
            video_material: { video_id: videoId }
        };
        if(awemeItemId) material.video_material.aweme_item_id = parseInt(awemeItemId);
        if(coverUri) material.video_material.cover_web_uri = coverUri;
        payload.customer_material_list = [material];
    }
    
    // 线索素材
    const leadTitle = document.getElementById('ld-promo-create-lead-title').value.trim();
    const leadVideoId = document.getElementById('ld-promo-create-lead-video-id').value.trim();
    const leadVideoMode = document.getElementById('ld-promo-create-lead-video-mode').value;
    
    if(leadTitle || leadVideoId) {
        const pm = {};
        if(leadTitle) pm.title_material_list = [{title: leadTitle}];
        if(leadVideoId) pm.video_material_list = [{image_mode: leadVideoMode, video_id: leadVideoId}];
        payload.procedural_material = pm;
    }
    
    // 投放卡片
    const cardTitle = document.getElementById('ld-promo-create-card-title').value.trim();
    const cardImage = document.getElementById('ld-promo-create-card-image').value.trim();
    const cardSelling = document.getElementById('ld-promo-create-card-selling').value.trim();
    const cardAction = document.getElementById('ld-promo-create-card-action').value.trim();
    const cardSmart = document.getElementById('ld-promo-create-card-smart-action').value;
    
    if(cardTitle || cardImage || cardSelling || cardAction) {
        const card = {};
        if(cardTitle) card.product_name = cardTitle;
        if(cardImage) card.product_images = [{image_uri: cardImage}];
        if(cardSelling) {
            card.product_selling_points = cardSelling.split(',').map(s => ({selling_point: s.trim()})).filter(s => s.selling_point);
        }
        if(cardAction) {
            card.call_to_actions = [{action: cardAction}];
        }
        if(cardSmart) card.enable_personal_call_to_action = cardSmart === 'true';
        payload.promotion_card_info = card;
    }
    
    const resultDiv = document.getElementById('ld-promo-create-result');
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">创建中...</div>';
    
    try {
        const res = await fetch('/api/local_delivery/promotion/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if(data.code === 0) {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 4px; color: #389e0d;">
                    ✅ 单元创建成功！单元ID: <strong>${data.data?.promotion_id || '-'}</strong>
                </div>`;
            }
        } else {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 15px; border-radius: 4px; color: #cf1322;">
                    ❌ 创建失败: ${data.message || '未知错误'} (code: ${data.code})
                </div>`;
            }
        }
    } catch(e) {
        if(resultDiv) {
            resultDiv.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 15px; border-radius: 4px; color: #cf1322;">
                请求异常: ${e.message}
            </div>`;
        }
    }
}

// ==================== 更新单元 ====================

    // 视频素材（全量更新，只要有值就覆盖）
    const updateImageMode = document.getElementById('ld-promo-update-image-mode').value;
    const updateVideoTitle = document.getElementById('ld-promo-update-video-title').value.trim();
    const updateVideoId = document.getElementById('ld-promo-update-video-id').value.trim();
    const updateAwemeItemId = document.getElementById('ld-promo-update-aweme-item-id').value.trim();
    const updateCoverUri = document.getElementById('ld-promo-update-cover-uri').value.trim();
    
    if(updateImageMode || updateVideoTitle || updateVideoId || updateAwemeItemId || updateCoverUri) {
        const material = {};
        if(updateImageMode) material.image_mode = updateImageMode;
        if(updateVideoTitle) material.title_material = { title: updateVideoTitle };
        if(updateVideoId || updateAwemeItemId || updateCoverUri) {
            material.video_material = {};
            if(updateVideoId) material.video_material.video_id = updateVideoId;
            if(updateAwemeItemId) material.video_material.aweme_item_id = parseInt(updateAwemeItemId);
            if(updateCoverUri) material.video_material.cover_web_uri = updateCoverUri;
        }
        payload.customer_material_list = [material];
    }
    
    // 线索素材
    const updateLeadTitle = document.getElementById('ld-promo-update-lead-title').value.trim();
    const updateLeadVideoId = document.getElementById('ld-promo-update-lead-video-id').value.trim();
    const updateLeadVideoMode = document.getElementById('ld-promo-update-lead-video-mode').value;
    
    if(updateLeadTitle || updateLeadVideoId) {
        const pm = {};
        if(updateLeadTitle) pm.title_material_list = [{title: updateLeadTitle}];
        if(updateLeadVideoId) pm.video_material_list = [{image_mode: updateLeadVideoMode || 'IMAGE_MODE_VIDEO_VERTICAL', video_id: updateLeadVideoId}];
        payload.procedural_material = pm;
    }
    
    // 投放卡片
    const updateCardTitle = document.getElementById('ld-promo-update-card-title').value.trim();
    const updateCardImage = document.getElementById('ld-promo-update-card-image').value.trim();
    const updateCardSelling = document.getElementById('ld-promo-update-card-selling').value.trim();
    const updateCardAction = document.getElementById('ld-promo-update-card-action').value.trim();
    const updateCardSmart = document.getElementById('ld-promo-update-card-smart-action').value;
    
    if(updateCardTitle || updateCardImage || updateCardSelling || updateCardAction || updateCardSmart) {
        const card = {};
        if(updateCardTitle) card.product_name = updateCardTitle;
        if(updateCardImage) card.product_images = [{image_uri: updateCardImage}];
        if(updateCardSelling) {
            card.product_selling_points = updateCardSelling.split(',').map(s => ({selling_point: s.trim()})).filter(s => s.selling_point);
        }
        if(updateCardAction) {
            card.call_to_actions = [{action: updateCardAction}];
        }
        if(updateCardSmart) card.enable_personal_call_to_action = updateCardSmart === 'true';
        payload.promotion_card_info = card;
    }
// ==================== 辅助数据查询 ====================

async function queryLocalPromotionRejectReason() {
    const localAccountId = document.getElementById('ld-promo-aux-local-account-id').value.trim();
    const promotionIds = document.getElementById('ld-promo-aux-promotion-ids').value.trim();
    const resultDiv = document.getElementById('ld-promo-aux-reject-result');
    
    if(!localAccountId || !promotionIds) {
        alert('请输入本地推账户ID和单元ID列表');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        const res = await fetch(`/api/local_delivery/promotion/reject_reason/get?local_account_id=${localAccountId}&promotion_ids=${encodeURIComponent(promotionIds)}`);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.list || [];
            if(list.length === 0) {
                resultDiv.innerHTML = '<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 4px; color: #389e0d;">✅ 查询成功，暂无审核建议</div>';
                return;
            }
            
            // 映射表
            const auditPlatformMap = { 'AD': '广告审核', 'CONTENT': '内容审核' };
            const rejectTypeMap = {
                'ADVANCED_CREATIVE_TYPE': '附加创意', 'AD_REJECT': '营销', 'ANCHOR': '私信锚点',
                'ARTICLE_URL': '文章链接', 'AUDIT_MAIN_PRODUCT_REFUSE': '组合购商品',
                'AUDIT_SUB_PRODUCT_REFUSE': '子商品', 'AUDIT_TYPE_POI_REFUSE': '落地页-门店信息',
                'AUDIT_TYPE_PRODUCT_REFUSE': '落地页-商品信息', 'AUDIT_TYPE_PROMOTION_REFUSE': '营销页',
                'AWEME_AVATAR': '抖音头像', 'AWEME_NICK_NAME': '抖音昵称', 'AWEME_VIDEO': '抖音视频标题',
                'BUTTON_TEXT': '按钮文本', 'CDP_CALL_TO_ACTION': '行动号召', 'CDP_CREATIVE_URL': '创意详情页',
                'CDP_PRODUCT_DESCRIBE': '卡片标题', 'CDP_PRODUCT_IMAGE': '卡片配图',
                'CDP_PRODUCT_SELLING_POINTS': '投放卖点', 'CLUE_SUB_TITLE': '线索信息-线索副标题',
                'CREATIVE': '创意', 'EXTERNAL_URL': '落地页', 'GRASS_PLANTING_SEARCH': '种草搜索词',
                'HEAD_PICTURE': '投放账户头像', 'HIGHLIGHT': '线索信息-服务亮点', 'IMAGE': '图片',
                'IMAGE_TEXT': '图文', 'LABEL_SUMMARY': '标签摘要', 'MERCHANT_CASE': '线索信息-商家案例',
                'MERCHANT_INTRO': '线索信息-商家介绍', 'MICRO_APP_INFO': '小程序', 'PHONE_NUMBER': '电话拨打',
                'PRODUCT_DESCRIBE': '卡片标题', 'PRODUCT_IMAGE': '卡片主图',
                'PRODUCT_SELLING_POINTS': '投放卖点', 'PROMOTION_CARD': '投放卡片',
                'QUALIFICATION': '资质不通过', 'SUB_TITLE': '副标题', 'TEXT_SUMMARY': '文本摘要',
                'TITLE': '标题', 'TOOL_PACK': '留资组件', 'UNKNOWN': '未知类型', 'VIDEO': '视频',
                'WITHOUT_SUBJECT': '无主体'
            };
            
            let html = '';
            list.forEach(item => {
                const promotionId = item.promotion_id || '-';
                const rejects = item.material_reject || [];
                
                html += `<div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">`;
                html += `<div style="font-weight: 600; font-size: 14px; color: #001529; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;">
                    📌 单元ID: <span style="font-family: monospace; color: #1890ff;">${promotionId}</span>
                </div>`;
                
                if(rejects.length === 0) {
                    html += `<div style="color: #52c41a; font-size: 13px;">✅ 该单元暂无审核拒绝建议</div>`;
                } else {
                    rejects.forEach((reject, idx) => {
                        const platform = auditPlatformMap[reject.audit_platform] || reject.audit_platform || '-';
                        const type = rejectTypeMap[reject.type] || reject.type || '-';
                        const content = reject.content || '-';
                        const reasons = reject.reject_reason || [];
                        const suggestions = reject.suggestion || [];
                        
                        html += `<div style="background: #fff2f0; border: 1px solid #ffccc7; border-radius: 6px; padding: 12px; margin-bottom: 10px;">`;
                        html += `<div style="display: flex; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">`;
                        html += `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #fff7e6; color: #d46b08; border: 1px solid #ffd591;">来源: ${platform}</span>`;
                        html += `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f;">类型: ${type}</span>`;
                        html += `</div>`;
                        
                        html += `<div style="margin-bottom: 8px;"><span style="color: #cf1322; font-weight: 500;">拒绝内容:</span> <span style="color: #333; font-size: 13px;">${content}</span></div>`;
                        
                        if(reasons.length > 0) {
                            html += `<div style="margin-bottom: 6px;"><span style="color: #999; font-size: 12px;">拒绝理由:</span> <span style="color: #cf1322; font-size: 13px;">${reasons.join('、')}</span></div>`;
                        }
                        if(suggestions.length > 0) {
                            html += `<div><span style="color: #999; font-size: 12px;">审核建议:</span> <span style="color: #1890ff; font-size: 13px;">${suggestions.join('、')}</span></div>`;
                        }
                        
                        // 视频素材
                        if(reject.video_material) {
                            const vm = reject.video_material;
                            html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ffccc7; font-size: 12px; color: #666;">
                                🎬 视频素材: ${vm.video_id || '-'} ${vm.video_url ? `<a href="${vm.video_url}" target="_blank" style="color: #1890ff;">查看</a>` : ''}
                            </div>`;
                        }
                        // 图片素材
                        if(reject.image_material && reject.image_material.length > 0) {
                            html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ffccc7; font-size: 12px; color: #666;">
                                🖼️ 图片素材: ${reject.image_material.length}张
                            </div>`;
                        }
                        
                        html += `</div>`;
                    });
                }
                html += `</div>`;
            });
            
            resultDiv.innerHTML = html;
        } else {
            resultDiv.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 12px; border-radius: 4px; color: #cf1322;">查询失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

async function queryProductByPoiIds() {
    const localAccountId = document.getElementById('ld-promo-aux-poi-local-account-id').value.trim();
    const poiIds = document.getElementById('ld-promo-aux-poi-ids').value.trim();
    const scene = document.getElementById('ld-promo-aux-poi-scene').value;
    const resultDiv = document.getElementById('ld-promo-aux-poi-result');
    
    if(!localAccountId || !poiIds) {
        alert('请输入本地推账户ID和门店ID列表');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_delivery/product/get_by_poiids?local_account_id=${localAccountId}&poi_ids=${encodeURIComponent(poiIds)}`;
        if(scene) url += `&local_delivery_scene=${scene}`;
        
        const res = await fetch(url);
        const data = await res.json();
        renderPromotionAuxResult(resultDiv, data, '商品列表');
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #f5222d;">请求异常: ${e.message}</div>`;
    }
}

function renderPromotionAuxResult(container, data, title) {
    if(!container) return;
    
    if(data.code === 0 && data.data) {
        let html = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 12px; border-radius: 4px; margin-bottom: 15px; color: #389e0d; font-size: 13px;">✅ ${title}查询成功</div>`;
        html += `<div style="background: #fafafa; border-radius: 8px; padding: 20px; border: 1px solid #f0f0f0;"><pre style="margin: 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #333;">${JSON.stringify(data.data, null, 2)}</pre></div>`;
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div style="background: #fff2f0; border: 1px solid #ffccc7; padding: 12px; border-radius: 4px; color: #cf1322;">${title}查询失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
    }
}
// ==================== 本地推素材管理 ====================

let lmCurrentTab = 'video';
let lmVideoPage = 1;
let lmImagePage = 1;
let lmVideoMode = 'library'; // 'library' 或 'aweme'

function switchLocalMaterialTab(tab) {
    lmCurrentTab = tab;
    const tabs = ['video', 'image'];
    const btnIds = {'video': 'btn-lm-tab-video', 'image': 'btn-lm-tab-image'};
    
    tabs.forEach(t => {
        const btn = document.getElementById(btnIds[t]);
        const content = document.getElementById('lm-tab-' + t);
        if(btn) {
            if(t === tab) {
                btn.style.background = '#1890ff';
                btn.style.color = 'white';
                btn.style.border = 'none';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#666';
                btn.style.border = '1px solid #d9d9d9';
            }
        }
        if(content) content.style.display = t === tab ? 'block' : 'none';
    });
}

function onAwemeAnchorTypeChange() {
    const type = document.getElementById('lm-aweme-anchor-types').value;
    document.getElementById('lm-aweme-poi-ids-group').style.display = (type === 'POI_ANCHOR') ? 'block' : 'none';
    document.getElementById('lm-aweme-product-ids-group').style.display = (type === 'PRODUCT_ANCHOR') ? 'block' : 'none';
    // 抖音号ID列表始终显示，不再动态隐藏
}

// ---------- 素材库视频查询 ----------
async function queryLocalMaterialVideoLibrary() {
    const localAccountId = document.getElementById('lm-video-local-account-id').value.trim();
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    
    lmVideoMode = 'library';
    lmVideoPage = 1;
    await fetchLocalMaterialVideo(localAccountId);
}

async function fetchLocalMaterialVideo(localAccountId) {
    const resultDiv = document.getElementById('lm-video-result');
    const paginationDiv = document.getElementById('lm-video-pagination');
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_material/video/get?local_account_id=${localAccountId}&page=${lmVideoPage}&page_size=20`;
        
        const keyword = document.getElementById('lm-video-keyword').value.trim();
        if(keyword) url += `&search_key_word=${encodeURIComponent(keyword)}`;
        
        const imageMode = document.getElementById('lm-video-image-mode').value;
        if(imageMode) url += `&image_mode=${encodeURIComponent(JSON.stringify([imageMode]))}`;
        
        const materialSource = document.getElementById('lm-video-material-source').value;
        if(materialSource) url += `&material_source=${encodeURIComponent(JSON.stringify([materialSource]))}`;
        
        const analysisType = document.getElementById('lm-video-analysis-type').value;
        if(analysisType) url += `&analysis_type=${encodeURIComponent(JSON.stringify([analysisType]))}`;
        
        const startTime = document.getElementById('lm-video-start-time').value;
        if(startTime) url += `&start_time=${startTime}`;
        
        const endTime = document.getElementById('lm-video-end-time').value;
        if(endTime) url += `&end_time=${endTime}`;
        
        const filterUnqualified = document.getElementById('lm-video-filter-unqualified').value;
        url += `&is_filter_unqualified=${filterUnqualified}`;
        
        const orderField = document.getElementById('lm-video-order-field').value;
        if(orderField) url += `&order_field=${orderField}`;
        
        const orderType = document.getElementById('lm-video-order-type').value;
        if(orderType) url += `&order_type=${orderType}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.video_list || [];
            const pageInfo = data.data.page_info || {};
            const totalPage = Math.ceil((pageInfo.total_number || 0) / 20) || 1;
            
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无素材库视频数据</div>';
                if(paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            
            let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">视频ID</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">素材ID</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">视频名称</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">类型</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">来源</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">时长</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">标签</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">创建时间</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">操作</th>';
            html += '</tr></thead><tbody>';
            
            const sourceMap = {'BP_PLATFORM':'工作平台','CREATIVE_AIGC':'即创','LOCAL_ADS_UPLOAD':'本地上传','STAR':'星图','MAPI':'MAPI'};
            const typeMap = {'IMAGE_MODE_VIDEO':'横版','IMAGE_MODE_VIDEO_VERTICAL':'竖版'};
            const tagMap = {'COPY':'搬运风险','FIRST_PUBLISH':'首发','HIGH_QUALITY':'优质','LOW_QUALITY':'低质','SIMILAR':'同质化'};
            
            list.forEach(item => {
                const tags = (item.material_properties || []).map(t => tagMap[t] || t).join(', ');
                html += `<tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 10px; font-family: monospace; font-size: 12px;">${item.video_id || '-'}</td>
                    <td style="padding: 10px; font-family: monospace; font-size: 12px;">${item.material_id || '-'}</td>
                    <td style="padding: 10px;">${item.video_name || '-'}</td>
                    <td style="padding: 10px;">${typeMap[item.image_mode] || item.image_mode || '-'}</td>
                    <td style="padding: 10px;">${sourceMap[item.source] || item.source || '-'}</td>
                    <td style="padding: 10px;">${item.duration ? item.duration + 's' : '-'}</td>
                    <td style="padding: 10px; font-size: 12px;">${tags || '-'}</td>
                    <td style="padding: 10px; font-size: 12px;">${item.create_time || '-'}</td>
                    <td style="padding: 10px;">
                        ${item.video_url ? `<a href="${item.video_url}" target="_blank" style="color: #1890ff; font-size: 12px;">预览</a>` : '-'}
                    </td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            if(resultDiv) resultDiv.innerHTML = html;
            
            if(paginationDiv) paginationDiv.style.display = 'flex';
            const pageInfoSpan = document.getElementById('lm-video-page-info');
            const btnPrev = document.getElementById('btn-lm-video-prev');
            const btnNext = document.getElementById('btn-lm-video-next');
            if(pageInfoSpan) pageInfoSpan.textContent = `第 ${lmVideoPage} 页 / 共 ${totalPage} 页`;
            if(btnPrev) btnPrev.disabled = lmVideoPage <= 1;
            if(btnNext) btnNext.disabled = lmVideoPage >= totalPage;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
            if(paginationDiv) paginationDiv.style.display = 'none';
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
        if(paginationDiv) paginationDiv.style.display = 'none';
    }
}

function changeLocalMaterialVideoPage(delta) {
    const localAccountId = document.getElementById('lm-video-local-account-id').value.trim();
    if(!localAccountId) return;
    lmVideoPage += delta;
    if(lmVideoPage < 1) lmVideoPage = 1;
    if(lmVideoMode === 'library') {
        fetchLocalMaterialVideo(localAccountId);
    } else {
        fetchLocalMaterialAwemeVideo(localAccountId);
    }
}

// ---------- 抖音主页视频查询 ----------
async function queryLocalMaterialAwemeVideo() {
    const localAccountId = document.getElementById('lm-video-local-account-id').value.trim();
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    
    lmVideoMode = 'aweme';
    lmVideoPage = 1;
    
    // 显示抖音专属筛选面板
    const panel = document.getElementById('lm-aweme-filter-panel');
    if(panel) panel.style.display = 'block';
    
    await fetchLocalMaterialAwemeVideo(localAccountId);
}

async function fetchLocalMaterialAwemeVideo(localAccountId) {
    const resultDiv = document.getElementById('lm-video-result');
    const paginationDiv = document.getElementById('lm-video-pagination');
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        // ===== 前端必填校验 =====
        const anchorTypes = document.getElementById('lm-aweme-anchor-types').value;
        const awemeIds = document.getElementById('lm-aweme-aweme-ids').value.trim();
        const productIds = document.getElementById('lm-aweme-product-ids').value.trim();
        const poiIds = document.getElementById('lm-aweme-poi-ids').value.trim();
        
        if (anchorTypes === 'ALL_ANCHOR' && !awemeIds) {
            if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #f5222d;">查询全部锚点类型时，必须填写抖音号ID列表</div>';
            return;
        }
        if (anchorTypes === 'PRODUCT_ANCHOR' && !productIds) {
            if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #f5222d;">查询商品锚点类型时，必须填写商品ID列表</div>';
            return;
        }
        if (anchorTypes === 'POI_ANCHOR' && !poiIds) {
            if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #f5222d;">查询门店锚点类型时，必须填写门店ID列表</div>';
            return;
        }
        // ===== 校验结束 =====

        let url = `/api/local_material/video/aweme/get?local_account_id=${localAccountId}&page_size=10&cursor=0`;
        
        if(anchorTypes) url += `&anchor_types=${encodeURIComponent(anchorTypes)}`;
        
        if(poiIds && anchorTypes === 'POI_ANCHOR') url += `&poi_ids=${encodeURIComponent(JSON.stringify(poiIds.split(',')))}`;
        
        if(productIds && anchorTypes === 'PRODUCT_ANCHOR') url += `&product_ids=${encodeURIComponent(JSON.stringify(productIds.split(',')))}`;
        
        if(awemeIds && anchorTypes === 'ALL_ANCHOR') url += `&aweme_ids=${encodeURIComponent(JSON.stringify(awemeIds.split(',')))}`;
        
        const itemStatus = document.getElementById('lm-aweme-item-status').value;
        url += `&item_status=${itemStatus}`;
        
        const orderField = document.getElementById('lm-aweme-order-field').value;
        if(orderField) url += `&order_filed=${orderField}`;
        
        const externalAction = document.getElementById('lm-aweme-external-action').value;
        if(externalAction) url += `&external_action=${externalAction}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.video_list || [];
            
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无抖音主页视频数据</div>';
                if(paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            
            let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #fafafa; border-bottom: 2px solid #f0f0f0;">';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">视频ID</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">标题</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">抖音号</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">类型</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">时长</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">可投放</th>';
            html += '<th style="padding: 10px; text-align: left; font-weight: 600;">操作</th>';
            html += '</tr></thead><tbody>';
            
            const typeMap = {'IMAGE_MODE_VIDEO':'横版','IMAGE_MODE_VIDEO_VERTICAL':'竖版','IMAGE_MODE_LOCAL_ADGRAPHIC':'团购卡'};
            
            list.forEach(item => {
                const canDelivery = item.can_delivery === true ? '<span style="color: #52c41a;">✅ 可投放</span>' : 
                                   (item.can_delivery === false ? '<span style="color: #f5222d;">❌ 不可投放</span>' : '-');
                const reasons = item.not_delivery_reason ? item.not_delivery_reason.join(', ') : '';
                
                html += `<tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 10px; font-family: monospace; font-size: 12px;">${item.video_id || '-'}</td>
                    <td style="padding: 10px;">${item.title || '-'}</td>
                    <td style="padding: 10px;">${item.aweme_name || '-'}<br><span style="font-size: 11px; color: #999;">${item.aweme_id || ''}</span></td>
                    <td style="padding: 10px;">${typeMap[item.image_mode] || item.image_mode || '-'}</td>
                    <td style="padding: 10px;">${item.duration || '-'}</td>
                    <td style="padding: 10px;">${canDelivery}<br>${reasons ? `<span style="font-size: 11px; color: #f5222d;">${reasons}</span>` : ''}</td>
                    <td style="padding: 10px;">
                        ${item.aweme_video_url ? `<a href="${item.aweme_video_url}" target="_blank" style="color: #1890ff; font-size: 12px;">播放</a>` : '-'}
                    </td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            if(resultDiv) resultDiv.innerHTML = html;
            if(paginationDiv) paginationDiv.style.display = 'none';
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
            if(paginationDiv) paginationDiv.style.display = 'none';
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
        if(paginationDiv) paginationDiv.style.display = 'none';
    }
}

// ---------- 本地上传视频 ----------
async function uploadLocalMaterialVideo() {
    const localAccountId = document.getElementById('lm-upload-video-local-account-id').value.trim();
    const fileInput = document.getElementById('lm-upload-video-file');
    const filename = document.getElementById('lm-upload-video-filename').value.trim();
    const signature = document.getElementById('lm-upload-video-signature').value.trim();
    const resultDiv = document.getElementById('lm-upload-video-result');
    
    if(!localAccountId || !fileInput.files[0]) {
        alert('请输入本地推账户ID并选择视频文件');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="color: #1890ff;">上传中，请稍候...</div>';
    
    const formData = new FormData();
    formData.append('local_account_id', localAccountId);
    formData.append('video_file', fileInput.files[0]);
    formData.append('filename', filename || fileInput.files[0].name);
    if(signature) formData.append('video_signature', signature);
    
    try {
        const res = await fetch('/api/local_material/video/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const d = data.data;
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 10px; border-radius: 4px; color: #389e0d; font-size: 13px;">
                    ✅ 上传成功！<br>视频ID: ${d.video_id || '-'}<br>素材ID: ${d.material_id || '-'}<br>尺寸: ${d.width || '-'}x${d.height || '-'}<br>时长: ${d.duration || '-'}s
                </div>`;
            }
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">上传失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">请求异常: ${e.message}</div>`;
    }
}

// ---------- 异步上传视频 ----------
async function createLocalMaterialAsyncTask() {
    const localAccountId = document.getElementById('lm-async-video-local-account-id').value.trim();
    const filename = document.getElementById('lm-async-video-filename').value.trim();
    const videoUrl = document.getElementById('lm-async-video-url').value.trim();
    const resultDiv = document.getElementById('lm-async-video-result');
    
    if(!localAccountId || !filename || !videoUrl) {
        alert('请填写完整信息（本地推账户ID、文件名、视频URL）');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="color: #1890ff;">创建任务中...</div>';
    
    try {
        const res = await fetch('/api/local_material/video/upload_task/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                local_account_id: parseInt(localAccountId),
                filename: filename,
                video_url: videoUrl
            })
        });
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 10px; border-radius: 4px; color: #389e0d; font-size: 13px;">
                    ✅ 异步任务创建成功！任务ID: <strong>${data.data.task_id || '-'}</strong><br>请使用"查询异步上传结果"查看处理状态（通常3分钟内完成）
                </div>`;
            }
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">创建失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">请求异常: ${e.message}</div>`;
    }
}

// ---------- 查询异步上传结果 ----------
async function queryLocalMaterialAsyncResult() {
    const localAccountId = document.getElementById('lm-query-task-local-account-id').value.trim();
    const taskIdsStr = document.getElementById('lm-query-task-ids').value.trim();
    const resultDiv = document.getElementById('lm-query-task-result');
    
    if(!localAccountId || !taskIdsStr) {
        alert('请输入本地推账户ID和任务ID列表');
        return;
    }
    
    const taskIds = taskIdsStr.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
    if(taskIds.length === 0) { alert('任务ID格式错误'); return; }
    if(taskIds.length > 100) { alert('单次最多查询100个任务'); return; }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="color: #1890ff;">查询中...</div>';
    
    try {
        const res = await fetch(`/api/local_material/video/upload_task/list?local_account_id=${localAccountId}&task_ids=${encodeURIComponent(JSON.stringify(taskIds))}`);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.list || [];
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="color: #999; font-size: 13px;">暂无任务数据</div>';
                return;
            }
            
            const statusMap = {'PROCESS':'处理中','SUCCESS':'成功','FAILED':'失败'};
            const statusColor = {'PROCESS':'#faad14','SUCCESS':'#52c41a','FAILED':'#f5222d'};
            
            let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
            list.forEach(item => {
                const st = statusMap[item.status] || item.status;
                const color = statusColor[item.status] || '#999';
                html += `<div style="padding: 10px; background: #fafafa; border-radius: 4px; border-left: 3px solid ${color}; font-size: 13px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong>任务ID: ${item.task_id}</strong>
                        <span style="color: ${color}; font-weight: 500;">${st}</span>
                    </div>
                    <div style="color: #666; font-size: 12px;">创建时间: ${item.create_time || '-'}</div>
                    ${item.error_msg ? `<div style="color: #f5222d; font-size: 12px; margin-top: 4px;">错误: ${item.error_msg}</div>` : ''}
                    ${item.video_info ? `<div style="color: #333; font-size: 12px; margin-top: 4px;">视频ID: ${item.video_info.video_id || '-'} | 素材ID: ${item.video_info.material_id || '-'} | ${item.video_info.width || '-'}x${item.video_info.height || '-'} | ${item.video_info.duration || '-'}s</div>` : ''}
                </div>`;
            });
            html += '</div>';
            if(resultDiv) resultDiv.innerHTML = html;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">查询失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">请求异常: ${e.message}</div>`;
    }
}

// ---------- 图文素材查询 ----------
async function queryLocalMaterialCarousel() {
    const localAccountId = document.getElementById('lm-image-local-account-id').value.trim();
    if(!localAccountId) { alert('请输入本地推账户ID'); return; }
    
    lmImagePage = 1;
    await fetchLocalMaterialCarousel(localAccountId);
}

async function fetchLocalMaterialCarousel(localAccountId) {
    const resultDiv = document.getElementById('lm-image-result');
    const paginationDiv = document.getElementById('lm-image-pagination');
    if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #1890ff;">查询中...</div>';
    
    try {
        let url = `/api/local_material/carousel/list?local_account_id=${localAccountId}&page=${lmImagePage}&page_size=20`;
        
        const keyword = document.getElementById('lm-image-keyword').value.trim();
        if(keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        
        const carouselIds = document.getElementById('lm-image-carousel-ids').value.trim();
        if(carouselIds) {
            const arr = carouselIds.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
            if(arr.length > 0) url += `&carousel_ids=${encodeURIComponent(JSON.stringify(arr))}`;
        }
        
        const startTime = document.getElementById('lm-image-start-time').value;
        if(startTime) url += `&start_time=${startTime}`;
        
        const endTime = document.getElementById('lm-image-end-time').value;
        if(endTime) url += `&end_time=${endTime}`;
        
        const orderBy = document.getElementById('lm-image-order-by').value;
        const orderType = document.getElementById('lm-image-order-type').value;
        url += `&order_by=${orderBy}&order_type=${orderType}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const list = data.data.carousel_list || [];
            const pageInfo = data.data.page_info || {};
            const totalPage = Math.ceil((pageInfo.total_number || 0) / 20) || 1;
            
            if(list.length === 0) {
                if(resultDiv) resultDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无图文素材数据</div>';
                if(paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            
            let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
            list.forEach(item => {
                let imagesHtml = '';
                if(item.image_list && item.image_list.length > 0) {
                    imagesHtml = '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">';
                    item.image_list.forEach((img, idx) => {
                        imagesHtml += `<div style="position: relative;">
                            <img src="${img.url || ''}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #f0f0f0;" onerror="this.style.display='none'">
                            <span style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; font-size: 10px; padding: 1px 4px; border-radius: 2px;">${idx+1}</span>
                        </div>`;
                    });
                    imagesHtml += '</div>';
                }
                
                html += `<div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="font-weight: 600; color: #001529; font-size: 14px;">${item.title || '未命名图文'}</div>
                        <span style="font-family: monospace; font-size: 12px; color: #666;">ID: ${item.carousel_id || '-'}</span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">创建时间: ${item.create_time || '-'}</div>
                    ${imagesHtml}
                    ${item.music ? `<div style="margin-top: 8px; font-size: 12px; color: #666;">🎵 音频: ${item.music.music_vid || '-'}</div>` : ''}
                </div>`;
            });
            html += '</div>';
            if(resultDiv) resultDiv.innerHTML = html;
            
            if(paginationDiv) paginationDiv.style.display = 'flex';
            const pageInfoSpan = document.getElementById('lm-image-page-info');
            const btnPrev = document.getElementById('btn-lm-image-prev');
            const btnNext = document.getElementById('btn-lm-image-next');
            if(pageInfoSpan) pageInfoSpan.textContent = `第 ${lmImagePage} 页 / 共 ${totalPage} 页`;
            if(btnPrev) btnPrev.disabled = lmImagePage <= 1;
            if(btnNext) btnNext.disabled = lmImagePage >= totalPage;
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">查询失败: ${data.message || '未知错误'}</div>`;
            if(paginationDiv) paginationDiv.style.display = 'none';
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">请求异常: ${e.message}</div>`;
        if(paginationDiv) paginationDiv.style.display = 'none';
    }
}

function changeLocalMaterialImagePage(delta) {
    const localAccountId = document.getElementById('lm-image-local-account-id').value.trim();
    if(!localAccountId) return;
    lmImagePage += delta;
    if(lmImagePage < 1) lmImagePage = 1;
    fetchLocalMaterialCarousel(localAccountId);
}

// ---------- 上传图片 ----------
async function uploadLocalMaterialImage() {
    const localAccountId = document.getElementById('lm-upload-image-local-account-id').value.trim();
    const fileInput = document.getElementById('lm-upload-image-file');
    const signature = document.getElementById('lm-upload-image-signature').value.trim();
    const isAigc = document.getElementById('lm-upload-image-aigc').checked;
    const resultDiv = document.getElementById('lm-upload-image-result');
    
    if(!localAccountId || !fileInput.files[0]) {
        alert('请输入本地推账户ID并选择图片文件');
        return;
    }
    
    if(resultDiv) resultDiv.innerHTML = '<div style="color: #1890ff;">上传中...</div>';
    
    const formData = new FormData();
    formData.append('local_account_id', localAccountId);
    formData.append('image_file', fileInput.files[0]);
    formData.append('upload_type', 'UPLOAD_BY_FILE');
    if(signature) formData.append('image_signature', signature);
    formData.append('is_aigc', isAigc ? 'true' : 'false');
    
    try {
        const res = await fetch('/api/local_material/image/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if(data.code === 0 && data.data) {
            const d = data.data;
            if(resultDiv) {
                resultDiv.innerHTML = `<div style="background: #f6ffed; border: 1px solid #b7eb8f; padding: 10px; border-radius: 4px; color: #389e0d; font-size: 13px;">
                    ✅ 上传成功！<br>图片ID: ${d.id || '-'}<br>素材ID: ${d.material_id || '-'}<br>尺寸: ${d.width || '-'}x${d.height || '-'}<br>格式: ${d.format || '-'}<br>
                    ${d.url ? `<a href="${d.url}" target="_blank" style="color: #1890ff;">预览图片</a>` : ''}
                </div>`;
            }
        } else {
            if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">上传失败: ${data.message || '未知错误'} (code: ${data.code})</div>`;
        }
    } catch(e) {
        if(resultDiv) resultDiv.innerHTML = `<div style="color: #cf1322; font-size: 13px;">请求异常: ${e.message}</div>`;
    }
}
// ===== 创建项目向导控制 =====
let currentWizardStep = 1;
const totalWizardSteps = 6;

function goWizardStep(step) {
    if(step < 1 || step > totalWizardSteps) return;
    
    // 更新步骤导航
    for(let i=1; i<=totalWizardSteps; i++) {
        const el = document.getElementById('wizard-step-'+i);
        const content = document.querySelector('.wizard-content[data-step="'+i+'"]');
        if(!el || !content) continue;
        
        if(i === step) {
            el.classList.add('active');
            el.classList.remove('completed');
            content.classList.add('active');
        } else if(i < step) {
            el.classList.remove('active');
            el.classList.add('completed');
            content.classList.remove('active');
        } else {
            el.classList.remove('active', 'completed');
            content.classList.remove('active');
        }
    }
    
    currentWizardStep = step;
    
    // 按钮控制
    document.getElementById('wizard-btn-prev').style.display = step === 1 ? 'none' : 'inline-block';
    document.getElementById('wizard-btn-next').style.display = step === totalWizardSteps ? 'none' : 'inline-block';
    document.getElementById('wizard-btn-submit').style.display = step === totalWizardSteps ? 'inline-block' : 'none';
    
    // 切换到第2步时，根据第1步选择渲染投放内容
    if(step === 2) refreshStep2Visibility();
    // 切换到第3步时，根据场景判断是否显示行为兴趣
    if(step === 3) refreshStep3Visibility();
    // 切换到第5步时，根据场景判断是否显示线索配置
    if(step === 5) refreshStep5Visibility();
}

function nextWizardStep() {
    // 步骤校验
    if(currentWizardStep === 1) {
        const accountId = document.getElementById('ld-create-local-account-id').value.trim();
        const name = document.getElementById('ld-create-name').value.trim();
        const goal = document.getElementById('ld-create-marketing-goal').value;
        const scene = document.getElementById('ld-create-local-delivery-scene').value;
        if(!accountId) { alert('请输入本地推账户ID'); return; }
        if(!name) { alert('请输入项目名称'); return; }
        if(!goal) { alert('请选择营销场景'); return; }
        if(!scene) { alert('请选择投放目标'); return; }
    }
    if(currentWizardStep === 2) {
        const goal = document.getElementById('ld-create-marketing-goal').value;
        const scene = document.getElementById('ld-create-local-delivery-scene').value;
        const deliveryGoal = document.getElementById('ld-create-delivery-goal').value;
        
        if(goal === 'VIDEO_IMAGE') {
            if(deliveryGoal === 'POI') {
                const mode = document.getElementById('ld-create-delivery-poi-mode').value;
                if(mode === 'PART' && !document.getElementById('ld-create-promotion-poi-ids').value.trim()) {
                    alert('请输入门店ID列表'); return;
                }
            }
            if(deliveryGoal === 'PRODUCT' && !document.getElementById('ld-create-product-id').value.trim()) {
                alert('请输入商品ID'); return;
            }
        }
             if(goal === 'LIVE' && (scene === 'CONTENT_HEAT' || scene === 'PRODUCT_PAY') && !document.getElementById('ld-create-aweme-id').value.trim()) {
            alert('请输入抖音号ID'); return;
        }
        // 判断是否需要优化目标（VIDEO_IMAGE + PRODUCT_PAY/POI_RECOMMEND 不需要）
        const needExternalAction = !(goal === 'VIDEO_IMAGE' && (scene === 'PRODUCT_PAY' || scene === 'POI_RECOMMEND'));
        if(needExternalAction) {
            const externalAction = document.getElementById('ld-create-external-action').value;
            if(!externalAction) { alert('请选择优化目标'); return; }
        }
    }
    if(currentWizardStep === 4) {
        const scheduleType = document.getElementById('ld-create-schedule-type').value;
        if((scheduleType === 'START_TO_END' || scheduleType === 'DELIVERY_7DAY') && !document.getElementById('ld-create-start-time').value) {
            alert('请输入开始时间'); return;
        }
        if(scheduleType === 'START_TO_END' && !document.getElementById('ld-create-end-time').value) {
            alert('请输入结束时间'); return;
        }
    }
    if(currentWizardStep === 5) {
        const budget = document.getElementById('ld-create-budget').value.trim();
        if(!budget) { alert('请输入项目预算'); return; }
    }
    
    if(currentWizardStep < totalWizardSteps) {
        goWizardStep(currentWizardStep + 1);
    }
}

function prevWizardStep() {
    if(currentWizardStep > 1) {
        goWizardStep(currentWizardStep - 1);
    }
}

// 卡片选择交互
function selectCard(group, value) {
    const container = document.getElementById('card-group-' + group);
    if(!container) return;
    container.querySelectorAll('.card-select-item').forEach(item => {
        item.classList.toggle('active', item.dataset.value === value);
    });
    
    // 同步到隐藏的 select
    const selectMap = {
        'marketing-goal': 'ld-create-marketing-goal',
        'delivery-scene': 'ld-create-local-delivery-scene',
        'ad-type': 'ld-create-ad-type',
        'delivery-goal': 'ld-create-delivery-goal',
        'schedule-type': 'ld-create-schedule-type',
        'bid-type': 'ld-create-bid-type'
    };
    const selectId = selectMap[group];
    if(selectId) {
        const select = document.getElementById(selectId);
        if(select) {
            select.value = value;
            // 触发原始 onchange
            const event = new Event('change');
            select.dispatchEvent(event);
        }
    }
}

function selectTag(group, value) {
    const container = document.getElementById('tag-group-' + group);
    if(!container) return;
    container.querySelectorAll('.tag-select-item').forEach(item => {
        item.classList.toggle('active', item.dataset.value === value);
    });
    
    const selectMap = {
        'poi-mode': 'ld-create-delivery-poi-mode',
        'district': 'ld-create-district',
        'gender': 'ld-create-gender'
    };
    const selectId = selectMap[group];
    if(selectId) {
        const select = document.getElementById(selectId);
        if(select) {
            select.value = value;
            const event = new Event('change');
            select.dispatchEvent(event);
        }
    }
}

// 折叠面板
function toggleWizardPanel(header) {
    const panel = header.closest('.wizard-panel');
    const body = panel.querySelector('.wizard-panel-body');
    const isOpen = body.classList.contains('show');
    if(isOpen) {
        body.classList.remove('show');
        panel.classList.remove('open');
    } else {
        body.classList.add('show');
        panel.classList.add('open');
    }
}

// 步骤2动态显示
function refreshStep2Visibility() {
    const goal = document.getElementById('ld-create-marketing-goal').value;
    const scene = document.getElementById('ld-create-local-delivery-scene').value;
    const adType = document.getElementById('ld-create-ad-type').value;
    
    // 投放内容显示控制
    const deliveryWrap = document.getElementById('step2-delivery-goal-wrap');
    const poiModeWrap = document.getElementById('step2-poi-mode-wrap');
    const productWrap = document.getElementById('step2-product-wrap');
    const awemeWrap = document.getElementById('step2-aweme-wrap');
    const actionWrap = document.getElementById('step2-external-action-wrap');
    const actionSelect = document.getElementById('ld-create-external-action');
    
    if(deliveryWrap) deliveryWrap.style.display = (goal === 'VIDEO_IMAGE') ? 'block' : 'none';
    if(awemeWrap) awemeWrap.style.display = (goal === 'LIVE' && (scene === 'CONTENT_HEAT' || scene === 'PRODUCT_PAY')) ? 'block' : 'none';
    
    // 默认选中投放内容
    if(goal === 'VIDEO_IMAGE') {
        const dg = document.getElementById('ld-create-delivery-goal').value;
        if(poiModeWrap) poiModeWrap.style.display = (dg === 'POI') ? 'block' : 'none';
        if(productWrap) productWrap.style.display = (dg === 'PRODUCT') ? 'block' : 'none';
    } else {
        if(poiModeWrap) poiModeWrap.style.display = 'none';
        if(productWrap) productWrap.style.display = 'none';
    }
    
    // ===== 优化目标处理 =====
    // 先判断当前场景是否需要优化目标
    let needExternalAction = true;
    let options = '<option value="">请选择</option>';
    
    if(goal === 'VIDEO_IMAGE') {
        if(scene === 'CONTENT_HEAT') {
            options += '<option value="NATIVE_ACTION">用户互动</option>';
            options += '<option value="FOLLOW_ACTION">粉丝增长</option>';
            options += '<option value="SHOW">展示量</option>';
            options += '<option value="POI_RECOMMEND">门店浏览</option>';
        } else if(scene === 'EXTERNAL') {
            options += '<option value="CLUE_ACQUISITION">获取线索</option>';
            options += '<option value="CLUE_CONFIRM">确认意向</option>';
            options += '<option value="CLUE_HIGH_INTENTION">预付定金</option>';
        } else if(scene === 'PRODUCT_PAY' || scene === 'POI_RECOMMEND') {
            // 不支持传入优化目标
            needExternalAction = false;
        }
    } else if(goal === 'LIVE') {
        if(scene === 'PRODUCT_PAY') {
            if(adType === 'GENERAL') {
                options += '<option value="LIVE_OTO_GROUP_BUYING">直播间团购购买</option>';
                options += '<option value="LIVE_OTO_CLICK">商品点击</option>';
            } else if(adType === 'SEARCHING') {
                options += '<option value="LIVE_OTO_GROUP_BUYING">直播间团购购买</option>';
            }
        } else if(scene === 'CONTENT_HEAT') {
            if(adType === 'GENERAL') {
                options += '<option value="LIVE_ENGAGEMENT">直播加热</option>';
                options += '<option value="FOLLOW_ACTION">粉丝增长</option>';
                options += '<option value="SHOW">展示</option>';
            } else if(adType === 'SEARCHING') {
                options += '<option value="LIVE_ENTER_ACTION">直播间观看</option>';
                options += '<option value="LIVE_STAY_TIME">直播间停留</option>';
            }
        } else if(scene === 'EXTERNAL') {
            options += '<option value="CLUE_ACQUISITION">获取线索</option>';
            options += '<option value="CLUE_CONFIRM">确认意向</option>';
            options += '<option value="CLUE_HIGH_INTENTION">预付定金</option>';
            options += '<option value="PRIVATE_MESSAGE">私信消息</option>';
        }
    }
    
    if(actionSelect) actionSelect.innerHTML = options;
    
    if(actionWrap) {
        if(needExternalAction) {
            actionWrap.style.display = 'block';
            // 移除可能存在的提示
            const hint = actionWrap.querySelector('.external-action-hint');
            if(hint) hint.remove();
        } else {
            actionWrap.style.display = 'block';
            // 显示"当前场景无需设置"提示
            let hint = actionWrap.querySelector('.external-action-hint');
            if(!hint) {
                hint = document.createElement('div');
                hint.className = 'external-action-hint';
                hint.style.cssText = 'color:#999; font-size:13px; margin-top:5px; padding:8px 12px; background:#f5f5f5; border-radius:4px;';
                actionWrap.appendChild(hint);
            }
            hint.textContent = '当前营销场景无需设置优化目标，该字段将不会提交';
            // 禁用select
            actionSelect.innerHTML = '<option value="">无需设置</option>';
            actionSelect.disabled = true;
        }
    }
}

// 步骤3动态显示
function refreshStep3Visibility() {
    const scene = document.getElementById('ld-create-local-delivery-scene').value;
    const interestWrap = document.getElementById('step3-interest-wrap');
    if(interestWrap) interestWrap.style.display = scene === 'EXTERNAL' ? 'block' : 'none';
}

// 步骤5动态显示
function refreshStep5Visibility() {
    const scene = document.getElementById('ld-create-local-delivery-scene').value;
    const leadsWrap = document.getElementById('step5-leads-wrap');
    if(leadsWrap) leadsWrap.style.display = scene === 'EXTERNAL' ? 'block' : 'none';
}

// 适配新 HTML 结构的事件处理函数
function onCreateSceneChange() {
    const goal = document.getElementById('ld-create-marketing-goal').value;
    const scene = document.getElementById('ld-create-local-delivery-scene').value;
    
    const deliveryGoalGroup = document.getElementById('step2-delivery-goal-wrap');
    const poiModeGroup = document.getElementById('step2-poi-mode-wrap');
    const productGroup = document.getElementById('step2-product-wrap');
    const awemeGroup = document.getElementById('step2-aweme-wrap');
    
    if(deliveryGoalGroup) deliveryGoalGroup.style.display = (goal === 'VIDEO_IMAGE') ? 'block' : 'none';
    if(awemeGroup) awemeGroup.style.display = (goal === 'LIVE' && (scene === 'CONTENT_HEAT' || scene === 'PRODUCT_PAY')) ? 'block' : 'none';
    
    if(goal === 'VIDEO_IMAGE' && document.getElementById('ld-create-delivery-goal')) {
        const dg = document.getElementById('ld-create-delivery-goal').value;
        if(poiModeGroup) poiModeGroup.style.display = (dg === 'POI') ? 'block' : 'none';
        if(productGroup) productGroup.style.display = (dg === 'PRODUCT') ? 'block' : 'none';
    } else {
        if(poiModeGroup) poiModeGroup.style.display = 'none';
        if(productGroup) productGroup.style.display = 'none';
    }
    
    const leadsWrap = document.getElementById('step5-leads-wrap');
    if(leadsWrap) leadsWrap.style.display = (scene === 'EXTERNAL') ? 'block' : 'none';
    
    const interestWrap = document.getElementById('step3-interest-wrap');
    if(interestWrap) interestWrap.style.display = (scene === 'EXTERNAL') ? 'block' : 'none';
    
    const peakWrap = document.getElementById('ld-create-is-set-peak-budget-group');
    if(peakWrap) {
        const showPeak = (goal === 'VIDEO_IMAGE' && (scene === 'PRODUCT_PAY' || scene === 'POI_RECOMMEND'));
        peakWrap.style.display = showPeak ? 'block' : 'none';
    }
    
    const actionSelect = document.getElementById('ld-create-external-action');
    if(actionSelect && goal && scene) refreshStep2Visibility();
}

function onDeliveryGoalChange() {
    const goal = document.getElementById('ld-create-delivery-goal').value;
    const poiModeGroup = document.getElementById('step2-poi-mode-wrap');
    const productGroup = document.getElementById('step2-product-wrap');
    
    if(poiModeGroup) poiModeGroup.style.display = (goal === 'POI') ? 'block' : 'none';
    if(productGroup) productGroup.style.display = (goal === 'PRODUCT') ? 'block' : 'none';
    
    if(goal === 'POI') onPoiModeChange();
}

function onPoiModeChange() {
    const mode = document.getElementById('ld-create-delivery-poi-mode').value;
    const poiIdsWrap = document.getElementById('step2-poi-ids-wrap');
    const autoWrap = document.getElementById('step2-auto-update-wrap');
    
    if(poiIdsWrap) poiIdsWrap.style.display = (mode === 'PART') ? 'block' : 'none';
    if(autoWrap) autoWrap.style.display = (mode === 'ALL') ? 'block' : 'none';
}

function onBidTypeChange() {
    const bidType = document.getElementById('ld-create-bid-type').value;
    const bidGroup = document.getElementById('step5-bid-wrap');
    const bidInput = document.getElementById('ld-create-bid');
    
    if(bidGroup) {
        const showBid = (bidType === 'MANUAL' || bidType === 'STABILIZE_COSTS');
        bidGroup.style.display = showBid ? 'block' : 'none';
        if(!showBid && bidInput) bidInput.value = '';
    }
}

function onScheduleTypeChange() {
    const type = document.getElementById('ld-create-schedule-type').value;
    const startWrap = document.getElementById('step4-start-time-wrap');
    const endWrap = document.getElementById('step4-end-time-wrap');
    const fixedWrap = document.getElementById('step4-fixed-seconds-wrap');
    const dailyWrap = document.getElementById('step4-daily-seconds-wrap');
    
    if(startWrap) startWrap.style.display = (type === 'START_TO_END' || type === 'DELIVERY_7DAY') ? 'block' : 'none';
    if(endWrap) endWrap.style.display = (type === 'START_TO_END') ? 'block' : 'none';
    if(fixedWrap) fixedWrap.style.display = (type === 'FIXED_TIME') ? 'block' : 'none';
    if(dailyWrap) dailyWrap.style.display = (type === 'DAILY_DELIVERY_DURATION') ? 'block' : 'none';
}

function onDistrictChange() {
    const district = document.getElementById('ld-create-district').value;
    const regionWrap = document.getElementById('step3-region-wrap');
    const poiAroundWrap = document.getElementById('step3-poi-around-wrap');
    
    if(regionWrap) regionWrap.style.display = (district === 'REGION') ? 'block' : 'none';
    if(poiAroundWrap) poiAroundWrap.style.display = (district === 'POI') ? 'block' : 'none';
}

function onPeakBudgetChange() {
    const isSet = document.getElementById('ld-create-is-set-peak-budget').value === 'true';
    const rateWrap = document.getElementById('step5-peak-rate-wrap');
    const daysWrap = document.getElementById('step5-peak-days-wrap');
    
    if(rateWrap) rateWrap.style.display = isSet ? 'block' : 'none';
    if(daysWrap) daysWrap.style.display = isSet ? 'block' : 'none';
}

function onInterestActionChange() {
    const val = document.getElementById('ld-create-customized-interest-action').value;
    const customWrap = document.getElementById('step3-interest-custom-wrap');
    if(customWrap) customWrap.style.display = (val === 'INTERESTACTION_CUSTOM') ? 'block' : 'none';
}
// ===== 定向设置官方风格交互 =====

// 地域类型
function selectDirType(value) {
    document.querySelectorAll('#dir-type-tabs .dir-type-tab').forEach(t => t.classList.toggle('active', t.dataset.value === value));
    const sel = document.getElementById('ld-create-district');
    if(sel) { sel.value = value; sel.dispatchEvent(new Event('change')); }
}

// 覆盖 onDistrictChange
function onDistrictChange() {
    const val = document.getElementById('ld-create-district').value;
    document.getElementById('dir-region-panel').style.display = val === 'REGION' ? 'block' : 'none';
    document.getElementById('dir-local-panel').style.display = val === 'LOCAL' ? 'block' : 'none';
    document.getElementById('dir-poi-panel').style.display = val === 'POI' ? 'block' : 'none';
    if(val === 'REGION') renderRegion();
}

// 人群Tab
function selectPeopleTab(mode) {
    document.querySelectorAll('#people-tabs .people-tab').forEach(t => t.classList.toggle('active', t.dataset.value === mode));
    document.getElementById('people-auto-panel').style.display = mode === 'auto' ? 'block' : 'none';
    document.getElementById('people-custom-panel').style.display = mode === 'custom' ? 'block' : 'none';
}

// 性别
function selectGender(value) {
    document.querySelectorAll('#gender-tabs .gender-tab').forEach(t => t.classList.toggle('active', t.dataset.value === value));
    const sel = document.getElementById('ld-create-gender');
    if(sel) sel.value = value;
}

// 年龄
let selectedAges = new Set();
function selectAge(value) {
    if(value === 'all') {
        selectedAges.clear();
        document.querySelectorAll('#age-tabs .age-tab').forEach(t => t.classList.toggle('active', t.dataset.value === 'all'));
        document.querySelectorAll('#age-detail input').forEach(cb => cb.checked = false);
        updateAgeUI(); return;
    }
    document.querySelector('#age-tabs .age-tab[data-value="all"]').classList.remove('active');
    const tab = document.querySelector('#age-tabs .age-tab[data-value="'+value+'"]');
    if(tab.classList.contains('active')) { selectedAges.delete(value); tab.classList.remove('active'); }
    else { selectedAges.add(value); tab.classList.add('active'); }
    updateAgeUI();
}
function toggleAgeMore() {
    document.getElementById('age-detail').classList.toggle('show');
}
function onAgeDetailChange() {
    document.querySelector('#age-tabs .age-tab[data-value="all"]').classList.remove('active');
    document.querySelectorAll('#age-tabs .age-tab:not([data-value="all"])').forEach(t => t.classList.remove('active'));
    selectedAges.clear();
    document.querySelectorAll('#age-detail input:checked').forEach(cb => selectedAges.add(cb.value));
    updateAgeUI();
}
function clearAgeMore() {
    document.querySelectorAll('#age-detail input').forEach(cb => cb.checked = false);
    selectedAges.clear();
    document.querySelector('#age-tabs .age-tab[data-value="all"]').classList.add('active');
    updateAgeUI();
}
function updateAgeUI() {
    const tip = document.getElementById('age-selected-tip');
    const container = document.getElementById('ld-audience-panel');
    if(selectedAges.size === 0) {
        tip.style.display = 'none';
        document.querySelector('#age-tabs .age-tab[data-value="all"]').classList.add('active');
    } else {
        tip.style.display = 'block';
        const names = Array.from(selectedAges).map(v => {
            const map = {'AGE_BETWEEN_18_23':'18-23','AGE_BETWEEN_24_30':'24-30','AGE_BETWEEN_31_40':'31-40','AGE_BETWEEN_41_49':'41-49','AGE_ABOVE_50':'50+','AGE_BETWEEN_18_19':'18-19','AGE_BETWEEN_20_23':'20-23','AGE_BETWEEN_31_35':'31-35','AGE_BETWEEN_36_40':'36-40','AGE_BETWEEN_41_45':'41-45','AGE_BETWEEN_46_50':'46-50','AGE_BETWEEN_51_55':'51-55','AGE_BETWEEN_56_59':'56-59','AGE_ABOVE_60':'60+'};
            return map[v] || v;
        });
        tip.textContent = '已选：' + names.join('、');
    }
    // 同步到原始容器
    if(container) container.querySelectorAll('input').forEach(cb => cb.checked = selectedAges.has(cb.value));
}

// 人群包
function selectPackage(value) {
    document.querySelectorAll('#package-tabs .audience-opt').forEach(t => t.classList.toggle('active', t.dataset.value === value));
    document.getElementById('package-input').style.display = value === 'custom' ? 'block' : 'none';
}

// 过滤已转化
function selectFilter(value) {
    document.querySelectorAll('#filter-tabs .audience-opt').forEach(t => t.classList.toggle('active', t.dataset.value === value));
    const sel = document.getElementById('ld-create-hide-if-converted');
    if(sel) sel.value = value;
}

// ===== 行政区域级联（简化数据） =====
const REGION_DB = {
    '110000':{name:'北京',cities:{'110100':'北京市'}},
    '120000':{name:'天津',cities:{'120100':'天津市'}},
    '130000':{name:'河北',cities:{'130100':'石家庄','130200':'唐山','130300':'秦皇岛','130400':'邯郸','130500':'邢台','130600':'保定','130700':'张家口','130800':'承德','130900':'沧州','131000':'廊坊','131100':'衡水'}},
    '140000':{name:'山西',cities:{'140100':'太原','140200':'大同','140300':'阳泉','140400':'长治','140500':'晋城','140600':'朔州','140700':'晋中','140800':'运城','140900':'忻州','141000':'临汾','141100':'吕梁'}},
    '150000':{name:'内蒙古',cities:{'150100':'呼和浩特','150200':'包头','150300':'乌海','150400':'赤峰','150500':'通辽','150600':'鄂尔多斯','150700':'呼伦贝尔','150800':'巴彦淖尔','150900':'乌兰察布','152200':'兴安','152500':'锡林郭勒','152900':'阿拉善'}},
    '210000':{name:'辽宁',cities:{'210100':'沈阳','210200':'大连','210300':'鞍山','210400':'抚顺','210500':'本溪','210600':'丹东','210700':'锦州','210800':'营口','210900':'阜新','211000':'辽阳','211100':'盘锦','211200':'铁岭','211300':'朝阳','211400':'葫芦岛'}},
    '220000':{name:'吉林',cities:{'220100':'长春','220200':'吉林','220300':'四平','220400':'辽源','220500':'通化','220600':'白山','220700':'松原','220800':'白城','222400':'延边'}},
    '230000':{name:'黑龙江',cities:{'230100':'哈尔滨','230200':'齐齐哈尔','230300':'鸡西','230400':'鹤岗','230500':'双鸭山','230600':'大庆','230700':'伊春','230800':'佳木斯','230900':'七台河','231000':'牡丹江','231100':'黑河','231200':'绥化','232700':'大兴安岭'}},
    '310000':{name:'上海',cities:{'310100':'上海市'}},
    '320000':{name:'江苏',cities:{'320100':'南京','320200':'无锡','320300':'徐州','320400':'常州','320500':'苏州','320600':'南通','320700':'连云港','320800':'淮安','320900':'盐城','321000':'扬州','321100':'镇江','321200':'泰州','321300':'宿迁'}},
    '330000':{name:'浙江',cities:{'330100':'杭州','330200':'宁波','330300':'温州','330400':'嘉兴','330500':'湖州','330600':'绍兴','330700':'金华','330800':'衢州','330900':'舟山','331000':'台州','331100':'丽水'}},
    '340000':{name:'安徽',cities:{'340100':'合肥','340200':'芜湖','340300':'蚌埠','340400':'淮南','340500':'马鞍山','340600':'淮北','340700':'铜陵','340800':'安庆','341000':'黄山','341100':'滁州','341200':'阜阳','341300':'宿州','341500':'六安','341600':'亳州','341700':'池州','341800':'宣城'}},
    '350000':{name:'福建',cities:{'350100':'福州','350200':'厦门','350300':'莆田','350400':'三明','350500':'泉州','350600':'漳州','350700':'南平','350800':'龙岩','350900':'宁德'}},
    '360000':{name:'江西',cities:{'360100':'南昌','360200':'景德镇','360300':'萍乡','360400':'九江','360500':'新余','360600':'鹰潭','360700':'赣州','360800':'吉安','360900':'宜春','361000':'抚州','361100':'上饶'}},
    '370000':{name:'山东',cities:{'370100':'济南','370200':'青岛','370300':'淄博','370400':'枣庄','370500':'东营','370600':'烟台','370700':'潍坊','370800':'济宁','370900':'泰安','371000':'威海','371100':'日照','371300':'临沂','371400':'德州','371500':'聊城','371600':'滨州','371700':'菏泽'}},
    '410000':{name:'河南',cities:{'410100':'郑州','410200':'开封','410300':'洛阳','410400':'平顶山','410500':'安阳','410600':'鹤壁','410700':'新乡','410800':'焦作','410900':'濮阳','411000':'许昌','411100':'漯河','411200':'三门峡','411300':'南阳','411400':'商丘','411500':'信阳','411600':'周口','411700':'驻马店'}},
    '420000':{name:'湖北',cities:{'420100':'武汉','420200':'黄石','420300':'十堰','420500':'宜昌','420600':'襄阳','420700':'鄂州','420800':'荆门','420900':'孝感','421000':'荆州','421100':'黄冈','421200':'咸宁','421300':'随州','422800':'恩施'}},
    '430000':{name:'湖南',cities:{'430100':'长沙','430200':'株洲','430300':'湘潭','430400':'衡阳','430500':'邵阳','430600':'岳阳','430700':'常德','430800':'张家界','430900':'益阳','431000':'郴州','431100':'永州','431200':'怀化','431300':'娄底','433100':'湘西'}},
    '440000':{name:'广东',cities:{'440100':'广州','440200':'韶关','440300':'深圳','440400':'珠海','440500':'汕头','440600':'佛山','440700':'江门','440800':'湛江','440900':'茂名','441200':'肇庆','441300':'惠州','441400':'梅州','441500':'汕尾','441600':'河源','441700':'阳江','441800':'清远','441900':'东莞','442000':'中山','445100':'潮州','445200':'揭阳','445300':'云浮'}},
    '450000':{name:'广西',cities:{'450100':'南宁','450200':'柳州','450300':'桂林','450400':'梧州','450500':'北海','450600':'防城港','450700':'钦州','450800':'贵港','450900':'玉林','451000':'百色','451100':'贺州','451200':'河池','451300':'来宾','451400':'崇左'}},
    '460000':{name:'海南',cities:{'460100':'海口','460200':'三亚','460300':'三沙','460400':'儋州','469001':'五指山','469002':'琼海','469005':'文昌','469006':'万宁','469007':'东方'}},
    '500000':{name:'重庆',cities:{'500100':'重庆市'}},
    '510000':{name:'四川',cities:{'510100':'成都','510300':'自贡','510400':'攀枝花','510500':'泸州','510600':'德阳','510700':'绵阳','510800':'广元','510900':'遂宁','511000':'内江','511100':'乐山','511300':'南充','511400':'眉山','511500':'宜宾','511600':'广安','511700':'达州','511800':'雅安','511900':'巴中','512000':'资阳','513200':'阿坝','513300':'甘孜','513400':'凉山'}},
    '520000':{name:'贵州',cities:{'520100':'贵阳','520200':'六盘水','520300':'遵义','520400':'安顺','520500':'毕节','520600':'铜仁','522300':'黔西南','522600':'黔东南','522700':'黔南'}},
    '530000':{name:'云南',cities:{'530100':'昆明','530300':'曲靖','530400':'玉溪','530500':'保山','530600':'昭通','530700':'丽江','530800':'普洱','530900':'临沧','532300':'楚雄','532500':'红河','532600':'文山','532800':'西双版纳','532900':'大理','533100':'德宏','533300':'怒江','533400':'迪庆'}},
    '540000':{name:'西藏',cities:{'540100':'拉萨','540200':'日喀则','540300':'昌都','540400':'林芝','540500':'山南','540600':'那曲','542500':'阿里'}},
    '610000':{name:'陕西',cities:{'610100':'西安','610200':'铜川','610300':'宝鸡','610400':'咸阳','610500':'渭南','610600':'延安','610700':'汉中','610800':'榆林','610900':'安康','611000':'商洛'}},
    '620000':{name:'甘肃',cities:{'620100':'兰州','620200':'嘉峪关','620300':'金昌','620400':'白银','620500':'天水','620600':'武威','620700':'张掖','620800':'平凉','620900':'酒泉','621000':'庆阳','621100':'定西','621200':'陇南','622900':'临夏','623000':'甘南'}},
    '630000':{name:'青海',cities:{'630100':'西宁','630200':'海东','632200':'海北','632300':'黄南','632500':'海南','632600':'果洛','632700':'玉树','632800':'海西'}},
    '640000':{name:'宁夏',cities:{'640100':'银川','640200':'石嘴山','640300':'吴忠','640400':'固原','640500':'中卫'}},
    '650000':{name:'新疆',cities:{'650100':'乌鲁木齐','650200':'克拉玛依','650400':'吐鲁番','650500':'哈密','652300':'昌吉','652700':'博尔塔拉','652800':'巴音郭楞','652900':'阿克苏','653000':'克孜勒苏','653100':'喀什','653200':'和田','654000':'伊犁','654200':'塔城','654300':'阿勒泰','659001':'石河子'}},
    '710000':{name:'台湾',cities:{'710100':'台湾'}},
    '810000':{name:'香港',cities:{'810100':'香港'}},
    '820000':{name:'澳门',cities:{'820100':'澳门'}}
};
let regionSelectedCities = new Set();

function renderRegion() {
    const list = document.getElementById('region-province-list');
    if(!list || list.children.length > 0) return;
    
    // 顶部"全选省份"
    const allDiv = document.createElement('div');
    allDiv.className = 'region-list-item';
    allDiv.style.cssText = 'background:#f5f5f5;font-weight:500;border-bottom:1px solid #e8e8e8;';
    allDiv.innerHTML = `<input type="checkbox" id="rp-all" onchange="toggleProvinceAll()"> <span class="txt">全选</span>`;
    list.appendChild(allDiv);
    
    Object.entries(REGION_DB).forEach(([pid, pdata]) => {
        const div = document.createElement('div');
        div.className = 'region-list-item';
        div.innerHTML = `<input type="checkbox" id="rp-${pid}" onchange="toggleProvince('${pid}')"> <span class="txt">${pdata.name}</span> <span class="arrow">›</span>`;
        div.onclick = function(e) { if(e.target.tagName !== 'INPUT') selectProvince(pid); };
        list.appendChild(div);
    });
}
function selectProvince(pid) {
    const cityList = document.getElementById('region-city-list');
    const pdata = REGION_DB[pid]; if(!pdata || !cityList) return;
    document.querySelectorAll('#region-province-list .region-list-item').forEach(i => i.classList.remove('active'));
    const cur = document.querySelector('#region-province-list .region-list-item:has(#rp-'+pid+')');
    if(cur) cur.classList.add('active');
    cityList.innerHTML = '';
    
    // 顶部"全选"
    const allDiv = document.createElement('div');
    allDiv.className = 'region-list-item';
    allDiv.style.cssText = 'background:#f5f5f5;font-weight:500;border-bottom:1px solid #e8e8e8;';
    const allChecked = Object.keys(pdata.cities).every(cid => regionSelectedCities.has(cid));
    allDiv.innerHTML = `<input type="checkbox" id="rc-all-${pid}" ${allChecked ? 'checked' : ''} onchange="toggleCityAll('${pid}')"> <span class="txt">全选</span>`;
    cityList.appendChild(allDiv);
    
    Object.entries(pdata.cities).forEach(([cid, cname]) => {
        const div = document.createElement('div');
        div.className = 'region-list-item';
        const ck = regionSelectedCities.has(cid) ? 'checked' : '';
        div.innerHTML = `<input type="checkbox" id="rc-${cid}" ${ck} onchange="toggleCity('${cid}','${cname}')"> <span class="txt">${cname}</span>`;
        cityList.appendChild(div);
    });
}
function toggleProvince(pid) {
    const pdata = REGION_DB[pid]; if(!pdata) return;
    const cb = document.getElementById('rp-'+pid);
    Object.keys(pdata.cities).forEach(cid => { cb.checked ? regionSelectedCities.add(cid) : regionSelectedCities.delete(cid); });
    const active = document.querySelector('#region-province-list .region-list-item.active');
    if(active) { const aid = active.querySelector('input').id.replace('rp-',''); if(aid === pid) selectProvince(pid); }
    syncProvinceAllCheckbox();
    updateRegionUI();
}
function toggleCity(cid, cname) {
    const cb = document.getElementById('rc-'+cid);
    cb.checked ? regionSelectedCities.add(cid) : regionSelectedCities.delete(cid);
    
    // 同步当前省份的"全选"和左侧省份 checkbox
    const activeProv = document.querySelector('#region-province-list .region-list-item.active');
    if(activeProv) {
        const pid = activeProv.querySelector('input').id.replace('rp-','');
        const pdata = REGION_DB[pid];
        if(pdata && pdata.cities[cid]) {
            const allChecked = Object.keys(pdata.cities).every(id => regionSelectedCities.has(id));
            const allCb = document.getElementById('rc-all-'+pid);
            if(allCb) allCb.checked = allChecked;
            const pCb = document.getElementById('rp-'+pid);
            if(pCb) pCb.checked = allChecked;
        }
    }
    syncProvinceAllCheckbox();
    updateRegionUI();
}
function updateRegionUI() {
    const list = document.getElementById('region-tag-list');
    const count = document.getElementById('region-count');
    const input = document.getElementById('ld-create-region-city');
    if(!list || !count || !input) return;
    
    list.innerHTML = '';
    let totalCount = 0;
    const cityIds = [];
    
    // 按省份分组判断全选/部分选
    Object.entries(REGION_DB).forEach(([pid, pdata]) => {
        const cities = Object.keys(pdata.cities);
        const selectedCities = cities.filter(cid => regionSelectedCities.has(cid));
        
        if(selectedCities.length === 0) return;
        
        totalCount += selectedCities.length;
        cityIds.push(...selectedCities);
        
        if(selectedCities.length === cities.length) {
            // 全选该省，只显示省份标签
            const tag = document.createElement('span');
            tag.className = 'region-tag';
            tag.innerHTML = `${pdata.name} <span class="del" onclick="removeProvince('${pid}')">×</span>`;
            list.appendChild(tag);
        } else {
            // 部分选，显示具体城市标签
            selectedCities.forEach(cid => {
                const cname = pdata.cities[cid];
                const tag = document.createElement('span');
                tag.className = 'region-tag';
                tag.innerHTML = `${cname} <span class="del" onclick="removeRegionCity('${cid}')">×</span>`;
                list.appendChild(tag);
            });
        }
    });
    
    count.textContent = `已选：${totalCount} 个行政区域`;
    input.value = cityIds.join(',');
}
function removeRegionCity(cid) {
    regionSelectedCities.delete(cid);
    const cb = document.getElementById('rc-'+cid); 
    if(cb) cb.checked = false;
    
    let affectedPid = null;
    Object.entries(REGION_DB).forEach(([pid, pdata]) => {
        if(pdata.cities[cid]) {
            affectedPid = pid;
            const all = Object.keys(pdata.cities).every(id => regionSelectedCities.has(id));
            const p = document.getElementById('rp-'+pid); 
            if(p) p.checked = all;
            const allCb = document.getElementById('rc-all-'+pid);
            if(allCb) allCb.checked = all;
        }
    });
    syncProvinceAllCheckbox();
    
    // 如果当前展开的省份就是受影响的省份，刷新城市列表以更新"全选"状态
    const activeProv = document.querySelector('#region-province-list .region-list-item.active');
    if(activeProv && affectedPid) {
        const activePid = activeProv.querySelector('input').id.replace('rp-','');
        if(activePid === affectedPid) selectProvince(affectedPid);
    }
    
    updateRegionUI();
}
function removeProvince(pid) {
    const pdata = REGION_DB[pid];
    if(!pdata) return;
    
    // 删除该省所有城市
    Object.keys(pdata.cities).forEach(cid => {
        regionSelectedCities.delete(cid);
    });
    
    // 同步 checkbox 状态
    const pCb = document.getElementById('rp-'+pid);
    if(pCb) pCb.checked = false;
    const allCb = document.getElementById('rc-all-'+pid);
    if(allCb) allCb.checked = false;
    
    // 刷新当前活跃省份的城市列表
    const activeProv = document.querySelector('#region-province-list .region-list-item.active');
    if(activeProv) {
        const activePid = activeProv.querySelector('input').id.replace('rp-','');
        if(activePid === pid) selectProvince(pid);
    }
    
    syncProvinceAllCheckbox();
    updateRegionUI();
}
function toggleProvinceAll() {
    const allCb = document.getElementById('rp-all');
    const checked = allCb ? allCb.checked : false;
    
    Object.entries(REGION_DB).forEach(([pid, pdata]) => {
        const pCb = document.getElementById('rp-'+pid);
        if(pCb) {
            pCb.checked = checked;
            Object.keys(pdata.cities).forEach(cid => {
                if(checked) regionSelectedCities.add(cid);
                else regionSelectedCities.delete(cid);
            });
        }
    });
    
    // 刷新当前活跃省份的城市列表
    const activeProv = document.querySelector('#region-province-list .region-list-item.active');
    if(activeProv) {
        const pid = activeProv.querySelector('input').id.replace('rp-','');
        if(pid !== 'all' && REGION_DB[pid]) selectProvince(pid);
    }
    
    updateRegionUI();
}
function syncProvinceAllCheckbox() {
    const allCb = document.getElementById('rp-all');
    if(!allCb) return;
    const allChecked = Object.keys(REGION_DB).every(pid => {
        const pCb = document.getElementById('rp-'+pid);
        return pCb && pCb.checked;
    });
    allCb.checked = allChecked;
}
function toggleCityAll(pid) {
    const pdata = REGION_DB[pid];
    if(!pdata) return;
    const cb = document.getElementById('rc-all-'+pid);
    const checked = cb ? cb.checked : false;
    Object.keys(pdata.cities).forEach(cid => {
        const cityCb = document.getElementById('rc-'+cid);
        if(cityCb) cityCb.checked = checked;
        if(checked) regionSelectedCities.add(cid);
        else regionSelectedCities.delete(cid);
    });
    const pCb = document.getElementById('rp-'+pid);
    if(pCb) pCb.checked = checked;
    syncProvinceAllCheckbox();
    updateRegionUI();
}
function clearRegion() { 
    regionSelectedCities.clear(); 
    document.querySelectorAll('.region-list input').forEach(cb => cb.checked = false); 
    syncProvinceAllCheckbox();
    updateRegionUI(); 
}
function filterRegion(k) {
    const key = k.trim();
    document.querySelectorAll('#region-province-list .region-list-item').forEach(item => {
        item.style.display = (!key || item.textContent.includes(key)) ? 'flex' : 'none';
    });
}
function batchRegion() {
    const ids = prompt('请输入城市ID列表，逗号分隔：','');
    if(!ids) return;
    ids.split(',').forEach(id => { id=id.trim(); if(id) regionSelectedCities.add(id); });
    updateRegionUI();
}
function downloadRegion() { alert('模板下载需后端配合，当前请使用批量添加直接输入城市ID'); }
function syncRegionType() {
    const v = document.querySelector('input[name="region-user-type"]:checked').value;
    const el = document.getElementById('ld-create-location-type'); if(el) el.value = v;
}
// ==================== 时段快捷操作（全局兜底）====================

function selectEarlyMorning() {
    document.querySelectorAll('.schedule-hour-cell').forEach(cell => {
        const h = parseInt(cell.dataset.hour);
        cell.className = (h >= 0 && h < 6) ? 'schedule-hour-cell off' : 'schedule-hour-cell on';
    });
    if(typeof updateScheduleTextFromTable === 'function') updateScheduleTextFromTable();
    if(typeof updateSelectedTimeDisplay === 'function') updateSelectedTimeDisplay();
}

function selectOffHours() {
    document.querySelectorAll('.schedule-hour-cell').forEach(cell => {
        const h = parseInt(cell.dataset.hour);
        cell.className = (h >= 18 || h < 9) ? 'schedule-hour-cell off' : 'schedule-hour-cell on';
    });
    if(typeof updateScheduleTextFromTable === 'function') updateScheduleTextFromTable();
    if(typeof updateSelectedTimeDisplay === 'function') updateSelectedTimeDisplay();
}
function toggleSelectAllAweme() {
    const checkboxes = document.querySelectorAll('.aweme-filter-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);

    const btn = document.getElementById('aweme-select-all-btn');
    if (btn) btn.textContent = allChecked ? '全选' : '取消全选';
}