/**
 * Owns how a Feature's main part keeps one JSON document of player data on disk: read it (a
 * missing file is the empty document), move an unreadable one aside and start empty, and
 * replace it atomically, readable only by the player (0o600). One operation runs at a time per
 * file, so a read-modify-write from two windows cannot lose a change. The Feature owns the
 * format: `parse` reads every document the released app writes, and throws for anything else.
 *
 * Main only: Travel history, Elite Skills capture plans, Maps' map knowledge and Trade Chat's
 * saved offers use it (their main/ folders).
 */
import { readFile } from "node:fs/promises";
import { writeAtomicJson } from "../main/core/atomic-file.js";
import { quarantineCorruptDocument } from "../main/core/corrupt-document.js";
import { Mutex } from "../main/core/mutex.js";

/** Player data is private to the player's account on this Mac. */
const DOCUMENT_MODE = 0o600;

export type JsonDocument<Document> = Readonly<{
  /**
   * Runs `operation` alone on the file at `path`, with the document as stored and a `save` that
   * replaces it. Nothing else this store runs on that file starts before `operation` settles.
   */
  run<Result>(path: string, operation: (stored: Document, save: (next: Document) => Promise<void>) => Promise<Result>): Promise<Result>;
}>;

export function jsonDocument<Document>({ parse, empty }: Readonly<{
  /** The document from parsed JSON; throws when it is not one. */
  parse(value: unknown): Document;
  /** The document a missing or unreadable file stands for. */
  empty: Document;
}>): JsonDocument<Document> {
  const locks = new Map<string, Mutex>();
  const lock = (path: string): Mutex => {
    let found = locks.get(path);
    if (found === undefined) {
      found = new Mutex();
      locks.set(path, found);
    }
    return found;
  };
  const read = async (path: string): Promise<Document> => {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty;
      throw error;
    }
    try {
      return parse(JSON.parse(text));
    } catch {
      await quarantineCorruptDocument(path);
      return empty;
    }
  };
  const save = (path: string) => (next: Document) => writeAtomicJson(path, next, DOCUMENT_MODE);
  return Object.freeze({
    run: (path, operation) => lock(path).run(async () => operation(await read(path), save(path))),
  });
}
