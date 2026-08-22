import { useCallback, useEffect, useRef, useState } from "react";
import { hashObject } from "../engine/codec.js";
import type { CommitData } from "../engine/commit.js";
import type { GraphLayout } from "../engine/graph.js";
import type { IndexEntry } from "../engine/index-entries.js";
import { CheckoutConflictError, Repository, type BranchInfo, type ObjectStats } from "../engine/repository.js";
import { MemoryStorage } from "../engine/storage/memory.js";
import { CommitGraph } from "./CommitGraph.js";
import { ObjectInspector } from "./ObjectInspector.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const enc = (s: string) => encoder.encode(s);
const dec = (b: Uint8Array) => decoder.decode(b);

function shortId(id: string): string {
  return id.slice(0, 8);
}

interface RowProps {
  path: string;
  id?: string;
  className?: string;
  onClick?: () => void;
  actions?: React.ReactNode;
}

function Row({ path, id, className, onClick, actions }: RowProps) {
  return (
    <div className={`row${onClick ? " clickable" : ""}${className ? ` ${className}` : ""}`} onClick={onClick}>
      <span className="path">{path}</span>
      {id && <span className="oid" title={id}>{shortId(id)}</span>}
      {actions && (
        <span className="row-actions" onClick={(e) => e.stopPropagation()}>
          {actions}
        </span>
      )}
    </div>
  );
}

export function App() {
  const [repo] = useState(() => new Repository(new MemoryStorage()));
  const [ready, setReady] = useState(false);

  // The engine keeps no Working Tree of its own (ADR 0002) — this UI owns it entirely, as a plain path -> content map.
  const [files, setFiles] = useState<Record<string, string>>({});
  const filesRef = useRef(files);
  filesRef.current = files;

  const [indexEntries, setIndexEntries] = useState<IndexEntry[]>([]);
  const [commitEntries, setCommitEntries] = useState<IndexEntry[]>([]);
  const [headId, setHeadId] = useState<string | undefined>(undefined);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState("");

  const [layout, setLayout] = useState<GraphLayout>({ nodes: [], edges: [] });
  const [commitsById, setCommitsById] = useState<Map<string, CommitData>>(new Map());
  const [stats, setStats] = useState<ObjectStats | undefined>(undefined);
  /** Which Commit the graph, the Commit column and the inspector are all looking at. */
  const [selectedCommitId, setSelectedCommitId] = useState<string | undefined>(undefined);
  const [selectedEntries, setSelectedEntries] = useState<IndexEntry[]>([]);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastCommitId, setLastCommitId] = useState<string | null>(null);

  const refresh = useCallback(
    async (select?: string) => {
      setIndexEntries(repo.readIndex());
      const head = await repo.headCommitId();
      setHeadId(head);
      setCommitEntries(head ? await repo.readCommitEntries(head) : []);
      setBranches(await repo.listBranches());
      const branchRef = await repo.currentBranch();
      setCurrentBranch(branchRef.replace(/^refs\/heads\//, ""));

      const nextLayout = await repo.graphLayout();
      const commits = new Map<string, CommitData>();
      for (const node of nextLayout.nodes) {
        const data = await repo.readCommit(node.id);
        if (data) commits.set(node.id, data);
      }
      setLayout(nextLayout);
      setCommitsById(commits);
      setStats(await repo.objectStats());

      // Selection follows an explicit request, otherwise stays put — and
      // falls back to HEAD if the Commit it was on is no longer in History.
      setSelectedCommitId((previous) => {
        const wanted = select ?? previous;
        return wanted !== undefined && commits.has(wanted) ? wanted : head;
      });
    },
    [repo],
  );

  useEffect(() => {
    (async () => {
      setSelectedEntries(selectedCommitId ? await repo.readCommitEntries(selectedCommitId) : []);
    })();
  }, [repo, selectedCommitId]);

  useEffect(() => {
    (async () => {
      await repo.init();
      setFiles({ "README.md": "# mini-git\n\nEdit, stage, commit — and watch the Object Store.\n" });
      await refresh();
      setReady(true);
    })();
  }, [repo, refresh]);

  function createFile() {
    const path = newFileName.trim();
    if (!path || path in files) return;
    setFiles((f) => ({ ...f, [path]: "" }));
    setNewFileName("");
    setSelectedPath(path);
  }

  function editFile(path: string, content: string) {
    setFiles((f) => ({ ...f, [path]: content }));
  }

  function deleteFile(path: string) {
    setFiles((f) => {
      const next = { ...f };
      delete next[path];
      return next;
    });
    if (selectedPath === path) setSelectedPath(null);
  }

  async function stage(path: string) {
    const content = files[path];
    if (content === undefined) {
      repo.unstage(path);
    } else {
      await repo.add(path, enc(content));
    }
    await refresh();
  }

  async function unstage(path: string) {
    repo.unstage(path);
    await refresh();
  }

  async function commit() {
    setError(null);
    try {
      const result = await repo.commit({ message: message.trim() || "(no message)" });
      setLastCommitId(result.id);
      setMessage("");
      await refresh(result.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createBranch() {
    const name = newBranchName.trim();
    if (!name) return;
    setError(null);
    try {
      await repo.branch(name);
      setNewBranchName("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function checkoutBranch(name: string) {
    setError(null);
    try {
      const result = await repo.checkout(name, async (path) => {
        const content = filesRef.current[path];
        return content === undefined ? undefined : enc(content);
      });
      setFiles((prev) => {
        const next = { ...prev };
        for (const { path, content } of result.writes) next[path] = dec(content);
        for (const path of result.removes) delete next[path];
        return next;
      });
      await refresh();
    } catch (err) {
      if (err instanceof CheckoutConflictError) {
        setError(`Checkout refused — uncommitted changes in: ${err.paths.join(", ")}`);
      } else {
        setError((err as Error).message);
      }
    }
  }

  if (!ready) return null;

  const indexByPath = new Map(indexEntries.map((e) => [e.path, e.id]));
  const commitByPath = new Map(commitEntries.map((e) => [e.path, e.id]));
  const workingPaths = Object.keys(files).sort();

  return (
    <>
      <header>
        <div>
          <h1>mini-git</h1>
          <span className="tagline">the internals are the interface</span>
        </div>
        <div className="branch-bar">
          <span>HEAD → {currentBranch || "(unborn)"}</span>
          <select value={currentBranch} onChange={(e) => checkoutBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            placeholder="new branch"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBranch()}
          />
          <button onClick={createBranch}>Branch</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <main>
        <div className="columns">
          <div className="column">
            <div className="column-header">
              <span>Working Tree</span>
              <span>{workingPaths.length}</span>
            </div>
            <div className="column-body">
              {workingPaths.length === 0 && <div className="empty">No files.</div>}
              {workingPaths.map((path) => {
                const content = files[path]!;
                const workingId = hashObject("blob", enc(content));
                const indexId = indexByPath.get(path);
                const modified = indexId !== undefined && indexId !== workingId;
                const added = indexId === undefined;
                return (
                  <Row
                    key={path}
                    path={path}
                    id={workingId}
                    className={modified ? "modified" : added ? "added" : undefined}
                    onClick={() => setSelectedPath(path)}
                    actions={
                      <>
                        <button onClick={() => stage(path)}>Stage</button>
                        <button onClick={() => deleteFile(path)}>Delete</button>
                      </>
                    }
                  />
                );
              })}
            </div>
            <div className="new-file">
              <input
                placeholder="new file path"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFile()}
              />
              <button onClick={createFile}>New</button>
            </div>
          </div>

          <div className="column">
            <div className="column-header">
              <span>Index</span>
              <span>{indexEntries.length}</span>
            </div>
            <div className="column-body">
              {indexEntries.length === 0 && <div className="empty">Nothing staged.</div>}
              {indexEntries.map(({ path, id }) => {
                const committedId = commitByPath.get(path);
                const staged = committedId !== id;
                return (
                  <Row
                    key={path}
                    path={path}
                    id={id}
                    className={staged ? "added" : undefined}
                    actions={<button onClick={() => unstage(path)}>Unstage</button>}
                  />
                );
              })}
            </div>
          </div>

          <div className="column">
            <div className="column-header">
              <span>{selectedCommitId === headId ? "Commit (HEAD)" : "Commit (selected)"}</span>
              <span className="oid">{selectedCommitId ? shortId(selectedCommitId) : "—"}</span>
            </div>
            <div className="column-body">
              {selectedEntries.length === 0 && <div className="empty">No Commits yet.</div>}
              {selectedEntries.map(({ path, id }) => (
                <Row key={path} path={path} id={id} />
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="editor">
            <div className="editor-header">
              <span>{selectedPath ?? "select a file"}</span>
            </div>
            <textarea
              disabled={!selectedPath}
              value={selectedPath ? (files[selectedPath] ?? "") : ""}
              onChange={(e) => selectedPath && editFile(selectedPath, e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="commit-box">
            <input
              placeholder="commit message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
            <button onClick={commit} disabled={indexEntries.length === 0}>
              Commit
            </button>
          </div>
          {lastCommitId && <div className="error" style={{ color: "var(--text-dim)" }}>Committed {shortId(lastCommitId)}</div>}
        </div>

        <div className="panel graph-panel">
          <div className="column-header">
            <span>History</span>
            <span>{layout.nodes.length} Commits</span>
          </div>
          <div className="panel-body">
            <CommitGraph
              layout={layout}
              commits={commitsById}
              branches={branches}
              selectedId={selectedCommitId}
              onSelect={setSelectedCommitId}
            />
          </div>
        </div>

        <div className="panel inspector-panel">
          <div className="column-header">
            <span>Object Inspector</span>
            <span className="oid">{selectedCommitId ? shortId(selectedCommitId) : "—"}</span>
          </div>
          <ObjectInspector repo={repo} commitId={selectedCommitId} stats={stats} originOf={(id) => repo.objectOrigin(id)} />
        </div>
      </main>
    </>
  );
}
