/* ============================================================================
 * kanju.ai（看剧AI）TVBox / 影视仓 Spider —— 真实模式
 * 依据浏览器抓包重建：home feed → catalog/detail → catalog/episodes
 *                     → playback/resolve → 直链 m3u8
 * 运行在手机 TVBox App 内部的 JS 引擎，直接拿账号去请求 kanju.ai。
 * ==========================================================================*/

var SITE = 'https://kanju.ai';

// 来自抓包的固定客户端标识
var CLIENT_NAME = 'dianyingtiantang-frontend';
var CLIENT_VERSION = '1.0.0';
var PROTOCOL_VERSION = '2026-07-05.library-v2.playback-v1';
var BUILD_VERSION = 'dianyingtiantang-v2026.08.17.5-cee41b28d97a-e3a9d84bfdc1-cee41b28d97a';

// 默认配置（会被 TVBox 传入的 ext 覆盖）
var CONFIG = {
  kanjuEmail: '',
  kanjuPassword: '',
  cookie: '',          // 登录后的会话 cookie（最可靠鉴权方式）
  signSecret: '',      // HMAC 签名密钥；留空则自动从前端 JS 提取
  realMode: true,      // true=真实接口，false=演示兜底
  ua: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
};

// 合并 TVBox 传入的 ext（CatVod 会把站点配置里的 ext 作为全局变量 ext 注入）
try {
  if (typeof ext !== 'undefined' && ext) {
    var _e = (typeof ext === 'string') ? JSON.parse(ext) : ext;
    for (var _k in _e) { if (_e.hasOwnProperty(_k)) CONFIG[_k] = _e[_k]; }
  }
} catch (e) {}

var _cookieCache = null;     // 运行时缓存的 cookie
var _secretCache = null;     // 运行时缓存的签名密钥
var _signFmtCache = null;    // 运行时缓存的可用签名格式
var _secretTried = false;

/* ----------------------------- 纯 JS SHA-256 ----------------------------- */
function sha256bytes(bytes) {
  // bytes: 每个字符 charCode 为 0-255 的字节串
  var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
           0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
           0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
           0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
           0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
           0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
           0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
           0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var l = bytes.length;
  var bitLen = l * 8;
  var total = ((l + 8) >> 6 << 6) + 64;
  if ((l + 1) > total - 8) total += 64;
  var buf = new Array(total);
  for (var i = 0; i < l; i++) buf[i] = bytes.charCodeAt(i) & 0xff;
  buf[l] = 0x80;
  for (var i = l + 1; i < total; i++) buf[i] = 0;
  // 64-bit 长度 big-endian：高 32 位（total-8..total-5）为 0，低 32 位在 total-4..total-1
  buf[total - 4] = (bitLen >>> 24) & 0xff;
  buf[total - 3] = (bitLen >>> 16) & 0xff;
  buf[total - 2] = (bitLen >>> 8) & 0xff;
  buf[total - 1] = bitLen & 0xff;
  var w = new Array(64);
  for (var off = 0; off < total; off += 64) {
    for (var i = 0; i < 16; i++) {
      w[i] = (buf[off + i*4] << 24) | (buf[off + i*4 + 1] << 16) | (buf[off + i*4 + 2] << 8) | buf[off + i*4 + 3];
    }
    for (var i = 16; i < 64; i++) {
      var s0 = ((w[i-15] >>> 7) | (w[i-15] << 25)) ^ ((w[i-15] >>> 18) | (w[i-15] << 14)) ^ (w[i-15] >>> 3);
      var s1 = ((w[i-2] >>> 17) | (w[i-2] << 15)) ^ ((w[i-2] >>> 19) | (w[i-2] << 13)) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
    for (var i = 0; i < 64; i++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (hh + S1 + ch + k[i] + w[i]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) | 0;
      hh=g; g=f; f=e; e=(d + t1) | 0; d=c; c=b; b=a; a=(t1 + t2) | 0;
    }
    h[0]=(h[0]+a)|0; h[1]=(h[1]+b)|0; h[2]=(h[2]+c)|0; h[3]=(h[3]+d)|0;
    h[4]=(h[4]+e)|0; h[5]=(h[5]+f)|0; h[6]=(h[6]+g)|0; h[7]=(h[7]+hh)|0;
  }
  var out = '';
  for (var i = 0; i < 8; i++) {
    var wd = h[i] >>> 0;
    out += String.fromCharCode((wd >>> 24) & 0xff, (wd >>> 16) & 0xff, (wd >>> 8) & 0xff, wd & 0xff);
  }
  return out;
}
function toBytesUtf8(str) { return unescape(encodeURIComponent(str)); }
function bytesToHexStr(byteStr) {
  var s = '';
  for (var i = 0; i < byteStr.length; i++) s += ('0' + (byteStr.charCodeAt(i) & 0xff).toString(16)).slice(-2);
  return s;
}
function sha256(str) { return bytesToHexStr(sha256bytes(toBytesUtf8(str))); }
function bytesToHexStr(byteStr) {
  var s = '';
  for (var i = 0; i < byteStr.length; i++) s += ('0' + (byteStr.charCodeAt(i) & 0xff).toString(16)).slice(-2);
  return s;
}
function hmacSha256(key, msg) {
  var bs = 64;
  var kb = toBytesUtf8(key);
  if (kb.length > bs) kb = sha256bytes(kb);
  var ipad = '', opad = '';
  for (var i = 0; i < bs; i++) {
    var b = i < kb.length ? (kb.charCodeAt(i) & 0xff) : 0;
    ipad += String.fromCharCode(b ^ 0x36);
    opad += String.fromCharCode(b ^ 0x5c);
  }
  var inner = ipad + msg;                 // msg 为 ASCII
  var ih = sha256bytes(inner);            // 32 字节串
  var outer = opad + ih;
  return sha256bytes(outer);
}
function hmacSha256Hex(key, msg) { return bytesToHexStr(hmacSha256(key, msg)); }

function randHex(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

/* --------------------------- 鉴权与签名密钥 --------------------------- */
function getCookie() {
  if (_cookieCache) return _cookieCache;
  var c = CONFIG.cookie || '';
  if (c) _cookieCache = c;
  return c;
}

// 尝试从前端 JS 包里提取签名密钥
function extractSecret() {
  if (_secretTried) return _secretCache;
  _secretTried = true;
  if (CONFIG.signSecret) { _secretCache = CONFIG.signSecret; return _secretCache; }
  try {
    var html = request(SITE + '/', { method: 'GET', headers: { 'user-agent': CONFIG.ua, 'accept': 'text/html' } });
    if (!html) return null;
    var m, scripts = [];
    var re = /(?:src|href)=["']([^"']+\.js)["']/g;
    while ((m = re.exec(html)) !== null) scripts.push(m[1]);
    // 也抓 modulepreload / 内联 import
    var re2 = /(["'])([^"']+\.js)\1/g;
    while ((m = re2.exec(html)) !== null) { if (m[2].indexOf('.js') >= 0) scripts.push(m[2]); }
    var candidates = [];
    for (var i = 0; i < scripts.length; i++) {
      var url = scripts[i];
      if (url.indexOf('http') !== 0) url = SITE + (url.charAt(0) === '/' ? '' : '/') + url;
      var js = request(url, { method: 'GET', headers: { 'user-agent': CONFIG.ua, 'accept': 'application/javascript' } });
      if (!js) continue;
      // 常见密钥命名
      var patterns = [
        /x-ai-movie-signature["']?\s*[:=]\s*["']?([0-9a-f]{16,64})/i,
        /signature[_-]?secret["']?\s*[:=]\s*["']([^"']+)["']/i,
        /signSecret["']?\s*[:=]\s*["']([^"']+)["']/i,
        /hmac[_-]?secret["']?\s*[:=]\s*["']([^"']+)["']/i,
        /client[_-]?secret["']?\s*[:=]\s*["']([^"']{8,64})["']/i,
        /["']secret["']\s*[:=]\s*["']([^"']{8,64})["']/
      ];
      for (var p = 0; p < patterns.length; p++) {
        var mm = js.match(patterns[p]);
        if (mm && mm[1] && mm[1].length >= 8) { _secretCache = mm[1]; return _secretCache; }
      }
      // 找 HMAC 调用附近出现的常量字符串
      var hm = js.match(/hmac\([^,]+,\s*["']([^"']{8,64})["']\)/i);
      if (hm && hm[1]) { _secretCache = hm[1]; return _secretCache; }
    }
  } catch (e) {}
  return null;
}

// 计算签名。若已探测到可用格式则用之；否则返回基于推测格式的签名
function computeSignature(method, path, body, ts, nonce) {
  var secret = _secretCache || CONFIG.signSecret || '';
  var msg;
  if (_signFmtCache) {
    msg = buildSignMsg(_signFmtCache, method, path, body, ts, nonce);
  } else {
    msg = [method.toUpperCase(), path, String(ts), nonce, body || ''].join('\n');
  }
  if (!secret) return '';
  return hmacSha256Hex(secret, msg);
}
function buildSignMsg(fmt, method, path, body, ts, nonce) {
  switch (fmt) {
    case 1: return [method.toUpperCase(), path, String(ts), nonce, body || ''].join('\n');
    case 2: return [path, String(ts), nonce].join('\n');
    case 3: return [String(ts), nonce, body || ''].join('\n');
    case 4: return [method.toUpperCase(), path, String(ts), nonce].join('\n');
    case 5: return [path, String(ts), nonce, body || ''].join('\n');
    case 6: return [CLIENT_NAME, path, String(ts), nonce].join('\n');
    default: return [method.toUpperCase(), path, String(ts), nonce, body || ''].join('\n');
  }
}

/* ------------------------------- HTTP 封装 ------------------------------- */
function http(method, path, body) {
  var url = SITE + path;
  var ts = Date.now();
  var nonce = randHex(32);
  var headers = {
    'accept': 'application/json',
    'x-ai-movie-build-version': BUILD_VERSION,
    'x-ai-movie-client-name': CLIENT_NAME,
    'x-ai-movie-client-version': CLIENT_VERSION,
    'x-ai-movie-protocol-version': PROTOCOL_VERSION,
    'x-ai-movie-nonce': nonce,
    'x-ai-movie-timestamp': String(ts),
    'x-ai-movie-signature': computeSignature(method, path, body || '', ts, nonce),
    'user-agent': CONFIG.ua
  };
  var ck = getCookie();
  if (ck) headers['cookie'] = ck;
  var opts = { method: method, headers: headers };
  if (body) {
    var b = (typeof body === 'string') ? body : JSON.stringify(body);
    opts.body = b;
    opts.data = b;
    headers['content-type'] = 'application/json';
  }
  var resp = null;
  try { resp = request(url, opts); } catch (e) { resp = null; }
  if (!resp) return null;
  if (typeof resp === 'string') return resp;
  if (resp.body !== undefined) return resp.body;
  return null;
}

// 尝试用 /v1/users/me 自测：找到可用的签名格式（含“不校验签名”的情况）
function ensureSigning() {
  if (_signFmtCache !== null) return true;
  extractSecret();
  if (!getCookie() && !CONFIG.kanjuEmail) {
    // 没有 cookie 也没有账号，无法鉴权
    _signFmtCache = 0; // 标记：先不签名
    return false;
  }
  // 依次尝试：完全不带签名、以及多种签名格式，以 users/me 是否 authenticated 为准
  var formats = [0, 1, 2, 3, 4, 5, 6];
  for (var i = 0; i < formats.length; i++) {
    var fmt = formats[i];
    var saved = _signFmtCache;
    _signFmtCache = (fmt === 0) ? -1 : fmt; // -1 表示本轮回测时强制空签名
    var r = http('GET', '/v1/users/me', '');
    _signFmtCache = saved;
    if (r) {
      try {
        var o = JSON.parse(r);
        if (o && o.authenticated === true) {
          _signFmtCache = (fmt === 0) ? -1 : fmt;
          return true;
        }
      } catch (e) {}
    }
  }
  // 都没通过（可能 cookie 无效或需登录），保留空签名以便上层报错更明确
  _signFmtCache = -1;
  return false;
}

/* ----------------------------- 结果映射工具 ----------------------------- */
function pick(arr, keys) {
  for (var i = 0; i < keys.length; i++) if (arr[keys[i]] !== undefined && arr[keys[i]] !== null) return arr[keys[i]];
  return '';
}
function toCard(item) {
  var id = pick(item, ['id', 'variant_id', 'work_id', 'vod_id']);
  var title = pick(item, ['title', 'name', 'vod_name']);
  var pic = pick(item, ['poster_url', 'pic', 'cover', 'vod_pic']);
  var remarks = pick(item, ['remarks', 'vod_remarks', 'year', 'label']);
  return { vod_id: id, vod_name: title, vod_pic: pic, vod_remarks: (remarks && remarks.vod_remarks) ? remarks.vod_remarks : (remarks || '') };
}
function extractCards(obj) {
  var out = [];
  if (!obj) return out;
  var arr = null;
  if (obj.sections) { // home feed
    for (var s = 0; s < obj.sections.length; s++) {
      var cards = obj.sections[s].cards;
      if (cards) for (var i = 0; i < cards.length; i++) out.push(toCard(cards[i]));
    }
    return out;
  }
  arr = obj.items || obj.data || obj.results || obj.list || obj.cards || (obj.data && obj.data.items);
  if (!arr && obj.object === 'catalog.detail') arr = null;
  if (arr && arr.length) {
    for (var i = 0; i < arr.length; i++) out.push(toCard(arr[i]));
  }
  return out;
}

/* ============================== CatVod 接口 ============================== */
function init() {
  return {
    code: 0,
    msg: 'kanju.ai ok',
    data: { key: 'kanju', name: '看剧AI', type: 3, api: '', searchable: 1, quickSearch: 1, filterable: 1 }
  };
}

function home() {
  if (!CONFIG.realMode) return demoHome();
  ensureSigning();
  try {
    var r = http('GET', '/v1/feed/home?scope=public&mode=preview&sections=3&cards=10', '');
    if (!r) return { code: 0, msg: '', data: { class: homeClasses(), filters: {}, list: [] } };
    var o = JSON.parse(r);
    var list = extractCards(o);
    return { code: 0, msg: '', data: { class: homeClasses(), filters: {}, list: list } };
  } catch (e) {
    return { code: 0, msg: '', data: { class: homeClasses(), filters: {}, list: [] } };
  }
}

function homeClasses() {
  return [
    { type_id: 'trending', type_name: '热门' },
    { type_id: 'movie', type_name: '电影' },
    { type_id: 'series', type_name: '剧集' },
    { type_id: 'anime', type_name: '动漫' }
  ];
}

function homeVod() { return home(); }

function category(tid, pg, filter, ext) {
  if (!CONFIG.realMode) return { code: 0, data: { list: [] } };
  ensureSigning();
  pg = pg || 1;
  try {
    var path;
    if (tid === 'trending' || !tid) {
      path = '/v1/feed/home?scope=public&mode=preview&sections=3&cards=10';
    } else {
      path = '/v1/browse/catalog?kind=' + encodeURIComponent(tid) + '&page=' + pg + '&limit=20';
    }
    var r = http('GET', path, '');
    if (!r) return { code: 0, data: { list: [] } };
    var list = extractCards(JSON.parse(r));
    return { code: 0, data: { list: list, page: pg, pagecount: 999, total: 99999 } };
  } catch (e) {
    return { code: 0, data: { list: [] } };
  }
}

function detail(ids) {
  if (!CONFIG.realMode) return demoDetail(ids);
  ensureSigning();
  try {
    var id = (ids + '').split(/[$,]/)[0];
    var d = http('GET', '/v1/catalog/' + id + '/detail', '');
    var e = http('GET', '/v1/catalog/' + id + '/episodes?limit=48&offset=0', '');
    if (!d) return { code: 0, data: [] };
    var dobj = JSON.parse(d);
    var episodes = [];
    if (e) {
      try { episodes = JSON.parse(e).episodes || []; } catch (x) {}
    }
    if (!episodes.length && dobj.episodes) episodes = dobj.episodes;

    var playUrl = '';
    var plays = [];
    for (var i = 0; i < episodes.length; i++) {
      var ep = episodes[i];
      var label = ep.title || ep.display_name || ('第' + (ep.sort_number || (i + 1)) + '集');
      var token = ep.token || ep.path;
      if (!token) continue;
      plays.push(label + '$' + token);
    }
    playUrl = plays.join('#');

    var vod = {
      vod_id: id,
      vod_name: dobj.title || dobj.vod_name || '',
      vod_pic: dobj.poster_url || dobj.vod_pic || '',
      vod_remarks: dobj.remarks || dobj.vod_remarks || '',
      vod_year: dobj.year || '',
      vod_content: dobj.description || dobj.vod_content || '',
      vod_actor: (dobj.actors || []).join(' '),
      vod_director: (dobj.directors || []).join(' '),
      vod_play_from: 'kanju',
      vod_play_url: playUrl
    };
    return { code: 0, data: [vod] };
  } catch (ex) {
    return { code: 0, data: [] };
  }
}

function search(wd) {
  if (!CONFIG.realMode) return demoSearch(wd);
  ensureSigning();
  try {
    var r = http('GET', '/v1/search?q=' + encodeURIComponent(wd) + '&limit=20', '');
    if (!r) return { code: 0, data: [] };
    var list = extractCards(JSON.parse(r));
    return { code: 0, data: list };
  } catch (e) {
    return { code: 0, data: [] };
  }
}

function play(flag, id) {
  if (!CONFIG.realMode) return demoPlay(flag, id);
  try {
    ensureSigning();
    var token = (id + '').split('$')[0];
    var r = http('GET', '/v1/playback/resolve/' + encodeURIComponent(token), '');
    if (!r) return { code: -1, msg: 'resolve 失败（可能未登录/签名错误，请检查配置页 cookie）' };
    var o = JSON.parse(r);
    var lines = (o && o.line_options) || [];
    if (!lines.length) return { code: -1, msg: '无可播放线路' };

    // 优先：直链 m3u8（free 线路，无需再解析）
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (ln.url_kind === 'm3u8' && ln.resolved === true && ln.resolve_mode === 'direct' && ln.url) {
        return { code: 0, url: ln.url, header: playHeader() };
      }
    }
    // 其次：任何已解析的 m3u8
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].url_kind === 'm3u8' && lines[i].url) return { code: 0, url: lines[i].url, header: playHeader() };
    }
    // 最后：解析 ticket
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.url_kind === 'resolve_ticket' && l.url) {
        var ticket = l.url.indexOf('rpt1.') === 0 ? l.url : (l.url.split('rpt1.').pop());
        var pr = http('POST', '/v1/playback/resolve-line', JSON.stringify({ ticket: ticket }));
        if (pr) {
          try {
            var po = JSON.parse(pr);
            if (po && po.line && po.line.url) return { code: 0, url: po.line.url, header: playHeader() };
          } catch (x) {}
        }
      }
    }
    // 兜底：返回首个有 url 的
    for (var i = 0; i < lines.length; i++) if (lines[i].url) return { code: 0, url: lines[i].url, header: playHeader() };
    return { code: -1, msg: '无可用播放地址' };
  } catch (e) {
    return { code: -1, msg: 'play 异常: ' + (e && e.message) };
  }
}

function playHeader() {
  return {
    'user-agent': CONFIG.ua,
    'referer': SITE + '/',
    'accept': '*/*'
  };
}

/* ------------------------------ 演示兜底（realMode=false 时用） ------------------------------ */
function demoHome() {
  return { code: 0, msg: '', data: { class: homeClasses(), filters: {}, list: [
    { vod_id: 'av_demo1', vod_name: '示例影片A', vod_pic: 'https://gimg0.baidu.com/gimg/app=2001&n=0&g=0n&fmt=webp&src=img.baipiaozhe.com/assets/images/ee/ee0635a5a1d20ad40dda9440d774845ff5575b8905c171cda4e4c7792f2d9971.webp', vod_remarks: '演示' }
  ] } };
}
function demoDetail(ids) {
  return { code: 0, data: [ { vod_id: 'av_demo1', vod_name: '示例影片A', vod_pic: '', vod_play_from: 'kanju',
    vod_play_url: '正片$https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' } ] };
}
function demoSearch(wd) { return demoHome(); }
function demoPlay(flag, id) {
  var url = (id + '').indexOf('http') === 0 ? id : 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  return { code: 0, url: url, header: playHeader() };
}
