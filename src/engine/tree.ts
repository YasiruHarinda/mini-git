import { compareBytes, hexToRaw20, raw20ToHex } from "./bytes.js";
import type { ObjectId } from "./storage/types.js";

/** Only regular files and sub-Trees; executable bit, symlinks etc. are out of scope. */
export type TreeEntryMode = "100644" | "40000";

export interface TreeEntry {
  mode: TreeEntryMode;
  name: string;
  id: ObjectId;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Git sorts tree entries as though directory names carry a trailing slash,
 * so "src.js" precedes "src/" against what a naive comparison of the raw
 * names gives. Getting this wrong is the classic trap (ADR 0001).
 */
function sortKey(entry: TreeEntry): Uint8Array {
  return encoder.encode(entry.mode === "40000" ? `${entry.name}/` : entry.name);
}

export function sortTreeEntries(entries: readonly TreeEntry[]): TreeEntry[] {
  return [...entries].sort((a, b) => compareBytes(sortKey(a), sortKey(b)));
}

/** Entries must already be sorted (see sortTreeEntries) — this does not sort them itself. */
export function encodeTree(entries: readonly TreeEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const entry of entries) {
    const head = encoder.encode(`${entry.mode} ${entry.name}\0`);
    const idBytes = hexToRaw20(entry.id);
    parts.push(head, idBytes);
    total += head.byteLength + idBytes.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export function decodeTree(content: Uint8Array): TreeEntry[] {
  const entries: TreeEntry[] = [];
  let offset = 0;
  while (offset < content.byteLength) {
    const nulIndex = content.indexOf(0, offset);
    if (nulIndex === -1) {
      throw new Error("malformed tree: missing NUL after entry header");
    }
    const header = decoder.decode(content.subarray(offset, nulIndex));
    const spaceIndex = header.indexOf(" ");
    if (spaceIndex === -1) {
      throw new Error(`malformed tree: no space in entry header "${header}"`);
    }
    const mode = header.slice(0, spaceIndex);
    const name = header.slice(spaceIndex + 1);
    if (mode !== "100644" && mode !== "40000") {
      throw new Error(`malformed tree: unsupported mode "${mode}"`);
    }
    const idBytes = content.subarray(nulIndex + 1, nulIndex + 21);
    if (idBytes.byteLength !== 20) {
      throw new Error("malformed tree: truncated Object ID");
    }
    entries.push({ mode, name, id: raw20ToHex(idBytes) });
    offset = nulIndex + 21;
  }
  return entries;
}
