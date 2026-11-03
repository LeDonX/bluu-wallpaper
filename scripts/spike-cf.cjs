/**
 * T-08 最小 spike：隐藏窗口通过 Cloudflare 挑战 → 读取 cf_clearance → 复用同 session 调 API
 *
 * 运行：pnpm exec electron scripts/spike-cf.cjs
 * 退出码：0 = 拿到 clearance 且 API 返回 JSON；1 = 任一环节失败
 *
 * 仅用于本地验证，不写入应用代码；不打印 cookie 值（05 §8）。
 *
 * 可调环境变量：
 *   SPIKE_SHOW=1        显示窗口（默认隐藏）
 *   SPIKE_UA=electron   不覆盖 UA（默认覆盖为 Chrome UA）
 *   SPIKE_TIMEOUT=90000 cf_clearance 轮询上限（毫秒，默认 45000）
 *   SPIKE_GPU=1         保留硬件加速（默认禁用）
 */
const { app, BrowserWindow, session } = require('electron');

const SITE_URL = 'https://konachan.com/';
const API_URL = 'https://konachan.com/post.json?tags=rating:safe&limit=3';
const PARTITION = process.env.SPIKE_PARTITION || 'persist:konachan';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CLEARANCE_TIMEOUT_MS = Number(process.env.SPIKE_TIMEOUT || 45000);
const HARD_TIMEOUT_MS = CLEARANCE_TIMEOUT_MS + 40000;
const SHOW = process.env.SPIKE_SHOW === '1';
const OVERRIDE_UA = process.env.SPIKE_UA !== 'electron';
const USE_GPU = process.env.SPIKE_GPU === '1';

const isChallenge = (status, body) =>
  status === 403 && /Just a moment|cf-chl-|__cf_chl/i.test(body);

const log = (message) => process.stdout.write(`${new Date().toISOString()} ${message}\n`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageState(win) {
  try {
    return await win.webContents.executeJavaScript(`(() => ({
      title: document.title,
      text: document.body ? document.body.innerText.replace(/\\s+/g, ' ').slice(0, 240) : '',
      hasChallengeForm: Boolean(document.getElementById('challenge-form')),
      hasCfOpt: typeof window._cf_chl_opt !== 'undefined',
      ua: navigator.userAgent,
      webdriver: navigator.webdriver,
      uaBrands: navigator.userAgentData ? navigator.userAgentData.brands.map((b) => b.brand + ' ' + b.version).join('|') : 'n/a'
    }))()`);
  } catch (error) {
    return { error: error.message };
  }
}

async function pollCookie(ses, name, timeoutMs, win) {
  const startedAt = Date.now();
  let lastTitle = '';
  while (Date.now() - startedAt < timeoutMs) {
    const cookies = await ses.cookies.get({ name });
    if (cookies.length > 0) return cookies[0];
    if (
      win &&
      Date.now() - startedAt > 0 &&
      Math.floor((Date.now() - startedAt) / 1000) % 10 === 0
    ) {
      const state = await pageState(win);
      if (state.title !== lastTitle) {
        lastTitle = state.title || '';
        log(
          `after ${Math.round((Date.now() - startedAt) / 1000)}s title=${JSON.stringify(state.title)} cfOpt=${state.hasCfOpt} challengeForm=${state.hasChallengeForm} text=${JSON.stringify(state.text)}`
        );
      }
    }
    await sleep(1000);
  }
  return null;
}

async function main() {
  const ses = session.fromPartition(PARTITION);
  if (OVERRIDE_UA) ses.setUserAgent(UA);

  const win = new BrowserWindow({
    show: SHOW,
    width: 1000,
    height: 800,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  win.webContents.on('did-finish-load', () =>
    log(`did-finish-load url=${win.webContents.getURL()}`)
  );
  win.webContents.on('did-fail-load', (_event, code, description, url) =>
    log(`did-fail-load code=${code} desc=${description} url=${url}`)
  );

  const startedAt = Date.now();
  log(`load ${SITE_URL} show=${SHOW} overrideUa=${OVERRIDE_UA} gpu=${USE_GPU}`);
  try {
    await win.loadURL(SITE_URL);
  } catch (error) {
    log(`loadURL rejected: ${error.message}`);
  }

  const stateAfterLoad = await pageState(win);
  log(`page-state: ${JSON.stringify(stateAfterLoad)}`);

  const clearance = await pollCookie(ses, 'cf_clearance', CLEARANCE_TIMEOUT_MS, win);
  log(
    `cf_clearance: ${clearance ? 'FOUND' : 'NOT FOUND'} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`
  );

  const allCookies = await ses.cookies.get({ domain: 'konachan.com' });
  log(`cookies(names): ${allCookies.map((cookie) => cookie.name).join(', ') || '(none)'}`);

  let res = null;
  let body = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await sleep(2000);
    res = await ses.fetch(API_URL, {
      headers: { Accept: 'application/json', Referer: `${SITE_URL}` },
      credentials: 'include'
    });
    body = await res.text();
    log(
      `ses.fetch attempt=${attempt} status=${res.status} contentType=${res.headers.get('content-type')} bytes=${body.length} isChallenge=${isChallenge(res.status, body)}`
    );
    if (!isChallenge(res.status, body)) break;
  }

  let browserJson = null;
  try {
    const raw = await win.webContents.executeJavaScript(
      `fetch(${JSON.stringify(API_URL)}, { headers: { Accept: 'application/json' } }).then(async (r) => ({ status: r.status, body: await r.text() }))`,
      true
    );
    browserJson = JSON.parse(raw.body);
    log(
      `browser-fetch status=${raw.status} posts=${browserJson.length} firstId=${browserJson[0] ? browserJson[0].id : 'n/a'}`
    );
  } catch (error) {
    log(`browser-fetch failed: ${error.message}`);
  }

  if (isChallenge(res.status, body)) {
    log('fallback: load API inside window');
    try {
      await win.loadURL(API_URL);
      const state = await pageState(win);
      log(`window-api title=${JSON.stringify(state.title)} text=${JSON.stringify(state.text)}`);
    } catch (error) {
      log(`window-api failed: ${error.message}`);
    }
  }

  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    log(`body-preview: ${body.slice(0, 200).replace(/\s+/g, ' ')}`);
  }

  if (Array.isArray(parsed)) {
    log(`api posts=${parsed.length} firstId=${parsed[0] ? parsed[0].id : 'n/a'}`);
  }

  win.destroy();

  const sesFetchOk = !isChallenge(res.status, body) && Array.isArray(parsed);
  const browserFetchOk = Array.isArray(browserJson) && browserJson.length > 0;
  const ok = Boolean(clearance) && (sesFetchOk || browserFetchOk);
  log(
    `RESULT: ${ok ? 'PASS' : 'FAIL'} clearance=${clearance ? 'YES' : 'NO'} ses.fetch=${sesFetchOk ? 'OK' : 'BLOCKED'} browser.fetch=${browserFetchOk ? 'OK' : 'BLOCKED'}`
  );
  return ok;
}

if (!USE_GPU) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
}

setTimeout(() => {
  log('RESULT: FAIL hard timeout');
  process.exit(1);
}, HARD_TIMEOUT_MS);

app
  .whenReady()
  .then(main)
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((error) => {
    log(`RESULT: FAIL error=${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });
