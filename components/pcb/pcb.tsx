"use client";
import { useRef, useState, useEffect } from "react";
import {
  MousePointer2,
  Waypoints,
  CircleDot,
  Ruler,
  ZoomIn,
  ZoomOut,
  Focus,
  Trash2,
  Hand,
} from "lucide-react";
import type { Project, Component, DesignDocument } from "@/types/project";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { uid } from "@/lib/utils";
export function pads(d: DesignDocument, c: Component) {
  const part = d.parts.find((p) => p.id === c.partId);
  const large = c.partId === "esp32",
    w = large ? 12 : 4,
    h = large ? 14 : 4;
  return (part?.pins ?? []).map((p, i) => ({
    id: p.id,
    x: c.pcbX + (i % 2 === 0 ? -w / 2 : w / 2),
    y: c.pcbY - h / 2 + 1 + Math.floor(i / 2) * 2,
    net: d.nets.find((n) =>
      n.connections.some((x) => x.componentId === c.id && x.pinId === p.id),
    )?.id,
  }));
}
export function PCB({
  project: p,
  selected,
  onSelect,
}: {
  project: Project;
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const d = p.document,
    edit = useWorkspace((s) => s.edit),
    svg = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState("select"),
    [layer, setLayer] = useState(0),
    [width, setWidth] = useState(0.25),
    [net, setNet] = useState(d.nets[0]?.id ?? ""),
    [points, setPoints] = useState<{ x: number; y: number }[]>([]),
    [cursor, setCursor] = useState({ x: 0, y: 0 }),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
      null,
    ),
    [showRats, setShowRats] = useState(true),
    [showSilk, setShowSilk] = useState(true),
    [traceId, setTraceId] = useState(""),
    [measure, setMeasure] = useState<{ x: number; y: number }[]>([]);
  const readOnly = !["owner", "editor"].includes(p.role),
    viewWidth = (d.board.width + 35) / zoom,
    viewHeight = (d.board.height + 25) / zoom;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPoints([]);
        setTool("select");
      }
      if (e.key === "Enter") finish();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const position = (e: React.PointerEvent | React.MouseEvent) => {
    const s = svg.current;
    if (!s) return { x: 0, y: 0 };
    const pt = s.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const real = pt.matrixTransform(s.getScreenCTM()?.inverse());
    let pos = { x: Math.round(real.x * 4) / 4, y: Math.round(real.y * 4) / 4 };
    if (tool === "route") {
      const all = d.components.flatMap((c) => pads(d, c));
      const close = all.find((a) => Math.hypot(a.x - pos.x, a.y - pos.y) < 1);
      if (close) {
        pos = { x: close.x, y: close.y };
        if (points.length === 0 && close.net) setNet(close.net);
      }
    }
    return pos;
  };
  function finish() {
    if (points.length < 2 || !net || readOnly) return;
    edit(p.id, "Route copper trace", (doc) =>
      doc.traces.push({ id: uid(), netId: net, layer, width, points }),
    );
    setPoints([]);
  }
  const click = (e: React.MouseEvent) => {
    const pt = position(e);
    if (tool === "route" && !readOnly) {
      if (e.detail === 2) {
        finish();
        return;
      }
      setPoints((ps) => [...ps, pt]);
    }
    if (tool === "via" && !readOnly && net)
      edit(p.id, "Place via", (doc) =>
        doc.vias.push({
          id: uid(),
          ...pt,
          netId: net,
          diameter: doc.rules.viaDiameter,
          drill: doc.rules.viaDrill,
        }),
      );
    if (tool === "measure")
      setMeasure((m) => (m.length === 1 ? [m[0], pt] : [pt]));
  };
  return (
    <div className="canvas pcb-bg">
      <div className="canvas-toolbar">
        {[
          [MousePointer2, "select", "Select"],
          [Hand, "pan", "Pan"],
          [Waypoints, "route", "Route trace"],
          [CircleDot, "via", "Place via"],
          [Ruler, "measure", "Measure"],
        ].map(([Icon, name, label]) => {
          const I = Icon as typeof Hand;
          return (
            <Button
              key={String(name)}
              size="icon"
              variant="ghost"
              title={String(label)}
              aria-label={String(label)}
              className={tool === name ? "active" : ""}
              disabled={readOnly && ["route", "via"].includes(String(name))}
              onClick={() => {
                setTool(String(name));
                setPoints([]);
              }}
            >
              <I />
            </Button>
          );
        })}
        <span className="divider" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom in"
          onClick={() => setZoom((v) => Math.min(6, v * 1.2))}
        >
          <ZoomIn />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom out"
          onClick={() => setZoom((v) => Math.max(0.3, v / 1.2))}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fit board"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Focus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete selected trace"
          disabled={!traceId || readOnly}
          onClick={() => {
            edit(
              p.id,
              "Remove trace",
              (doc) =>
                (doc.traces = doc.traces.filter((t) => t.id !== traceId)),
            );
            setTraceId("");
          }}
        >
          <Trash2 />
        </Button>
      </div>
      {tool === "route" && (
        <div className="tool-instruction">
          Click route points. Enter or double-click finishes. Escape cancels.
          {points.length > 1 && (
            <Button size="sm" variant="ghost" onClick={finish}>
              Finish trace
            </Button>
          )}
        </div>
      )}
      {tool === "measure" && (
        <div className="tool-instruction">
          Click two points to measure.{" "}
          {measure.length === 2
            ? Math.hypot(
                measure[1].x - measure[0].x,
                measure[1].y - measure[0].y,
              ).toFixed(2) + " mm"
            : ""}
        </div>
      )}
      <div className="pcb-layer-controls">
        <div className="eyebrow">LAYER STACK</div>
        <label className="field">
          <span>Active copper</span>
          <select
            className="input"
            value={layer}
            onChange={(e) => setLayer(Number(e.target.value))}
          >
            {Array.from({ length: d.board.layers }, (_, i) => (
              <option key={i} value={i}>
                {i === 0
                  ? "Top copper"
                  : i === d.board.layers - 1
                    ? "Bottom copper"
                    : "Inner copper " + i}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Trace width (mm)</span>
          <input
            className="input"
            type="number"
            min="0.1"
            step="0.05"
            value={width}
            onChange={(e) => setWidth(Math.max(0.1, Number(e.target.value)))}
          />
        </label>
        <label className="field">
          <span>Net</span>
          <select
            className="input"
            value={net}
            onChange={(e) => setNet(e.target.value)}
          >
            <option value="">Choose net</option>
            {d.nets.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label className="layer">
          <input
            type="checkbox"
            checked={showRats}
            onChange={(e) => setShowRats(e.target.checked)}
          />
          Ratsnest
        </label>
        <label className="layer">
          <input
            type="checkbox"
            checked={showSilk}
            onChange={(e) => setShowSilk(e.target.checked)}
          />
          Top silkscreen
        </label>
        <p className="required-note" style={{ marginTop: 10, maxWidth: 145 }}>
          Generic pad geometry.
          <br />
          Footprints need verification.
        </p>
      </div>
      <svg
        ref={svg}
        className="pcb-svg"
        viewBox={`${(d.board.width - viewWidth) / 2 + pan.x} ${(d.board.height - viewHeight) / 2 + pan.y} ${viewWidth} ${viewHeight}`}
        onClick={click}
        onPointerMove={(e) => {
          const pt = position(e);
          setCursor(pt);
          if (drag) {
            if (drag.id === "pan") {
              setPan((v) => ({
                x: v.x - (pt.x - drag.x),
                y: v.y - (pt.y - drag.y),
              }));
            } else setDrag({ ...drag, x: pt.x, y: pt.y });
          }
        }}
        onPointerDown={(e) => {
          if (tool === "pan") {
            const pt = position(e);
            setDrag({ id: "pan", ...pt });
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerUp={() => {
          if (drag && drag.id !== "pan" && !readOnly)
            edit(p.id, "Move PCB component", (doc) => {
              const c = doc.components.find((c) => c.id === drag.id);
              if (c) {
                c.pcbX = drag.x;
                c.pcbY = drag.y;
              }
            });
          setDrag(null);
        }}
        onWheel={(e) =>
          setZoom((v) =>
            Math.max(0.3, Math.min(6, v * (e.deltaY < 0 ? 1.08 : 0.92))),
          )
        }
      >
        <rect
          x="0"
          y="0"
          width={d.board.width}
          height={d.board.height}
          rx="1.5"
          fill="#1e3d35"
          stroke="#9dba87"
          strokeWidth=".18"
        />
        <rect
          x={d.rules.edgeClearance}
          y={d.rules.edgeClearance}
          width={Math.max(0.1, d.board.width - d.rules.edgeClearance * 2)}
          height={Math.max(0.1, d.board.height - d.rules.edgeClearance * 2)}
          fill="none"
          stroke="#abc27433"
          strokeWidth=".15"
          strokeDasharray=".5 .5"
        />
        {showRats &&
          d.nets.flatMap((n) => {
            const ps = n.connections
              .map((x) => {
                const c = d.components.find((c) => c.id === x.componentId);
                return c ? pads(d, c).find((p) => p.id === x.pinId) : undefined;
              })
              .filter(Boolean);
            return ps
              .slice(1)
              .map((pt, i) => (
                <line
                  key={n.id + i}
                  x1={ps[0]!.x}
                  y1={ps[0]!.y}
                  x2={pt!.x}
                  y2={pt!.y}
                  stroke={net === n.id ? "#dbc69099" : "#c6be6a36"}
                  strokeWidth=".08"
                />
              ));
          })}
        {d.traces.map((t) => (
          <g
            key={t.id}
            onClick={(e) => {
              if (tool === "select") {
                e.stopPropagation();
                setTraceId(t.id);
              }
            }}
          >
            <polyline
              points={t.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={
                t.id === traceId
                  ? "#fff"
                  : t.layer === 0
                    ? "#d98277"
                    : "#6d9dda"
              }
              strokeWidth={t.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={t.layer === layer ? 1 : 0.4}
            />
            <polyline
              points={t.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(t.width, 1)}
            />
          </g>
        ))}
        {d.vias.map((v) => (
          <g key={v.id}>
            <circle cx={v.x} cy={v.y} r={v.diameter / 2} fill="#b6af6f" />
            <circle cx={v.x} cy={v.y} r={v.drill / 2} fill="#182421" />
          </g>
        ))}
        {d.components.map((original) => {
          const c =
            drag?.id === original.id
              ? { ...original, pcbX: drag.x, pcbY: drag.y }
              : original;
          const large = c.partId === "esp32",
            w = large ? 12 : 4,
            h = large ? 14 : 4;
          return (
            <g
              key={c.id}
              onPointerDown={(e) => {
                if (tool === "select") {
                  e.stopPropagation();
                  onSelect([c.id]);
                  if (!readOnly) {
                    setDrag({ id: c.id, x: c.pcbX, y: c.pcbY });
                    svg.current?.setPointerCapture(e.pointerId);
                  }
                }
              }}
            >
              <rect
                x={c.pcbX - w / 2}
                y={c.pcbY - h / 2}
                width={w}
                height={h}
                fill={large ? "#89968c" : "#28352e"}
                stroke={selected.includes(c.id) ? "#efba83" : "#b7c6a3"}
                strokeWidth={selected.includes(c.id) ? ".3" : ".12"}
              />
              {pads(d, c).map((pad) => (
                <rect
                  key={pad.id}
                  x={pad.x - 0.5}
                  y={pad.y - 0.32}
                  width="1"
                  height=".64"
                  fill={pad.net === net ? "#ffe19f" : "#b8ac70"}
                  stroke="#e0d292"
                  strokeWidth=".07"
                />
              ))}
              {showSilk && (
                <text
                  x={c.pcbX}
                  y={c.pcbY - h / 2 - 0.8}
                  fontSize="1"
                  fill="#d6dec6"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {c.reference}
                </text>
              )}
              {large && (
                <text
                  x={c.pcbX}
                  y={c.pcbY}
                  fontSize="1.2"
                  fill="#283b30"
                  textAnchor="middle"
                >
                  ESP32
                </text>
              )}
            </g>
          );
        })}
        {points.length > 0 && (
          <polyline
            points={[...points, cursor].map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#efc282"
            strokeWidth={width}
            strokeDasharray=".6 .3"
          />
        )}
        {measure.length === 2 && (
          <line
            x1={measure[0].x}
            y1={measure[0].y}
            x2={measure[1].x}
            y2={measure[1].y}
            stroke="#c8dcff"
            strokeWidth=".12"
            strokeDasharray=".6 .3"
          />
        )}
        <text
          x="2"
          y={d.board.height - 2}
          fontSize="1.2"
          fill="#b4c6a5"
          fontFamily="monospace"
        >
          NODEDISTRO LABS · PLACEMENT STUDY
        </text>
      </svg>
      <div className="canvas-label">
        {d.board.width} × {d.board.height} mm · {d.board.layers} LAYERS ·{" "}
        {d.traces.length} TRACES
      </div>
      <div className="canvas-corner">
        X {cursor.x.toFixed(2)} · Y {cursor.y.toFixed(2)} mm
      </div>
    </div>
  );
}
