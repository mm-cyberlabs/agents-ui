import { createReadStream, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { watch, type FSWatcher } from "chokidar";
import { EventEmitter } from "eventemitter3";
import { parseJsonlLine } from "../parsers/jsonl-parser.js";
import type { JsonlLine } from "../types/jsonl.js";

export interface JsonlTailEvents {
  line: (line: JsonlLine, filePath: string) => void;
  error: (error: Error, filePath: string) => void;
}

/**
 * Tails a JSONL file, emitting parsed lines as they are appended.
 * Tracks byte offset to avoid re-reading the entire file.
 */
export class JsonlTail extends EventEmitter<JsonlTailEvents> {
  private watcher: FSWatcher | null = null;
  private byteOffset = 0;
  private reading = false;
  private pendingRead = false;

  constructor(
    private filePath: string,
    private startFromEnd = false,
  ) {
    super();
  }

  /**
   * Start tailing. If startFromEnd is true, skip existing content.
   * Otherwise, read and emit all existing lines first.
   */
  async start(): Promise<void> {
    if (this.startFromEnd) {
      try {
        const s = await stat(this.filePath);
        this.byteOffset = s.size;
      } catch {
        this.byteOffset = 0;
      }
    }

    // Read existing content
    await this.readNewLines();

    // Watch for changes
    this.watcher = watch(this.filePath, {
      persistent: false,
      usePolling: false,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    });

    this.watcher.on("change", () => {
      this.readNewLines().catch((err) =>
        this.emit("error", err instanceof Error ? err : new Error(String(err)), this.filePath),
      );
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private async readNewLines(): Promise<void> {
    if (this.reading) {
      this.pendingRead = true;
      return;
    }

    this.reading = true;

    try {
      // Check if file has grown
      let fileSize: number;
      try {
        fileSize = statSync(this.filePath).size;
      } catch {
        return;
      }

      if (fileSize <= this.byteOffset) return;

      const stream = createReadStream(this.filePath, {
        start: this.byteOffset,
        encoding: "utf-8",
      });

      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      let bytesRead = 0;
      for await (const rawLine of rl) {
        // +1 for newline character
        bytesRead += Buffer.byteLength(rawLine, "utf-8") + 1;
        const parsed = parseJsonlLine(rawLine);
        if (parsed) {
          this.emit("line", parsed, this.filePath);
        }
      }

      this.byteOffset += bytesRead;
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)), this.filePath);
    } finally {
      this.reading = false;
      if (this.pendingRead) {
        this.pendingRead = false;
        this.readNewLines().catch((err) =>
          this.emit("error", err instanceof Error ? err : new Error(String(err)), this.filePath),
        );
      }
    }
  }
}
