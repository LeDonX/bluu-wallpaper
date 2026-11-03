import { readFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 09 §2：场景通过请求头切换，同一端口即可覆盖全部用例 */
export const SCENARIO_HEADER = 'x-scenario';

export const MOCK_SCENARIOS = ['ok', '429-3', 'challenge-once', 'challenge-always', 'timeout'] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number];

/** timeout 场景的挂起时长：远大于测试里的 timeoutMs，用于触发客户端超时分支 */
const TIMEOUT_SCENARIO_DELAY_MS = 30_000;

export interface MockRequestRecord {
  path: string;
  scenario: MockScenario;
  atMs: number;
}

export interface MockStats {
  requestCount: number;
  firstAtMs: number | null;
  lastAtMs: number | null;
  requests: MockRequestRecord[];
}

export interface MockServer {
  readonly baseUrl: string;
  url(path: string): string;
  stats(): MockStats;
  close(): Promise<void>;
}

const CHALLENGE_FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/konachan/challenge-403.html'
);

const isMockScenario = (value: string): value is MockScenario =>
  (MOCK_SCENARIOS as readonly string[]).includes(value);

const sendJson = (
  res: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
): void => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(payload));
};

/**
 * 09 §2 的本地 mock server：监听 127.0.0.1 随机端口，不访问真实站点。
 * 只有 /__stats 需要被断言，因此其余路径统一返回空数组，具体 fixtures 切分留给适配器任务。
 */
export async function startMockServer(): Promise<MockServer> {
  const challengeHtml = await readFile(CHALLENGE_FIXTURE, 'utf8');
  const requests: MockRequestRecord[] = [];
  const scenarioCounts = new Map<string, number>();
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  const buildStats = (): MockStats => ({
    requestCount: requests.length,
    firstAtMs: requests[0]?.atMs ?? null,
    lastAtMs: requests.at(-1)?.atMs ?? null,
    requests: requests.map((record) => ({ ...record }))
  });

  const nextCount = (scenario: MockScenario): number => {
    const count = (scenarioCounts.get(scenario) ?? 0) + 1;
    scenarioCounts.set(scenario, count);
    return count;
  };

  const sendChallenge = (res: ServerResponse): void => {
    res.writeHead(403, { 'content-type': 'text/html; charset=UTF-8', server: 'cloudflare' });
    res.end(challengeHtml);
  };

  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';

    // 统计端点本身不计数，否则采样会污染限速断言
    if (path === '/__stats') {
      sendJson(res, 200, buildStats());
      return;
    }

    const rawScenario = req.headers[SCENARIO_HEADER];
    const scenarioValue = Array.isArray(rawScenario) ? rawScenario[0] : rawScenario;
    const scenario: MockScenario =
      scenarioValue !== undefined && isMockScenario(scenarioValue) ? scenarioValue : 'ok';

    requests.push({ path, scenario, atMs: Date.now() });

    switch (scenario) {
      case '429-3': {
        if (nextCount(scenario) <= 3) {
          res.writeHead(429, { 'retry-after': '1' });
          res.end('');
          return;
        }
        sendJson(res, 200, []);
        return;
      }
      case 'challenge-once': {
        if (nextCount(scenario) === 1) {
          sendChallenge(res);
          return;
        }
        sendJson(res, 200, []);
        return;
      }
      case 'challenge-always': {
        sendChallenge(res);
        return;
      }
      case 'timeout': {
        // 挂起响应，客户端 abort 后由 close 事件清理定时器，避免测试进程被拖住
        const timer = setTimeout(() => {
          pendingTimers.delete(timer);
          sendJson(res, 200, []);
        }, TIMEOUT_SCENARIO_DELAY_MS);
        pendingTimers.add(timer);
        res.on('close', () => {
          clearTimeout(timer);
          pendingTimers.delete(timer);
        });
        return;
      }
      case 'ok': {
        sendJson(res, 200, []);
        return;
      }
    }
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', fail);
      done();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('mock server 未获得 TCP 端口');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const close = (): Promise<void> =>
    new Promise<void>((done, fail) => {
      for (const timer of pendingTimers) clearTimeout(timer);
      pendingTimers.clear();
      server.closeAllConnections();
      server.close((error) => {
        if (error) fail(error);
        else done();
      });
    });

  return {
    baseUrl,
    url: (path) => new URL(path, baseUrl).toString(),
    stats: buildStats,
    close
  };
}
