/** 02 §5.2：滚轮与快捷键共享的缩放范围；最小为默认适应尺寸，不允许缩得更小 */
export const VIEWER_MIN_ZOOM = 1;
export const VIEWER_MAX_ZOOM = 4;
export const VIEWER_ZOOM_STEP = 0.25;

/** 变换值以容器中心为原点：offset 为屏幕像素，zoom 为相对适配尺寸的倍数 */
export interface ViewerTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface ViewerPoint {
  x: number;
  y: number;
}

export interface ViewerSize {
  width: number;
  height: number;
}

/** 02 §5.2：把图片按 contain 适配到预览区后的展示尺寸（100% 缩放时） */
export function fitContentSize(content: ViewerSize, viewport: ViewerSize): ViewerSize {
  if (content.width <= 0 || content.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(viewport.width / content.width, viewport.height / content.height);
  return { width: content.width * scale, height: content.height * scale };
}

/** 02 §5.2：拖拽边界——放大后最多拖到图片边缘与预览区边缘对齐 */
export function clampViewerOffset(
  transform: ViewerTransform,
  content: ViewerSize,
  viewport: ViewerSize
): ViewerTransform {
  const zoom = clampZoom(transform.zoom);
  const maxX = Math.max(0, (content.width * zoom - viewport.width) / 2);
  const maxY = Math.max(0, (content.height * zoom - viewport.height) / 2);
  const offsetX = Math.min(maxX, Math.max(-maxX, transform.offsetX));
  const offsetY = Math.min(maxY, Math.max(-maxY, transform.offsetY));

  if (offsetX === transform.offsetX && offsetY === transform.offsetY && zoom === transform.zoom) {
    return transform;
  }
  return { zoom, offsetX, offsetY };
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(VIEWER_MAX_ZOOM, Math.max(VIEWER_MIN_ZOOM, zoom));
}

export function resetViewerTransform(): ViewerTransform {
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}

export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(zoom + direction * VIEWER_ZOOM_STEP);
}

/**
 * 以鼠标为锚点缩放：保持指针下的图像点不动（02 §5.2）。
 * pointer 与 center 使用同一坐标系（容器中心为原点），因此调用方传 center=(0,0)。
 */
export function zoomAtPoint(
  current: ViewerTransform,
  nextZoom: number,
  pointer: ViewerPoint,
  center: ViewerPoint
): ViewerTransform {
  const fromZoom = clampZoom(current.zoom);
  const toZoom = clampZoom(nextZoom);
  if (toZoom === fromZoom) return { ...current, zoom: toZoom };

  // 缩到最小即回到默认适应尺寸：一并清空拖动偏移，避免图片偏出画布
  if (toZoom <= VIEWER_MIN_ZOOM) {
    return { zoom: VIEWER_MIN_ZOOM, offsetX: 0, offsetY: 0 };
  }

  const ratio = 1 - toZoom / fromZoom;
  return {
    zoom: toZoom,
    offsetX: current.offsetX + (pointer.x - center.x - current.offsetX) * ratio,
    offsetY: current.offsetY + (pointer.y - center.y - current.offsetY) * ratio
  };
}

/** 02 §5.3：上一张/下一张，越界返回 null（不循环） */
export function stepIndex(current: number, delta: -1 | 1, total: number): number | null {
  const next = current + delta;
  if (!Number.isInteger(next) || next < 0 || next >= total) return null;
  return next;
}

/** 02 §5.1 / DR-028：Content-Length 缺失时返回 null，由 UI 展示不确定进度 */
export function progressPercent(loaded: number, total: number | null): number | null {
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(loaded) || loaded <= 0) return 0;
  return Math.min(100, Math.floor((loaded / total) * 100));
}

/** 917952 → 896.4KB；用于信息栏展示 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知';
  if (bytes < 1024) return `${Math.round(bytes)}B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${trimFixed(kilobytes)}KB`;

  return `${trimFixed(kilobytes / 1024)}MB`;
}

function trimFixed(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
