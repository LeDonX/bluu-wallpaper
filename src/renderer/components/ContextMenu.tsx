import type { ReactElement } from 'react';
import { useEffect } from 'react';

import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect(): void;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: readonly ContextMenuItem[];
  onClose(): void;
}

const MENU_WIDTH = 168;
const ITEM_HEIGHT = 32;
const EDGE_GAP = 8;

/** 02 §14.1 / DR-046：卡片右键菜单；点击空白、Esc、滚动或缩放均关闭 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): ReactElement {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    const handleScroll = (): void => onClose();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const left = Math.max(EDGE_GAP, Math.min(x, window.innerWidth - MENU_WIDTH - EDGE_GAP));
  const top = Math.max(
    EDGE_GAP,
    Math.min(y, window.innerHeight - items.length * ITEM_HEIGHT - EDGE_GAP * 2)
  );

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onPointerDown={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className={styles.menu}
        style={{ left, top }}
        role="menu"
        aria-label="卡片操作"
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={item.disabled}
            autoFocus={index === 0}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
