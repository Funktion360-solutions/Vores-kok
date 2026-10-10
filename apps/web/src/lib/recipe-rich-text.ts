export type Inline = { kind: 'text' | 'bold' | 'italic' | 'code'; text: string };
export type Block =
  | { kind: 'paragraph' | 'heading' | 'quote'; text: string }
  | { kind: 'ul' | 'ol'; items: string[]; start: number };
// A small, deliberately bounded text format. HTML is always plain text.
export function inlineText(text: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > offset) parts.push({ kind: 'text', text: text.slice(offset, start) });
    parts.push({
      kind: match[1] ? 'bold' : match[2] ? 'italic' : 'code',
      text: match[1] ?? match[2] ?? match[3] ?? '',
    });
    offset = start + match[0].length;
  }
  if (offset < text.length) parts.push({ kind: 'text', text: text.slice(offset) });
  return parts;
}
export function textBlocks(text: string): Block[] {
  const result: Block[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  function flush() {
    if (paragraph.length) {
      result.push({ kind: 'paragraph', text: paragraph.join('\n') });
      paragraph = [];
    }
  }
  for (const line of lines) {
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^#{2,3}\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      result.push({ kind: 'heading', text: heading[1]! });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      result.push({ kind: 'quote', text: quote[1]! });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const numbered = /^\s*(\d+)\.\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      const last = result.at(-1);
      const item = bullet?.[1] ?? numbered?.[2] ?? '';
      if (last?.kind === kind) {
        last.items.push(item);
      } else result.push({ kind, items: [item], start: numbered ? Number(numbered[1]) : 1 });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return result;
}
export type FormatAction = 'bold' | 'italic' | 'ul' | 'ol' | 'heading' | 'quote';
export function formatSelection(value: string, start: number, end: number, action: FormatAction) {
  if (action === 'bold' || action === 'italic') {
    const mark = action === 'bold' ? '**' : '*';
    const selected = value.slice(start, end);
    const text = selected || 'tekst';
    if (selected.startsWith(mark) && selected.endsWith(mark) && selected.length > 2 * mark.length) {
      const plain = selected.slice(mark.length, -mark.length);
      return {
        value: value.slice(0, start) + plain + value.slice(end),
        start,
        end: start + plain.length,
      };
    }
    if (
      value.slice(Math.max(0, start - mark.length), start) === mark &&
      value.slice(end, end + mark.length) === mark
    ) {
      return {
        value: value.slice(0, start - mark.length) + selected + value.slice(end + mark.length),
        start: start - mark.length,
        end: end - mark.length,
      };
    }
    return {
      value: value.slice(0, start) + mark + text + mark + value.slice(end),
      start: start + mark.length,
      end: start + mark.length + text.length,
    };
  }
  const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const rangeEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const next = value.indexOf('\n', rangeEnd);
  const lineEnd = next === -1 ? value.length : next;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const numbered = action === 'ol';
  const prefixPattern =
    action === 'ul'
      ? /^[-*]\s+/
      : numbered
        ? /^\d+\.\s+/
        : action === 'heading'
          ? /^#{2,3}\s+/
          : /^>\s?/;
  const remove = lines.every((line) => prefixPattern.test(line));
  const replacement = lines
    .map((line, n) => {
      if (remove) return line.replace(prefixPattern, '');
      const clean = line.replace(/^\s*(?:[-*]\s+|\d+\.\s+|#{2,3}\s+|>\s?)/, '');
      return (
        (action === 'ul' ? '- ' : numbered ? n + 1 + '. ' : action === 'heading' ? '## ' : '> ') +
        (clean || 'tekst')
      );
    })
    .join('\n');
  return {
    value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + replacement.length,
  };
}
