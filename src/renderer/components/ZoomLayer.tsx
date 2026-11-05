import {
  clampViewerOffset,
  fitContentSize,
  stepZoom,
  type ViewerSize,
  type ViewerTransform,
  zoomAtPoint
} from '@shared/viewer';
import type { PointerEvent, ReactElement, ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import styles from './ImageViewer.module.css';

export interface ZoomLayerProps {
  /** 预览图 blob URL；未就绪时为 null（DR-028） */
  sampleSrc: string | null;
  /** 原图 blob URL；未就绪时为 null（DR-028） */
  originalSrc: string | null;
  alt: string;
  transform: ViewerTransform;
  onTransformChange(next: ViewerTransform): void;
  onReset(): void;
  /** 加载进度/错误浮层，不参与缩放变换 */
  children?: ReactNode;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * 02 §5.2：图片区支持滚轮缩放（以鼠标为锚点）、拖动、双击复位。
 * 原生 wheel 监听必须 `passive: false` 才能阻止默认滚动。
 * DR-028：只渲染 store 产出的 blob URL，不再从渲染层直连图片域名。
 */
export function ZoomLayer({
  sampleSrc,
  originalSrc,
  alt,
  transform,
  onTransformChange,
  onReset,
  children
}: ZoomLayerProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // 只渲染一张图：原图就绪后直接替换预览图，避免两张图叠在一起
  const src = originalSrc ?? sampleSrc;
  const zoomed = transform.zoom > 1;

  /** 读取预览区尺寸与图片 100% 时的 contain 展示尺寸，用于拖拽边界 */
  const measureBounds = useCallback((): { content: ViewerSize; viewport: ViewerSize } | null => {
    const canvas = containerRef.current;
    const image = imageRef.current;
    if (canvas === null || image === null) return null;
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return null;

    const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    const content = fitContentSize(
      { width: image.naturalWidth, height: image.naturalHeight },
      viewport
    );
    return { content, viewport };
  }, []);

  const clampTransform = useCallback(
    (next: ViewerTransform): ViewerTransform => {
      const bounds = measureBounds();
      if (bounds === null) return next;
      return clampViewerOffset(next, bounds.content, bounds.viewport);
    },
    [measureBounds]
  );

  // 键盘缩放、图片替换后兜底：任何来源的变换都收回到图片边界内
  useEffect(() => {
    const clamped = clampTransform(transform);
    if (clamped !== transform) onTransformChange(clamped);
  }, [clampTransform, onTransformChange, src, transform]);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const pointer = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2
      };
      const nextZoom = stepZoom(transform.zoom, event.deltaY < 0 ? 1 : -1);
      onTransformChange(clampTransform(zoomAtPoint(transform, nextZoom, pointer, { x: 0, y: 0 })));
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [clampTransform, onTransformChange, transform]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!zoomed || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;

    onTransformChange(
      clampTransform({
        ...transform,
        offsetX: drag.offsetX + event.clientX - drag.startX,
        offsetY: drag.offsetY + event.clientY - drag.startY
      })
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.canvas}
      data-zoomed={zoomed}
      role="group"
      aria-label="图片缩放区"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onReset}
    >
      <div
        className={styles.stage}
        style={{
          transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.zoom})`
        }}
      >
        {src !== null ? (
          <img
            ref={imageRef}
            className={styles.image}
            src={src}
            alt={alt}
            draggable={false}
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}
