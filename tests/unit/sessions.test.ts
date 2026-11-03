import { SITE_IDS } from '@shared/constants';
import { SESSION_PARTITION_PREFIX, sessionPartition } from '@shared/sessions';
import { describe, expect, it } from 'vitest';

describe('每站点 session 分区命名', () => {
  it('两站各自使用 persist 前缀的独立分区', () => {
    expect(sessionPartition('yande')).toBe('persist:yande');
    expect(sessionPartition('konachan')).toBe('persist:konachan');
  });

  it('所有站点分区互不相同，且都以 persist: 开头', () => {
    const partitions = SITE_IDS.map((site) => sessionPartition(site));

    expect(new Set(partitions).size).toBe(SITE_IDS.length);
    for (const partition of partitions) {
      expect(partition.startsWith(SESSION_PARTITION_PREFIX)).toBe(true);
    }
  });

  it('分区名由站点 ID 唯一决定，重复调用结果稳定', () => {
    for (const site of SITE_IDS) {
      expect(sessionPartition(site)).toBe(`${SESSION_PARTITION_PREFIX}${site}`);
      expect(sessionPartition(site)).toBe(sessionPartition(site));
    }
  });
});
