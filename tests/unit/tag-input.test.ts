import { isTagType, TAG_TYPES, tagTypeFromCode } from '@shared/models';
import { activeToken, replaceActiveToken, suggestPrefix } from '@shared/tags';
import { describe, expect, it } from 'vitest';

describe('标签联想纯函数', () => {
  it('activeToken 取末尾未结束的 token；以空白结尾视为正在开新标签', () => {
    expect(activeToken('hatsune mi')).toBe('mi');
    expect(activeToken('hatsune ')).toBe('');
    expect(activeToken('')).toBe('');
    expect(activeToken('  ')).toBe('');
  });

  it('suggestPrefix 只对 ≥2 字符的普通标签生效', () => {
    expect(suggestPrefix('mi')).toBe('mi');
    expect(suggestPrefix('m')).toBeNull();
    expect(suggestPrefix('rating:s')).toBeNull();
    expect(suggestPrefix('score:>=100')).toBeNull();
    expect(suggestPrefix('-miku')).toBeNull();
  });

  it('replaceActiveToken 替换当前 token 并保留前面已输入内容', () => {
    expect(replaceActiveToken('hatsune mi', '')).toBe('hatsune');
    expect(replaceActiveToken('mi', 'hatsune_miku')).toBe('hatsune_miku');
    expect(replaceActiveToken('', 'hatsune')).toBe('hatsune');
  });
});

describe('06 §4 标签类型映射', () => {
  it('0/1/3/4 映射为 general/artist/copyright/character', () => {
    expect(tagTypeFromCode(0)).toBe('general');
    expect(tagTypeFromCode(1)).toBe('artist');
    expect(tagTypeFromCode(3)).toBe('copyright');
    expect(tagTypeFromCode(4)).toBe('character');
  });

  it('未知整数与非法字符串按 general 处理', () => {
    expect(tagTypeFromCode(2)).toBe('general');
    expect(tagTypeFromCode(99)).toBe('general');
    expect(isTagType('artist')).toBe(true);
    expect(isTagType('unknown')).toBe(false);
    expect(isTagType(null)).toBe(false);
    expect(TAG_TYPES).toEqual(['general', 'artist', 'copyright', 'character']);
  });
});
