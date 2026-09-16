"use client";
import { useState, useEffect } from "react";
import type { Project } from "@/types/project";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { ExternalLink, RotateCw, Trash2 } from "lucide-react";
export function Properties({
  project: p,
  selected,
}: {
  project: Project;
  selected: string[];
}) {
  const c = p.document.components.find((c) => c.id === selected[0]),
    part = p.document.parts.find((x) => x.id === c?.partId),
    edit = useWorkspace((s) => s.edit);
  const readOnly = !["owner", "editor"].includes(p.role);
  if (!c)
    return (
      <div className="properties">
        <div className="eyebrow">PROJECT PROPERTIES</div>
        <h3 style={{ margin: "16px 0" }}>{p.document.name}</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Select a component to inspect and edit its properties.
        </p>
        <hr />
        {[
          [
            "Board",
            `${p.document.board.width} × ${p.document.board.height} mm`,
          ],
          ["Layers", p.document.board.layers],
          ["Components", p.document.components.length],
          ["Nets", p.document.nets.length],
        ].map(([k, v]) => (
          <div className="readiness-row" key={k}>
            <span className="muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    );
  const update = (key: string, value: string | number) =>
    edit(p.id, "Update " + c.reference, (doc) => {
      const target = doc.components.find((x) => x.id === c.id);
      if (target) Object.assign(target, { [key]: value });
    });
  return (
    <div className="properties" key={c.id}>
      <div className="eyebrow">COMPONENT PROPERTIES</div>
      <h3 className="accent" style={{ margin: "14px 0" }}>
        {c.reference}
      </h3>
      {[
        ["Reference", c.reference, "reference"],
        ["Value", c.value, "value"],
        ["Functional block", c.block, "block"],
      ].map(([label, value, key]) => (
        <label className="field" key={key}>
          <span>{label}</span>
          <input
            className="input"
            defaultValue={value}
            key={value}
            disabled={readOnly}
            maxLength={key === "reference" ? 30 : 100}
            onBlur={(e) => {
              if (e.target.value.trim()) update(key, e.target.value);
            }}
          />
        </label>
      ))}
      <label className="field">
        <span>Part</span>
        <select
          className="input"
          value={c.partId}
          disabled={readOnly}
          onChange={(e) => {
            const id = e.target.value;
            edit(p.id, "Replace component " + c.reference, (doc) => {
              const target = doc.components.find((x) => x.id === c.id)!;
              target.partId = id;
              target.value = doc.parts.find((x) => x.id === id)!.name;
              doc.nets.forEach(
                (n) =>
                  (n.connections = n.connections.filter(
                    (x) => x.componentId !== c.id,
                  )),
              );
            });
          }}
        >
          {p.document.parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p className="required-note">
        Replacing a part disconnects its old pins. Reconnect and review the new
        pinout.
      </p>
      <hr />
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        BOARD PLACEMENT
      </div>
      <div className="grid-2">
        {[
          ["X (mm)", "pcbX", c.pcbX],
          ["Y (mm)", "pcbY", c.pcbY],
          ["Rotation", "rotation", c.rotation],
        ].map(([label, key, value]) => (
          <label className="field" key={String(key)}>
            <span>{label}</span>
            <input
              className="input"
              type="number"
              defaultValue={value}
              key={String(value)}
              disabled={readOnly}
              onBlur={(e) => {
                if (Number.isFinite(e.target.valueAsNumber))
                  update(String(key), e.target.valueAsNumber);
              }}
            />
          </label>
        ))}
      </div>
      <label className="field">
        <span>Assembly side</span>
        <select
          className="input"
          value={c.side}
          disabled={readOnly}
          onChange={(e) => update("side", e.target.value)}
        >
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </label>
      <hr />
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        PART INFORMATION
      </div>
      <p className="muted" style={{ fontSize: 11, lineHeight: 2 }}>
        {part?.manufacturer}
        <br />
        {part?.mpn || "MPN missing"}
        <br />
        {part?.package}
      </p>
      <p
        className="mono"
        style={{ fontSize: 10, overflowWrap: "anywhere", marginTop: 10 }}
      >
        {part?.footprint || "Footprint missing"}
      </p>
      {part?.datasheet && (
        <a
          href={part.datasheet}
          target="_blank"
          rel="noreferrer"
          className="row accent"
          style={{ fontSize: 11, marginTop: 14 }}
        >
          Manufacturer documentation <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}
