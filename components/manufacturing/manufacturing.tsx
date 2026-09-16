"use client";
import { useState, useEffect } from "react";
import {
  Download,
  FileArchive,
  ShieldCheck,
  TriangleAlert,
  Factory,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { runChecks } from "@/lib/editor/checks";
import { autoFixSafeConnectivity } from "@/lib/editor/auto-fix";
import { useWorkspace } from "@/hooks/use-workspace";
import { bomRows, csv, placementRows } from "@/lib/manufacturing/exports";
import { download } from "@/lib/utils";
import type { Project, CheckReport } from "@/types/project";
export function Manufacturing({ project: p }: { project: Project }) {
  const edit = useWorkspace((s) => s.edit);
  const [report, setReport] = useState<CheckReport | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const d = p.document;
  useEffect(() => {
    setReport(null);
  }, [d]);
  async function gerber() {
    setBusy(true);
    setMessage("");
    try {
      if (p.demo)
        throw Error(
          "Fabrication exporter not configured. Demo geometry is not fabrication-ready.",
        );
      const r = await fetch(`/api/projects/${p.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "gerber", revision: p.revision }),
      });
      if (!r.ok) {
        const data = await r.json();
        throw Error(data.error);
      }
      download("fabrication.zip", await r.blob());
      setMessage(
        "Provider fabrication archive received. Manufacturer review is still required.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  function autoFix() {
    if (p.demo || !["owner", "editor"].includes(p.role)) {
      setMessage("Auto-fix requires an editable cloud project.");
      return;
    }
    const result = autoFixSafeConnectivity(d);
    if (result.changes.length) {
      edit(p.id, "Auto-fix safe connectivity", (doc) =>
        Object.assign(doc, result.document),
      );
      setReport(runChecks(result.document));
    } else setReport(runChecks(d));
    setMessage(
      `${result.changes.length} safe connection${result.changes.length === 1 ? "" : "s"} applied. ${result.skipped.length} item${result.skipped.length === 1 ? "" : "s"} require an engineering decision.`,
    );
  }
  return (
    <section className="workspace-tab">
      <div className="page-title">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            FROM DESIGN TO DESK
          </div>
          <h1>Manufacturing review</h1>
          <p>A clear picture before you commit to copper.</p>
        </div>
        <div className="row">
          <Button
            variant="outline"
            onClick={autoFix}
            disabled={p.demo || !["owner", "editor"].includes(p.role)}
          >
            Auto-fix safe connections
          </Button>
          <Button variant="secondary" onClick={() => setReport(runChecks(d))}>
            <ShieldCheck /> Run final checks
          </Button>
        </div>
      </div>
      <div className="notice row">
        <TriangleAlert size={17} />
        <span>
          Fabrication readiness is not verified. Generic pad geometry and
          incomplete checks require qualified engineering review and a real
          exporter.
        </span>
      </div>
      <div className="manufacturing-grid" style={{ marginTop: 22 }}>
        <div className="panel panel-pad">
          <div className="row">
            <Factory size={16} className="accent" />
            <h3>Fabrication specification</h3>
          </div>
          {[
            ["Board dimensions", `${d.board.width} × ${d.board.height} mm`],
            ["Layers", d.board.layers],
            ["Thickness", `${d.board.thickness} mm`],
            ["Copper weight", `${d.board.copperWeight} oz`],
            ["Surface finish", d.board.finish],
            ["Solder mask", d.board.mask],
            ["Silkscreen", "White"],
          ].map(([k, v]) => (
            <div className="readiness-row" key={String(k)}>
              <span className="muted">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
        <div className="panel panel-pad">
          <div className="row">
            <ShieldCheck size={16} className="accent" />
            <h3>Validation & assembly</h3>
          </div>
          {[
            [
              "Electrical / PCB checks",
              report
                ? `${report.results.filter((r) => r.severity === "error").length} errors, ${report.results.filter((r) => r.severity === "warning").length} warnings`
                : "Not run",
            ],
            [
              "Missing footprint definitions",
              d.components.filter(
                (c) => !d.parts.find((p) => p.id === c.partId)?.footprint,
              ).length,
            ],
            ["Physical footprint validation", "Not performed"],
            [
              "Assembly side",
              Array.from(new Set(d.components.map((c) => c.side))).join(", ") ||
                "No components",
            ],
            ["BOM availability", "Supplier not connected"],
            ["Simulation", "Not verified"],
            ["Manufacturer verification", "Not performed"],
          ].map(([k, v]) => (
            <div className="readiness-row" key={String(k)}>
              <span className="muted">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {report && (
        <section
          className="panel panel-pad"
          style={{ marginTop: 22 }}
          aria-label="Detailed electrical and PCB check results"
        >
          <h3>Check details</h3>
          <p className="muted">
            Resolve these findings in the schematic or PCB editor, then run
            checks again. These checks do not establish fabrication readiness.
          </p>
          {report.results.length === 0 ? (
            <p>No findings from the implemented checks.</p>
          ) : (
            <ul style={{ paddingLeft: 20 }}>
              {report.results.map((result, index) => (
                <li key={result.id + ":" + index} style={{ marginTop: 12 }}>
                  <strong>
                    {result.severity.toUpperCase()} · {result.category}
                  </strong>
                  <br />
                  {result.message}
                  {result.suppressed && (
                    <p className="muted">
                      Suppression note: {result.suppressed}. This finding is
                      still included in the review count.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="section-head">
        <h2>Design outputs</h2>
        <span className="muted">Review every export before use</span>
      </div>
      <div className="grid-2">
        {[
          [
            "BOM CSV",
            "Component list and illustrative costs",
            () => download("bom.csv", csv(bomRows(d)), "text/csv"),
          ],
          [
            "Placement CSV",
            "Component origins in millimeters · unverified",
            () =>
              download(
                "placement-unverified.csv",
                csv(placementRows(d)),
                "text/csv",
              ),
          ],
          [
            "Design archive",
            "Portable JSON · schematic, board, and rules",
            () =>
              download(
                "nodedistro-labs-design.json",
                JSON.stringify(
                  { format: "nodedistro-labs", version: 1, document: d },
                  null,
                  2,
                ),
              ),
          ],
          [
            "Gerber & drill files",
            "Requires a verified fabrication exporter",
            gerber,
          ],
        ].map(([title, copy, action]) => (
          <div className="panel panel-pad between" key={String(title)}>
            <div>
              <h3>{String(title)}</h3>
              <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                {String(copy)}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={"Export " + title}
              disabled={busy}
              onClick={action as () => void}
            >
              <Download />
            </Button>
          </div>
        ))}
      </div>
      {message && (
        <div className="notice" style={{ marginTop: 20 }} role="status">
          {message}
        </div>
      )}
      <p className="required-note" style={{ marginTop: 20 }}>
        Gerber files are never synthesized from the visual preview. The
        configured provider must validate the board format and generate actual
        fabrication data.
      </p>
    </section>
  );
}
