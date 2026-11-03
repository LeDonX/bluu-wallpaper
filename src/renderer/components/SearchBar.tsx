import type { SiteId } from '@shared/constants';
import type { TagSuggestion } from '@shared/models';
import { activeToken, replaceActiveToken, suggestPrefix } from '@shared/tags';
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

/** 02 §3：停止输入 300ms 后触发联想 */
const SUGGEST_DEBOUNCE_MS = 300;

export interface SearchBarProps {
  site: SiteId;
  disabled: boolean;
  onSubmit(query: string): void;
}

/**
 * 02 §2.1 / §3：单行输入 + 标签联想。
 * Tab 选中的联想项转成 chip，提交时与剩余输入合并成原站查询串；
 * 联想失败静默降级，不影响搜索本身。
 */
export function SearchBar({ site, disabled, onSubmit }: SearchBarProps): ReactElement {
  const [draft, setDraft] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);

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

  const scheduleSuggest = (text: string): void => {
    cancelSuggest();
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
    const query = [...chips, draft.trim()].filter((part) => part !== '').join(' ');
    onSubmit(query);
  };

  const showSuggestions = suggestions.length > 0;

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
            aria-expanded={showSuggestions}
            role="combobox"
            value={draft}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDraft(event.target.value);
              scheduleSuggest(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            onBlur={cancelSuggest}
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
        </div>
      </div>

      <button className="search-bar__submit" type="submit" disabled={disabled}>
        搜索
      </button>
    </form>
  );
}
