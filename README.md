# kanju.ai → TVBox / 影视仓 播放接口

把你提供的 kanju.ai 账号接进 TVBox / 影视仓 的一套**自托管源服务**。

> ⚠️ 重要说明
> - kanju.ai（看剧AI）是一个**封闭式商业流媒体平台**，官方**没有公开** TVBox 接口或 JSON 源。
> - 因此这里用"自建源服务 + 自定义爬虫(spider)"的方式把它的内容桥接给 TVBox。
> - 要让它**真正播放 kanju.ai 的内容**，需要你在浏览器里抓到 kanju.ai 真实的登录/列表/播放接口，并填进 `spider.js`（见下方"抓取真实接口"）。在这之前，服务以**演示数据**运行，用于验证整条链路能加载、能点开播放。

---

## 〇、手机端免电脑方案（推荐，家里无常开电脑用这个）

TVBox 运行时，爬虫（spider）是在**你手机 App 内部**执行的，直接拿账号密码去请求 kanju.ai，**全程不需要家里的电脑**。只需：

1. 把 `spider.js` 传到一个一直在线、能直链访问的地方（GitHub Raw / jsDelivr 等，**只做一次**）。
2. 手机浏览器打开 `make-config.html`，填 spider 网址 + 账号密码，点“生成并下载 config.json”。
3. 把 `config.json` 导入 TVBox（设置→配置地址→选文件；或也托管成网址后填网址）。
4. 换账号：重新打开 `make-config.html` 改完再生成一次即可。

详见 `make-config.html` 页面内的引导。

---

## 一、运行（电脑常开局域网方案，可选）

需要 Node.js（已自带即可）。

```bash
cd C:\Users\Cloudwd\Desktop\Tvbox
node server.js
```

启动后会有两个地址（把 `8388` 换成你的端口，本机 IP 用 `ipconfig` 查）：

| 用途 | 地址 |
| --- | --- |
| **TVBox 配置地址**（填进 App） | `http://<本机IP>:8388/config.json` |
| **修改账号密码页面** | `http://<本机IP>:8388/admin` |

> 手机/电视上的 TVBox 必须和这台电脑在**同一个 WiFi/局域网**下，才能访问到 `http://<本机IP>:...`。
> 若想让外网也能用，请用内网穿透（如 frp / ngrok / Cloudflare Tunnel），那样配置地址改成穿透后的公网地址即可。

---

## 二、在 TVBox / 影视仓 里填配置

1. 打开 TVBox（或影视仓）。
2. 进入 **设置 → 配置地址**（影视仓是首页右上角 `+` → 添加）。
3. 填入：`http://<本机IP>:8388/config.json`
4. 确定后返回首页，等待加载。会看到名为「看剧AI」的源。
5. 点进去即可看到列表、搜索、播放。

---

## 三、在配置页面修改账号和密码

打开 `http://<本机IP>:8388/admin`：

- **kanju.ai 账号（邮箱）**：填 `tianweiwd@qq.com`（默认已填）
- **kanju.ai 密码**：填 `Qetuo2012@`（默认已填）
- **站点显示名**：TVBox 里显示的源名称
- **启用真实接口**：在你填好 `spider.js` 里的真实请求逻辑后，勾选它

保存后，**TVBox 刷新一下（长按首页或重新加载配置）** 就会用新账号。

> 账号密码通过 `/config.json` 的 `ext` 字段传给 spider。这是**本地/私用**方案，请勿把该配置地址公开给别人。

---

## 四、抓取真实接口（把它变成"真能用"）

默认是演示数据。要让它播放 kanju.ai 真实内容，需要抓包：

1. 电脑浏览器打开 https://kanju.ai 并**登录**你的账号。
2. 按 `F12` 打开开发者工具 → **Network（网络）** 面板。
3. 依次操作并记下接口：
   - **登录**：在登录/刷新时看发往 `/api/...` 或 `api.kanju.ai/...` 的请求，记录 URL、`method`、请求体（email/password 字段名）、返回里哪里是 `token`。
   - **首页/列表**：看加载剧集列表的请求，记录返回里 `vod_id / name / pic / remarks` 对应字段。
   - **详情**：点开某剧，记录分集列表接口。
   - **播放**：点播放，记录最终的 `.m3u8` 或 `.mp4` 直链在哪里返回。
4. 把这些信息填进 `spider.js` 中标记为 **`TODO`** 的几个函数：
   - `login()`：用账号密码换 token
   - `realHomeVod()` / `realCategory()` / `realSearch()`：返回 `{list:[...]}`
   - `realDetail(id)`：返回分集 `vod_play_url`
   - `realPlay(flag,id)`：返回真实直链 `{url:...}`
5. 在 `/admin` 页面勾选 **启用真实接口**，TVBox 刷新即可。

> spider 在 TVBox/影视仓 里通过内置 JS 引擎运行，环境提供全局 `request(url)` / `request({url,method,headers,data})` 用来发网络请求，并支持读取 `init(ext)` 传进来的账号信息。

---

## 五、文件说明

| 文件 | 作用 |
| --- | --- |
| `server.js` | 源服务器：返回配置地址、spider、配置页面 |
| `spider.js` | CatVod JS 爬虫：实现 TVBox 要求的接口，含演示数据与真实接口骨架 |
| `config.json` | 本地保存的账号密码 / 站点名 / 真实模式开关（被 `/admin` 读写） |
| `README.md` | 本说明 |

---

## 六、常见问题

- **TVBox 提示"拉取失败/源为空"**：检查手机和电脑是否同一 WiFi；检查电脑防火墙是否放行 `8388` 端口；用手机浏览器直接打开配置地址看能否返回 JSON。
- **只显示演示影片**：说明还在演示模式（realMode=false），按第四节抓包并填写真实接口后才会是 kanju.ai 真实内容。
- **换账号不生效**：在 `/admin` 保存后，TVBox 里"重置"或重新加载配置即可。
