/**
 * T-06 最小烟测：每站点 persist 分区命名、cookie 隔离、跨进程保留、默认 UA 未被覆盖。
 *
 * 需用同一个临时 userData 分两次运行（第一次写、第二次验证）：
 *   $tmp = Join-Path $env:TEMP ("booru-sessions-" + [guid]::NewGuid())
 *   $env:SPIKE_USER_DATA=$tmp; $env:SPIKE_PHASE=write;  pnpm exec electron scripts/spike-sessions.cjs
 *   $env:SPIKE_USER_DATA=$tmp; $env:SPIKE_PHASE=verify; pnpm exec electron scripts/spike-sessions.cjs
 *
 * 退出码：0 = 全部检查通过；1 = 任一检查失败。
 * 仅用于本地验证，不写入应用代码；不打印 cookie 值（05 §8）。
 */
const { app, session } = require('electron');

const SITES = ['yande', 'konachan'];
const COOKIE_NAME = 'spike_marker';
const COOKIE_URL = 'https://spike.test/';
const PHASE = process.env.SPIKE_PHASE === 'verify' ? 'verify' : 'write';
const USER_DATA = process.env.SPIKE_USER_DATA;

if (USER_DATA) app.setPath('userData', USER_DATA);

const log = (message) => process.stdout.write(`[${PHASE}] ${message}\n`);

const partitionOf = (site) => `persist:${site}`;
const failures = [];
const check = (ok, label, detail = '') => {
  log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(label);
};

async function readMarker(ses) {
  const cookies = await ses.cookies.get({ name: COOKIE_NAME });
  return cookies.length > 0 ? cookies[0].value : null;
}

async function writePhase() {
  const defaultUa = session.defaultSession.getUserAgent();
  const sessions = new Map();

  for (const site of SITES) {
    const partition = partitionOf(site);
    const ses = session.fromPartition(partition);
    sessions.set(site, ses);

    check(partition.startsWith('persist:'), `${site} 分区以 persist: 开头`, partition);
    check(ses.getUserAgent() === defaultUa, `${site} 未覆盖默认 UA`);
  }
  check(
    partitionOf('yande') !== partitionOf('konachan'),
    '两站分区名互不相同',
    `${partitionOf('yande')} / ${partitionOf('konachan')}`
  );

  for (const site of SITES) {
    const ses = sessions.get(site);
    await ses.cookies.set({
      url: COOKIE_URL,
      name: COOKIE_NAME,
      value: site,
      path: '/',
      secure: true,
      // 无 expirationDate 的 cookie 是会话 cookie，不会落盘
      expirationDate: Math.floor(Date.now() / 1000) + 86400
    });
    check((await readMarker(ses)) === site, `${site} 分区写入了自己的 cookie`);
  }

  for (const site of SITES) {
    const other = SITES.find((s) => s !== site);
    const otherSes = sessions.get(other);
    check(
      (await readMarker(otherSes)) === other,
      `${site} 的 cookie 未串入 ${other} 分区`,
      `期望 ${other}`
    );
  }
  check(
    (await readMarker(session.defaultSession)) === null,
    '默认分区不含站点测试 cookie（与站点分区隔离）'
  );

  await sessions.get('yande').cookies.flushStore();
  await sessions.get('konachan').cookies.flushStore();
  log('已落盘，等待下一次启动验证');
}

async function verifyPhase() {
  const defaultUa = session.defaultSession.getUserAgent();

  for (const site of SITES) {
    const ses = session.fromPartition(partitionOf(site));
    check(ses.getUserAgent() === defaultUa, `${site} 重启后仍保留默认 UA`);
    check(
      (await readMarker(ses)) === site,
      `${site} 重启后 cookie 仍保留`,
      `value=${await readMarker(ses)}`
    );
  }
  check((await readMarker(session.defaultSession)) === null, '重启后默认分区仍不含站点测试 cookie');
}

app
  .whenReady()
  .then(() => (PHASE === 'verify' ? verifyPhase() : writePhase()))
  .then(() => {
    log(`RESULT: ${failures.length === 0 ? 'PASS' : 'FAIL'} failures=${failures.length}`);
    process.exit(failures.length === 0 ? 0 : 1);
  })
  .catch((error) => {
    log(`RESULT: FAIL error=${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });
