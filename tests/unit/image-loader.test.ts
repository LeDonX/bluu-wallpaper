import {
  fetchImageBytes,
  type ImageTransport,
  type ImageTransportResponse,
  isAllowedImageUrl
} from '@main/network/image-loader';
import type { ImageProgress } from '@shared/ipc-contract';
import { describe, expect, it } from 'vitest';

interface ResponseOptions {
  status?: number;
  contentLength?: string | null;
  contentType?: string | null;
  chunks?: Uint8Array[];
  /** 传入 null 表示无流，走 arrayBuffer 分支 */
  body?: ReadableStream<Uint8Array> | null;
  buffer?: ArrayBuffer;
}

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    }
  });
}

function createResponse(options: ResponseOptions = {}): ImageTransportResponse {
  const {
    status = 200,
    contentLength = null,
    contentType = null,
    chunks = [],
    body,
    buffer = new ArrayBuffer(0)
  } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string): string | null {
        const key = name.toLowerCase();
        if (key === 'content-length') return contentLength;
        if (key === 'content-type') return contentType;
        return null;
      }
    },
    body: body === undefined ? streamOf(chunks) : body,
    arrayBuffer: async () => buffer
  };
}

const input = { requestId: 'req-1', url: 'https://files.yande.re/image/1.jpg' };

describe('图片地址白名单（DR-028）', () => {
  it('只允许 https 且属于已配置图片域名', () => {
    expect(isAllowedImageUrl('https://files.yande.re/image/1.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://assets.yande.re/sample/1.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://files.konachan.com/image/1.jpg')).toBe(true);
    expect(isAllowedImageUrl('http://files.yande.re/image/1.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://yande.re/post/show/1')).toBe(false);
    expect(isAllowedImageUrl('not a url')).toBe(false);
  });

  it('非法地址返回 CONFIG 且不触发传输', async () => {
    let calls = 0;
    const transport: ImageTransport = async () => {
      calls += 1;
      return createResponse();
    };

    const result = await fetchImageBytes(
      { requestId: 'req-1', url: 'https://example.com/1.jpg' },
      { transport }
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(calls).toBe(0);
  });
});

describe('images:fetch 流式读取', () => {
  it('按块聚合字节并报告 Content-Length 总长', async () => {
    const progress: ImageProgress[] = [];
    let clock = 0;
    const transport: ImageTransport = async () =>
      createResponse({
        contentLength: '10',
        contentType: 'image/jpeg; charset=binary',
        chunks: [new Uint8Array(4), new Uint8Array(6)]
      });

    const result = await fetchImageBytes(input, {
      transport,
      onProgress: (value) => progress.push(value),
      now: () => (clock += 1000)
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expect success');

    expect(result.data.mimeType).toBe('image/jpeg');
    expect(result.data.bytes.byteLength).toBe(10);
    expect(progress.map((value) => value.loaded)).toEqual([4, 10, 10]);
    expect(progress.every((value) => value.requestId === 'req-1')).toBe(true);
    expect(progress.every((value) => value.total === 10)).toBe(true);
  });

  it('进度按 100ms 节流，结束时强制上报最终字节', async () => {
    const progress: ImageProgress[] = [];
    const transport: ImageTransport = async () =>
      createResponse({
        contentLength: '10',
        chunks: [new Uint8Array(4), new Uint8Array(6)]
      });

    const result = await fetchImageBytes(input, {
      transport,
      onProgress: (value) => progress.push(value),
      now: () => 0
    });

    expect(result.ok).toBe(true);
    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ loaded: 4, total: 10 });
    expect(progress[1]).toMatchObject({ loaded: 10, total: 10 });
  });

  it('缺少 Content-Length 时总长为 null（渲染层展示不确定进度）', async () => {
    const progress: ImageProgress[] = [];
    const transport: ImageTransport = async () => createResponse({ chunks: [new Uint8Array(5)] });

    const result = await fetchImageBytes(input, {
      transport,
      onProgress: (value) => progress.push(value),
      now: () => 1
    });

    expect(result.ok).toBe(true);
    expect(progress.at(-1)).toMatchObject({ loaded: 5, total: null });
  });

  it('无响应流时退回 arrayBuffer 并上报全量', async () => {
    const progress: ImageProgress[] = [];
    const transport: ImageTransport = async () =>
      createResponse({ body: null, buffer: new ArrayBuffer(8) });

    const result = await fetchImageBytes(input, {
      transport,
      onProgress: (value) => progress.push(value)
    });

    expect(result.ok).toBe(true);
    expect(progress).toEqual([{ requestId: 'req-1', loaded: 8, total: 8 }]);
  });

  it('HTTP 错误映射为 NETWORK，5xx 可重试', async () => {
    const transport: ImageTransport = async () => createResponse({ status: 503 });

    const result = await fetchImageBytes(input, { transport });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NETWORK', retryable: true, detail: 'HTTP 503' }
    });
  });

  it('超时中止传输并返回 TIMEOUT', async () => {
    const transport: ImageTransport = (_url, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });

    const result = await fetchImageBytes(input, { transport, timeoutMs: 10 });

    expect(result).toMatchObject({ ok: false, error: { code: 'TIMEOUT', retryable: true } });
  });
});
