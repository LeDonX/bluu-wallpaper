/** 02 §5.2：滚轮与快捷键共享的缩放范围 */
export const VIEWER_MIN_ZOOM = 0.5;
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
