"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useWorkspace, localPersistenceError } from "./use-workspace";
import { browserDb, cloudConfigured } from "@/lib/db/client";
import type { Project } from "@/types/project";
export function useProjectSync(id: string) {
  const p = useWorkspace((s) => s.projects.find((p) => p.id === id)),
    ready = useWorkspace((s) => s.ready);
  const [status, setStatus] = useState("Loading…"),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [members, setMembers] = useState<string[]>([]);
  const saved = useRef(""),
    revision = useRef(0),
    saving = useRef(false),
    conflict = useRef(false),
    channel = useRef<ReturnType<
      ReturnType<typeof browserDb>["channel"]
    > | null>(null),
    cursorTime = useRef(0);
  useEffect(() => {
    let cancelled = false;
    if (id.startsWith("demo-")) {
      if (ready) {
        setLoaded(true);
        setStatus("Saved locally");
      }
      return;
    }
    if (!cloudConfigured()) {
      setError(
        "Cloud services are not configured. Open a local demo project from the dashboard.",
      );
      return;
    }
    fetch("/api/projects/" + id)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (cancelled) return;
        saved.current = JSON.stringify(data.project.document);
        revision.current = data.project.revision;
        useWorkspace.getState().upsert(data.project);
        setLoaded(true);
        setStatus("Saved");
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, ready]);
  useEffect(()=>{if(p&&!p.demo&&p.revision>revision.current&&!saving.current){revision.current=p.revision;saved.current=JSON.stringify(p.document);setStatus('Saved');}},[p?.revision,p?.demo,p?.document]);
  const save = useCallback(async () => {
    const current = useWorkspace.getState().projects.find((p) => p.id === id);
    if (!current || !loaded || conflict.current) return;
    if (current.demo) {
      try {
        localStorage.setItem("nodecraft-save-test", "1");
        localStorage.removeItem("nodecraft-save-test");
        setStatus(
          localPersistenceError || (navigator.onLine ? "Saved locally" : "Offline · saved locally"),
        );
      } catch {
        setStatus("Local storage full — export a backup");
      }
      return;
    }
    if (!["owner", "editor"].includes(current.role)) return;
    if (saving.current) return;
    const body = JSON.stringify(current.document);
    if (body === saved.current) return;
    if (!navigator.onLine) {
      setStatus("Offline · unsaved changes");
      return;
    }
    saving.current = true;
    setStatus("Saving…");
    try {
      const response = await fetch("/api/projects/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: current.document,
          revision: revision.current,
          description: "Editor changes",
        }),
      });
      const data = await response.json();
      if (response.status === 409) {
        conflict.current = true;
        setStatus("Conflict detected");
        return;
      }
      if (!response.ok) throw Error(data.error);
      revision.current = data.project.revision;
      saved.current = body;
      const latest = useWorkspace.getState().projects.find((p) => p.id === id);
      if (latest)
        useWorkspace
          .getState()
          .upsert({ ...latest, revision: revision.current });
      setStatus("Saved");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      saving.current = false;
    }
  }, [id, loaded]);
  useEffect(() => {
    if (!loaded || !p) return;
    const timer = setTimeout(save, 650);
    return () => clearTimeout(timer);
  }, [p?.document, loaded, save]);
  useEffect(() => {
    if (!loaded) return;
    const online = () => save();
    const before = (e: BeforeUnloadEvent) => {
      const cur = useWorkspace.getState().projects.find((p) => p.id === id);
      if (cur && !cur.demo && JSON.stringify(cur.document) !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("beforeunload", before);
    const timer = setInterval(save, 3000);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("beforeunload", before);
      clearInterval(timer);
    };
  }, [loaded, id, save]);
  useEffect(() => {
    if (!loaded || id.startsWith("demo-") || !cloudConfigured()) return;
    const db = browserDb();
    let cleanup = false;
    db.auth.getUser().then(({ data: { user } }) => {
      if (!user || cleanup) return;
      const ch = db.channel("project:" + id, {
        config: { private: true, presence: { key: user.id } },
      });
      channel.current = ch;
      ch.on("presence", { event: "sync" }, () =>
        setMembers(Object.keys(ch.presenceState())),
      )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "pcb_projects",
            filter: "id=eq." + id,
          },
          (payload) => {
            const row = payload.new;
            if (row.revision <= revision.current || saving.current) return;
            const cur = useWorkspace
              .getState()
              .projects.find((p) => p.id === id);
            if (cur && JSON.stringify(cur.document) !== saved.current) {
              conflict.current = true;
              setStatus("Conflict detected");
            } else if (cur) {
              revision.current = row.revision;
              saved.current = JSON.stringify(row.document);
              useWorkspace
                .getState()
                .upsert({
                  ...cur,
                  document: row.document,
                  revision: row.revision,
                });
            }
          },
        )
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED")
            await ch.track({ userId: user.id, activeEditor: true });
        });
    });
    return () => {
      cleanup = true;
      if (channel.current) db.removeChannel(channel.current);
    };
  }, [loaded, id]);
  const broadcastCursor = (cursor: { x: number; y: number }) => {
    if (Date.now() - cursorTime.current < 100) return;
    cursorTime.current = Date.now();
    channel.current?.send({
      type: "broadcast",
      event: "cursor",
      payload: cursor,
    });
  };
  return { project: p, loaded, status, error, members, save, broadcastCursor };
}
