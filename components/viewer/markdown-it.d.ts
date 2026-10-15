// markdown-it 10 (pulled in by react-native-markdown-display) ships no types.
declare module 'markdown-it' {
  interface MarkdownItInstance { options: Record<string, unknown>; parse(src: string, env: object): unknown[] }
  const MarkdownIt: (options?: Record<string, unknown>) => MarkdownItInstance;
  export default MarkdownIt;
}
