"use client";
import { useState } from "react";
import { Download, Search, TriangleAlert, Package } from "lucide-react";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { bomRows, csv } from "@/lib/manufacturing/exports";
import { download, money } from "@/lib/utils";
export function BOM({
  project: p,
  onSelect,
}: {
  project: Project;
  onSelect: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState(""),
    [format, setFormat] = useState("CSV");
  const rows = bomRows(p.document),
    total = rows.reduce((sum, r) => sum + r["Extended Price"], 0),
    shown = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    );
  async function exportBOM() {
    if (format === "CSV") download("bom.csv", csv(rows), "text/csv");
    else if (format === "JSON")
      download("bom.json", JSON.stringify(rows, null, 2));
    else {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("BOM");
      ws.columns = Object.keys(rows[0] ?? { Reference: "" }).map((key) => ({
        header: key,
        key,
        width: 22,
      }));
      ws.addRows(rows);
      ws.getRow(1).font = { bold: true };
      const buffer = await wb.xlsx.writeBuffer();
      download(
        "bom.xlsx",
        new Blob([new Uint8Array(buffer as ArrayBuffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
    }
  }
  return (
    <section className="workspace-tab">
      <div className="page-title">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            COMPONENT INTELLIGENCE
          </div>
          <h1>Bill of materials</h1>
          <p>Every component, accounted for.</p>
        </div>
        <div className="row">
          <select
            className="input"
            aria-label="BOM export format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            {["CSV", "XLSX", "JSON"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <Button
            onClick={exportBOM}
            disabled={!rows.length}
            variant="secondary"
          >
            <Download /> Export BOM
          </Button>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <p>Components</p>
          <strong>{rows.length}</strong>
        </div>
        <div className="stat">
          <p>Estimated cost / board</p>
          <strong className="accent">{money(total)}</strong>
        </div>
        <div className="stat">
          <p>Missing MPN</p>
          <strong>{rows.filter((r) => !r.MPN).length}</strong>
        </div>
      </div>
      <div className="notice row">
        <TriangleAlert size={16} />
        <span>
          Catalog pricing is illustrative. Stock and lifecycle are unknown until
          an authorized supplier is connected. Tax and shipping are excluded.
        </span>
      </div>
      <div className="row" style={{ margin: "20px 0" }}>
        <Search size={16} className="muted" />
        <input
          className="input"
          style={{ maxWidth: 370 }}
          aria-label="Search BOM"
          placeholder="Filter by reference, MPN, or manufacturer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="spacer" />
        <span className="muted">{shown.length} items</span>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {Object.keys(rows[0]).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.Reference}
                  onClick={() => {
                    const c = p.document.components.find(
                      (c) => c.reference === r.Reference,
                    );
                    if (c) onSelect([c.id]);
                  }}
                >
                  {Object.entries(r).map(([k, v]) => (
                    <td
                      key={k}
                      style={{
                        color: k === "Reference" ? "var(--accent)" : undefined,
                      }}
                    >
                      {k.includes("Price")
                        ? money(Number(v))
                        : String(v) || <span className="red">Missing</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <Package />
          <h3>No components yet</h3>
          <p>Add components in the schematic to build the BOM.</p>
        </div>
      )}
      <p className="required-note" style={{ marginTop: 16 }}>
        The BOM is derived from schematic components. Change a selected
        component’s value or part in Properties.
      </p>
    </section>
  );
}
