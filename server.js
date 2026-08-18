'use strict';

/**
 * kanju.ai -> TVBox / 影视仓 源服务器
 * -------------------------------------------------
 * 这是一个零依赖的 Node.js 服务，提供：
 *   1) /config.json  —— TVBox 配置地址（直接填进 TVBox/影视仓 的“配置地址”）
 *   2) /spider.js    —— CatVod JS 爬虫（实现 init/home/homeVod/category/detail/search/play）
 *   3) /admin        —— 配置页面（在浏览器里修改 kanju.ai 账号和密码）
 *
 * 运行： node server.js
 * 然后浏览器打开 http://<这台电脑的IP>:8388/admin 修改账号密码，
 * 在 TVBox 里填入 http://<IP>:8388/config.json 即可。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8388;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');

// ---------- 配置读写 ----------
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {
      // kanju.ai 账号（在 /admin 页面可改）
      kanjuEmail: 'tianweiwd@qq.com',
      kanjuPassword: 'Qetuo2012@',
      // kanju.ai 站点显示名
      siteName: '看剧AI',
      // spider 拉取地址（一般不用改）
      spiderUrl: '/spider.js',
      // 真实接口模式：false=演示回退，true=调用你在 spider.js 里填好的 kanju.ai 接口
      realMode: false
    };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// ---------- 工具 ----------
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}

function sendJSON(res, obj) {
  send(res, 200, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

function sendFile(res, file, contentType) {
  try {
    const buf = fs.readFileSync(file);
    send(res, 200, buf, { 'Content-Type': contentType });
  } catch (e) {
    send(res, 404, 'Not found');
  }
}

// ---------- 路由 ----------
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // 1) 配置地址（TVBox 用）
  if (pathname === '/config.json') {
    const cfg = loadConfig();
    const base = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['host']}`;
    const config = {
      spider: base + (cfg.spiderUrl.startsWith('/') ? cfg.spiderUrl : '/' + cfg.spiderUrl),
      sites: [
        {
          key: 'kanju',
          name: cfg.siteName || '看剧AI',
          type: 3,
          api: '',
          searchable: 1,
          quickSearch: 1,
          filterable: 1,
          // 把账号密码通过 ext 传给 spider。注意：仅本地/私用，勿公开该地址。
          ext: JSON.stringify({
            // 这里塞入账号信息，spider 读取后登录 kanju.ai
            kanjuEmail: cfg.kanjuEmail,
            kanjuPassword: cfg.kanjuPassword,
            realMode: !!cfg.realMode,
            ua: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile'
          })
        }
      ]
    };
    return sendJSON(res, config);
  }

  // 2) spider 脚本
  if (pathname === '/spider.js') {
    return sendFile(res, path.join(ROOT, 'spider.js'), 'application/javascript; charset=utf-8');
  }

  // 3) 配置页面（改账号密码）
  if (pathname === '/admin') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const cfg = loadConfig();
          if (typeof data.kanjuEmail === 'string') cfg.kanjuEmail = data.kanjuEmail;
          if (typeof data.kanjuPassword === 'string') cfg.kanjuPassword = data.kanjuPassword;
          if (typeof data.siteName === 'string') cfg.siteName = data.siteName;
          if (typeof data.realMode === 'boolean') cfg.realMode = data.realMode;
          saveConfig(cfg);
          sendJSON(res, { ok: true });
        } catch (e) {
          sendJSON(res, { ok: false, error: String(e) });
        }
      });
      return;
    }
    // GET -> 返回页面
    const cfg = loadConfig();
    return send(res, 200, adminPage(cfg), { 'Content-Type': 'text/html; charset=utf-8' });
  }

  // 4) 健康检查
  if (pathname === '/') {
    return send(res, 200,
      '<html><body style="font-family:sans-serif"><h2>kanju.ai TVBox 源服务</h2>' +
      '<p>配置地址（填进 TVBox/影视仓）：<code>/config.json</code></p>' +
      '<p>修改账号密码：<a href="/admin">/admin</a></p></body></html>',
      { 'Content-Type': 'text/html; charset=utf-8' });
  }

  send(res, 404, 'Not found');
});

// ---------- 配置页面 HTML ----------
function adminPage(cfg) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>kanju.ai 源配置</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f6fa;margin:0;padding:24px;color:#222}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,.06)}
  h2{margin-top:0}
  label{display:block;margin:14px 0 6px;font-weight:600;font-size:14px}
  input[type=text],input[type=password]{width:100%;padding:10px 12px;border:1px solid #d9dbe3;border-radius:8px;font-size:14px}
  .row{display:flex;align-items:center;gap:8px;margin:16px 0}
  button{background:#2d6cdf;color:#fff;border:0;padding:11px 18px;border-radius:8px;font-size:15px;cursor:pointer}
  button:hover{background:#2559bd}
  .msg{margin-top:14px;font-size:14px;min-height:20px}
  .ok{color:#1a9e54}.err{color:#d23b3b}
  .tip{background:#f0f4ff;border-left:3px solid #2d6cdf;padding:10px 12px;border-radius:6px;font-size:13px;color:#444;line-height:1.6;margin-top:18px}
  code{background:#eef1f6;padding:2px 6px;border-radius:4px}
</style>
</head>
<body>
<div class="card">
  <h2>kanju.ai 源配置</h2>
  <p style="color:#666;font-size:13px;margin-top:-6px">在这里修改 kanju.ai 的账号和密码，保存后 TVBox 会在下次刷新时自动使用新账号。</p>

  <label>kanju.ai 账号（邮箱）</label>
  <input type="text" id="email" value="${escapeHtml(cfg.kanjuEmail || '')}">

  <label>kanju.ai 密码</label>
  <input type="password" id="password" value="${escapeHtml(cfg.kanjuPassword || '')}" autocomplete="new-password">

  <label>站点显示名</label>
  <input type="text" id="siteName" value="${escapeHtml(cfg.siteName || '看剧AI')}">

  <div class="row">
    <input type="checkbox" id="realMode" ${cfg.realMode ? 'checked' : ''}>
    <label for="realMode" style="margin:0">启用真实接口（已按抓包填好 spider.js 后勾选）</label>
  </div>

  <button onclick="save()">保存配置</button>
  <div class="msg" id="msg"></div>

  <div class="tip">
    <b>使用步骤：</b><br>
    1. 本机运行 <code>node server.js</code>，手机/电视与电脑同一 WiFi。<br>
    2. 在 TVBox/影视仓 的“配置地址”填入：<br><code>http://&lt;本机IP&gt;:8388/config.json</code><br>
    3. 需要换账号时，打开 <code>http://&lt;本机IP&gt;:8388/admin</code> 修改即可。
  </div>
</div>
<script>
function escapeHtml(s){return (s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
function save(){
  var msg=document.getElementById('msg');
  msg.className='msg';msg.textContent='保存中...';
  fetch('/admin',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      kanjuEmail:document.getElementById('email').value,
      kanjuPassword:document.getElementById('password').value,
      siteName:document.getElementById('siteName').value,
      realMode:document.getElementById('realMode').checked
    })}).then(function(r){return r.json()}).then(function(d){
      if(d.ok){msg.className='msg ok';msg.textContent='✅ 已保存，TVBox 刷新即可生效';}
      else{msg.className='msg err';msg.textContent='❌ 保存失败：'+d.error;}
    }).catch(function(e){msg.className='msg err';msg.textContent='❌ 网络错误：'+e;});
}
</script>
</body></html>`;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

server.listen(PORT, HOST, () => {
  console.log(`kanju.ai TVBox 源服务已启动`);
  console.log(`  配置地址: http://0.0.0.0:${PORT}/config.json`);
  console.log(`  配置页面: http://0.0.0.0:${PORT}/admin`);
});
