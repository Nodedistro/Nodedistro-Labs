"use client";
import { useState, useEffect } from "react";
import { Cpu, Search, Plus, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { searchCatalog, catalog } from "@/lib/components/catalog";
import { money, uid } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { partSchema, type Project, type Part } from "@/types/project";
export function ComponentPicker({
  open,
  onOpenChange,
  project: p,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("All"),
    [detail, setDetail] = useState<Part | null>(null);
  const [custom,setCustom]=useState<Part[]>([]);
  useEffect(()=>{if(!open)return;try{const saved=JSON.parse(localStorage.getItem('nodecraft-library')??'[]');setCustom(partSchema.array().parse(saved));}catch{setCustom([]);}},[open]);
  const edit = useWorkspace((s) => s.edit);
  const all = Array.from(
    new Map([...catalog, ...custom, ...p.document.parts].map((p) => [p.id, p])).values(),
  );
  const found = searchCatalog(q, all).filter(
    (p) => category === "All" || p.category === category,
  );
  function add(part: Part) {
    edit(p.id, "Add " + part.name, (doc) => {
      if (!doc.parts.some((p) => p.id === part.id)) doc.parts.push(part);
      const prefix =
        part.category === "Resistors"
          ? "R"
          : part.category === "Capacitors"
            ? "C"
            : part.category === "Connectors"
              ? "J"
              : part.category === "Diodes"
                ? "D"
                : "U";
      let number = 1;
      while (doc.components.some((c) => c.reference === prefix + number))
        number++;
      doc.components.push({
        id: uid(),
        partId: part.id,
        reference: prefix + number,
        value: part.name,
        x: 250 + (doc.components.length % 4) * 250,
        y: 200 + Math.floor(doc.components.length / 4) * 240,
        pcbX: doc.board.width / 2,
        pcbY: doc.board.height / 2,
        rotation: 0,
        side: "top",
        block: "New components",
      });
    });
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-wide">
        <DialogTitle>Add a component</DialogTitle>
        <DialogDescription>
          Search the project catalog. All supplied symbols are simplified
          logical representations.
        </DialogDescription>
        <div className="row">
          <Search size={17} className="muted" />
          <input
            autoFocus
            className="input"
            placeholder="Search name, manufacturer, MPN, or specification…"
            aria-label="Search components"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 170 }}
            aria-label="Component category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["All", ...Array.from(new Set(all.map((p) => p.category)))].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </div>
        <div style={{ maxHeight: 380, overflow: "auto", marginTop: 14 }}>
          {found.map((part) => (
            <div className="library-result" key={part.id}>
              <span className="part-icon">
                <Cpu size={22} />
              </span>
              <button
                style={{
                  flex: 1,
                  textAlign: "left",
                  background: "none",
                  border: 0,
                }}
                onClick={() => setDetail(part)}
              >
                <h3>{part.name}</h3>
                <p>
                  {part.manufacturer} · {part.mpn || "MPN missing"}
                </p>
                <p>{part.description}</p>
              </button>
              <div style={{ textAlign: "right", fontSize: 12 }}>
                {money(part.price)}
                <p className="muted" style={{ fontSize: 10 }}>
                  Illustrative
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => add(part)}>
                <Plus /> Add
              </Button>
            </div>
          ))}
          {!found.length && (
            <div className="empty">
              <Search />
              <h3>No matching components</h3>
              <p>Try another name, category, or package.</p>
            </div>
          )}
        </div>
        {detail && (
          <div className="notice" style={{ marginTop: 15 }}>
            <strong>{detail.name}</strong>
            <p>
              Package: {detail.package} · Footprint: {detail.footprint}
            </p>
            <p>Inventory: unknown · Lifecycle: {detail.lifecycle}</p>
            {detail.datasheet && (
              <a
                className="subtle-link"
                href={detail.datasheet}
                target="_blank"
                rel="noreferrer"
              >
                Manufacturer documentation ↗
              </a>
            )}
          </div>
        )}
        <p className="required-note" style={{ marginTop: 15 }}>
          Verify pin numbering, footprints, electrical ratings, lifecycle, and
          availability against manufacturer data before fabrication.
        </p>
      </DialogContent>
    </Dialog>
  );
}
