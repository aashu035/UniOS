import React, { useMemo } from 'react';
import { Linking, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { T } from '../uni/primitives';
import { sans, mono, useUni } from '../uni/theme';
import { isWebLink } from '../../core/fs/names';
import { markdownParser, MAX_MARKDOWN_BYTES } from '../viewer/markdownParser';

/**
 * Markdown in UniOS type (design UniFile: notes and .md files). Links open only
 * when they are http(s); images are not fetched (a shared note could use one to
 * track who opened it), so their alt text shows instead. Very long text is
 * shown as plain text (see markdownParser).
 */
export function MarkdownBody({ text }: { text: string }) {
  const p = useUni();
  const style = useMemo(() => ({
    body: { ...sans(500), color: p.text, fontSize: 15, lineHeight: 23 },
    heading1: { ...sans(800), fontSize: 22, lineHeight: 28, letterSpacing: -0.5, marginTop: 8, marginBottom: 6 },
    heading2: { ...sans(800), fontSize: 16.5, lineHeight: 22, marginTop: 14, marginBottom: 4 },
    heading3: { ...sans(800), fontSize: 15, lineHeight: 21, marginTop: 12, marginBottom: 2 },
    strong: { ...sans(800) },
    em: { fontStyle: 'italic' as const },
    paragraph: { marginTop: 4, marginBottom: 8 },
    bullet_list_icon: { color: p.muted, fontWeight: '800' as const, marginRight: 8 },
    ordered_list_icon: { color: p.muted, fontWeight: '800' as const, marginRight: 8 },
    list_item: { marginBottom: 4 },
    blockquote: { backgroundColor: p.surface, borderLeftWidth: 0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginVertical: 6 },
    code_inline: { ...mono(500), backgroundColor: p.surface, color: p.text, fontSize: 13, borderRadius: 6, paddingHorizontal: 4, borderWidth: 0 },
    code_block: { ...mono(500), backgroundColor: p.surface, color: p.text, fontSize: 12.5, lineHeight: 19, borderRadius: 12, padding: 12, borderWidth: 0 },
    fence: { ...mono(500), backgroundColor: p.surface, color: p.text, fontSize: 12.5, lineHeight: 19, borderRadius: 12, padding: 12, borderWidth: 0 },
    table: { borderWidth: 1, borderColor: p.border, borderRadius: 12, marginVertical: 6 },
    th: { padding: 8, ...sans(800), fontSize: 13 },
    td: { padding: 8, fontSize: 13 },
    tr: { borderBottomWidth: 1, borderColor: p.hair },
    hr: { backgroundColor: p.hair, height: 1, marginVertical: 12 },
    link: { color: p.primary, textDecorationLine: 'underline' as const },
  }), [p]);

  if (text.length > MAX_MARKDOWN_BYTES) return <T selectable size={15} style={{ lineHeight: 23 }}>{text}</T>;
  return (
    <Markdown style={style} markdownit={markdownParser}
      onLinkPress={(url) => { if (isWebLink(url)) Linking.openURL(url).catch(() => {}); return false; }}
      rules={{ image: (node: any) => <Text key={node.key} style={{ color: p.muted, fontStyle: 'italic' }}>{`[${node.attributes?.alt || 'image'}]`}</Text> }}>
      {text}
    </Markdown>
  );
}
