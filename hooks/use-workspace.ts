"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Project, DesignDocument, Operation } from "@/types/project";
import { demoProject } from "@/lib/editor/demo";
import { uid } from "@/lib/utils";
export let localPersistenceError = '';
const safeStorage = {getItem:(name:string)=>{try{return localStorage.getItem(name);}catch{localPersistenceError='Storage unavailable';return null;}},setItem:(name:string,value:string)=>{try{localStorage.setItem(name,value);localPersistenceError='';}catch{localPersistenceError='Storage full or unavailable — export a backup';}},removeItem:(name:string)=>{try{localStorage.removeItem(name);}catch{localPersistenceError='Storage unavailable';}}};
export type LocalComment = {
  id: string;
  projectId: string;
  objectId?: string;
  text: string;
  author: string;
  createdAt: string;
  resolved: boolean;
  parentId?: string;
};
export type Checkpoint = {
  id: string;
  projectId: string;
  name: string;
  document: DesignDocument;
  createdAt: string;
  revision: number;
};
interface WorkspaceState {
  projects: Project[];
  comments: LocalComment[];
  checkpoints: Checkpoint[];
  preferences: Record<string, string>;
  history: Record<string, Operation[]>;
  future: Record<string, Operation[]>;
  ready: boolean;
  hydrate: () => void;
  upsert: (p: Project) => void;
  create: (document: DesignDocument) => string;
  edit: (id: string, type: string, mutate: (d: DesignDocument) => void) => void;
  undo: (id: string) => void;
  redo: (id: string) => void;
  star: (id: string) => void;
  checkpoint: (id: string, name: string) => void;
  comment: (c: Omit<LocalComment, "id" | "createdAt" | "author">) => void;
  resolve: (id: string) => void;
  preference: (key: string, value: string) => void;
}
export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      projects: [],
      comments: [],
      checkpoints: [],
      preferences: {
        units: "mm",
        layers: "2",
        confirmation: "Always confirm",
        manufacturer: "No preference",
      },
      history: {},
      future: {},
      ready: false,
      hydrate: () => {
        if (!get().projects.some((p) => p.id === "demo-sensor"))
          set((s) => ({ projects: [demoProject(), ...s.projects] }));
        set({ ready: true });
      },
      upsert: (p) =>
        set((s) => ({
          projects: s.projects.some((x) => x.id === p.id)
            ? s.projects.map((x) => (x.id === p.id ? p : x))
            : [p, ...s.projects],
        })),
      create: (document) => {
        const id = "demo-" + uid();
        get().upsert({
          id,
          document,
          revision: 0,
          updatedAt: new Date().toISOString(),
          starred: false,
          isPublic: false,
          demo: true,
          role: "owner",
        });
        return id;
      },
      edit: (id, type, mutate) =>
        set((s) => {
          const p = s.projects.find((p) => p.id === id);
          if (!p || !["owner", "editor"].includes(p.role)) return s;
          const before = structuredClone(p.document),
            after = structuredClone(before);
          mutate(after);
          if (JSON.stringify(before) === JSON.stringify(after)) return s;
          const op = {
            id: uid(),
            type,
            before,
            after,
            author: p.demo ? "Local designer" : "You",
            timestamp: new Date().toISOString(),
          };
          return {
            projects: s.projects.map((x) =>
              x.id === id
                ? { ...x, document: after, updatedAt: op.timestamp }
                : x,
            ),
            history: {
              ...s.history,
              [id]: [...(s.history[id] ?? []), op].slice(-60),
            },
            future: { ...s.future, [id]: [] },
          };
        }),
      undo: (id) =>
        set((s) => {
          const ops = s.history[id] ?? [],
            last = ops.at(-1);
          if (!last) return s;
          return {
            projects: s.projects.map((p) =>
              p.id === id
                ? {
                    ...p,
                    document: structuredClone(last.before),
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            ),
            history: { ...s.history, [id]: ops.slice(0, -1) },
            future: { ...s.future, [id]: [...(s.future[id] ?? []), last] },
          };
        }),
      redo: (id) =>
        set((s) => {
          const ops = s.future[id] ?? [],
            last = ops.at(-1);
          if (!last) return s;
          return {
            projects: s.projects.map((p) =>
              p.id === id
                ? {
                    ...p,
                    document: structuredClone(last.after),
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            ),
            history: { ...s.history, [id]: [...(s.history[id] ?? []), last] },
            future: { ...s.future, [id]: ops.slice(0, -1) },
          };
        }),
      star: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, starred: !p.starred } : p,
          ),
        })),
      checkpoint: (id, name) => {
        const p = get().projects.find((p) => p.id === id);
        if (p)
          set((s) => ({
            checkpoints: [
              {
                id: uid(),
                projectId: id,
                name,
                document: structuredClone(p.document),
                createdAt: new Date().toISOString(),
                revision: p.revision,
              },
              ...s.checkpoints,
            ],
          }));
      },
      comment: (c) =>
        set((s) => ({
          comments: [
            ...s.comments,
            {
              ...c,
              id: uid(),
              createdAt: new Date().toISOString(),
              author: "Local designer",
            },
          ],
        })),
      resolve: (id) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === id ? { ...c, resolved: !c.resolved } : c,
          ),
        })),
      preference: (key, value) =>
        set((s) => ({ preferences: { ...s.preferences, [key]: value } })),
    }),
    {
      name: "nodecraft-workspace-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({
        projects: s.projects.filter((p) => p.demo),
        comments: s.comments.filter((c) => c.projectId.startsWith("demo-")),
        checkpoints: s.checkpoints.filter((c) =>
          c.projectId.startsWith("demo-"),
        ),
        preferences: s.preferences,
      }),
    },
  ),
);
