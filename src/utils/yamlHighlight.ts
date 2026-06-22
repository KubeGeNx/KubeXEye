// Dependency-free YAML line tokenizer for display purposes only — not a parser. It's deliberately
// scoped to the shapes `yaml.stringify` actually produces for plain k8s objects (mappings,
// sequences, quoted/unquoted scalars, block scalars), not the full YAML grammar.

export interface YamlToken {
  text: string;
  color?: string;
  italic?: boolean;
}

export const YAML_COLORS = {
  key: '#dcb67a',        // amber — YAML mapping keys
  string: '#7ec699',     // green — quoted string values
  scalar: '#79c0ff',     // blue — unquoted scalar values
  comment: '#89D185',    // light green — was #6a9955, too dark on #1e1e1e (failed WCAG)
  punctuation: '#C8C5BB', // warm gray — aligns with secondary text token
  undefined: '#ff6b6b',  // bright red — null/empty/missing values
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

// ─── JSON syntax highlighter ────────────────────────────────────────────────
// Tokenizes JSON.stringify output line-by-line for colored display. Shares the
// same color palette as the YAML highlighter so the two views look consistent.

export interface JsonToken {
  text: string;
  color?: string;
}

const JSON_COLOR = {
  key: '#dcb67a',        // amber — object keys
  string: '#7ec699',     // green — string values
  number: '#79c0ff',     // blue — numeric values
  keyword: '#7EB6F0',    // soft blue — true / false
  null: '#ff6b6b',       // red — null
  punctuation: '#C8C5BB', // warm gray — braces, brackets, colon, comma
} as const;

function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;

  // Preserve leading whitespace as unstyled
  const leadMatch = line.match(/^\s+/);
  if (leadMatch) {
    tokens.push({ text: leadMatch[0] });
    i = leadMatch[0].length;
  }

  while (i < line.length) {
    const rest = line.slice(i);

    // String token — key (followed by colon) or value
    if (rest[0] === '"') {
      const strMatch = rest.match(/^"(?:[^"\\]|\\.)*"/);
      if (strMatch) {
        const str = strMatch[0];
        const after = line.slice(i + str.length).trimStart();
        const isKey = after.startsWith(':');
        tokens.push({ text: str, color: isKey ? JSON_COLOR.key : JSON_COLOR.string });
        i += str.length;
        continue;
      }
    }

    // Number
    const numMatch = rest.match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numMatch) {
      tokens.push({ text: numMatch[0], color: JSON_COLOR.number });
      i += numMatch[0].length;
      continue;
    }

    // true / false
    if (rest.startsWith('true') || rest.startsWith('false')) {
      const kw = rest.startsWith('true') ? 'true' : 'false';
      tokens.push({ text: kw, color: JSON_COLOR.keyword });
      i += kw.length;
      continue;
    }

    // null
    if (rest.startsWith('null')) {
      tokens.push({ text: 'null', color: JSON_COLOR.null });
      i += 4;
      continue;
    }

    // Punctuation and whitespace — one char at a time
    const ch = rest[0];
    tokens.push({ text: ch, color: '{}[],:'.includes(ch) ? JSON_COLOR.punctuation : undefined });
    i++;
  }

  return tokens;
}

export function highlightJsonLines(jsonText: string): JsonToken[][] {
  return jsonText.split('\n').map(tokenizeJsonLine);
}
