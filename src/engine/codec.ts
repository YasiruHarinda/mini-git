import { createHash } from "node:crypto";
import type { ObjectId } from "./storage/types.js";

export type ObjectType = "blob" | "tree" | "commit";

/**
 * Git's object framing: "<type> <size>\0<content>". This is what gets
 * hashed to produce the Object ID, and what ObjectStorage.write/read
 * exchange with the storage adapters (compression is an adapter detail,
 * not part of this framing).
 */
export function frameObject(type: ObjectType, content: Uint8Array): Uint8Array {
  const header = `${type} ${content.byteLength}\0`;
  const headerBytes = new TextEncoder().encode(header);
  const frame = new Uint8Array(headerBytes.byteLength + content.byteLength);
  frame.set(headerBytes, 0);
  frame.set(content, headerBytes.byteLength);
  return frame;
}

export function hashFrame(frame: Uint8Array): ObjectId {
  return createHash("sha1").update(frame).digest("hex");
}

export function hashObject(type: ObjectType, content: Uint8Array): ObjectId {
  return hashFrame(frameObject(type, content));
}

export interface ParsedObject {
  type: ObjectType;
  content: Uint8Array;
}

const NUL = 0;

export function parseFrame(frame: Uint8Array): ParsedObject {
  const nulIndex = frame.indexOf(NUL);
  if (nulIndex === -1) {
    throw new Error("malformed object: no NUL byte separating header from content");
  }
  const header = new TextDecoder().decode(frame.subarray(0, nulIndex));
  const [type, sizeStr] = header.split(" ");
  if (type !== "blob" && type !== "tree" && type !== "commit") {
    throw new Error(`malformed object: unknown type "${type}"`);
  }
  const size = Number(sizeStr);
  const content = frame.subarray(nulIndex + 1);
  if (content.byteLength !== size) {
    throw new Error(
      `malformed object: header declares ${size} bytes but content is ${content.byteLength}`,
    );
  }
  return { type, content };
}
