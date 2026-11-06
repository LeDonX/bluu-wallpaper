import {
  DEFAULT_DOWNLOAD_TEMPLATE,
  downloadSource,
  hasJpegVariant,
  MAX_DOWNLOAD_RELATIVE_PATH,
  parseDownloadConfig,
  renderDownloadPath,
  sanitizePathSegment
} from '@shared/downloads';
import type { Post, PostTag } from '@shared/models';
import { describe, expect, it } from 'vitest';

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    site: 'yande',
    id: 42,
    md5: 'abc123',
    previewUrl: 'https://assets.yande.re/data/preview/a.jpg',
    sampleUrl: 'https://files.yande.re/sample/a.jpg',
    fileUrl: 'https://files.yande.re/image/full.png',
    width: 1000,
    height: 1400,
    fileSize: 12345,
    rating: 'safe',
    score: 10,
    tags: [],
    createdAt: 1793668940000,
    ...overrides
  };
}

function tag(name: string, type: PostTag['type']): PostTag {
  return { name, type };
}

describe('下载命名模板（02 §7.3 / DR-037）', () => {
  it('默认模板为 {md5}.{ext}，文件直接保存在下载目录下（DR-064）', () => {
    expect(DEFAULT_DOWNLOAD_TEMPLATE).toBe('{md5}.{ext}');
    expect(
      renderDownloadPath(makePost({ tags: [tag('hatsune_miku', 'artist')] }))
    ).toBe('abc123.png');
  });

  it('旧默认模板在读取配置时迁移为新默认模板（DR-043 / DR-064）', () => {
    expect(parseDownloadConfig({ template: '{site}/{rating}/{artist}/{md5}.{ext}' }).template).toBe(
      DEFAULT_DOWNLOAD_TEMPLATE
    );
    expect(parseDownloadConfig({ template: '{site}/{md5}.{ext}' }).template).toBe(
      DEFAULT_DOWNLOAD_TEMPLATE
    );
    // 用户自定义模板保持原样
    expect(parseDownloadConfig({ template: '{site}/{id}.{ext}' }).template).toBe(
      '{site}/{id}.{ext}'
    );
  });

  it('artist 取首个 artist 标签，缺失回落 unknown', () => {
    const post = makePost({
      tags: [tag('blue_archive', 'copyright'), tag('yuuka', 'character'), tag('alice', 'artist')]
    });
    expect(renderDownloadPath(post, '{artist}/{copyright}/{character}')).toBe(
      'alice/blue_archive/yuuka'
    );
    expect(renderDownloadPath(makePost(), '{artist}/{copyright}/{character}')).toBe(
      'unknown/unknown/unknown'
    );
  });

  it('未知变量原样保留，md5 为空回退为 site_id（DR-070）', () => {
    expect(renderDownloadPath(makePost({ md5: '' }), '{id}-{foo}-{md5}')).toBe(
      '42-{foo}-yande_42'
    );
    expect(renderDownloadPath(makePost({ md5: '' }))).toBe('yande_42.png');
    expect(
      renderDownloadPath(makePost({ md5: '' }), '{site}/{rating}/{id}.{ext}')
    ).toBe('yande/safe/42.png');
  });

  it('非法字符与控制字符替换为 _，纯点号段替换为 _', () => {
    const rendered = renderDownloadPath(
      makePost({ tags: [tag('a/b:c*?"<>|', 'artist')], md5: 'a\u0001b' }),
      '{artist}/{md5}'
    );
    expect(rendered).not.toMatch(/[\\:*?"<>|]/);
    expect(rendered.includes('\u0001')).toBe(false);
    expect(rendered.startsWith('a_b_c_')).toBe(true);
    expect(renderDownloadPath(makePost(), '../{id}')).toBe('_/42');
    expect(sanitizePathSegment('..')).toBe('_');
    expect(sanitizePathSegment('.')).toBe('_');
  });

  it('扩展名取自原图 URL，缺失回落 jpg', () => {
    expect(renderDownloadPath(makePost({ fileUrl: 'https://files.yande.re/image/a' }), '{ext}')).toBe(
      'jpg'
    );
    expect(renderDownloadPath(makePost({ fileUrl: '' }), '{ext}')).toBe('jpg');
  });

  it('超过 120 字符回落到紧凑路径', () => {
    const longArtist = 'x'.repeat(MAX_DOWNLOAD_RELATIVE_PATH + 10);
    expect(
      renderDownloadPath(
        makePost({ tags: [tag(longArtist, 'artist')] }),
        '{site}/{rating}/{artist}/{md5}.{ext}'
      )
    ).toBe('abc123.png');
  });

  it('空模板或纯空白模板使用默认模板', () => {
    const post = makePost({ tags: [tag('miku', 'artist')] });
    expect(renderDownloadPath(post, '')).toBe('abc123.png');
    expect(renderDownloadPath(post, '   ')).toBe('abc123.png');
    expect(renderDownloadPath(post)).toBe('abc123.png');
  });
});

describe('下载格式选择（07 DR-051）', () => {
  const png = makePost({
    fileUrl: 'https://files.yande.re/image/full.png',
    fileSize: 20_000,
    jpegUrl: 'https://files.yande.re/image/full.jpg',
    jpegFileSize: 900
  });

  it('hasJpegVariant 仅在存在独立 JPEG 且大小有效时为 true', () => {
    expect(hasJpegVariant(png)).toBe(true);
    expect(hasJpegVariant(makePost())).toBe(false);
    // 原图即 JPG 时站点把 jpeg_url 指向同一个地址、大小记为 0
    expect(
      hasJpegVariant(makePost({ jpegUrl: makePost().fileUrl, jpegFileSize: 0 }))
    ).toBe(false);
    expect(hasJpegVariant(makePost({ jpegUrl: '', jpegFileSize: 900 }))).toBe(false);
  });

  it('downloadSource 按格式返回地址与大小，JPEG 不可用时回落原图', () => {
    expect(downloadSource(png, 'jpeg')).toEqual({ url: png.jpegUrl, size: 900 });
    expect(downloadSource(png, 'original')).toEqual({ url: png.fileUrl, size: png.fileSize });

    const jpg = makePost();
    expect(downloadSource(jpg, 'jpeg')).toEqual({ url: jpg.fileUrl, size: jpg.fileSize });
  });

  it('parseDownloadConfig 读取默认格式，非法值回落 original', () => {
    expect(parseDownloadConfig({}).format).toBe('original');
    expect(parseDownloadConfig({ format: 'jpeg' }).format).toBe('jpeg');
    expect(parseDownloadConfig({ format: 'png' }).format).toBe('original');
  });
});
