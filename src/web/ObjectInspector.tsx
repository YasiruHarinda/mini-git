import { useCallback, useEffect, useState } from "react";
import type { CommitData } from "../engine/commit.js";
import type { ObjectOrigin, ObjectStats, Repository } from "../engine/repository.js";
import type { TreeEntry } from "../engine/tree.js";

const decoder = new TextDecoder();

function shortId(id: string): string {
  return id.slice(0, 8);
}

interface OidProps {
  id: string;
  origin: ObjectOrigin;
}

/**
 * Every Object on this screen wears its Object ID and says whether the last
 * operation created it. The engine answers the second question (`objectOrigin`)
 * — identical bytes are identical from out here, so the interface has no way
 * to tell a new Object from a reused one by looking.
 */
function Oid({ id, origin }: OidProps) {
  return (
    <span className={`oid ${origin}`} title={`${id} — ${origin === "created" ? "created by the last operation" : "reused unchanged"}`}>
      {shortId(id)}
    </span>
  );
}

export interface ObjectInspectorProps {
  repo: Repository;
  commitId?: string;
  stats?: ObjectStats;
  originOf: (id: string) => ObjectOrigin;
}

export function ObjectInspector({ repo, commitId, stats, originOf }: ObjectInspectorProps) {
  const [commit, setCommit] = useState<CommitData | null>(null);
  const [trees, setTrees] = useState<Map<string, TreeEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [blob, setBlob] = useState<{ id: string; path: string; text: string } | null>(null);
  /** How many paths in this Commit resolve to each Blob — one Blob at two paths is the whole point. */
  const [pathsPerBlob, setPathsPerBlob] = useState<Map<string, number>>(new Map());

  const loadTree = useCallback(
    async (id: string) => {
      const entries = await repo.readTree(id);
      if (entries) setTrees((prev) => new Map(prev).set(id, entries));
    },
    [repo],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!commitId) {
        setCommit(null);
        setBlob(null);
        return;
      }
      const data = await repo.readCommit(commitId);
      const entries = await repo.readCommitEntries(commitId);
      if (cancelled) return;
      const counts = new Map<string, number>();
      for (const entry of entries) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
      setPathsPerBlob(counts);
      setCommit(data);
      setBlob(null);
      // The Object Store is append-only, so cached Tree entries never go
      // stale; only the root a new selection starts from changes.
      setExpanded(data ? new Set([data.tree]) : new Set());
      if (data) await loadTree(data.tree);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, commitId, loadTree]);

  async function toggle(id: string) {
    const open = expanded.has(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!open && !trees.has(id)) await loadTree(id);
  }

  async function showBlob(id: string, path: string) {
    const content = await repo.readBlob(id);
    setBlob({ id, path, text: content ? decoder.decode(content) : "" });
  }

  function renderTree(treeId: string, prefix: string, depth: number): React.ReactNode[] {
    const entries = trees.get(treeId);
    if (!entries) return [<div key={`${treeId}-loading`} className="empty">reading Tree…</div>];

    return entries.flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isTree = entry.mode === "40000";
      const open = isTree && expanded.has(entry.id);
      const shared = (pathsPerBlob.get(entry.id) ?? 0) > 1;
      const row = (
        <div
          key={path}
          className={`object-row clickable${blob?.id === entry.id && blob.path === path ? " selected" : ""}`}
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => (isTree ? toggle(entry.id) : showBlob(entry.id, path))}
        >
          <span className="twisty">{isTree ? (open ? "▾" : "▸") : " "}</span>
          <span className={`kind ${isTree ? "tree" : "blob"}`}>{isTree ? "tree" : "blob"}</span>
          <span className="path">
            {entry.name}
            {isTree ? "/" : ""}
          </span>
          {shared && <span className="badge shared" title="the same Blob appears at more than one path in this Commit">shared</span>}
          <Oid id={entry.id} origin={originOf(entry.id)} />
        </div>
      );
      return open ? [row, ...renderTree(entry.id, path, depth + 1)] : [row];
    });
  }

  if (!commitId || !commit) {
    return <div className="empty">Select a Commit in the graph to walk its Objects.</div>;
  }

  const saved = stats && stats.fileVersions > 0 ? Math.round(stats.savedProportion * 100) : 0;

  return (
    <>
      {stats && (
        <div className="stats">
          <strong>{stats.uniqueBlobs}</strong> unique Blob{stats.uniqueBlobs === 1 ? "" : "s"} hold{" "}
          <strong>{stats.fileVersions}</strong> file version{stats.fileVersions === 1 ? "" : "s"} committed —{" "}
          <strong>{saved}%</strong> saved by Structural Sharing.
        </div>
      )}

      <div className="object-body">
        <div className="object-row header">
          <span className="kind commit">commit</span>
          <span className="path">{commit.message.split("\n")[0]}</span>
          <Oid id={commitId} origin={originOf(commitId)} />
        </div>
        <div className="object-meta">
          {commit.parents.length === 0 ? (
            <div>
              <span className="label">parent</span> none — the root of this History
            </div>
          ) : (
            commit.parents.map((parent, i) => (
              <div key={parent}>
                <span className="label">{commit.parents.length > 1 ? `parent ${i + 1}` : "parent"}</span>
                <Oid id={parent} origin={originOf(parent)} />
              </div>
            ))
          )}
          <div>
            <span className="label">author</span> {commit.author.name} &lt;{commit.author.email}&gt;
          </div>
        </div>

        <div className="object-row header" onClick={() => toggle(commit.tree)}>
          <span className="twisty">{expanded.has(commit.tree) ? "▾" : "▸"}</span>
          <span className="kind tree">tree</span>
          <span className="path">/</span>
          <Oid id={commit.tree} origin={originOf(commit.tree)} />
        </div>
        {expanded.has(commit.tree) && renderTree(commit.tree, "", 1)}

        {blob && (
          <div className="blob-view">
            <div className="blob-header">
              <span className="path">{blob.path}</span>
              <Oid id={blob.id} origin={originOf(blob.id)} />
            </div>
            <pre>{blob.text || "(empty file)"}</pre>
          </div>
        )}
      </div>

      <div className="legend">
        <span className="oid created">new</span> created by the last operation
        <span className="oid reused">reused</span> already in the Object Store
      </div>
    </>
  );
}
