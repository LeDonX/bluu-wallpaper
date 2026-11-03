/**
 * 02 §3：联想只针对"当前正在输入的标签"。
 * 输入串以空白分隔，末尾无空白时最后一个 token 即当前标签；以空白结尾说明正在开新标签。
 */
export function activeToken(text: string): string {
  if (/\s$/.test(text)) return '';
  const matched = /\S+$/.exec(text);
  return matched === null ? '' : matched[0];
}

/**
 * 取可联想的标签前缀：
 * - 少于 2 字符不触发（02 §3）
 * - 带冒号的是 `rating:` / `score:` / `id:` 等原站语法，不参与标签联想
 * - 排除式 `-tag` 保留原语义，不做正向联想
 */
export function suggestPrefix(token: string): string | null {
  if (token.startsWith('-') || token.includes(':')) return null;
  return token.length >= 2 ? token : null;
}

/** 用补全结果替换当前标签 token；其余已输入内容原样保留 */
export function replaceActiveToken(text: string, replacement: string): string {
  const head = text.replace(/\S+\s*$/, '').trimEnd();
  if (replacement === '') return head;
  return head === '' ? replacement : `${head} ${replacement}`;
}
