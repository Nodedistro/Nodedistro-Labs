"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitFork, Search, ArrowRight } from "lucide-react";
import { PublicNav } from "@/app/page";
import { Button } from "@/components/ui/button";
import { BoardPreview } from "@/components/pcb/board-preview";
import { demoProject } from "@/lib/editor/demo";
import { useWorkspace } from "@/hooks/use-workspace";
import { cloudConfigured } from "@/lib/db/client";
import type { Project } from "@/types/project";
export default function Page() {
  const router = useRouter(),
    create = useWorkspace((s) => s.create);
  const [projects, setProjects] = useState<Project[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!cloudConfigured()) return;
    fetch("/api/explore")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        if (d.error) setError(d.error);
      })
      .catch(() =>
        setError(
          "Public cloud designs are unavailable. The local demo is still available.",
        ),
      );
  }, []);
  const shown = [demoProject(), ...projects].filter((p) =>
    p.document.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="public">
      <PublicNav />
      <main className="public-section" style={{ paddingTop: 45 }}>
        <div className="eyebrow">CURIOSITY IS CONTAGIOUS</div>
        <h1 style={{ fontSize: 52, marginTop: 18 }}>
          Something worth
          <br />
          building on.
        </h1>
        <p className="section-copy">
          Explore published designs and start an independent copy. Only
          explicitly public cloud projects appear here.
        </p>
        <div className="row" style={{ maxWidth: 450, marginBottom: 30 }}>
          <Search size={18} />
          <input
            className="input"
            aria-label="Search public projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
          />
        </div>
        {error && (
          <p className="notice" role="status">
            {error}
          </p>
        )}
        <div className="grid-3">
          {shown.map((p) => (
            <article className="project-card" key={p.id}>
              <div className="project-thumb">
                <BoardPreview document={p.document} />
                <span className="badge" style={{ color: "#d4d8de" }}>
                  {p.demo ? "CURATED DEMO" : "PUBLIC PROJECT"}
                </span>
              </div>
              <div className="project-info" style={{ background: "white" }}>
                <h3>{p.document.name}</h3>
                <p>{p.document.description}</p>
                <p>
                  {p.document.components.length} components ·{" "}
                  {p.document.board.layers} layers
                </p>
                <div className="row" style={{ marginTop: 18 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/project/" + p.id)}
                  >
                    View <ArrowRight />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      router.push(
                        "/project/" +
                          create({
                            ...structuredClone(p.document),
                            name: p.document.name + " (fork)",
                          }),
                      )
                    }
                  >
                    <GitFork />
                    Fork locally
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
