import type { AnySiteId } from '@shared/constants';
import type { TagSuggestion } from '@shared/models';
import { activeToken, replaceActiveToken, suggestPrefix } from '@shared/tags';
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

/** 02 §3：停止输入 300ms 后触发联想 */
const SUGGEST_DEBOUNCE_MS = 300;

export interface SearchBarProps {
  site: AnySiteId;
  disabled: boolean;
  /** T-53：无联想能力的站点（wallhaven）不请求联想 */
  suggestEnabled: boolean;
  /** DR-055：最近使用优先的搜索历史；为空时不展示下拉 */
  history: readonly string[];
  onSubmit(query: string): void;
  onSelectHistory(query: string): void;
  onDeleteHistory(query: string): void;
  onClearHistory(): void;
}

/**
 * 02 §2.1 / §3：单行输入 + 标签联想 + 搜索历史。
 * Tab 选中的联想项转成 chip，提交时与剩余输入合并成原站查询串；
 * 联想失败静默降级，不影响搜索本身。
 */
export function SearchBar({
  site,
  disabled,
  suggestEnabled,
  history,
  onSubmit,
  onSelectHistory,
  onDeleteHistory,
  onClearHistory
}: SearchBarProps): ReactElement {
  const [draft, setDraft] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  // DR-055：聚焦且输入为空时才展示历史，避免与标签联想/已选 chip 叠加
  const [historyOpen, setHistoryOpen] = useState(false);

  const timerRef = useRef<number | null>(null);
  // 请求序号用于丢弃过期联想结果，避免快速输入时旧响应覆盖新结果
  const requestSeq = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  /** 取消在途/待发的联想请求；任何关闭下拉的入口都要调用 */
  const cancelSuggest = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    requestSeq.current += 1;
    setSuggestions([]);
    setHighlight(-1);
  };

  // T-53：切站后丢弃上一站点残留的联想结果
  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      requestSeq.current += 1;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setSuggestions([]);
      setHighlight(-1);
    }, 0);
    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [site, suggestEnabled]);

  const scheduleSuggest = (text: string): void => {
    cancelSuggest();
    // T-53：站点没有联想能力时不发请求
    if (!suggestEnabled) return;
    const prefix = suggestPrefix(activeToken(text));
    if (prefix === null) return;
    const seq = requestSeq.current;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      window.booru
        .suggestTags({ site, prefix })
        .then((result) => {
          if (requestSeq.current !== seq) return;
          // 失败静默降级：联想不可用时不影响正常搜索（02 §3）
          setSuggestions(result.ok ? result.data : []);
          setHighlight(-1);
        })
        .catch(() => {
          if (requestSeq.current !== seq) return;
          setSuggestions([]);
          setHighlight(-1);
        });
    }, SUGGEST_DEBOUNCE_MS);
  };

  const selectSuggestion = (suggestion: TagSuggestion): void => {
    setChips((previous) =>
      previous.includes(suggestion.name) ? previous : [...previous, suggestion.name]
    );
    setDraft((previous) => replaceActiveToken(previous, ''));
    cancelSuggest();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      cancelSuggest();
      setHistoryOpen(false);
      return;
    }
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((previous) => (previous + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((previous) => (previous <= 0 ? suggestions.length - 1 : previous - 1));
      return;
    }
    if (event.key === 'Tab') {
      const suggestion = suggestions[highlight >= 0 ? highlight : 0];
      if (suggestion === undefined) return;
      event.preventDefault();
      selectSuggestion(suggestion);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // 回车/点击搜索后立即收起联想与历史下拉，避免提交后浮层残留
    cancelSuggest();
    setHistoryOpen(false);
    const query = [...chips, draft.trim()].filter((part) => part !== '').join(' ');
    onSubmit(query);
  };

  /** DR-055：点击历史项填入输入框并立即复用该查询 */
  const selectHistory = (query: string): void => {
    setDraft(query);
    setChips([]);
    cancelSuggest();
    setHistoryOpen(false);
    onSelectHistory(query);
  };

  const showSuggestions = suggestions.length > 0;
  const showHistory = historyOpen && !showSuggestions && draft.trim() === '' && chips.length === 0;
  const showOverlay = showSuggestions || showHistory;

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-bar__field">
        {chips.length > 0 ? (
          <div className="search-bar__chips">
            {chips.map((chip) => (
              <span className="tag-chip" key={chip}>
                {chip}
                <button
                  type="button"
                  className="tag-chip__remove"
                  aria-label={`移除标签 ${chip}`}
                  onClick={() => {
                    setChips((previous) => previous.filter((item) => item !== chip));
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="search-bar__input-wrap">
          <input
            className="search-bar__input"
            type="search"
            placeholder="输入标签、rating:s 或 score:>=100"
            aria-label="搜索标签"
            aria-autocomplete="list"
            aria-expanded={showOverlay}
            role="combobox"
            value={draft}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDraft(event.target.value);
              setHistoryOpen(false);
              scheduleSuggest(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (history.length > 0) setHistoryOpen(true);
            }}
            onBlur={() => {
              cancelSuggest();
              setHistoryOpen(false);
            }}
          />

          {showSuggestions ? (
            <ul className="tag-suggest" role="listbox" aria-label="标签联想">
              {suggestions.map((suggestion, index) => (
                <li
                  className="tag-suggest__option"
                  key={suggestion.name}
                  role="option"
                  aria-selected={index === highlight}
                >
                  <button
                    type="button"
                    className="tag-suggest__item"
                    // 阻止按下时输入框失焦，保证点击能落在选项上
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      selectSuggestion(suggestion);
                    }}
                  >
                    <span className="tag-suggest__name">{suggestion.name}</span>
                    <span className="tag-suggest__type">{suggestion.type}</span>
                    <span className="tag-suggest__count">{suggestion.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showHistory ? (
            <div className="search-history">
              <div className="search-history__header">
                <span className="search-history__title">搜索历史</span>
                <button
                  type="button"
                  className="search-history__clear"
                  // 阻止按下时输入框失焦，保证点击能落在按钮上
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={onClearHistory}
                >
                  清空
                </button>
              </div>
              <ul className="search-history__list" role="listbox" aria-label="搜索历史">
                {history.map((item) => (
                  <li
                    className="search-history__item"
                    key={item}
                    role="option"
                    aria-selected={false}
                  >
                    <button
                      type="button"
                      className="search-history__query"
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        selectHistory(item);
                      }}
                    >
                      {item}
                    </button>
                    <button
                      type="button"
                      className="search-history__remove"
                      aria-label={`删除历史 ${item}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        onDeleteHistory(item);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <button className="search-bar__submit" type="submit" disabled={disabled}>
        搜索
      </button>
    </form>
  );
}
