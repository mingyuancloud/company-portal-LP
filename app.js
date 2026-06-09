/* ════════════════════════════════════════════════════
   企业集合后台管理系统 - Supabase 版
   ════════════════════════════════════════════════════ */

// ── Supabase Client ───────────────────────────────
const supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

let currentUser = null;
let currentRole = 'user';
let currentPage = 'dashboard';
let allCompanies = [];

// ── Toast Helper ─────────────────────────────────
function toast(msg, type) {
  const el = document.getElementById('toastContainer');
  el.innerHTML = `<div class="toast ${type || 'success'}">${msg}</div>`;
  setTimeout(function() { el.innerHTML = ''; }, 2500);
}

// ── Auth: Login ───────────────────────────────────
async function doLogin() {
  const email = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  if (!email || !password) { errEl.textContent = '请输入邮箱和密码'; return; }
  errEl.textContent = '';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    await loadUserRole();
    showApp();
  } catch (e) {
    errEl.textContent = e.message || '登录失败';
  }
}

// ── Auth: Logout ──────────────────────────────────
async function doLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentRole = 'user';
  document.getElementById('loginPage').classList.remove('app-hidden');
  document.getElementById('appPage').classList.add('app-hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

// ── Auth: Check existing session ──────────────────
async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  if (data && data.session) {
    currentUser = data.session.user;
    await loadUserRole();
    showApp();
  }
}

// ── Load user role ────────────────────────────────
async function loadUserRole() {
  if (!currentUser) return;
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentUser.id)
    .single();
  currentRole = (data && data.role) ? data.role : 'user';
}

// ── Show App UI ───────────────────────────────────
function showApp() {
  document.getElementById('loginPage').classList.add('app-hidden');
  document.getElementById('appPage').classList.remove('app-hidden');
  document.getElementById('currentUser').textContent =
    (currentUser.user_metadata && currentUser.user_metadata.display_name) || currentUser.email;
  // Admin-only nav items
  document.getElementById('navUsers').style.display = currentRole === 'admin' ? '' : 'none';
  switchPage('dashboard');
}

// ── Page Switching ────────────────────────────────
function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.side-item').forEach(function(el) { el.classList.remove('active'); });
  var nav = document.querySelector('.side-item[data-page="' + page + '"]');
  if (nav) nav.classList.add('active');
  document.getElementById('searchInput').style.display = page === 'dashboard' ? '' : 'none';

  if (page === 'dashboard') {
    document.getElementById('pageTitle').textContent = '企业总览';
    loadDashboard();
  } else if (page === 'users') {
    document.getElementById('pageTitle').textContent = '用户管理';
    loadUsers();
  }
}

// ════════════════════════════════════════════════════
//   Dashboard
// ════════════════════════════════════════════════════
var activeFilters = { region: null, biz: null, stage: null };
var filterData = { bizs: [], stages: [] };

async function loadDashboard() {
  var search = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';

  var query = supabase.from('companies').select('*').order('updated_at', { ascending: false });

  if (activeFilters.region) query = query.eq('region', activeFilters.region);
  if (activeFilters.biz)    query = query.eq('biz', activeFilters.biz);
  if (activeFilters.stage)  query = query.eq('stage', activeFilters.stage);
  if (search)               query = query.or('name.ilike.%' + search + '%,en.ilike.%' + search + '%,desc.ilike.%' + search + '%,tags.ilike.%' + search + '%');

  try {
    var result = await query;
    if (result.error) throw result.error;
    allCompanies = result.data || [];

    // Stats
    var all = await supabase.from('companies').select('region,biz');
    var rows = all.data || [];
    var domestic = rows.filter(function(r) { return r.region === '国内'; }).length;
    var overseas = rows.filter(function(r) { return r.region === '海外'; }).length;
    var bizStats = {};
    rows.forEach(function(r) { bizStats[r.biz] = (bizStats[r.biz] || 0) + 1; });

    // Filter options
    filterData.bizs = [];
    var seenBiz = {};
    rows.forEach(function(r) { if (!seenBiz[r.biz]) { seenBiz[r.biz] = true; filterData.bizs.push(r.biz); } });
    filterData.stages = [];
    var seenStage = {};
    rows.forEach(function(r) { if (!seenStage[r.stage]) { seenStage[r.stage] = true; filterData.stages.push(r.stage); } });

    renderDashboard({ total: rows.length, domestic: domestic, overseas: overseas, bizStats: bizStats });
  } catch (e) {
    document.getElementById('contentArea').innerHTML = '<p style="color:var(--red)">加载失败: ' + (e.message || '未知错误') + '</p>';
  }
}

function renderDashboard(stats) {
  var html = '';

  // Filters
  html += '<div class="filter-row">';
  html += '<div class="filter-group"><span style="font-size:11px;color:var(--text3);padding:5px 0;margin-right:4px;">地区</span>';
  ['全部','国内','海外'].forEach(function(r) {
    var val = r === '全部' ? null : r;
    html += '<span class="filter-chip' + (activeFilters.region === val ? ' active' : '') + '" onclick="toggleFilter(\'region\',\'' + (val || '') + '\')">' + r + '</span>';
  });
  html += '</div>';
  html += '<div class="filter-group"><span style="font-size:11px;color:var(--text3);padding:5px 0;margin-right:4px;">业务线</span>';
  ['全部'].concat(filterData.bizs).forEach(function(b) {
    var val = b === '全部' ? null : b;
    html += '<span class="filter-chip' + (activeFilters.biz === val ? ' active' : '') + '" onclick="toggleFilter(\'biz\',\'' + (val || '') + '\')">' + b + '</span>';
  });
  html += '</div>';
  html += '<div class="filter-group"><span style="font-size:11px;color:var(--text3);padding:5px 0;margin-right:4px;">阶段</span>';
  ['全部'].concat(filterData.stages).forEach(function(s) {
    var val = s === '全部' ? null : s;
    html += '<span class="filter-chip' + (activeFilters.stage === val ? ' active' : '') + '" onclick="toggleFilter(\'stage\',\'' + (val || '') + '\')">' + s + '</span>';
  });
  html += '</div>';
  html += '</div>';

  // Stats
  html += '<div class="stats-row">';
  html += '<div class="stat-card"><div class="stat-num">' + stats.total + '</div><div class="stat-label">企业总数</div></div>';
  html += '<div class="stat-card"><div class="stat-num">' + stats.domestic + '</div><div class="stat-label">国内企业</div></div>';
  html += '<div class="stat-card"><div class="stat-num">' + stats.overseas + '</div><div class="stat-label">海外企业</div></div>';
  var topBiz = Object.entries(stats.bizStats).sort(function(a,b) { return b[1]-a[1]; })[0];
  html += '<div class="stat-card"><div class="stat-num">' + (topBiz ? topBiz[1] : 0) + '</div><div class="stat-label">最多业务线: ' + (topBiz ? topBiz[0] : '-') + '</div></div>';
  html += '</div>';

  // Company Grid
  html += '<div class="company-grid">';
  if (allCompanies.length === 0) {
    html += '<div class="cc-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8E92A4" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v4l3 2"/></svg><p>暂无匹配企业</p></div>';
  } else {
    allCompanies.forEach(function(c) {
      var avatarClass = c.region === '海外' ? 'overseas' : 'domestic';
      var regionTag = c.region === '海外' ? 'tag-overseas' : 'tag-domestic';
      var initial = c.en ? c.en[0] : c.name[0];
      var tags = (c.tags || '').split(',').filter(Boolean);
      html += '<div class="company-card" onclick="showDetail(\'' + c.id + '\')">';
      html += '<div class="cc-top"><div class="cc-avatar ' + avatarClass + '">' + esc(initial) + '</div>';
      html += '<div class="cc-info"><div class="cc-name">' + esc(c.name) + '</div><div class="cc-en">' + esc(c.en || '') + '</div>';
      html += '<div class="cc-desc">' + esc(c.desc || '') + '</div>';
      html += '<div class="cc-tags"><span class="tag ' + regionTag + '">' + c.region + '</span>';
      html += '<span class="tag tag-biz">' + c.biz + '</span>';
      if (c.stage) html += '<span class="tag tag-biz">' + c.stage + '</span>';
      tags.forEach(function(t) { html += '<span class="tag tag-biz">' + t.trim() + '</span>'; });
      html += '</div></div></div>';
      html += '<div class="cc-meta"><span>📍 ' + esc(c.hq || '-') + '</span><span>👥 ' + esc(c.employees || '-') + '</span><span>🏗 ' + esc(c.founded || '-') + '</span></div>';
      html += '</div>';
    });
  }
  html += '</div>';
  document.getElementById('contentArea').innerHTML = html;
}

function toggleFilter(type, value) {
  if (activeFilters[type] === value) activeFilters[type] = null;
  else activeFilters[type] = value;
  loadDashboard();
}

function doSearch() { loadDashboard(); }

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// ════════════════════════════════════════════════════
//   Detail Panel
// ════════════════════════════════════════════════════
function showDetail(id) {
  var c = allCompanies.find(function(x) { return x.id === id; });
  if (!c) return;

  var links = '';
  if (c.website) links += '<a class="link-chip lc-website" href="' + c.website + '" target="_blank"><svg class="link-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13" stroke="currentColor" stroke-width="1.2"/></svg>官方网站</a>';
  if (c.docs) links += '<a class="link-chip" href="' + c.docs + '" target="_blank"><svg class="link-icon" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>文档</a>';
  if (c.crunchbase) links += '<a class="link-chip lc-crunchbase" href="' + c.crunchbase + '" target="_blank"><svg class="link-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M10 6a3 3 0 1 0 0 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>Crunchbase</a>';
  if (c.linkedin) links += '<a class="link-chip lc-linkedin" href="' + c.linkedin + '" target="_blank"><svg class="link-icon" viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 6.5v5M4 4.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zM7 11.5V9c0-1 .5-2 2-2s2 .8 2 2v2.5M7 6.5v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>LinkedIn</a>';
  (c.links||'').split(',').filter(Boolean).forEach(function(l) {
    var url = l.trim();
    try { var u = new URL(url); links += '<a class="link-chip" href="' + url + '" target="_blank">' + u.hostname + '</a>'; } catch(e) {}
  });

  var tags = (c.tags||'').split(',').filter(Boolean);

  var panel = document.getElementById('detailPanel');
  panel.innerHTML =
    '<div class="detail-overlay" onclick="closeDetail()"></div>' +
    '<div class="detail-panel">' +
      '<div class="dp-header">' +
        '<button class="dp-close" onclick="closeDetail()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg></button>' +
        '<div class="dp-title">' + esc(c.name) + '</div>' +
        '<div class="dp-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="closeDetail();showCompanyForm(\'' + c.id + '\')">✏️ 编辑</button>' +
          '<button class="btn btn-danger btn-sm" onclick="closeDetail();confirmDelete(\'' + c.id + '\')">🗑</button>' +
        '</div>' +
      '</div>' +
      '<div class="dp-body">' +
        (c.en ? '<div style="font-size:13px;color:var(--text3);margin-bottom:12px;">' + esc(c.en) + '</div>' : '') +
        '<div class="dp-section"><div class="dp-section-title">基本信息</div><div class="dp-info-grid">' +
          '<div class="dp-info-item"><div class="dp-info-label">地区</div><div class="dp-info-value">' + c.region + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">业务线</div><div class="dp-info-value">' + c.biz + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">发展阶段</div><div class="dp-info-value">' + (c.stage || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">总部</div><div class="dp-info-value">' + esc(c.hq || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">成立年份</div><div class="dp-info-value">' + esc(c.founded || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">员工规模</div><div class="dp-info-value">' + esc(c.employees || '-') + '</div></div>' +
        '</div>' + (c.desc ? '<div class="dp-desc" style="margin-top:8px;">' + esc(c.desc) + '</div>' : '') + '</div>' +
        '<div class="dp-section"><div class="dp-section-title">快速访问</div>' + (links || '<span style="font-size:12px;color:var(--text3)">暂无链接</span>') + '</div>' +
        '<div class="dp-section"><div class="dp-section-title">联系人</div><div class="dp-info-grid">' +
          '<div class="dp-info-item"><div class="dp-info-label">姓名</div><div class="dp-info-value">' + esc(c.contact_name || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">职位</div><div class="dp-info-value">' + esc(c.contact_title || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">邮箱</div><div class="dp-info-value">' + esc(c.contact_email || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">电话</div><div class="dp-info-value">' + esc(c.contact_phone || '-') + '</div></div>' +
        '</div></div>' +
        '<div class="dp-section"><div class="dp-section-title">投资 / 持股</div><div class="dp-info-grid">' +
          '<div class="dp-info-item"><div class="dp-info-label">融资轮次</div><div class="dp-info-value">' + esc(c.round || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">持股比例</div><div class="dp-info-value">' + esc(c.stake || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">投资金额</div><div class="dp-info-value">' + esc(c.invest_amount || '-') + '</div></div>' +
          '<div class="dp-info-item"><div class="dp-info-label">投资日期</div><div class="dp-info-value">' + esc(c.invest_date || '-') + '</div></div>' +
          '<div class="dp-info-item" style="grid-column:1/-1"><div class="dp-info-label">共同投资人</div><div class="dp-info-value">' + esc(c.co_investors || '-') + '</div></div>' +
        '</div></div>' +
        (tags.length ? '<div class="dp-section"><div class="dp-section-title">标签</div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + tags.map(function(t) { return '<span class="tag tag-biz" style="font-size:12px;padding:4px 10px;">' + esc(t.trim()) + '</span>'; }).join('') + '</div></div>' : '') +
        (c.notes ? '<div class="dp-section"><div class="dp-section-title">备注</div><div class="dp-desc">' + esc(c.notes) + '</div></div>' : '') +
      '</div>' +
    '</div>';
  panel.classList.remove('app-hidden');
}

function closeDetail() { document.getElementById('detailPanel').classList.add('app-hidden'); }

// ════════════════════════════════════════════════════
//   Company Form (Add / Edit)
// ════════════════════════════════════════════════════
function showCompanyForm(id) {
  var isEdit = !!id;
  var c = isEdit ? allCompanies.find(function(x) { return x.id === id; }) : {};
  var v = function(key) { return (c[key] || ''); };

  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-overlay" onclick="closeModal()">' +
      '<div class="modal-box" onclick="event.stopPropagation()">' +
        '<div class="modal-header">' +
          '<div class="modal-title">' + (isEdit ? '编辑企业' : '添加企业') + '</div>' +
          '<button class="modal-close" onclick="closeModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="section-divider">基本信息</div>' +
          '<div class="form-row-2"><div><div class="form-label">企业名称 *</div><input class="form-input" id="f-name" value="' + escAttr(v('name')) + '"></div><div><div class="form-label">英文名</div><input class="form-input" id="f-en" value="' + escAttr(v('en')) + '"></div></div>' +
          '<div class="form-row-2"><div><div class="form-label">地区</div><select class="form-select" id="f-region"><option value="国内"' + (v('region')==='国内'?' selected':'') + '>国内</option><option value="海外"' + (v('region')==='海外'?' selected':'') + '>海外</option></select></div><div><div class="form-label">业务线</div><input class="form-input" id="f-biz" value="' + escAttr(v('biz')) + '" placeholder="科技 / 电商 / SaaS…"></div></div>' +
          '<div class="form-row-2"><div><div class="form-label">发展阶段</div><input class="form-input" id="f-stage" value="' + escAttr(v('stage')) + '" placeholder="初创期 / 成长期…"></div><div><div class="form-label">总部</div><input class="form-input" id="f-hq" value="' + escAttr(v('hq')) + '"></div></div>' +
          '<div class="form-row-2"><div><div class="form-label">成立年份</div><input class="form-input" id="f-founded" value="' + escAttr(v('founded')) + '"></div><div><div class="form-label">员工规模</div><input class="form-input" id="f-employees" value="' + escAttr(v('employees')) + '"></div></div>' +
          '<div class="form-row"><div class="form-label">简介</div><textarea class="form-textarea" id="f-desc" rows="2">' + escAttr(v('desc')) + '</textarea></div>' +
          '<div class="section-divider">链接</div>' +
          '<div class="form-row-2"><div><div class="form-label">官方网站</div><input class="form-input" id="f-website" value="' + escAttr(v('website')) + '" placeholder="https://"></div><div><div class="form-label">文档 / Wiki</div><input class="form-input" id="f-docs" value="' + escAttr(v('docs')) + '" placeholder="https://"></div></div>' +
          '<div class="form-row-2"><div><div class="form-label">Crunchbase 页面</div><input class="form-input" id="f-crunchbase" value="' + escAttr(v('crunchbase')) + '" placeholder="https://www.crunchbase.com/organization/…"></div><div><div class="form-label">LinkedIn 公司主页</div><input class="form-input" id="f-linkedin" value="' + escAttr(v('linkedin')) + '" placeholder="https://www.linkedin.com/company/…"></div></div>' +
          '<div class="form-row"><div class="form-label">其他链接</div><input class="form-input" id="f-links" value="' + escAttr(v('links')) + '" placeholder="多个链接用英文逗号分隔"></div>' +
          '<div class="section-divider">联系人</div>' +
          '<div class="form-row-2"><div><div class="form-label">姓名</div><input class="form-input" id="f-contact-name" value="' + escAttr(v('contact_name')) + '"></div><div><div class="form-label">职位</div><input class="form-input" id="f-contact-title" value="' + escAttr(v('contact_title')) + '"></div></div>' +
          '<div class="form-row-2"><div><div class="form-label">邮箱</div><input class="form-input" id="f-contact-email" value="' + escAttr(v('contact_email')) + '"></div><div><div class="form-label">电话</div><input class="form-input" id="f-contact-phone" value="' + escAttr(v('contact_phone')) + '"></div></div>' +
          '<div class="section-divider">投资 / 持股</div>' +
          '<div class="form-row-2"><div><div class="form-label">融资轮次</div><input class="form-input" id="f-round" value="' + escAttr(v('round')) + '"></div><div><div class="form-label">持股比例</div><input class="form-input" id="f-stake" value="' + escAttr(v('stake')) + '"></div></div>' +
          '<div class="form-row-2"><div><div class="form-label">投资金额</div><input class="form-input" id="f-invest-amount" value="' + escAttr(v('invest_amount')) + '"></div><div><div class="form-label">投资日期</div><input class="form-input" id="f-invest-date" value="' + escAttr(v('invest_date')) + '"></div></div>' +
          '<div class="form-row"><div class="form-label">共同投资人</div><input class="form-input" id="f-co-investors" value="' + escAttr(v('co_investors')) + '"></div>' +
          '<div class="section-divider">备注与标签</div>' +
          '<div class="form-row"><div class="form-label">标签</div><input class="form-input" id="f-tags" value="' + escAttr(v('tags')) + '" placeholder="多个标签用英文逗号分隔"></div>' +
          '<div class="form-row"><div class="form-label">备注</div><textarea class="form-textarea" id="f-notes" rows="2">' + escAttr(v('notes')) + '</textarea></div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" onclick="closeModal()">取消</button>' +
          '<button class="btn btn-primary" onclick="' + (isEdit ? 'saveCompany(\'' + id + '\')' : 'saveCompany()') + '">保存</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function escAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function field(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

async function saveCompany(id) {
  var data = {
    name: field('f-name'), en: field('f-en'), region: field('f-region'),
    biz: field('f-biz'), stage: field('f-stage'), hq: field('f-hq'),
    founded: field('f-founded'), employees: field('f-employees'), desc: field('f-desc'),
    website: field('f-website'), docs: field('f-docs'),
    crunchbase: field('f-crunchbase'), linkedin: field('f-linkedin'), links: field('f-links'),
    contact_name: field('f-contact-name'), contact_title: field('f-contact-title'),
    contact_email: field('f-contact-email'), contact_phone: field('f-contact-phone'),
    round: field('f-round'), stake: field('f-stake'),
    invest_amount: field('f-invest-amount'), invest_date: field('f-invest-date'),
    co_investors: field('f-co-investors'), tags: field('f-tags'), notes: field('f-notes')
  };
  if (!data.name) { toast('企业名称不能为空', 'error'); return; }

  try {
    var result;
    if (id) {
      result = await supabase.from('companies').update(data).eq('id', id);
    } else {
      data.created_by = currentUser.id;
      result = await supabase.from('companies').insert(data);
    }
    if (result.error) throw result.error;
    toast(id ? '企业已更新' : '企业已添加');
    closeModal();
    loadDashboard();
  } catch (e) {
    toast(e.message || '保存失败', 'error');
  }
}

function closeModal() { document.getElementById('modalContainer').innerHTML = ''; }

// ════════════════════════════════════════════════════
//   Delete
// ════════════════════════════════════════════════════
function confirmDelete(id) {
  var c = allCompanies.find(function(x) { return x.id === id; });
  if (!c) return;
  document.getElementById('confirmContainer').innerHTML =
    '<div class="confirm-overlay">' +
      '<div class="confirm-box"><h3>确认删除</h3><p>确定要删除「' + esc(c.name) + '」吗？此操作不可恢复。</p>' +
        '<div class="confirm-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'confirmContainer\').innerHTML=\'\'">取消</button>' +
          '<button class="btn btn-danger btn-sm" onclick="doDelete(\'' + id + '\')">确认删除</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

async function doDelete(id) {
  try {
    var result = await supabase.from('companies').delete().eq('id', id);
    if (result.error) throw result.error;
    toast('已删除');
    document.getElementById('confirmContainer').innerHTML = '';
    loadDashboard();
  } catch (e) {
    toast(e.message || '删除失败', 'error');
  }
}

// ════════════════════════════════════════════════════
//   CSV Import / Template
// ════════════════════════════════════════════════════
function downloadTemplate() {
  var headers = ['name','en','region','hq','biz','stage','founded','employees','desc','website','docs','crunchbase','linkedin','contact_name','contact_title','contact_email','contact_phone','round','stake','invest_amount','invest_date','co_investors','tags','notes'];
  var csv = '\uFEFF' + headers.join(',') + '\n';
  var example = '星辰科技,Startech Inc.,国内,上海,科技,成长期,2018,350+,企业级AI解决方案,https://example.com,,https://www.crunchbase.com/organization/xxx,https://www.linkedin.com/company/xxx,李明,BD总监,liming@example.com,,Series B,12%,3000万,2022-09,IDG资本,重点关注,备注信息';
  csv += example;
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'company-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

function showImport() {
  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-overlay" onclick="closeModal()">' +
      '<div class="modal-box" onclick="event.stopPropagation()" style="width:500px;">' +
        '<div class="modal-header"><div class="modal-title">导入企业数据</div>' +
          '<button class="modal-close" onclick="closeModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
        '<div class="modal-body">' +
          '<div class="import-dropzone" id="dropZone" onclick="document.getElementById(\'fileInput\').click()">' +
            '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8E92A4" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><path d="M12 3v12"/></svg>' +
            '<p>点击或拖拽上传 CSV 文件</p><span>支持 .csv 格式</span></div>' +
          '<input type="file" id="fileInput" accept=".csv" style="display:none" onchange="doImport(event)">' +
          '<div id="importResult"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var dz = document.getElementById('dropZone');
  dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.style.borderColor = 'var(--blue)'; dz.style.background = 'var(--blue-bg)'; });
  dz.addEventListener('dragleave', function() { dz.style.borderColor = ''; dz.style.background = ''; });
  dz.addEventListener('drop', function(e) {
    e.preventDefault(); dz.style.borderColor = ''; dz.style.background = '';
    if (e.dataTransfer.files.length) doImportFile(e.dataTransfer.files[0]);
  });
}

function doImport(event) {
  var file = event.target.files[0];
  if (file) doImportFile(file);
}

function doImportFile(file) {
  var reader = new FileReader();
  reader.onload = async function(e) {
    var content = e.target.result;
    var lines = content.split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (lines.length < 2) {
      document.getElementById('importResult').innerHTML = '<div class="import-result" style="background:var(--red-bg);color:var(--red);">❌ 文件为空或格式不正确</div>';
      return;
    }

    var parseCSV = function(line) {
      var result = [], current = '', inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { result.push(current.trim()); current = ''; }
        else current += ch;
      }
      result.push(current.trim());
      return result;
    };

    var headers = parseCSV(lines[0]).map(function(h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var values = parseCSV(lines[i]);
      var row = {};
      headers.forEach(function(h, idx) { row[h] = values[idx] || ''; });
      if (!row.name) continue;

      rows.push({
        name: row.name || '', en: row.en || row['英文名'] || '', region: row.region || row['地区'] || '国内',
        biz: row.biz || row['业务线'] || '科技', stage: row.stage || row['阶段'] || '初创期',
        hq: row.hq || row['总部'] || '', founded: row.founded || row['成立年份'] || '',
        employees: row.employees || row['员工规模'] || '', desc: row.desc || row['简介'] || '',
        website: row.website || row['官网'] || '', docs: row.docs || '',
        crunchbase: row.crunchbase || row['Crunchbase'] || '', linkedin: row.linkedin || row['LinkedIn'] || '',
        links: row.links || '', contact_name: row.contact_name || row['联系人'] || '',
        contact_title: row.contact_title || row['职位'] || '', contact_email: row.contact_email || row['邮箱'] || '',
        contact_phone: row.contact_phone || row['电话'] || '', round: row.round || row['融资轮次'] || '',
        stake: row.stake || row['持股比例'] || '', invest_amount: row.invest_amount || row['投资金额'] || '',
        invest_date: row.invest_date || row['投资日期'] || '', co_investors: row.co_investors || row['共同投资人'] || '',
        tags: row.tags || row['标签'] || '', notes: row.notes || row['备注'] || '',
        created_by: currentUser.id
      });
    }

    try {
      var result = await supabase.from('companies').insert(rows);
      if (result.error) throw result.error;
      document.getElementById('importResult').innerHTML = '<div class="import-result success">✅ 成功导入 ' + rows.length + ' 家企业</div>';
      setTimeout(function() { closeModal(); loadDashboard(); }, 1500);
    } catch (err) {
      document.getElementById('importResult').innerHTML = '<div class="import-result" style="background:var(--red-bg);color:var(--red);">❌ ' + (err.message || '导入失败') + '</div>';
    }
  };
  reader.readAsText(file);
}

// ════════════════════════════════════════════════════
//   User Management (admin only, via Supabase)
// ════════════════════════════════════════════════════
async function loadUsers() {
  if (currentRole !== 'admin') return;

  try {
    // Fetch user_roles with auth user info (limited - can't list all users from client)
    var result = await supabase.from('user_roles').select('id, user_id, role, created_at');
    if (result.error) throw result.error;

    var roles = result.data || [];

    // Get current user email
    var html =
      '<div style="max-width:600px;">' +
        '<p style="font-size:13px;color:var(--text2);margin-bottom:16px;">👋 管理员可通过 <a href="https://supabase.com/dashboard" target="_blank" style="color:var(--blue);">Supabase 控制台</a> → Authentication → Add User 来创建新用户。</p>' +
        '<p style="font-size:13px;color:var(--text2);margin-bottom:16px;">在 Supabase SQL Editor 中执行以下 SQL 可将用户设为管理员：<br>' +
        '<code style="display:block;padding:8px 12px;background:var(--bg2);border-radius:6px;margin-top:6px;font-size:12px;">UPDATE user_roles SET role = \'admin\' WHERE user_id = \'USER-UUID\';</code></p>' +

        '<table class="users-table">' +
          '<thead><tr><th>User ID</th><th>角色</th><th>创建时间</th></tr></thead><tbody>';

    roles.forEach(function(r) {
      var date = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '-';
      html += '<tr><td style="font-family:monospace;font-size:12px;">' + r.user_id + '</td>' +
        '<td><span class="role-badge ' + r.role + '">' + (r.role === 'admin' ? '管理员' : '普通用户') + '</span></td>' +
        '<td style="color:var(--text3)">' + date + '</td></tr>';
    });

    html += '</tbody></table>' +

      '<div class="pwd-section">' +
        '<h3 style="font-size:14px;margin-bottom:10px;">修改我的密码</h3>' +
        '<div class="pwd-row">' +
          '<input type="password" id="pwd-new" placeholder="新密码（至少6位）">' +
          '<button class="btn btn-primary btn-sm" onclick="changeMyPwd()">修改</button>' +
        '</div>' +
        '<div id="pwdMsg" style="font-size:12px;margin-top:4px;"></div>' +
      '</div>' +
    '</div>';

    document.getElementById('contentArea').innerHTML = html;
  } catch (e) {
    document.getElementById('contentArea').innerHTML = '<p style="color:var(--red)">加载失败: ' + (e.message || '未知错误') + '</p>';
  }
}

async function changeMyPwd() {
  var newPwd = document.getElementById('pwd-new').value;
  var msg = document.getElementById('pwdMsg');
  if (!newPwd || newPwd.length < 6) { msg.innerHTML = '<span style="color:var(--red)">请输入至少6位的新密码</span>'; return; }
  try {
    var result = await supabase.auth.updateUser({ password: newPwd });
    if (result.error) throw result.error;
    msg.innerHTML = '<span style="color:var(--green)">密码修改成功</span>';
    document.getElementById('pwd-new').value = '';
  } catch (e) {
    msg.innerHTML = '<span style="color:var(--red)">' + (e.message || '修改失败') + '</span>';
  }
}

// ════════════════════════════════════════════════════
//   Init
// ════════════════════════════════════════════════════
checkAuth();

// Enter key for login
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var appHidden = document.getElementById('appPage').classList.contains('app-hidden');
    if (appHidden) doLogin();
  }
});
