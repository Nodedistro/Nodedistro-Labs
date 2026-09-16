"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  ConnectionMode,
  applyNodeChanges,
  type Node,
  type NodeProps,
  type Connection,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  MousePointer2,
  Hand,
  Plus,
  Waypoints,
  RotateCw,
  Trash2,
  Focus,
  Type,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { uid } from "@/lib/utils";
import { toast } from "sonner";
import type { Part, Component, Project } from "@/types/project";
export function SymbolNode({ data, selected }: NodeProps) {
  const c = data.component as Component,
    p = data.part as Part;
  return (
    <div
      className={"circuit-node " + (selected ? "selected" : "")}
      style={{ transform: `rotate(${c.rotation}deg)` }}
    >
      <span className="part-ref">{c.reference}</span>
      <div className="part-name">{p?.name ?? c.value}</div>
      {p?.pins.map((pin, i) => (
        <div className="pin-row" key={pin.id}>
          <Handle
            type="source"
            position={i % 2 === 0 ? Position.Left : Position.Right}
            id={pin.id}
            isConnectable
          />
          <span>{i % 2 === 0 ? pin.id : ""}</span>
          <span>{pin.name}</span>
          <span>{i % 2 ? pin.id : ""}</span>
        </div>
      ))}
      <span className="part-package">
        {p?.package} · {c.value}
      </span>
    </div>
  );
}
const nodeTypes = {
  component: SymbolNode,
  label: ({ data }: NodeProps) => (
    <div className="block-label">{String(data.label)}</div>
  ),
  annotation: ({ data }: NodeProps) => (
    <div className="notice">{String(data.label)}</div>
  ),
};
export function Schematic({
  project: p,
  selected,
  onSelect,
  onAdd,
  focusId,
  focusNonce,
  onCursor,
}: {
  project: Project;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onAdd: () => void;
  focusId?: string;
  focusNonce: number;
  onCursor?: (point: { x: number; y: number }) => void;
}) {
  const edit = useWorkspace((s) => s.edit),
    d = p.document,
    readOnly = !["owner", "editor"].includes(p.role);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null),
    [tool, setTool] = useState<"select" | "pan" | "wire" | "label">("select");
  const computed = useMemo(
    () =>
      [
        ...d.components.map((c) => ({
          id: c.id,
          type: "component",
          position: { x: c.x, y: c.y },
          data: { component: c, part: d.parts.find((p) => p.id === c.partId) },
          selected: selected.includes(c.id),
        })),
        ...Array.from(new Set(d.components.map((c) => c.block)))
          .filter(Boolean)
          .map((block, i) => {
            const members = d.components.filter((c) => c.block === block);
            return {
              id: "block-" + i,
              type: "label",
              position: {
                x: Math.min(...members.map((c) => c.x)),
                y: Math.min(...members.map((c) => c.y)) - 80,
              },
              data: { label: block },
              selectable: false,
              draggable: false,
            };
          }),
        ...d.annotations.map((a) => ({
          id: a.id,
          type: "annotation",
          position: { x: a.x, y: a.y },
          data: { label: a.text },
        })),
      ] as Node[],
    [d, selected],
  );
  const [nodes, setNodes] = useState<Node[]>(computed);
  useEffect(() => setNodes(computed), [computed]);
  const edges = useMemo(
    () =>
      d.nets.flatMap((n) =>
        n.connections
          .slice(1)
          .map((c, i) => ({
            id: n.id + "::" + i,
            source: n.connections[0].componentId,
            sourceHandle: n.connections[0].pinId,
            target: c.componentId,
            targetHandle: c.pinId,
            type: "smoothstep",
            label: n.name,
            style: {
              stroke:
                n.name === "GND"
                  ? "#5d8d7c"
                  : n.name.startsWith("+")
                    ? "#b89f70"
                    : "#7fb69d",
              strokeWidth: 1.2,
            },
            labelStyle: { fill: "#a8bdad", fontSize: 9 },
            labelBgStyle: { fill: "#19241f" },
            data: { netId: n.id, connection: c },
          })),
      ),
    [d.nets],
  );
  const remove = useCallback(() => {
    if (!selected.length || readOnly) return;
    edit(p.id, "Remove selected components", (doc) => {
      doc.components = doc.components.filter((c) => !selected.includes(c.id));
      doc.nets = doc.nets.map((n) => ({
        ...n,
        connections: n.connections.filter(
          (c) => !selected.includes(c.componentId),
        ),
      }));
      doc.annotations = doc.annotations.filter((a) => !selected.includes(a.id));
    });
    onSelect([]);
  }, [selected, readOnly, p.id, edit, onSelect]);
  const rotate = useCallback(() => {
    if (readOnly) return;
    edit(p.id, "Rotate selection", (doc) =>
      doc.components.forEach((c) => {
        if (selected.includes(c.id)) c.rotation = (c.rotation + 90) % 360;
      }),
    );
  }, [readOnly, p.id, selected, edit]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches(
          "input,textarea,select,[contenteditable=true]",
        ) ||
        document.querySelector("[role=dialog]")
      )
        return;
      if (e.key === "Delete") {
        e.preventDefault();
        remove();
      }
      if (e.key.toLowerCase() === "r") rotate();
      if (e.key.toLowerCase() === "w") setTool("wire");
      if (e.key === "Escape") {
        setTool("select");
        onSelect([]);
      }
      if (e.key.toLowerCase() === "f")
        flow?.fitView({
          nodes: selected.map((id) => ({ id })),
          duration: 300,
          padding: 0.4,
        });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [remove, rotate, onSelect, flow, selected]);
  useEffect(() => {
    if (focusId && flow)
      flow.fitView({ nodes: [{ id: focusId }], padding: 1, duration: 350 });
  }, [focusId, focusNonce, flow]);
  const connect = (conn: Connection) => {
    if (readOnly || !conn.sourceHandle || !conn.targetHandle) return;
    const a = { componentId: conn.source, pinId: conn.sourceHandle },
      b = { componentId: conn.target, pinId: conn.targetHandle };
    if (a.componentId === b.componentId && a.pinId === b.pinId) return;
    edit(p.id, "Connect schematic pins", (doc) => {
      const na = doc.nets.find((n) =>
          n.connections.some(
            (c) => c.componentId === a.componentId && c.pinId === a.pinId,
          ),
        ),
        nb = doc.nets.find((n) =>
          n.connections.some(
            (c) => c.componentId === b.componentId && c.pinId === b.pinId,
          ),
        );
      if (na && nb) {
        if (na.id === nb.id) return;
        na.connections.push(...nb.connections);
        doc.nets = doc.nets.filter((n) => n.id !== nb.id);
        doc.traces.forEach((t) => {
          if (t.netId === nb.id) t.netId = na.id;
        });
        doc.vias.forEach((v) => {
          if (v.netId === nb.id) v.netId = na.id;
        });
      } else if (na) na.connections.push(b);
      else if (nb) nb.connections.push(a);
      else
        doc.nets.push({
          id: uid(),
          name: "NET_" + (doc.nets.length + 1),
          connections: [a, b],
        });
    });
  };
  return (
    <div className="canvas">
      <div className="canvas-toolbar">
        {[
          [MousePointer2, "select", "Select (V)"],
          [Hand, "pan", "Pan"],
          [Waypoints, "wire", "Wire (W)"],
        ].map(([Icon, t, label]) => {
          const I = Icon as typeof Hand;
          return (
            <Button
              key={String(t)}
              variant="ghost"
              size="icon"
              title={String(label)}
              aria-label={String(label)}
              className={tool === t ? "active" : ""}
              onClick={() => setTool(t as typeof tool)}
            >
              <I />
            </Button>
          );
        })}
        <span className="divider" />
        <Button
          variant="ghost"
          size="icon"
          title="Add component"
          aria-label="Add component"
          onClick={onAdd}
          disabled={readOnly}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Add annotation"
          aria-label="Add annotation"
          onClick={() => setTool("label")}
          disabled={readOnly}
        >
          <Type />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Rotate (R)"
          aria-label="Rotate selection"
          onClick={rotate}
          disabled={!selected.length || readOnly}
        >
          <RotateCw />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Delete"
          aria-label="Delete selection"
          onClick={remove}
          disabled={!selected.length || readOnly}
        >
          <Trash2 />
        </Button>
        <span className="divider" />
        <Button
          variant="ghost"
          size="icon"
          title="Fit design"
          aria-label="Fit design"
          onClick={() => flow?.fitView({ padding: 0.2, duration: 300 })}
        >
          <Focus />
        </Button>
      </div>
      {tool === "wire" && (
        <div className="tool-instruction">
          Drag between pin handles to connect. Connected nets merge.
        </div>
      )}
      {tool === "label" && (
        <div className="tool-instruction">
          Click the canvas to add an annotation.
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setFlow}
        onNodesChange={(changes: NodeChange[]) =>
          setNodes((ns) => applyNodeChanges(changes, ns))
        }
        onNodeDragStop={(_, node, dragged) =>
          edit(p.id, "Move schematic components", (doc) => {
            for (const n of dragged.length ? dragged : [node]) {
              const c = doc.components.find((c) => c.id === n.id),
                a = doc.annotations.find((a) => a.id === n.id);
              if (c) Object.assign(c, { x: n.position.x, y: n.position.y });
              if (a) Object.assign(a, { x: n.position.x, y: n.position.y });
            }
          })
        }
        onSelectionChange={({ nodes }) => {
          const ids = nodes
            .filter((n) => !n.id.startsWith("block"))
            .map((n) => n.id);
          if (ids.join() !== selected.join()) onSelect(ids);
        }}
        onConnect={connect}
        connectionMode={ConnectionMode.Loose}
        onEdgesDelete={(deleted) => {
          if (readOnly) return;
          edit(p.id, "Disconnect pins", (doc) => {
            for (const edge of deleted) {
              const data = edge.data as {
                netId: string;
                connection: { componentId: string; pinId: string };
              };
              const net = doc.nets.find((n) => n.id === data.netId);
              if (net)
                net.connections = net.connections.filter(
                  (c) =>
                    !(
                      c.componentId === data.connection.componentId &&
                      c.pinId === data.connection.pinId
                    ),
                );
            }
          });
        }}
        onPaneClick={(e) => {
          if (tool === "label" && !readOnly && flow) {
            const text = window.prompt("Annotation text");
            if (text?.trim()) {
              const pt = flow.screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
              });
              edit(p.id, "Add annotation", (doc) =>
                doc.annotations.push({
                  id: uid(),
                  text: text.slice(0, 1000),
                  ...pt,
                }),
              );
            }
            setTool("select");
          }
        }}
        onPaneMouseMove={(e) => {
          if (onCursor && flow)
            onCursor(flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}
        nodesDraggable={!readOnly && tool !== "pan"}
        nodesConnectable={!readOnly}
        elementsSelectable={tool !== "pan"}
        panOnDrag={tool === "pan" ? true : [1, 2]}
        selectionOnDrag={tool === "select"}
        deleteKeyCode={null}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.1}
        maxZoom={3}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
      >
        <Background gap={20} size={1} color="#39453f" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor="#527263"
          pannable
          zoomable
          style={{ width: 125, height: 80 }}
        />
      </ReactFlow>
      <div className="canvas-label" style={{ left: 58 }}>
        LOGICAL SCHEMATIC · {d.components.length} COMPONENTS · {d.nets.length}{" "}
        NETS
      </div>
    </div>
  );
}
