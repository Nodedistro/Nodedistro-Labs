"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  ChevronDown,
  ArrowRight,
  Check,
  Loader2,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { blankDocument, demoDocument, samplePlan } from "@/lib/editor/demo";
import { catalog } from "@/lib/components/catalog";
import { cloudConfigured } from "@/lib/db/client";
import type { EngineeringPlan, DesignDocument } from "@/types/project";
import { uid } from "@/lib/utils";
function NewProjectForm() {
  const params = useSearchParams(),
    router = useRouter();
  const [mode, setMode] = useState("ai"),
    [prompt, setPrompt] = useState(""),
    [name, setName] = useState("Untitled project"),
    [advanced, setAdvanced] = useState(false),
    [requirements, setRequirements] = useState<Record<string, string>>({}),
    [plan, setPlan] = useState<EngineeringPlan | null>(null),
    [sample, setSample] = useState(false),
    [planId, setPlanId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [destination, setDestination] = useState("local");
  const create = useWorkspace((s) => s.create);
  useEffect(() => setPrompt(params.get("prompt") ?? ""), [params]);
  async function generate() {
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, requirements: {...useWorkspace.getState().preferences,...requirements} }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setPlan(data.plan);
      setPlanId(data.id);
      setSample(false);
      setDestination("cloud");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      let doc: DesignDocument = blankDocument(name);
      if (plan) {
        if (sample) doc = demoDocument();
        else {
          doc.name =
            plan.summary.split(".")[0].slice(0, 100) ||
            "New electronics project";
          doc.description = plan.summary;
          doc.requirements = plan.requirements;
          doc.components = plan.components.map((c, i) => {
            const part = catalog.find((p) => p.id === c.partId);
            if (!part)
              throw Error(
                "The plan contains a part outside the supported catalog. Request a revised plan.",
              );
            const prefix =
              part.category === "Connectors"
                ? "J"
                : part.category === "Resistors"
                  ? "R"
                  : part.category === "Capacitors"
                    ? "C"
                    : "U";
            return {
              id: uid(),
              partId: part.id,
              reference: prefix + (i + 1),
              value: part.name,
              x: 100 + (i % 4) * 300,
              y: 150 + Math.floor(i / 4) * 300,
              rotation: 0,
              pcbX: 10 + (i % 4) * 12,
              pcbY: 10 + Math.floor(i / 4) * 12,
              side: "top" as const,
              block:
                plan.blocks.find((b) =>
                  b.components.some((n) => n.includes(part.name)),
                )?.name ?? "Proposed components",
            };
          });
        }
        doc.planApproved = true;
      }
      if (destination === "local" || sample) {
        const id = create(doc);
        router.push("/project/" + id);
      } else {
        const r = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: doc, planId: planId || undefined }),
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        useWorkspace.getState().upsert(data.project);
        router.push("/project/" + data.project.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project creation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <DashboardShell>
      <div className="new-project">
        <div className="page-title">
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              A NEW CONNECTION
            </div>
            <h1>
              {plan
                ? "Review your engineering plan"
                : "What do you want to build?"}
            </h1>
            <p>
              {plan
                ? "Check the assumptions. Approve the direction. Then make it yours."
                : "Start with an idea, or go straight to a blank canvas."}
            </p>
          </div>
        </div>
        {plan ? (
          <>
            <div className="notice">
              {sample
                ? "Static example plan · local demo data · not an AI response."
                : "AI recommendation · not electrical validation."}{" "}
              Approval creates proposed components only. Connections and support
              circuitry still need review.
            </div>
            <div className="panel" style={{ marginTop: 20 }}>
              <div className="plan-section">
                <h3>Project summary</h3>
                <p>{plan.summary}</p>
              </div>
              {[
                ["Requirements", plan.requirements],
                ["System architecture", plan.architecture],
                ["Power tree", plan.powerTree],
                ["Interfaces", plan.interfaces],
                ["Design constraints", plan.constraints],
                ["Risks", plan.risks],
                ["Assumptions", plan.assumptions],
                ["Proposed next steps", plan.nextSteps],
              ].map(([title, items]) => (
                <section className="plan-section" key={String(title)}>
                  <h3>{String(title)}</h3>
                  <ul>
                    {(items as string[]).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <section className="plan-section">
                <h3>Functional blocks</h3>
                {plan.blocks.map((b) => (
                  <div key={b.name} style={{ marginBottom: 15 }}>
                    <strong>{b.name}</strong>
                    <p>{b.purpose}</p>
                    <p>{b.components.join(" · ")}</p>
                  </div>
                ))}
              </section>
              <section className="plan-section">
                <h3>Major components</h3>
                {plan.components.map((c, i) => (
                  <p key={i} style={{ marginBottom: 10 }}>
                    <strong>
                      {catalog.find((p) => p.id === c.partId)?.name ?? c.partId}
                    </strong>{" "}
                    — {c.reason}
                  </p>
                ))}
              </section>
            </div>
            <div className="dialog-actions">
              <Button
                variant="outline"
                onClick={() => {
                  setPlan(null);
                  setPlanId("");
                }}
              >
                Edit requirements / Request changes
              </Button>
              <Button onClick={save} disabled={busy}>
                <Check />
                {busy ? "Creating…" : "Approve plan & open editor"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="new-tabs">
              <button
                className={mode === "ai" ? "active" : ""}
                onClick={() => setMode("ai")}
              >
                <Sparkles className="accent" size={20} />
                <div>
                  <strong>Start with AI</strong>
                  <p className="muted" style={{ fontSize: 12 }}>
                    Think through the design together
                  </p>
                </div>
              </button>
              <button
                className={mode === "blank" ? "active" : ""}
                onClick={() => setMode("blank")}
              >
                <Plus size={20} />
                <div>
                  <strong>Blank project</strong>
                  <p className="muted" style={{ fontSize: 12 }}>
                    Your canvas, your connections
                  </p>
                </div>
              </button>
            </div>
            <div className="panel panel-pad stack">
              {mode === "ai" ? (
                <>
                  <label className="field">
                    <span>Describe your project</span>
                    <textarea
                      className="input textarea"
                      style={{ minHeight: 180 }}
                      placeholder="Create a small USB-C powered environmental sensor using Wi-Fi and Bluetooth. It should measure temperature and humidity, and fit inside a 60 × 45 mm enclosure…"
                      value={prompt}
                      maxLength={8000}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </label>
                  <p className="required-note">
                    Tell us the intended use, power source, and any important
                    constraints. Assumptions will be called out in the plan.
                  </p>
                  <button
                    className="between"
                    style={{
                      border: 0,
                      borderTop: "1px solid var(--line)",
                      background: "none",
                      padding: "15px 0 0",
                      textAlign: "left",
                    }}
                    onClick={() => setAdvanced((v) => !v)}
                  >
                    Advanced requirements <ChevronDown size={15} />
                  </button>
                  {advanced && (
                    <div className="advanced-grid">
                      {[
                        "Board dimensions",
                        "Preferred MCU",
                        "Input voltage",
                        "Output voltage",
                        "Power consumption",
                        "Connectivity",
                        "PCB layers",
                        "Preferred manufacturers",
                        "Maximum BOM cost",
                        "Component packages",
                        "Operating environment",
                        "Quantity",
                        "Prototype or production",
                      ].map((key) => (
                        <label className="field" key={key}>
                          <span>{key}</span>
                          <input
                            className="input"
                            placeholder="Optional"
                            value={requirements[key] ?? ""}
                            maxLength={200}
                            onChange={(e) =>
                              setRequirements({
                                ...requirements,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <Button
                    onClick={generate}
                    disabled={busy || prompt.trim().length < 10}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {busy
                      ? "Building design proposal…"
                      : "Create engineering plan"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPlan(samplePlan);
                      setSample(true);
                      setError("");
                    }}
                  >
                    Explore the static environmental-sensor example instead
                  </Button>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Project name</span>
                    <input
                      className="input"
                      value={name}
                      maxLength={120}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Workspace</span>
                    <select
                      className="input"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    >
                      <option value="local">
                        Local demo — saved on this device
                      </option>
                      <option value="cloud">
                        Cloud — requires sign-in and Supabase
                      </option>
                    </select>
                  </label>
                  <Button onClick={save} disabled={busy || !name.trim()}>
                    <Plus />
                    {busy ? "Creating…" : "Create blank project"}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
        {error && (
          <div className="notice" role="alert" style={{ marginTop: 20 }}>
            {error}
          </div>
        )}
        <p className="required-note" style={{ marginTop: 25 }}>
          Your OpenAI key stays on the server. Cloud authentication and AI
          services must be configured before live planning is available.
        </p>
      </div>
    </DashboardShell>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={<div className="empty">Preparing project builder…</div>}
    >
      <NewProjectForm />
    </Suspense>
  );
}
