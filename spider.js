'use strict';

/* =============================================================================
 * kanju.ai TVBox / 影视仓 爬虫 (CatVod JS Spider)
 * -----------------------------------------------------------------------------
 * 这是 TVBox/影视仓 通过 spider=https://.../spider.js 加载的 JS 爬虫。
 * 当 TVBox 加载 /config.json 时，会把账号密码通过 ext 传进来，init() 解析后
 * 即可用这些凭据去请求 kanju.ai。
 *
 * 接口约定（TVBox JS Loader 调用以下全局函数，返回值均为 JSON 字符串）：
 *   init(ext)           初始化（ext 来自配置，可含账号密码）
 *   home()              返回分类列表
 *   homeVod()           首页推荐
 *   category(tid,pg)    按分类翻页
 *   detail(id)          详情 + 播放列表
 *   search(wd)          搜索
 *   play(flag,id)       返回真实播放地址
 *
 * 说明：
 *   - 默认 realMode=false，使用内置【演示数据】，保证整套链路在 TVBox 里立刻
 *     能加载、能点开播放，方便你先验证流程。
 *   - 当你在浏览器抓到 kanju.ai 真实接口后，把 realMode 打开（配置页勾选），
 *     并在下方 “==== 真实接口（按需填写）====” 区域填入真实请求逻辑即可。
 * =========================================================================== */

var CONFIG = { kanjuEmail: '', kanjuPassword: '', realMode: false, ua: '' };
var TOKEN = '';   // 登录后缓存的 token（真实模式用）
var TOKEN_EXPIRE = 0;

/* ----------------------------- 初始化 ----------------------------- */
function init(ext) {
  try { if (ext) CONFIG = JSON.parse(ext); } catch (e) {}
  // 真实模式下，可在此提前登录换取 token
  if (CONFIG.realMode) {
    try { login(); } catch (e) { /* 首次失败时延迟到具体请求再登录 */ }
  }
  return '';
}

/* ----------------------- 网络请求封装（TVBox JS 运行时提供 request） ----------------------- */
function httpGet(url, headers) {
  headers = headers || {};
  if (!headers['User-Agent'] && CONFIG.ua) headers['User-Agent'] = CONFIG.ua;
  // TVBox/影视仓 的 JS 环境提供全局 request(url) 或 request({...})
  var resp;
  try { resp = request(url); }
  catch (e1) {
    try { resp = request({ url: url, method: 'GET', headers: headers }); }
    catch (e2) { throw new Error('当前环境不支持 request()，请确认使用支持 JS spider 的 TVBox/影视仓 版本。' + e2); }
  }
  return resp;
}

/* =============================================================================
 *  ======== 真实接口（按需填写）========
 *  下面这些函数目前是“骨架”。请在浏览器抓包得到 kanju.ai 的真实接口后，
 *  把请求逻辑填进去，并把配置页的“启用真实接口”勾上。
 *  抓包方法见 README.md。
 * =========================================================================== */

function login() {
  if (TOKEN && Date.now() < TOKEN_EXPIRE) return TOKEN;
  // TODO: 用 CONFIG.kanjuEmail / CONFIG.kanjuPassword 调用 kanju.ai 登录接口
  // 伪代码：
  //   var json = httpGet('https://kanju.ai/api/login?email=...&password=...');
  //   var data = JSON.parse(json);
  //   TOKEN = data.token;
  //   TOKEN_EXPIRE = Date.now() + 3600 * 1000;
  //   return TOKEN;
  throw new Error('真实接口未填写：请在 spider.js 的 login() 中按抓包结果实现 kanju.ai 登录。');
}

function realHomeVod() {
  // TODO: 拉取 kanju.ai 首页/推荐，整理成 {list:[{vod_id,vod_name,vod_pic,vod_remarks}]}
  login();
  throw new Error('真实接口未填写：realHomeVod()');
}

function realCategory(tid, pg) {
  login();
  throw new Error('真实接口未填写：realCategory()');
}

function realDetail(id) {
  login();
  throw new Error('真实接口未填写：realDetail()');
}

function realSearch(wd) {
  login();
  throw new Error('真实接口未填写：realSearch()');
}

function realPlay(flag, id) {
  login();
  throw new Error('真实接口未填写：realPlay()');
}

/* =============================================================================
 *  ======== 演示数据（realMode=false 时使用）========
 *  保证整条链路可加载、可播放，先验证流程。
 * =========================================================================== */

var DEMO_CLASS = [
  { type_id: 'tv',     type_name: '电视剧' },
  { type_id: 'anime',  type_name: '动漫' },
  { type_id: 'variety',type_name: '综艺' }
];

var DEMO_ITEMS = {
  tv: [
    { vod_id: 'av_demo_tv_1', vod_name: '重器（演示）',  vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第18集' },
    { vod_id: 'av_demo_tv_2', vod_name: '狂徒（演示）',  vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第16集' },
    { vod_id: 'av_demo_tv_3', vod_name: '给你梦想（演示）', vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第11集' }
  ],
  anime: [
    { vod_id: 'av_demo_an_1', vod_name: '遮天（演示）',   vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第175集' },
    { vod_id: 'av_demo_an_2', vod_name: '一斩苍穹（演示）', vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第4集' },
    { vod_id: 'av_demo_an_3', vod_name: '一念永恒（演示）', vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第6集' }
  ],
  variety: [
    { vod_id: 'av_demo_va_1', vod_name: '地球超新鲜（演示）', vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第8期' },
    { vod_id: 'av_demo_va_2', vod_name: '脱口秀和Ta的朋友们（演示）', vod_pic: 'https://kanju.ai/placeholder.jpg', vod_remarks: '更新至第8期' }
  ]
};

// 公开演示用测试视频（验证播放链路即可，非 kanju.ai 内容）
var DEMO_PLAY_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

/* ----------------------------- 实现 ----------------------------- */
function home() {
  return JSON.stringify({ class: DEMO_CLASS, filters: {} });
}

function homeVod() {
  if (CONFIG.realMode) return JSON.stringify(realHomeVod());
  var list = [];
  for (var k in DEMO_ITEMS) list = list.concat(DEMO_ITEMS[k]);
  return JSON.stringify({ list: list });
}

function category(tid, pg) {
  if (CONFIG.realMode) return JSON.stringify(realCategory(tid, pg));
  var list = DEMO_ITEMS[tid] || [];
  return JSON.stringify({ list: list, page: pg || 1, pagecount: 1, limit: 20, total: list.length });
}

function detail(id) {
  if (CONFIG.realMode) return JSON.stringify(realDetail(id));
  // 从演示数据里找基本信息
  var base = null;
  for (var k in DEMO_ITEMS) {
    for (var i = 0; i < DEMO_ITEMS[k].length; i++) {
      if (DEMO_ITEMS[k][i].vod_id === id) { base = DEMO_ITEMS[k][i]; break; }
    }
  }
  base = base || { vod_id: id, vod_name: '演示影片', vod_pic: '', vod_remarks: '' };
  var eps = [];
  for (var e = 1; e <= 3; e++) {
    eps.push('第' + e + '集$' + DEMO_PLAY_URL);
  }
  var vod = {
    vod_id: base.vod_id,
    vod_name: base.vod_name,
    vod_pic: base.vod_pic,
    vod_remarks: base.vod_remarks,
    vod_play_from: 'kanju线路',
    vod_play_url: eps.join('#')
  };
  return JSON.stringify({ list: [vod] });
}

function search(wd) {
  if (CONFIG.realMode) return JSON.stringify(realSearch(wd));
  var list = [];
  for (var k in DEMO_ITEMS) {
    for (var i = 0; i < DEMO_ITEMS[k].length; i++) {
      if (DEMO_ITEMS[k][i].vod_name.indexOf(wd) >= 0) list.push(DEMO_ITEMS[k][i]);
    }
  }
  return JSON.stringify({ list: list });
}

function play(flag, id) {
  if (CONFIG.realMode) return JSON.stringify(realPlay(flag, id));
  // 演示模式：id 已经是可直接播放的地址
  return JSON.stringify({ url: id });
}
