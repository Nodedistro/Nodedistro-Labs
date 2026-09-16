"use client";
import { useState, useEffect } from "react";
import { useWorkspace, type LocalComment } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { MessageSquare, Check, CornerDownRight } from "lucide-react";
import type { Project } from "@/types/project";
export function Comments({
  project: p,
  objectId,
}: {
  project: Project;
  objectId?: string;
}) {
  const local = useWorkspace((s) => s.comments),
    add = useWorkspace((s) => s.comment),
    resolve = useWorkspace((s) => s.resolve);
  const [remote, setRemote] = useState<LocalComment[]>([]),
    [text, setText] = useState(""),
    [reply, setReply] = useState<string | undefined>(),
    [error, setError] = useState("");
  const comments = p.demo ? local.filter((c) => c.projectId === p.id) : remote;
  useEffect(() => {
    if (p.demo) return;
    fetch(`/api/projects/${p.id}/comments`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setRemote(d.comments);
      })
      .catch(() => setError("Comments unavailable."));
  }, [p.id, p.demo]);
  async function submit() {
    if (!text.trim()) return;
    if (p.demo)
      add({
        projectId: p.id,
        text,
        objectId,
        resolved: false,
        parentId: reply,
      });
    else {
      const r = await fetch(`/api/projects/${p.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, objectId, parentId: reply }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error);
        return;
      }
      setRemote((cs) => [...cs, d.comment]);
    }
    setText("");
    setReply(undefined);
  }
  async function toggle(c: LocalComment) {
    if (p.demo) resolve(c.id);
    else {
      const r = await fetch(`/api/projects/${p.id}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, resolved: !c.resolved }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error);
        return;
      }
      setRemote((cs) =>
        cs.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)),
      );
    }
  }
  return (
    <div className="properties">
      <div className="eyebrow">DESIGN DISCUSSION</div>
      <p className="muted" style={{ margin: "12px 0", fontSize: 11 }}>
        {objectId
          ? "Commenting on " +
            (p.document.components.find((c) => c.id === objectId)?.reference ??
              objectId)
          : "Project comments"}
      </p>
      {error && <p className="error-text">{error}</p>}
      {comments.length === 0 && (
        <div className="empty" style={{ padding: 10, minHeight: 140 }}>
          <MessageSquare />
          <h3>No comments yet</h3>
          <p>Leave a question or a design note.</p>
        </div>
      )}
      {comments.map((c) => (
        <div
          className="comment-card"
          key={c.id}
          style={{
            opacity: c.resolved ? 0.55 : 1,
            paddingLeft: c.parentId ? 12 : 0,
          }}
        >
          <div className="between">
            <small>
              {c.parentId && "↳ "}
              {c.author}
            </small>
            <small>{new Date(c.createdAt).toLocaleDateString()}</small>
          </div>
          <p>{c.text}</p>
          {c.objectId && (
            <small>
              On{" "}
              {p.document.components.find((x) => x.id === c.objectId)
                ?.reference ?? c.objectId}
            </small>
          )}
          <div className="row">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReply(c.id)}
              disabled={p.role === "viewer"}
            >
              Reply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggle(c)}
              disabled={p.role === "viewer"}
            >
              {c.resolved ? "Reopen" : "Resolve"}
            </Button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20 }}>
        {reply && (
          <p className="accent">
            Replying to comment{" "}
            <button onClick={() => setReply(undefined)}>Cancel</button>
          </p>
        )}
        <textarea
          className="input textarea"
          aria-label="Comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a design note…"
          maxLength={4000}
        />
        <Button
          size="sm"
          style={{ marginTop: 10 }}
          disabled={!text.trim() || p.role === "viewer"}
          onClick={submit}
        >
          Post comment
        </Button>
      </div>
    </div>
  );
}
