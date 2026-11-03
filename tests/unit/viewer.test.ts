import {
  clampZoom,
  formatFileSize,
  progressPercent,
  resetViewerTransform,
  stepIndex,
  stepZoom,
  VIEWER_MAX_ZOOM,
  VIEWER_MIN_ZOOM,
  zoomAtPoint
} from '@shared/viewer';
import { describe, expect, it } from 'vitest';

describe('查看器缩放', () => {
  it('clampZoom 限制在 0.5–4 倍，非法值回到 1', () => {
    expect(clampZoom(0.1)).toBe(VIEWER_MIN_ZOOM);
    expect(clampZoom(10)).toBe(VIEWER_MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(2)).toBe(2);
  });

  it('stepZoom 每次 ±0.25 且不越界', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(VIEWER_MAX_ZOOM, 1)).toBe(VIEWER_MAX_ZOOM);
    expect(stepZoom(VIEWER_MIN_ZOOM, -1)).toBe(VIEWER_MIN_ZOOM);
  });

  it('zoomAtPoint 保持鼠标下的图像点不动（02 §5.2）', () => {
    const current = resetViewerTransform();
    const pointer = { x: 100, y: 50 };
    const next = zoomAtPoint(current, 2, pointer, { x: 0, y: 0 });

    // 放大前图像点在 (100, 50)，放大后应为 offset + 2 * (100, 50) = (100, 50)
    expect(next.zoom).toBe(2);
    expect(next.offsetX).toBe(-100);
    expect(next.offsetY).toBe(-50);
    expect(next.offsetX + 2 * pointer.x).toBe(pointer.x);
    expect(next.offsetY + 2 * pointer.y).toBe(pointer.y);
  });

  it('zoomAtPoint 在相同缩放时保持偏移不变', () => {
    const current = { zoom: 2, offsetX: 12, offsetY: -8 };
    expect(zoomAtPoint(current, 2, { x: 30, y: 40 }, { x: 0, y: 0 })).toEqual(current);
  });
});

describe('查看器切图', () => {
  it('stepIndex 在边界返回 null，不循环', () => {
    expect(stepIndex(0, -1, 3)).toBeNull();
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBeNull();
    expect(stepIndex(2, -1, 3)).toBe(1);
  });
});

describe('图片加载进度（DR-028）', () => {
  it('有总长时返回整数百分比并封顶 100', () => {
    expect(progressPercent(0, 1000)).toBe(0);
    expect(progressPercent(500, 1000)).toBe(50);
    expect(progressPercent(999, 1000)).toBe(99);
    expect(progressPercent(1000, 1000)).toBe(100);
    expect(progressPercent(1200, 1000)).toBe(100);
  });

  it('无总长、非法总长或非法已加载时退化为不确定进度', () => {
    expect(progressPercent(500, null)).toBeNull();
    expect(progressPercent(500, 0)).toBeNull();
    expect(progressPercent(500, -1)).toBeNull();
    expect(progressPercent(500, Number.NaN)).toBeNull();
    expect(progressPercent(-1, 1000)).toBe(0);
    expect(progressPercent(Number.NaN, 1000)).toBe(0);
  });

  it('formatFileSize 输出 B / KB / MB', () => {
    expect(formatFileSize(512)).toBe('512B');
    expect(formatFileSize(917952)).toBe('896.4KB');
    expect(formatFileSize(12 * 1024 * 1024)).toBe('12MB');
    expect(formatFileSize(-1)).toBe('未知');
  });
});
