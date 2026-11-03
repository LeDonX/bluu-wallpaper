import { fetchImageBytes, type ImageTransport } from '@main/network/image-loader';
import { createAppError, type Result } from '@shared/errors';
import type { ImageBinary, ImageProgress } from '@shared/ipc-contract';
import { z } from 'zod';

const imageFetchSchema = z.object({
  requestId: z.string().min(1).max(80),
  url: z.string().min(1).max(2048)
});

export type ImagesFetchHandler = (
  raw: unknown,
  onProgress: (progress: ImageProgress) => void
) => Promise<Result<ImageBinary>>;

/** 03 §7 / DR-028：入参校验后交给网络层流式读取；进度由调用方绑定 webContents */
export function createImagesFetchHandler(transport: ImageTransport): ImagesFetchHandler {
  return (raw, onProgress) => {
    const parsed = imageFetchSchema.safeParse(raw);
    if (!parsed.success) {
      return Promise.resolve({
        ok: false,
        error: createAppError('CONFIG', '图片请求参数无效', {
          detail: parsed.error.issues[0]?.message
        })
      });
    }

    return fetchImageBytes(parsed.data, { transport, onProgress });
  };
}
