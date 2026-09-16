"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Cpu,
  Box,
  Activity,
  List,
  Factory,
  Undo2,
  Redo2,
  Search,
  Sparkles,
  Share2,
  ShieldCheck,
  Settings,
  Plus,
  GitBranch,
  PanelLeftClose,
  PanelRightClose,
  TriangleAlert,
  X,
  CircleAlert,
  Check,
  MessageSquare,
  Download,
  Upload,
  Copy,
  Save,
  Folder,
  Waypoints,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Schematic } from "@/components/schematic/schematic";
import { PCB } from "@/components/pcb/pcb";
import { BOM } from "@/components/bom/bom";
import { Simulation } from "@/components/simulation/simulation";
import { Manufacturing } from "@/components/manufacturing/manufacturing";
import { Assistant } from "@/components/ai/assistant";
import { ReviewDialog } from "@/components/ai/review";
import { NetDialog } from "./nets";
import { Properties } from "./properties";
import { Comments } from "./comments";
import { ComponentPicker } from "./component-picker";
import { SettingsDialog, HistoryDialog, ShareDialog } from "./dialogs";
import { useWorkspace } from "@/hooks/use-workspace";
import { useProjectSync } from "@/hooks/use-project-sync";
import { runChecks } from "@/lib/editor/checks";
import { download, uid } from "@/lib/utils";
import {
  documentSchema,
  type CheckReport,
  type Component,
} from "@/types/project";
import { validateTopology } from "@/lib/editor/actions";
import { toast } from "sonner";
const Board3D = dynamic(() => import("@/components/pcb/board-3d"), {
  ssr: false,
  loading: () => <div className="empty">Loading 3D workspace…</div>,
});
const tabs = [
  ["Schematic", FileText],
  ["PCB", Layers],
  ["3D", Box],
  ["Simulation", Activity],
  ["BOM", List],
  ["Manufacturing", Factory],
] as const;
export function Editor({ projectId }: { projectId: string }) {
  const {
    project: p,
    loaded,
    status,
    error,
    members,
    save,
    broadcastCursor,
  } = useProjectSync(projectId);
  const [tab, setTab] = useState("Schematic"),
    [right, setRight] = useState("AI"),
    [left, setLeft] = useState(true),
    [selected, setSelected] = useState<string[]>([]),
    [picker, setPicker] = useState(false),
    [settings, setSettings] = useState(false),
    [history, setHistory] = useState(false),
    [share, setShare] = useState(false),
    [commands, setCommands] = useState(false),
    [query, setQuery] = useState(""),
    [report, setReport] = useState<CheckReport | null>(null),
    [checkedDocument, setCheckedDocument] = useState(""),
    [checksOpen, setChecksOpen] = useState(false),
    [focusId, setFocusId] = useState<string>(),
    [focusNonce, setFocusNonce] = useState(0),
    [rightWidth, setRightWidth] = useState(306),
    [savingCloud, setSavingCloud] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false),
    [netsOpen, setNetsOpen] = useState(false);
  const clipboard = useRef<Component[]>([]),
    fileInput = useRef<HTMLInputElement>(null);
  const edit = useWorkspace((s) => s.edit),
    undo = useWorkspace((s) => s.undo),
    redo = useWorkspace((s) => s.redo),
    past = useWorkspace((s) => s.history[projectId]),
    future = useWorkspace((s) => s.future[projectId]);
  const canEdit = p && ["owner", "editor"].includes(p.role);
  const checks = useCallback(() => {
    if (!p) return;
    setReport(runChecks(p.document));
    setCheckedDocument(JSON.stringify(p.document));
    setChecksOpen(true);
  }, [p]);
  const focus = (id?: string) => {
    if (!id) return;
    setSelected([id]);
    setFocusId(id);
    setFocusNonce((n) => n + 1);
    setTab("Schematic");
  };
  useEffect(() => {
    if (window.innerWidth < 680) setRight("");
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key === "k") {
        e.preventDefault();
        setCommands((v) => !v);
        return;
      }
      if (cmd && e.key === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (
        (e.target as HTMLElement).matches(
          "input,textarea,select,[contenteditable=true]",
        ) ||
        document.querySelector("[role=dialog]")
      )
        return;
      if (cmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canEdit) (e.shiftKey ? redo : undo)(projectId);
      }
      if (cmd && e.key === "c" && p) {
        clipboard.current = p.document.components
          .filter((c) => selected.includes(c.id))
          .map((c) => ({ ...c }));
      }
      if (cmd && e.key === "v" && canEdit && clipboard.current.length) {
        e.preventDefault();
        edit(projectId, "Paste components", (d) => {
          clipboard.current.forEach((c) => {
            const prefix = c.reference.replace(/\d+$/, "");
            let n = 1;
            while (d.components.some((c) => c.reference === prefix + n)) n++;
            d.components.push({
              ...c,
              id: uid(),
              reference: prefix + n,
              x: c.x + 40,
              y: c.y + 40,
              pcbX: c.pcbX + 2,
              pcbY: c.pcbY + 2,
            });
          });
        });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [p, selected, projectId, canEdit, edit, undo, redo, save]);
  async function cloudCopy() {
    if (!p) return;
    setSavingCloud(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: p.document }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      useWorkspace.getState().upsert(d.project);
      window.location.href = "/project/" + d.project.id;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save cloud copy.",
      );
    } finally {
      setSavingCloud(false);
    }
  }
  const commandItems = [
    { name: "Review design with AI", action: () => setReviewOpen(true) },
    { name: "Manage net connections", action: () => setNetsOpen(true) },
    {
      name: "New project",
      action: () => window.location.assign("/projects/new"),
    },
    { name: "Add component", action: () => setPicker(true) },
    { name: "Run DRC / ERC", action: checks },
    { name: "Run simulation", action: () => setTab("Simulation") },
    { name: "Project settings", action: () => setSettings(true) },
    { name: "Share project", action: () => setShare(true) },
    { name: "Version history", action: () => setHistory(true) },
    ...tabs.map(([name]) => ({
      name: "Open " + name,
      action: () => setTab(name),
    })),
    ...(p?.document.components ?? []).map((c) => ({
      name: c.reference + " · " + c.value,
      action: () => focus(c.id),
    })),
  ];
  if (error)
    return (
      <div className="empty" style={{ height: "100vh" }}>
        <CircleAlert />
        <h3>Could not open this project</h3>
        <p>{error}</p>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  if (!loaded || !p)
    return (
      <div className="empty" style={{ height: "100vh" }}>
        <Layers />
        <h3>{loaded ? "Project not found" : "Opening workspace…"}</h3>
        {loaded && (
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        )}
      </div>
    );
  const stale = !!report && checkedDocument !== JSON.stringify(p.document),
    errors =
      report?.results.filter((r) => r.severity === "error" && !r.suppressed) ??
      [],
    warnings =
      report?.results.filter(
        (r) => r.severity === "warning" && !r.suppressed,
      ) ?? [];
  return (
    <div className="editor">
      <header className="editor-top">
        <Logo compact />
        <Link href="/dashboard" title="Back to dashboard">
          <ArrowLeft size={15} className="muted" />
        </Link>
        <button
          className="editor-title"
          style={{ background: "none", border: 0, textAlign: "left" }}
          onClick={() => setSettings(true)}
        >
          {p.document.name}
          <small>
            {p.demo ? "Local demo project" : "Private workspace"} · revision{" "}
            {p.revision}
          </small>
        </button>
        <span className="save-status">{status}</span>
        <span className="spacer" />
        <div className="row history-buttons">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            title="Undo (Ctrl Z)"
            disabled={!canEdit || !past?.length}
            onClick={() => undo(projectId)}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            title="Redo (Ctrl Shift Z)"
            disabled={!canEdit || !future?.length}
            onClick={() => redo(projectId)}
          >
            <Redo2 />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search commands"
          onClick={() => setCommands(true)}
        >
          <Search />
        </Button>
        <div className="row collaborator-avatars">
          {members.length ? (
            members.slice(0, 3).map((m, i) => (
              <span className="avatar" key={m} title="Active collaborator">
                {i + 1}
              </span>
            ))
          ) : (
            <span className="avatar" title="Local designer">
              N
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShare(true)}>
          <Share2 />
          <span className="top-action-label">Share</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={checks}>
          <ShieldCheck />
          <span className="top-action-label">Run checks</span>
        </Button>
        <Button size="sm" onClick={() => setTab("Manufacturing")}>
          <Factory />
          <span className="top-action-label">Manufacture</span>
        </Button>
      </header>
      <nav className="editor-tabs" aria-label="Editor workspaces">
        {tabs.map(([name, Icon]) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={tab === name ? "active" : ""}
            aria-current={tab === name ? "page" : undefined}
          >
            <Icon size={13} />
            {name}
          </button>
        ))}
        <span className="spacer" />
        <button
          aria-label="Toggle assistant"
          onClick={() => setRight((r) => (r ? "" : "AI"))}
        >
          <Sparkles size={14} />
        </button>
      </nav>
      <div className="mobile-editor-notice">
        Compact viewer · use a larger screen for precise editing.
      </div>
      <div className="editor-body">
        {left && (
          <aside className="editor-left">
            <div className="panel-heading">
              <span>Project explorer</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Collapse explorer"
                onClick={() => setLeft(false)}
              >
                <PanelLeftClose />
              </Button>
            </div>
            <div className="tree-section">
              <div className="eyebrow">PROJECT</div>
              <button className="tree-item" onClick={() => setTab("Schematic")}>
                <ChevronDown />
                Design files
              </button>
              <button
                className={
                  "tree-item tree-indent " +
                  (tab === "Schematic" ? "active" : "")
                }
                onClick={() => setTab("Schematic")}
              >
                <FileText />
                Main schematic<span className="component-count">1</span>
              </button>
              <button
                className={
                  "tree-item tree-indent " + (tab === "PCB" ? "active" : "")
                }
                onClick={() => setTab("PCB")}
              >
                <Layers />
                Board layout
              </button>
              <button
                className="tree-item tree-indent"
                onClick={() => setTab("BOM")}
              >
                <List />
                Bill of materials
              </button>
            </div>
            <div className="tree-section">
              <div className="between">
                <div className="eyebrow">COMPONENTS</div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPicker(true)}
                  aria-label="Add component from explorer"
                  disabled={!canEdit}
                >
                  <Plus />
                </Button>
              </div>
              {p.document.components.map((c) => (
                <button
                  key={c.id}
                  className={
                    "tree-item " + (selected.includes(c.id) ? "active" : "")
                  }
                  onClick={() => {
                    focus(c.id);
                    setRight("Properties");
                  }}
                >
                  <Cpu />
                  <span style={{ minWidth: 20, color: "#c6b89e" }}>
                    {c.reference}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.document.parts.find((p) => p.id === c.partId)?.name ??
                      c.value}
                  </span>
                </button>
              ))}
            </div>
            <div className="tree-section">
              <div className="between">
                <div className="eyebrow">NETS</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNetsOpen(true)}
                >
                  Edit
                </Button>
              </div>
              {p.document.nets.map((n) => (
                <button
                  key={n.id}
                  className="tree-item"
                  onClick={() => {
                    setSelected(n.connections.map((c) => c.componentId));
                    setTab("Schematic");
                  }}
                >
                  <Waypoints />
                  {n.name}
                  <span className="component-count">
                    {n.connections.length}
                  </span>
                </button>
              ))}
            </div>
            <div className="tree-section">
              <div className="eyebrow">LIBRARY</div>
              <button className="tree-item" onClick={() => setPicker(true)}>
                <Cpu />
                Components & symbols
              </button>
              <Link href="/libraries" className="tree-item">
                <Folder />
                Custom libraries
              </Link>
              <Link href="/templates" className="tree-item">
                <Box />
                Reusable blocks
              </Link>
            </div>
            <div className="tree-bottom">
              <button className="tree-item" onClick={() => setSettings(true)}>
                <Settings />
                Design rules
              </button>
              <button className="tree-item" onClick={() => setHistory(true)}>
                <GitBranch />
                Version history
              </button>
              <button
                className="tree-item"
                onClick={() => setRight("Comments")}
              >
                <MessageSquare />
                Comments
              </button>
              <button
                className="tree-item"
                onClick={() =>
                  download(
                    "nodedistro-labs-design.json",
                    JSON.stringify(
                      {
                        format: "nodedistro-labs",
                        version: 1,
                        document: p.document,
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                <Download />
                Export design archive
              </button>
              <button
                className="tree-item"
                disabled={!canEdit}
                onClick={() => fileInput.current?.click()}
              >
                <Upload />
                Import design archive
              </button>
              {p.demo && (
                <button
                  className="tree-item accent"
                  disabled={savingCloud}
                  onClick={cloudCopy}
                >
                  <Save />
                  {savingCloud ? "Saving…" : "Save a cloud copy"}
                </button>
              )}
            </div>
          </aside>
        )}
        <section className="editor-center">
          {!left && (
            <Button
              className="explorer-reopen"
              style={{ position: "absolute", left: 0, top: 65, zIndex: 8 }}
              size="icon"
              variant="secondary"
              aria-label="Open project explorer"
              onClick={() => setLeft(true)}
            >
              <ChevronRight />
            </Button>
          )}
          {tab === "Schematic" && (
            <Schematic
              project={p}
              selected={selected}
              onSelect={setSelected}
              onAdd={() => setPicker(true)}
              focusId={focusId}
              focusNonce={focusNonce}
              onCursor={broadcastCursor}
            />
          )}{" "}
          {tab === "PCB" && (
            <PCB project={p} selected={selected} onSelect={setSelected} />
          )}{" "}
          {tab === "3D" && <Board3D document={p.document} />}{" "}
          {tab === "BOM" && (
            <BOM
              project={p}
              onSelect={(ids) => {
                setSelected(ids);
                setRight("Properties");
              }}
            />
          )}{" "}
          {tab === "Simulation" && <Simulation project={p} />}{" "}
          {tab === "Manufacturing" && <Manufacturing project={p} />}{" "}
          {checksOpen && report && (
            <div className="check-panel">
              <div className="panel-heading">
                <div className="row">
                  <ShieldCheck size={14} />
                  <strong>Design checks</strong>
                  <span className="red">{errors.length} errors</span>
                  <span className="accent">{warnings.length} warnings</span>
                  <span className="muted">{report.passed} passed</span>
                  {stale && <span className="badge amber">OUT OF DATE</span>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChecksOpen(false)}
                  aria-label="Close checks"
                >
                  <X />
                </Button>
              </div>
              {report.results.map((r, index) => (
                <div
                  className="check-row"
                  key={`${r.id}:${index}`}
                  style={{ opacity: r.suppressed ? 0.5 : 1 }}
                >
                  <button
                    className="row"
                    style={{
                      flex: 1,
                      border: 0,
                      background: "none",
                      textAlign: "left",
                    }}
                    onClick={() => focus(r.objectId)}
                  >
                    {r.severity === "error" ? (
                      <CircleAlert size={12} className="red" />
                    ) : (
                      <TriangleAlert size={12} className="accent" />
                    )}
                    {r.message}
                    {r.suppressed && " · Suppressed: " + r.suppressed}
                  </button>
                  {!r.suppressed && canEdit && (
                    <button
                      className="muted"
                      style={{ background: "none", border: 0, fontSize: 10 }}
                      onClick={() => {
                        const reason = window.prompt(
                          "Explain why this rule is being suppressed (at least 5 characters).",
                        );
                        if (reason && reason.trim().length >= 5) {
                          edit(p.id, "Suppress rule with explanation", (doc) =>
                            doc.suppressions.push({
                              ruleId: r.id,
                              reason: reason.trim(),
                            }),
                          );
                          setReport({
                            ...report,
                            results: report.results.map((x) =>
                              x.id === r.id ? { ...x, suppressed: reason } : x,
                            ),
                          });
                        }
                      }}
                    >
                      Suppress
                    </button>
                  )}
                </div>
              ))}
              {report.results.length === 0 && (
                <div className="check-row green">
                  <Check size={13} />
                  No issues found in the implemented checks.
                </div>
              )}
              <div className="check-scope">
                Limited deterministic coverage. Not checked: physical pad
                clearance, complete routing connectivity, signal integrity,
                thermal behavior, or manufacturer capabilities. Suppression does
                not verify a design.
              </div>
            </div>
          )}
        </section>
        {right && (
          <>
            <div
              className="resize-handle"
              role="separator"
              aria-label="Resize inspector"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1)
                  setRightWidth(
                    Math.max(240, Math.min(480, window.innerWidth - e.clientX)),
                  );
              }}
            />
            <aside className="editor-right" style={{ width: rightWidth }}>
              <div className="panel-heading" style={{ padding: "0 7px" }}>
                {["Properties", "AI", "Comments"].map((r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    key={r}
                    className={right === r ? "accent" : ""}
                    onClick={() => setRight(r)}
                  >
                    {r === "AI" ? "AI assistant" : r}
                  </Button>
                ))}
              </div>
              {right === "AI" ? (
                <Assistant
                  project={p}
                  onClose={() => setRight("")}
                  onChecks={checks}
                />
              ) : right === "Properties" ? (
                <Properties project={p} selected={selected} />
              ) : (
                <Comments project={p} objectId={selected[0]} />
              )}
            </aside>
          </>
        )}
      </div>
      <footer className="editor-status">
        <span className="row">
          <span className="dot" />
          {p.demo ? "LOCAL DEMO" : "CLOUD PROJECT"}
        </span>
        <span>{status}</span>
        <span className="hide-small">
          {p.document.components.length} components · {p.document.nets.length}{" "}
          nets
        </span>
        <span className="spacer" />
        <span className="status-message">
          {report
            ? `${errors.length} errors · ${warnings.length} warnings${stale ? " · stale results" : ""}`
            : "Checks not run"}
        </span>
        <span className="hide-small">Grid 10 · mm</span>
        <span>Nodedistro Labs</span>
      </footer>
      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        project={p}
      />
      <NetDialog open={netsOpen} onOpenChange={setNetsOpen} project={p} />
      <ComponentPicker open={picker} onOpenChange={setPicker} project={p} />
      <SettingsDialog open={settings} onOpenChange={setSettings} project={p} />
      <HistoryDialog open={history} onOpenChange={setHistory} project={p} />
      <ShareDialog open={share} onOpenChange={setShare} project={p} />
      <Dialog open={commands} onOpenChange={setCommands}>
        <DialogContent>
          <DialogTitle>Command center</DialogTitle>
          <DialogDescription>
            Find components or jump to an action.
          </DialogDescription>
          <input
            className="input"
            autoFocus
            aria-label="Search commands"
            placeholder="Search commands or components…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="command-list">
            {commandItems
              .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
              .map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setCommands(false);
                    c.action();
                  }}
                >
                  <Search size={14} />
                  {c.name}
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 2_000_000) throw Error("Archive exceeds 2 MB.");
            if (f.type && f.type !== "application/json")
              throw Error("Choose a JSON design archive.");
            const data = JSON.parse(await f.text());
            const doc = documentSchema.parse(data.document);
            validateTopology(doc);
            edit(p.id, "Import design archive", (d) => Object.assign(d, doc));
            toast.success("Design imported. Undo is available.");
          } catch {
            toast.error(
              "Invalid design archive. Expected Nodedistro Labs JSON under 2 MB.",
            );
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
