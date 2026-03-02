import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { JsonlLine } from "../types/jsonl.js";

const VALID_TYPES = new Set(["user", "assistant", "system", "progress", "queue-operation"]);

/**
 * Parse a single JSONL line into a typed message.
 * Returns null for unparseable or unknown lines.
 */
export function parseJsonlLine(raw: string): JsonlLine | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || !parsed || !VALID_TYPES.has(parsed.type)) {
      return null;
    }
    return parsed as JsonlLine;
  } catch {
    return null;
  }
}

/**
 * Stream-parse a JSONL file, yielding each parsed line.
 * Optionally start from a byte offset for tail-like behavior.
 */
export async function* parseJsonlFile(
  filePath: string,
  startByte = 0,
): AsyncGenerator<JsonlLine> {
  const stream = createReadStream(filePath, {
    start: startByte,
    encoding: "utf-8",
  });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const parsed = parseJsonlLine(line);
    if (parsed) yield parsed;
  }
}

/**
 * Parse all lines from a JSONL file into an array.
 * For large files, prefer parseJsonlFile generator.
 */
export async function parseJsonlFileAll(filePath: string): Promise<JsonlLine[]> {
  const lines: JsonlLine[] = [];
  for await (const line of parseJsonlFile(filePath)) {
    lines.push(line);
  }
  return lines;
}
