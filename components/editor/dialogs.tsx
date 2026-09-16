"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { download } from "@/lib/utils";
import type { Project, DesignDocument } from "@/types/project";
import { documentSchema } from "@/types/project";
import { toast } from "sonner";
export function SettingsDialog({
  open,
  onOpenChange,
  project: p,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  project: Project;
}) {
  const [doc, setDoc] = useState(p.document);
  useEffect(() => {
    if (open) setDoc(structuredClone(p.document));
  }, [open, p.document]);
  const edit = useWorkspace((s) => s.edit);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Project settings</DialogTitle>
        <DialogDescription>
          Board specifications and deterministic design rules. Dimensions are in
          millimeters.
        </DialogDescription>
        <label className="field">
          <span>Project name</span>
          <input
            className="input"
            value={doc.name}
            maxLength={120}
            onChange={(e) => setDoc({ ...doc, name: e.target.value })}
          />
        </label>
        <div className="form-grid" style={{ marginTop: 20 }}>
          {[
            ["Width", "width"],
            ["Height", "height"],
            ["Thickness", "thickness"],
            ["Copper weight (oz)", "copperWeight"],
          ].map(([label, key]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                className="input"
                type="number"
                step="any"
                min="0.1"
                value={doc.board[key as keyof typeof doc.board]}
                onChange={(e) =>
                  setDoc({
                    ...doc,
                    board: { ...doc.board, [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          <label className="field">
            <span>Layers</span>
            <select
              className="input"
              value={doc.board.layers}
              onChange={(e) =>
                setDoc({
                  ...doc,
                  board: {
                    ...doc.board,
                    layers: Number(e.target.value) as 2 | 4 | 6,
                  },
                })
              }
            >
              {[2, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n} layers
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Finish</span>
            <select
              className="input"
              value={doc.board.finish}
              onChange={(e) =>
                setDoc({
                  ...doc,
                  board: { ...doc.board, finish: e.target.value },
                })
              }
            >
              <option>ENIG</option>
              <option>Lead-free HASL</option>
              <option>OSP</option>
            </select>
          </label>
        </div>
        <hr />
        <h3 style={{ marginBottom: 15 }}>Design rules</h3>
        <div className="form-grid">
          {Object.entries(doc.rules).map(([key, value]) => (
            <label className="field" key={key}>
              <span>{key.replace(/([A-Z])/g, " $1")}</span>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.05"
                value={value}
                onChange={(e) =>
                  setDoc({
                    ...doc,
                    rules: { ...doc.rules, [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <p className="required-note" style={{ marginTop: 18 }}>
          These defaults are editable design assumptions, not a manufacturer
          guarantee. Copper-to-pad and full footprint clearance checks are not
          implemented.
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!["owner", "editor"].includes(p.role)}
            onClick={() => {
              const result = documentSchema.safeParse(doc);
              if (!result.success) {
                toast.error("Enter valid dimensions and rules.");
                return;
              }
              edit(p.id, "Update project settings", (d) =>
                Object.assign(d, doc),
              );
              onOpenChange(false);
            }}
          >
            Save settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function HistoryDialog({
  open,
  onOpenChange,
  project: p,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  project: Project;
}) {
  const local = useWorkspace((s) => s.checkpoints),
    checkpoint = useWorkspace((s) => s.checkpoint),
    edit = useWorkspace((s) => s.edit);
  const [name, setName] = useState(""),
    [versions, setVersions] = useState<
      {
        id: string;
        name: string;
        document: DesignDocument;
        createdAt: string;
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (open && !p.demo)
      fetch(`/api/projects/${p.id}/versions`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) setError(d.error);
          else setVersions(d.versions);
        });
  }, [open, p.id, p.demo]);
  const all = p.demo ? local.filter((v) => v.projectId === p.id) : versions;
  async function create() {
    if (!name.trim()) return;
    if (p.demo) checkpoint(p.id, name);
    else {
      const r = await fetch(`/api/projects/${p.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, revision: p.revision }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error);
        return;
      }
      setVersions((v) => [d.version, ...v]);
    }
    setName("");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Version history</DialogTitle>
        <DialogDescription>
          Named checkpoints preserve the complete design. Restoring creates a
          new edit.
        </DialogDescription>
        <div className="row">
          <input
            className="input"
            aria-label="Checkpoint name"
            placeholder="Name this checkpoint…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            disabled={!name.trim() || !["owner", "editor"].includes(p.role)}
            onClick={create}
          >
            Create checkpoint
          </Button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {!all.length && (
          <div className="empty">
            <h3>No checkpoints yet</h3>
            <p>Save a milestone before your next change.</p>
          </div>
        )}
        {all.map((v) => (
          <div className="library-result" key={v.id}>
            <div style={{ flex: 1 }}>
              <h3>{v.name}</h3>
              <p>{new Date(v.createdAt).toLocaleString()}</p>
              <p>
                {v.document.components.length} components ·{" "}
                {v.document.nets.length} nets
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                download("checkpoint.json", JSON.stringify(v, null, 2))
              }
            >
              Inspect
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!["owner", "editor"].includes(p.role)}
              onClick={() => {
                edit(p.id, "Restore checkpoint: " + v.name, (d) =>
                  Object.assign(d, structuredClone(v.document)),
                );
                onOpenChange(false);
              }}
            >
              Restore
            </Button>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
export function ShareDialog({
  open,
  onOpenChange,
  project: p,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  project: Project;
}) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("viewer"),
    [message, setMessage] = useState("");
  async function invite() {
    setMessage("");
    try {
      const r = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: p.id, email, role }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(
        "Invitation created. Share the acceptance link with your collaborator: " +
          d.url,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invitation failed.");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Share this project</DialogTitle>
        <DialogDescription>
          Private by default. Give collaborators only the access they need.
        </DialogDescription>
        {p.demo ? (
          <div className="notice">
            This is a local demo project. Save a cloud copy to share it with
            authenticated collaborators.
          </div>
        ) : (
          <>
            <label className="field">
              <span>Collaborator email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field" style={{ marginTop: 14 }}>
              <span>Permission</span>
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="viewer">Viewer — can inspect</option>
                <option value="commenter">Commenter — can discuss</option>
                <option value="editor">Editor — can modify designs</option>
              </select>
            </label>
            <Button
              style={{ marginTop: 20 }}
              disabled={p.role !== "owner" || !email.includes("@")}
              onClick={invite}
            >
              Create invitation
            </Button>
            <p className="required-note" style={{ marginTop: 12 }}>
              Invitation links require sign-in with the invited email. No email
              is sent automatically.
            </p>
          </>
        )}
        {message && (
          <p
            className="notice"
            style={{ marginTop: 15, overflowWrap: "anywhere" }}
          >
            {message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
