// Vite 的 `?raw` 导入在打包时内联为字符串；TS 需要显式声明
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
