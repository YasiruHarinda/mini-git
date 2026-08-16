import type { ObjectId } from "./storage/types.js";

export interface Signature {
  name: string;
  email: string;
  /** Unix timestamp in seconds. */
  timestamp: number;
  /** Minutes east of UTC; negative for zones behind UTC. */
  timezoneOffsetMinutes: number;
}

export interface CommitData {
  tree: ObjectId;
  /** Zero for the first Commit in a Repository, one normally, two for a Merge Commit. */
  parents: ObjectId[];
  author: Signature;
  committer: Signature;
  message: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function formatSignature(sig: Signature): string {
  const sign = sig.timezoneOffsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(sig.timezoneOffsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sig.name} <${sig.email}> ${sig.timestamp} ${sign}${hh}${mm}`;
}

const SIGNATURE_PATTERN = /^(.*) <(.*)> (\d+) ([+-]\d{2})(\d{2})$/;

function parseSignature(line: string): Signature {
  const match = line.match(SIGNATURE_PATTERN);
  if (!match) {
    throw new Error(`malformed commit: bad signature line "${line}"`);
  }
  const [, name, email, timestamp, tzHours, tzMinutes] = match;
  const sign = tzHours!.startsWith("-") ? -1 : 1;
  const timezoneOffsetMinutes = sign * (Math.abs(Number(tzHours)) * 60 + Number(tzMinutes));
  return { name: name!, email: email!, timestamp: Number(timestamp), timezoneOffsetMinutes };
}

export function encodeCommit(data: CommitData): Uint8Array {
  const lines: string[] = [`tree ${data.tree}`];
  for (const parent of data.parents) {
    lines.push(`parent ${parent}`);
  }
  lines.push(`author ${formatSignature(data.author)}`);
  lines.push(`committer ${formatSignature(data.committer)}`);
  lines.push("");
  return encoder.encode(lines.join("\n") + "\n" + data.message);
}

export function decodeCommit(content: Uint8Array): CommitData {
  const text = decoder.decode(content);
  const separator = text.indexOf("\n\n");
  if (separator === -1) {
    throw new Error("malformed commit: no blank line separating header from message");
  }
  const header = text.slice(0, separator);
  const message = text.slice(separator + 2);

  let tree: ObjectId | undefined;
  const parents: ObjectId[] = [];
  let author: Signature | undefined;
  let committer: Signature | undefined;

  for (const line of header.split("\n")) {
    if (line.startsWith("tree ")) {
      tree = line.slice("tree ".length);
    } else if (line.startsWith("parent ")) {
      parents.push(line.slice("parent ".length));
    } else if (line.startsWith("author ")) {
      author = parseSignature(line.slice("author ".length));
    } else if (line.startsWith("committer ")) {
      committer = parseSignature(line.slice("committer ".length));
    }
  }

  if (!tree || !author || !committer) {
    throw new Error("malformed commit: missing tree, author or committer");
  }
  return { tree, parents, author, committer, message };
}
