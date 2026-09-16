"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
  ArrowRight,
  Star,
  Folder,
  Clock,
  GitBranch,
  Cpu,
  Radio,
  Layers,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { DashboardShell } from "./shell";
import { Button } from "@/components/ui/button";
import { BoardPreview } from "@/components/pcb/board-preview";
import type { Project } from "@/types/project";
import { browserDb, cloudConfigured } from "@/lib/db/client";
export function ProjectCard({ project: p }: { project: Project }) {
  const star = useWorkspace((s) => s.star);
  return (
    <article className="project-card">
      <div className="project-thumb">
        <Link href={"/project/" + p.id} aria-label={"Open " + p.document.name}>
          <BoardPreview document={p.document} />
        </Link>
        <span className="badge">
          {p.demo ? "LOCAL DEMO" : p.isPublic ? "PUBLIC" : "PRIVATE"}
        </span>
        <button
          className="project-star"
          aria-label={p.starred ? "Unstar project" : "Star project"}
          onClick={() => star(p.id)}
        >
          <Star size={14} fill={p.starred ? "currentColor" : "none"} />
        </button>
      </div>
      <Link href={"/project/" + p.id}>
        <div className="project-info">
          <h3>{p.document.name}</h3>
          <p>
            {p.document.components.length} components ·{" "}
            {p.document.board.layers} layers
          </p>
          <div className="between">
            <span className="row">
              <span className="dot" />{" "}
              {p.demo ? "Local workspace" : "Cloud project"}
            </span>
            <span>
              {new Date(p.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
export function Dashboard({ filter = "home" }: { filter?: string }) {
  const router = useRouter(),
    projects = useWorkspace((s) => s.projects),
    ready = useWorkspace((s) => s.ready),
    history = useWorkspace((s) => s.history);
  const [prompt, setPrompt] = useState(""),
    [tab, setTab] = useState("Recent"),
    [error, setError] = useState("");
  useEffect(() => {
    if (cloudConfigured())
      browserDb()
        .auth.getSession()
        .then(({ data }) =>
          data.session
            ? fetch("/api/projects").then((r) => r.json())
            : { projects: [] },
        )
        .then((data) => {
          data.projects?.forEach((p: Project) =>
            useWorkspace.getState().upsert(p),
          );
          if (data.error && !data.error.includes("Sign in"))
            setError(data.error);
        })
        .catch(() =>
          setError(
            "Cloud projects are unavailable. Local projects are still accessible.",
          ),
        );
  }, []);
  const shown = projects
    .filter((p) =>
      filter === "shared"
        ? !p.demo && p.role !== "owner"
        : tab === "Starred"
          ? p.starred
          : true,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const start = () =>
    router.push("/projects/new?prompt=" + encodeURIComponent(prompt));
  return (
    <DashboardShell>
      <div className="dash-welcome">
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>
            YOUR HARDWARE WORKSPACE
          </div>
          <h1>
            {filter === "home"
              ? "Make something that matters."
              : filter === "shared"
                ? "Shared with you"
                : filter === "recent"
                  ? "Recently opened"
                  : "Your projects"}
          </h1>
          <p>
            {filter === "home"
              ? "A little inspiration. A lot of possibilities. What will you build next?"
              : "Your ideas, circuits, and boards in one place."}
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus /> New project
          </Link>
        </Button>
      </div>
      {error && <div className="notice">{error}</div>}
      {filter === "home" && (
        <section className="ai-start">
          <div
            className="row accent"
            style={{ fontSize: 11, marginBottom: 13 }}
          >
            <Sparkles size={15} /> START WITH AN IDEA
          </div>
          <h2>From “what if” to your next circuit.</h2>
          <p>
            Describe what you want to build. Your AI copilot will help you work
            through the engineering.
          </p>
          <div className="prompt-row">
            <input
              className="input"
              aria-label="Project idea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") start();
              }}
              placeholder="A small USB-C powered environmental sensor with Wi-Fi…"
            />
            <Button onClick={start}>
              <Sparkles /> Build with AI <ArrowRight />
            </Button>
          </div>
          <div className="chips">
            {[
              "A smart home sensor",
              "A robotics controller",
              "A USB-C power module",
            ].map((x) => (
              <button className="tag" key={x} onClick={() => setPrompt(x)}>
                {x} ↗
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="section-head">
        <div className="row">
          <h2>{filter === "home" ? "Your projects" : "Projects"}</h2>
          <span className="badge">{shown.length}</span>
        </div>
        <div className="row">
          {["Recent", "Starred"].map((x) => (
            <Button
              variant={tab === x ? "secondary" : "ghost"}
              size="sm"
              key={x}
              onClick={() => setTab(x)}
            >
              {x === "Starred" && <Star />}
              {x}
            </Button>
          ))}
        </div>
      </div>
      {!ready ? (
        <div className="grid-3">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : shown.length ? (
        <div className="grid-3">
          {shown.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {filter === "home" && (
            <Link
              className="project-card empty"
              style={{ minHeight: 280, borderStyle: "dashed" }}
              href="/projects/new"
            >
              <Plus />
              <h3>A new idea starts here</h3>
              <p>
                Create a blank project
                <br />
                or start with an AI plan.
              </p>
              <span className="accent" style={{ fontSize: 12 }}>
                Create project →
              </span>
            </Link>
          )}
        </div>
      ) : (
        <div className="panel empty">
          <Folder />
          <h3>
            {filter === "shared"
              ? "No shared projects yet"
              : "No projects here yet"}
          </h3>
          <p>
            {filter === "shared"
              ? "Projects shared with your account will appear here."
              : "Create a project or star one to find it here."}
          </p>
          <Button asChild variant="outline">
            <Link href="/projects/new">Create a project</Link>
          </Button>
        </div>
      )}
      {filter === "home" && (
        <div className="dashboard-bottom">
          <section>
            <div className="section-head">
              <h2>Start a little further ahead</h2>
              <Link
                href="/templates"
                className="muted"
                style={{ fontSize: 12 }}
              >
                All templates →
              </Link>
            </div>
            {[
              ["Environmental sensor", "ESP32 · BME280 · USB-C", Radio],
              ["Microcontroller starter", "Power · MCU · Programming", Cpu],
              ["Power supply module", "Input · Regulation · Filtering", Layers],
            ].map(([name, desc, Icon]) => {
              const I = Icon as typeof Cpu;
              return (
                <Link
                  className="template-small"
                  href={
                    "/templates?template=" + encodeURIComponent(String(name))
                  }
                  key={String(name)}
                >
                  <span className="template-icon">
                    <I size={17} />
                  </span>
                  <div>
                    <strong>{String(name)}</strong>
                    <p className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                      {String(desc)}
                    </p>
                  </div>
                  <span className="spacer" />
                  <ArrowRight size={14} className="muted" />
                </Link>
              );
            })}
          </section>
          <section>
            <div className="section-head">
              <h2>Workspace activity</h2>
              <Clock size={14} className="muted" />
            </div>
            {Object.values(history)
              .flat()
              .slice(-4)
              .reverse()
              .map((op) => (
                <div className="activity-item" key={op.id}>
                  <GitBranch size={15} />
                  <div>
                    {op.type}
                    <p>
                      {new Date(op.timestamp).toLocaleTimeString()} ·{" "}
                      {op.author}
                    </p>
                  </div>
                </div>
              ))}
            <div className="activity-item">
              <Layers size={15} />
              <div>
                Demo workspace ready
                <p>Explore the environmental sensor project.</p>
              </div>
            </div>
            <div className="notice" style={{ marginTop: 16 }}>
              Demo parts and prices are illustrative. No live inventory,
              simulation, or manufacturing verification has been performed.
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
