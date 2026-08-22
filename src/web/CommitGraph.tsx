import type { CommitData } from "../engine/commit.js";
import type { GraphLayout } from "../engine/graph.js";
import type { BranchInfo } from "../engine/repository.js";

/**
 * History drawn by hand in SVG from the engine's layout query (ticket 08).
 * Every row and lane here arrives already decided: the constants below turn
 * a row and a lane into pixels and nothing more. If this file ever needs to
 * work out *which* lane a Commit belongs in, that logic belongs in
 * `graph.ts`, not here (ADR 0002 — the interface asks, the engine decides).
 */
const ROW_HEIGHT = 30;
const LANE_WIDTH = 20;
const NODE_RADIUS = 5.5;
const MARGIN_X = 18;
const MARGIN_Y = 18;
const LABEL_GAP = 20;
/** The whole interface is monospace, so text width is a multiplication rather than a measurement. */
const CHAR_WIDTH = 6.6;
const CHIP_PAD = 6;
const CHIP_GAP = 6;
const LANE_COLOURS = 6;

function laneColour(lane: number): string {
  return `var(--lane-${lane % LANE_COLOURS})`;
}

function chipWidth(text: string): number {
  return text.length * CHAR_WIDTH + CHIP_PAD * 2;
}

interface Chip {
  text: string;
  kind: "head" | "branch";
}

export interface CommitGraphProps {
  layout: GraphLayout;
  commits: Map<string, CommitData>;
  branches: BranchInfo[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function CommitGraph({ layout, commits, branches, selectedId, onSelect }: CommitGraphProps) {
  if (layout.nodes.length === 0) {
    return <div className="empty">No Commits yet — stage a file and commit to grow a history.</div>;
  }

  const maxRow = Math.max(...layout.nodes.map((n) => n.row));
  const laneCount = Math.max(...layout.nodes.map((n) => n.lane)) + 1;

  // Row 0 is the root of History; screens read newest-first, so rows count
  // downward from the top. This flip is presentation, not layout.
  const y = (row: number) => MARGIN_Y + (maxRow - row) * ROW_HEIGHT;
  const x = (lane: number) => MARGIN_X + lane * LANE_WIDTH;
  const labelX = MARGIN_X + laneCount * LANE_WIDTH + LABEL_GAP;

  const chipsByCommit = new Map<string, Chip[]>();
  for (const branch of branches) {
    const chips = chipsByCommit.get(branch.id) ?? [];
    if (branch.current) chips.unshift({ text: "HEAD", kind: "head" });
    chips.push({ text: branch.name, kind: "branch" });
    chipsByCommit.set(branch.id, chips);
  }

  const positionOf = new Map(layout.nodes.map((n) => [n.id, n]));

  const rows = layout.nodes.map((node) => {
    const chips = chipsByCommit.get(node.id) ?? [];
    let cursor = labelX;
    const placed = chips.map((chip) => {
      const width = chipWidth(chip.text);
      const at = cursor;
      cursor += width + CHIP_GAP;
      return { ...chip, x: at, width };
    });
    const commit = commits.get(node.id);
    const summary = (commit?.message ?? "").split("\n")[0] ?? "";
    const text = `${node.id.slice(0, 8)}  ${summary}`;
    return { node, chips: placed, text, textX: cursor, endX: cursor + text.length * CHAR_WIDTH };
  });

  const width = Math.max(...rows.map((r) => r.endX)) + MARGIN_X;
  const height = (maxRow + 1) * ROW_HEIGHT + MARGIN_Y;

  return (
    <svg className="graph" width={width} height={height} role="img" aria-label="Commit graph">
      {rows.map(({ node }) => (
        <rect
          key={`hit-${node.id}`}
          className={`graph-row${node.id === selectedId ? " selected" : ""}`}
          x={0}
          y={y(node.row) - ROW_HEIGHT / 2}
          width={width}
          height={ROW_HEIGHT}
          onClick={() => onSelect(node.id)}
        >
          <title>{node.id}</title>
        </rect>
      ))}

      <g className="graph-ink">
        {layout.edges.map((edge) => {
          const from = positionOf.get(edge.from)!;
          const to = positionOf.get(edge.to)!;
          const x1 = x(from.lane);
          const y1 = y(from.row);
          const x2 = x(to.lane);
          const y2 = y(to.row);
          // Colour by the outer lane so a side line keeps its own colour
          // all the way to the Merge Commit that absorbs it.
          const colour = laneColour(Math.max(from.lane, to.lane));
          const mid = (y1 + y2) / 2;
          const d = x1 === x2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`;
          return <path key={`${edge.from}-${edge.to}`} d={d} style={{ stroke: colour }} fill="none" />;
        })}

        {layout.nodes.map((node) => {
          const merge = node.parents.length > 1;
          const colour = laneColour(node.lane);
          return (
            <g key={`node-${node.id}`}>
              {node.id === selectedId && (
                <circle cx={x(node.lane)} cy={y(node.row)} r={NODE_RADIUS + 4} className="node-halo" style={{ stroke: colour }} />
              )}
              <circle
                cx={x(node.lane)}
                cy={y(node.row)}
                r={merge ? NODE_RADIUS + 1 : NODE_RADIUS}
                className={merge ? "node merge" : "node"}
                style={merge ? { stroke: colour } : { fill: colour }}
              />
            </g>
          );
        })}

        {rows.map(({ node, chips, text, textX }) => (
          <g key={`label-${node.id}`}>
            {chips.map((chip) => (
              <g key={chip.text}>
                <rect
                  className={`chip ${chip.kind}`}
                  x={chip.x}
                  y={y(node.row) - 8}
                  width={chip.width}
                  height={16}
                  rx={3}
                  style={chip.kind === "branch" ? { stroke: laneColour(node.lane) } : undefined}
                />
                <text className={`chip-text ${chip.kind}`} x={chip.x + CHIP_PAD} y={y(node.row) + 4}>
                  {chip.text}
                </text>
              </g>
            ))}
            <text className={`graph-text${node.id === selectedId ? " selected" : ""}`} x={textX} y={y(node.row) + 4}>
              {text}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
