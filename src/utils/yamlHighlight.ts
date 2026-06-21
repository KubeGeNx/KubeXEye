// Dependency-free YAML line tokenizer for display purposes only — not a parser. It's deliberately
// scoped to the shapes `yaml.stringify` actually produces for plain k8s objects (mappings,
// sequences, quoted/unquoted scalars, block scalars), not the full YAML grammar.

export interface YamlToken {
  text: string;
  color?: string;
  italic?: boolean;
}

export const YAML_COLORS = {
  key: '#dcb67a',
  string: '#7ec699',
  scalar: '#79c0ff',
  comment: '#6a9955',
  punctuation: '#d4d4d4',
  undefined: '#ff6b6b',
} as const;

const BLOCK_SCALAR_RE = /^[|>][+-]?$/;
const EMPTY_VALUE_TOKENS = new Set(['null', '~', "''", '""', '{}', '[]']);

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function isQuoted(value: string): boolean {
  return (value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'));
}

/** Finds the colon that separates a mapping key from its value, ignoring colons inside quotes. */
function findKeyColon(text: string): number {
  let inQuote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inQuote = ch;
      continue;
    }
    if (ch === ':' && (i === text.length - 1 || text[i + 1] === ' ')) return i;
  }
  return -1;
}

function tokenizeContent(content: string): { tokens: YamlToken[]; valueIsEmpty: boolean } {
  const tokens: YamlToken[] = [];
  let rest = content;

  if (rest === '-') {
    return { tokens: [{ text: '-' }], valueIsEmpty: false };
  }
  if (rest.startsWith('- ')) {
    tokens.push({ text: '- ' });
    rest = rest.slice(2);
  }

  if (rest.startsWith('#')) {
    return { tokens: [...tokens, { text: rest, color: YAML_COLORS.comment, italic: true }], valueIsEmpty: false };
  }

  const colonIdx = findKeyColon(rest);
  if (colonIdx === -1) {
    if (rest === '') return { tokens, valueIsEmpty: false };
    const color = isQuoted(rest) ? YAML_COLORS.string : YAML_COLORS.scalar;
    return { tokens: [...tokens, { text: rest, color }], valueIsEmpty: false };
  }

  const key = rest.slice(0, colonIdx);
  const afterColon = rest.slice(colonIdx + 1);
  const value = afterColon.trim();
  tokens.push({ text: key, color: YAML_COLORS.key });
  // Left uncolored until we know which branch applies — the empty-value branch needs the caller's
  // lookahead (does a nested block follow?) to decide whether this resolves to "undefined" (red)
  // or just punctuation (a parent key), so coloring it here would always lose to that decision.
  const colonToken: YamlToken = { text: ':' };
  tokens.push(colonToken);

  if (value === '') {
    tokens.push({ text: afterColon });
    return { tokens, valueIsEmpty: true };
  }
  if (BLOCK_SCALAR_RE.test(value)) {
    colonToken.color = YAML_COLORS.punctuation;
    tokens.push({ text: afterColon, color: YAML_COLORS.punctuation });
    return { tokens, valueIsEmpty: false };
  }
  if (EMPTY_VALUE_TOKENS.has(value)) {
    colonToken.color = YAML_COLORS.punctuation;
    tokens.push({ text: afterColon, color: YAML_COLORS.undefined });
    return { tokens, valueIsEmpty: true };
  }
  colonToken.color = YAML_COLORS.punctuation;
  tokens.push({ text: afterColon, color: isQuoted(value) ? YAML_COLORS.string : YAML_COLORS.scalar });
  return { tokens, valueIsEmpty: false };
}

/** Tokenizes a full YAML document into one colored-token array per line, for rendering as JSX. */
export function highlightYamlLines(yamlText: string): YamlToken[][] {
  const rawLines = yamlText.split('\n');
  const lines = rawLines.map((line) => ({ indent: indentOf(line), content: line.trimStart(), raw: line }));

  const result: YamlToken[][] = [];
  let blockScalarIndent: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const { indent, content, raw } = lines[i];

    if (raw.trim() === '') {
      result.push([]);
      continue;
    }

    if (blockScalarIndent !== null) {
      if (indent > blockScalarIndent) {
        result.push([{ text: raw, color: YAML_COLORS.string }]);
        continue;
      }
      blockScalarIndent = null;
    }

    const { tokens, valueIsEmpty } = tokenizeContent(content);

    if (valueIsEmpty) {
      const next = lines[i + 1];
      const hasChildren = Boolean(next) && next.raw.trim() !== '' && next.indent > indent;
      const fallbackColor = hasChildren ? YAML_COLORS.punctuation : YAML_COLORS.undefined;
      for (const token of tokens) {
        if (!token.color) token.color = fallbackColor;
      }
    }

    const colonIdx = findKeyColon(content.startsWith('- ') ? content.slice(2) : content);
    if (colonIdx !== -1) {
      const valueAfterColon = (content.startsWith('- ') ? content.slice(2) : content).slice(colonIdx + 1).trim();
      if (BLOCK_SCALAR_RE.test(valueAfterColon)) blockScalarIndent = indent;
    }

    result.push([{ text: ' '.repeat(indent) }, ...tokens]);
  }

  return result;
}
