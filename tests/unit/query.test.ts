import { parseQuery, QueryError } from '@main/sites/query';
import { describe, expect, it } from 'vitest';

describe('parseQuery 合法语法', () => {
  it('普通标签按空白分割为隐式 AND，保留括号与下划线并归一为小写', () => {
    const query = parseQuery('  Koh_(Minagi_Kou) police_uniform selfie  ');
    expect(query.raw).toBe('Koh_(Minagi_Kou) police_uniform selfie');
    expect(query.tags).toEqual(['koh_(minagi_kou)', 'police_uniform', 'selfie']);
    expect(query.excludedTags).toEqual([]);
    expect(query.ids).toEqual([]);
    expect(query.order).toBeNull();
  });

  it('-tag 进入排除列表，非内置前缀按普通标签处理', () => {
    const query = parseQuery('-censored pool:123 hatsune_miku');
    expect(query.tags).toEqual(['pool:123', 'hatsune_miku']);
    expect(query.excludedTags).toEqual(['censored']);
  });

  it('rating 的 s/q/e 与全称均映射为 safe/questionable/explicit', () => {
    expect(parseQuery('rating:s').ratings).toEqual(['safe']);
    expect(parseQuery('rating:q').ratings).toEqual(['questionable']);
    expect(parseQuery('rating:E').ratings).toEqual(['explicit']);
    expect(parseQuery('rating:safe').ratings).toEqual(['safe']);
  });

  it('-rating:e 保留为排除分级，供 T-16 的 R18 默认过滤使用', () => {
    const query = parseQuery('rating:s -rating:e');
    expect(query.ratings).toEqual(['safe']);
    expect(query.excludedRatings).toEqual(['explicit']);
  });

  it('score 与 width 支持 >= > <= < = 及裸数字', () => {
    const query = parseQuery('score:>=100 score:<-5 width:1920');
    expect(query.scores).toEqual([
      { op: '>=', value: 100 },
      { op: '<', value: -5 }
    ]);
    expect(query.widths).toEqual([{ op: '=', value: 1920 }]);

    expect(parseQuery('width:<=1080').widths).toEqual([{ op: '<=', value: 1080 }]);
    expect(parseQuery('width:>800').widths).toEqual([{ op: '>', value: 800 }]);
  });

  it('id 支持精确指定并允许重复', () => {
    expect(parseQuery('id:1271989 id:123').ids).toEqual([1271989, 123]);
  });

  it('order 支持 score/fav/random', () => {
    expect(parseQuery('order:score').order).toBe('score');
    expect(parseQuery('order:FAV').order).toBe('fav');
    expect(parseQuery('order:random').order).toBe('random');
  });

  it('综合查询各字段互不干扰', () => {
    const query = parseQuery(
      'hatsune_miku rating:s score:>=50 -rating:e order:fav width:>=1920 -monochrome'
    );
    expect(query.tags).toEqual(['hatsune_miku']);
    expect(query.excludedTags).toEqual(['monochrome']);
    expect(query.ratings).toEqual(['safe']);
    expect(query.excludedRatings).toEqual(['explicit']);
    expect(query.scores).toEqual([{ op: '>=', value: 50 }]);
    expect(query.widths).toEqual([{ op: '>=', value: 1920 }]);
    expect(query.order).toBe('fav');
  });

  it('空串返回空查询', () => {
    expect(parseQuery('   ')).toEqual({
      raw: '',
      tags: [],
      excludedTags: [],
      ratings: [],
      excludedRatings: [],
      scores: [],
      widths: [],
      ids: [],
      order: null
    });
  });
});

describe('parseQuery 非法语法', () => {
  const expectQueryError = (input: string, message: string): void => {
    try {
      parseQuery(input);
    } catch (error) {
      expect(error).toBeInstanceOf(QueryError);
      const appError = (error as QueryError).appError;
      expect(appError.code).toBe('PARSE');
      expect(appError.retryable).toBe(false);
      expect(appError.message).toBe(message);
      return;
    }
    throw new Error(`期望 ${input} 抛出 QueryError`);
  };

  it('未知分级给出可读中文错误', () => {
    expectQueryError('rating:x', '未知分级 "x"，仅支持 s / q / e');
  });

  it('rating 缺少值', () => {
    expectQueryError('rating:', 'rating 缺少值，仅支持 s / q / e');
  });

  it('未知排序', () => {
    expectQueryError('order:hot', '未知排序 "hot"，仅支持 score / fav / random');
  });

  it('order 重复指定', () => {
    expectQueryError('order:score order:fav', 'order 只能指定一次');
  });

  it('score 与 width 比较式无效', () => {
    expectQueryError('score:>=abc', 'score 比较式无效，应为 score:>=100 形式');
    expectQueryError('width:1920px', 'width 比较式无效，应为 width:>=100 形式');
  });

  it('id 必须为正整数', () => {
    expectQueryError('id:abc', 'id 必须是正整数：id:abc');
    expectQueryError('id:0', 'id 必须是正整数：id:0');
  });

  it('单独一个减号不合法', () => {
    expectQueryError('-', '"-" 后缺少标签名');
  });

  it('除 rating 外的排除式前缀暂不支持', () => {
    expectQueryError('-score:>=100', '暂不支持排除式 "score:"，请改用普通标签');
    expectQueryError('-id:123', '暂不支持排除式 "id:"，请改用普通标签');
  });
});
