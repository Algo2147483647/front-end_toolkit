export interface ConsoleLineError {
  line: number;
  message: string;
}

export type ConsoleNodeOperand =
  | { type: "key"; value: string }
  | { type: "context" };

export type ConsoleInstruction =
  | { type: "help"; line: number }
  | { type: "show"; key: ConsoleNodeOperand; line: number }
  | { type: "use"; key: ConsoleNodeOperand; line: number }
  | { type: "rename"; oldKey: ConsoleNodeOperand; newKey: string; line: number }
  | { type: "delete"; key: ConsoleNodeOperand; recursive: boolean; line: number }
  | { type: "add"; key: string; parentKey?: ConsoleNodeOperand; line: number }
  | { type: "copy"; sourceKey: ConsoleNodeOperand; key: string; parentKey?: ConsoleNodeOperand; line: number }
  | { type: "setParents"; key: ConsoleNodeOperand; keys: ConsoleNodeOperand[]; line: number }
  | { type: "setChildren"; key: ConsoleNodeOperand; keys: ConsoleNodeOperand[]; line: number }
  | { type: "setField"; key: ConsoleNodeOperand; field: string; value: string; line: number }
  | { type: "json"; key: ConsoleNodeOperand; line: number };

type ConsoleToken =
  | { type: "word"; value: string }
  | { type: "string"; value: string }
  | { type: "symbol"; value: "," | "=" };

export function parseConsoleSource(source: string): { ok: true; instructions: ConsoleInstruction[] } | { ok: false; error: ConsoleLineError } {
  const instructions: ConsoleInstruction[] = [];
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) {
      continue;
    }

    const tokenized = tokenizeLine(rawLine);
    if (!tokenized.ok) {
      return { ok: false, error: { line: lineNumber, message: tokenized.message } };
    }

    const parsed = parseInstruction(tokenized.tokens, lineNumber);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    instructions.push(parsed.instruction);
  }

  return { ok: true, instructions };
}

function tokenizeLine(line: string): { ok: true; tokens: ConsoleToken[] } | { ok: false; message: string } {
  const tokens: ConsoleToken[] = [];
  let index = 0;

  while (index < line.length) {
    const char = line[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "," || char === "=") {
      tokens.push({ type: "symbol", value: char });
      index += 1;
      continue;
    }
    if (char === "\"") {
      let cursor = index + 1;
      let escaped = false;
      while (cursor < line.length) {
        const current = line[cursor];
        if (current === "\"" && !escaped) {
          break;
        }
        escaped = current === "\\" && !escaped;
        if (current !== "\\") {
          escaped = false;
        }
        cursor += 1;
      }
      if (cursor >= line.length || line[cursor] !== "\"") {
        return { ok: false, message: "Unterminated string literal." };
      }
      try {
        tokens.push({ type: "string", value: JSON.parse(line.slice(index, cursor + 1)) as string });
      } catch {
        return { ok: false, message: "Invalid string literal." };
      }
      index = cursor + 1;
      continue;
    }

    let cursor = index;
    while (cursor < line.length && !/\s/.test(line[cursor]) && line[cursor] !== "," && line[cursor] !== "=") {
      cursor += 1;
    }
    tokens.push({ type: "word", value: line.slice(index, cursor) });
    index = cursor;
  }

  return { ok: true, tokens };
}

function parseInstruction(tokens: ConsoleToken[], line: number): { ok: true; instruction: ConsoleInstruction } | { ok: false; error: ConsoleLineError } {
  if (!tokens.length) {
    return { ok: false, error: { line, message: "Expected an instruction." } };
  }

  const mnemonic = expectWordToken(tokens[0]);
  if (!mnemonic) {
    return { ok: false, error: { line, message: "Expected an instruction mnemonic." } };
  }

  switch (mnemonic.value) {
    case "help":
      return parseHelpInstruction(tokens, line);
    case "show":
      return parseSingleNodeInstruction(tokens, line, "show");
    case "use":
      return parseSingleNodeInstruction(tokens, line, "use");
    case "json":
      return parseSingleNodeInstruction(tokens, line, "json");
    case "mv":
      return parseRenameInstruction(tokens, line);
    case "rm":
      return parseDeleteInstruction(tokens, line);
    case "add":
      return parseAddInstruction(tokens, line);
    case "cp":
      return parseCopyInstruction(tokens, line);
    case "parents":
      return parseRelationInstruction(tokens, line, "setParents");
    case "children":
      return parseRelationInstruction(tokens, line, "setChildren");
    case "set":
      return parseSetInstruction(tokens, line);
    default:
      return { ok: false, error: { line, message: `Unknown instruction "${mnemonic.value}".` } };
  }
}

function parseHelpInstruction(tokens: ConsoleToken[], line: number): { ok: true; instruction: ConsoleInstruction } | { ok: false; error: ConsoleLineError } {
  if (tokens.length !== 1) {
    return { ok: false, error: { line, message: "help does not accept any arguments." } };
  }
  return { ok: true, instruction: { type: "help", line } };
}

function parseSingleNodeInstruction(
  tokens: ConsoleToken[],
  line: number,
  type: "show" | "use" | "json",
): { ok: true; instruction: ConsoleInstruction } | { ok: false; error: ConsoleLineError } {
  if (tokens.length !== 2) {
    return { ok: false, error: { line, message: `${type} expects exactly one node operand.` } };
  }
  const operand = parseNodeOperand(tokens[1], true);
  if (!operand) {
    return { ok: false, error: { line, message: "Expected a node operand." } };
  }
  return { ok: true, instruction: { type, key: operand, line } };
}

function parseRenameInstruction(tokens: ConsoleToken[], line: number) {
  if (tokens.length !== 3) {
    return { ok: false, error: { line, message: "mv expects <old-key> <new-key>." } } as const;
  }
  const oldKey = parseNodeOperand(tokens[1], true);
  const newKey = parseLiteralToken(tokens[2]);
  if (!oldKey || !newKey) {
    return { ok: false, error: { line, message: "mv expects <old-key> <new-key>." } } as const;
  }
  return { ok: true, instruction: { type: "rename", oldKey, newKey, line } satisfies ConsoleInstruction } as const;
}

function parseDeleteInstruction(tokens: ConsoleToken[], line: number) {
  if (tokens.length === 2) {
    const key = parseNodeOperand(tokens[1], true);
    if (!key) {
      return { ok: false, error: { line, message: "rm expects a node operand." } } as const;
    }
    return { ok: true, instruction: { type: "delete", key, recursive: false, line } } as const;
  }
  if (tokens.length === 3 && expectWordToken(tokens[1])?.value === "-r") {
    const key = parseNodeOperand(tokens[2], true);
    if (!key) {
      return { ok: false, error: { line, message: "rm -r expects a node operand." } } as const;
    }
    return { ok: true, instruction: { type: "delete", key, recursive: true, line } } as const;
  }
  return { ok: false, error: { line, message: "rm expects either <node> or -r <node>." } } as const;
}

function parseAddInstruction(tokens: ConsoleToken[], line: number) {
  if (tokens.length !== 2 && tokens.length !== 4) {
    return { ok: false, error: { line, message: "add expects <new-key> or <new-key> -p <parent>." } } as const;
  }
  const key = parseLiteralToken(tokens[1]);
  if (!key) {
    return { ok: false, error: { line, message: "add expects a new node key." } } as const;
  }
  if (tokens.length === 2) {
    return { ok: true, instruction: { type: "add", key, line } } as const;
  }
  if (expectWordToken(tokens[2])?.value !== "-p") {
    return { ok: false, error: { line, message: "add only supports the -p modifier." } } as const;
  }
  const parentKey = parseNodeOperand(tokens[3], true);
  if (!parentKey) {
    return { ok: false, error: { line, message: "add -p expects a parent node operand." } } as const;
  }
  return { ok: true, instruction: { type: "add", key, parentKey, line } } as const;
}

function parseCopyInstruction(tokens: ConsoleToken[], line: number) {
  if (tokens.length !== 3 && tokens.length !== 5) {
    return { ok: false, error: { line, message: "cp expects <source> <new-key> or <source> <new-key> -p <parent>." } } as const;
  }
  const sourceKey = parseNodeOperand(tokens[1], true);
  const key = parseLiteralToken(tokens[2]);
  if (!sourceKey || !key) {
    return { ok: false, error: { line, message: "cp expects <source> <new-key>." } } as const;
  }
  if (tokens.length === 3) {
    return { ok: true, instruction: { type: "copy", sourceKey, key, line } } as const;
  }
  if (expectWordToken(tokens[3])?.value !== "-p") {
    return { ok: false, error: { line, message: "cp only supports the -p modifier." } } as const;
  }
  const parentKey = parseNodeOperand(tokens[4], true);
  if (!parentKey) {
    return { ok: false, error: { line, message: "cp -p expects a parent node operand." } } as const;
  }
  return { ok: true, instruction: { type: "copy", sourceKey, key, parentKey, line } } as const;
}

function parseRelationInstruction(
  tokens: ConsoleToken[],
  line: number,
  type: "setParents" | "setChildren",
) {
  if (tokens.length < 3) {
    return { ok: false, error: { line, message: `${type === "setParents" ? "parents" : "children"} expects <node> = <list>.` } } as const;
  }
  const key = parseNodeOperand(tokens[1], true);
  if (!key || tokens[2].type !== "symbol" || tokens[2].value !== "=") {
    return { ok: false, error: { line, message: `${type === "setParents" ? "parents" : "children"} expects <node> = <list>.` } } as const;
  }
  const parsedList = parseNodeList(tokens.slice(3));
  if (!parsedList.ok) {
    return { ok: false, error: { line, message: parsedList.message } } as const;
  }
  return { ok: true, instruction: { type, key, keys: parsedList.operands, line } } as const;
}

function parseSetInstruction(tokens: ConsoleToken[], line: number) {
  if (tokens.length !== 4) {
    return { ok: false, error: { line, message: "set expects <node> <field> <value>." } } as const;
  }
  const key = parseNodeOperand(tokens[1], true);
  const field = parseLiteralToken(tokens[2]);
  const value = parseLiteralToken(tokens[3]);
  if (!key || !field || value === null) {
    return { ok: false, error: { line, message: "set expects <node> <field> <value>." } } as const;
  }
  return { ok: true, instruction: { type: "setField", key, field, value, line } } as const;
}

function parseNodeList(tokens: ConsoleToken[]): { ok: true; operands: ConsoleNodeOperand[] } | { ok: false; message: string } {
  if (!tokens.length) {
    return { ok: true, operands: [] };
  }

  const operands: ConsoleNodeOperand[] = [];
  let expectsOperand = true;
  for (const token of tokens) {
    if (expectsOperand) {
      const operand = parseNodeOperand(token, true);
      if (!operand) {
        return { ok: false, message: "Expected a node operand in the relation list." };
      }
      operands.push(operand);
      expectsOperand = false;
      continue;
    }
    if (token.type !== "symbol" || token.value !== ",") {
      return { ok: false, message: "Expected a comma-separated relation list." };
    }
    expectsOperand = true;
  }

  if (expectsOperand) {
    return { ok: false, message: "Expected a node operand after the final comma." };
  }

  return { ok: true, operands };
}

function parseNodeOperand(token: ConsoleToken | undefined, allowContextAlias: boolean): ConsoleNodeOperand | null {
  if (!token) {
    return null;
  }
  if (token.type === "word" && token.value === "." && allowContextAlias) {
    return { type: "context" };
  }
  const value = parseLiteralToken(token);
  return value ? { type: "key", value } : null;
}

function parseLiteralToken(token: ConsoleToken | undefined): string | null {
  if (!token || token.type === "symbol") {
    return null;
  }
  return token.value;
}

function expectWordToken(token: ConsoleToken | undefined): Extract<ConsoleToken, { type: "word" }> | null {
  return token?.type === "word" ? token : null;
}
