import {
  postSelectionKey,
  selectKeyRange,
  toggleSelectionKey
} from '@shared/selection';
import { describe, expect, it } from 'vitest';

const orderedKeys = ['yande:1', 'yande:2', 'yande:3', 'yande:4', 'yande:5'];

describe('多选模型（02 §7.1 / DR-038）', () => {
  it('选中键包含站点，避免两站同 id 串选', () => {
    expect(postSelectionKey({ site: 'yande', id: 7 })).toBe('yande:7');
    expect(postSelectionKey({ site: 'konachan', id: 7 })).toBe('konachan:7');
  });

  it('点击切换单项且不修改入参集合', () => {
    const initial = new Set(['yande:1']);
    const added = toggleSelectionKey(initial, 'yande:2');
    expect([...added]).toEqual(['yande:1', 'yande:2']);
    expect([...initial]).toEqual(['yande:1']);

    const removed = toggleSelectionKey(added, 'yande:1');
    expect([...removed]).toEqual(['yande:2']);
  });

  it('Shift 连选并入锚点到目标的区间（含两端）', () => {
    const selected = selectKeyRange(new Set(['yande:5']), orderedKeys, 'yande:2', 'yande:4');
    expect([...selected].sort()).toEqual(['yande:2', 'yande:3', 'yande:4', 'yande:5']);
  });

  it('反方向连选与已选集合合并、去重', () => {
    const selected = selectKeyRange(new Set(['yande:1']), orderedKeys, 'yande:4', 'yande:2');
    expect([...selected].sort()).toEqual(['yande:1', 'yande:2', 'yande:3', 'yande:4']);
  });

  it('锚点或目标不在可见列表时保持原集合', () => {
    const initial = new Set(['yande:1']);
    expect(selectKeyRange(initial, orderedKeys, 'yande:9', 'yande:3')).toBe(initial);
    expect(selectKeyRange(initial, orderedKeys, 'yande:1', 'yande:9')).toBe(initial);
  });
});
