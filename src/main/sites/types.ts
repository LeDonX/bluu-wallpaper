import type { ParsedQuery } from '@main/sites/query';
import type { AnySiteId } from '@shared/constants';
import type { PostPage, SearchCursor, TagSuggestion } from '@shared/models';
import type { RankingDate, RankingKind } from '@shared/rankings';

/**
 * 07 DR-070：多源适配器的最小契约。`search` 必选；
 * 站点没有的能力直接省略对应方法，由 `SITE_CAPABILITIES` 决定入口是否显示，
 * handler 收到缺失能力的请求时按 CONFIG 拒绝。
 */
export interface SiteAdapter {
  readonly id: AnySiteId;
  readonly baseUrl: string;
  search(query: ParsedQuery, cursor?: SearchCursor): Promise<PostPage>;
  /** DR-041：榜单；无榜单能力的站点不实现 */
  rankings?(
    kind: RankingKind,
    date: RankingDate | undefined,
    cursor?: SearchCursor
  ): Promise<PostPage>;
  /** 02 §3 / 06 §4：标签联想；无联想能力的站点不实现 */
  suggestTags?(prefix: string, limit?: number): Promise<TagSuggestion[]>;
  /** 07 DR-076 / T-52：每日壁纸；无每日能力的站点不实现 */
  daily?(): Promise<PostPage>;
}
