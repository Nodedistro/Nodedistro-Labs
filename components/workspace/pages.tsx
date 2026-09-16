"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Search,
  Plus,
  Library,
  Layers,
  ArrowRight,
  Users,
  ChartNoAxesColumn,
  Settings,
  LogOut,
  Check,
  ExternalLink,
  Download,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { catalog, searchCatalog } from "@/lib/components/catalog";
import { templates, templateDocument } from "@/lib/components/templates";
import { BoardPreview } from "@/components/pcb/board-preview";
import { useWorkspace } from "@/hooks/use-workspace";
import { browserDb, cloudConfigured } from "@/lib/db/client";
import { money, uid, download } from "@/lib/utils";
import { partSchema, type Part } from "@/types/project";
import { PricingCards } from "./pricing";
import { toast } from "sonner";
export function WorkspacePage({ section }: { section: string }) {
  return (
    <DashboardShell>
      {section === "templates" ? (
        <Templates />
      ) : section === "components" ? (
        <Components />
      ) : section === "libraries" ? (
        <Libraries />
      ) : section === "settings" ? (
        <SettingsPage />
      ) : section === "usage" ? (
        <Usage />
      ) : section === "billing" ? (
        <Billing />
      ) : (
        <Teams />
      )}
    </DashboardShell>
  );
}
function Templates() {
  const router = useRouter(),
    create = useWorkspace((s) => s.create);
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            DON’T START FROM ZERO
          </div>
          <h1>Templates & circuit blocks</h1>
          <p>
            Independent project copies you can explore, adapt, and complete.
          </p>
        </div>
      </div>
      <div className="notice" style={{ marginBottom: 25 }}>
        These are illustrative starter circuits. Pinouts, footprints, support
        components, and routing require engineering review.
      </div>
      <div className="grid-3">
        {templates.map((t) => (
          <article className="project-card" key={t.id}>
            <div className="project-thumb">
              <BoardPreview document={templateDocument(t.id)} />
              <span className="badge">STARTER TEMPLATE</span>
            </div>
            <div className="project-info">
              <h3>{t.name}</h3>
              <p style={{ minHeight: 52 }}>{t.description}</p>
              <div className="chips" style={{ margin: "12px 0" }}>
                {t.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push("/project/" + create(templateDocument(t.id)))
                }
              >
                Use template <ArrowRight />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Components() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All");
  const found = searchCatalog(query).filter(
    (p) => category === "All" || p.category === category,
  );
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            THE BUILDING BLOCKS
          </div>
          <h1>Component catalog</h1>
          <p>A structured starting point for your next design.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/libraries">
            <Plus />
            Custom component
          </Link>
        </Button>
      </div>
      <div className="notice">
        Illustrative catalog. Logical pin maps are simplified; manufacturer
        documentation is the source of truth. No live pricing or inventory is
        connected.
      </div>
      <div className="row" style={{ margin: "24px 0" }}>
        <Search size={17} />
        <input
          className="input"
          aria-label="Search component catalog"
          placeholder="Search MPN, name, package, or manufacturer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          {["All", ...new Set(catalog.map((p) => p.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="panel panel-pad">
        {found.map((p) => (
          <div className="library-result" key={p.id}>
            <span className="part-icon">
              <Cpu size={22} />
            </span>
            <div className="spacer">
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <p>
                {p.manufacturer} · {p.mpn || "Missing MPN"} · {p.package}
              </p>
            </div>
            <span className="muted">{money(p.price)} est.</span>
            {p.datasheet && (
              <Button asChild variant="ghost" size="icon">
                <a
                  href={p.datasheet}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={"Documentation for " + p.name}
                >
                  <ExternalLink />
                </a>
              </Button>
            )}
          </div>
        ))}
        {!found.length && (
          <div className="empty">
            <Search />
            <h3>No matching parts</h3>
            <p>Try a different keyword or category.</p>
          </div>
        )}
      </div>
    </>
  );
}
function Libraries() {
  const [parts, setParts] = useState<Part[]>([]),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [mpn, setMpn] = useState(""),
    [manufacturer, setManufacturer] = useState(""),
    [pkg, setPkg] = useState(""),
    [footprint, setFootprint] = useState(""),
    [pins, setPins] = useState("1,VCC,power\n2,GND,ground"),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      setParts(JSON.parse(localStorage.getItem("nodecraft-library") ?? "[]"));
    } catch {
      setError("Local library could not be read.");
    }
  }, []);
  function create() {
    try {
      const part = partSchema.parse({
        id: uid(),
        name,
        mpn,
        manufacturer,
        package: pkg,
        footprint,
        description: "Custom component",
        category: "Custom",
        datasheet: "",
        price: 0,
        stock: null,
        lifecycle: "Unknown",
        tags: [],
        pins: pins
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [id, name, type] = line.split(",").map((x) => x.trim());
            return { id, name, type, required: true };
          }),
      });
      const next = [...parts, part];
      localStorage.setItem("nodecraft-library", JSON.stringify(next));
      setParts(next);
      setOpen(false);
      setName("");
      setError("");
      toast.success("Custom component saved on this device.");
    } catch {
      setError(
        "Check component fields and pins. Pin types: input, output, power, ground, passive.",
      );
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Your component library</h1>
          <p>Private, reusable definitions for the way you design.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Create component
        </Button>
      </div>
      <div className="notice">
        This local library stays on this device. Export components for backup.
        Import them into a project through its component picker.
      </div>
      {parts.length ? (
        <div className="panel panel-pad" style={{ marginTop: 20 }}>
          {parts.map((p) => (
            <div className="library-result" key={p.id}>
              <Cpu size={22} className="green" />
              <div className="spacer">
                <h3>{p.name}</h3>
                <p>
                  {p.manufacturer} · {p.mpn} · {p.pins.length} pins
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  download(p.name + ".json", JSON.stringify(p, null, 2))
                }
              >
                <Download />
                Export
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel empty" style={{ marginTop: 24 }}>
          <Library />
          <h3>Your library is a blank canvas</h3>
          <p>
            Create a custom component with a logical pin map and footprint
            reference.
          </p>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Create your first component
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Create a component</DialogTitle>
          <DialogDescription>
            Define the logical pins. Physical footprint geometry still needs a
            verified library.
          </DialogDescription>
          <div className="form-grid">
            {[
              ["Name", name, setName],
              ["Manufacturer", manufacturer, setManufacturer],
              ["MPN", mpn, setMpn],
              ["Package", pkg, setPkg],
              ["Footprint reference", footprint, setFootprint],
            ].map(([label, value, set]) => (
              <label className="field" key={String(label)}>
                <span>{String(label)}</span>
                <input
                  className="input"
                  value={String(value)}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="field" style={{ marginTop: 20 }}>
            <span>Pins: number,name,type — one per line</span>
            <textarea
              className="input textarea mono"
              value={pins}
              onChange={(e) => setPins(e.target.value)}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="dialog-actions">
            <Button onClick={create} disabled={!name.trim()}>
              Save component
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function SettingsPage() {
  const prefs = useWorkspace((s) => s.preferences),
    set = useWorkspace((s) => s.preference);
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Workspace settings</h1>
          <p>Make Nodedistro Labs work the way you do.</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            if (cloudConfigured()) await browserDb().auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut />
          Sign out
        </Button>
      </div>
      <div className="grid-2">
        <section className="panel panel-pad stack">
          <h3>Engineering preferences</h3>
          {[
            ["Preferred manufacturer", "manufacturer"],
            ["Preferred component family", "family"],
            ["Preferred package", "package"],
            ["Maximum BOM cost", "budget"],
            ["Typical PCB manufacturer", "fabricator"],
          ].map(([label, key]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                className="input"
                value={prefs[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                placeholder="No preference"
              />
            </label>
          ))}
          <label className="field">
            <span>Typical layer count</span>
            <select
              className="input"
              value={prefs.layers}
              onChange={(e) => set("layers", e.target.value)}
            >
              {[2, 4, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="notice">
            Major AI changes always require approval. Preferences guide
            planning; they are not engineering facts. Saved locally.
          </div>
        </section>
        <section className="panel panel-pad">
          <h3>Connected services</h3>
          {[
            ["Cloud database & authentication", "cloud"],
            ["OpenAI hardware assistant", "ai"],
            ["Simulation engine", "simulation"],
            ["Fabrication exporter", "fabrication"],
          ].map(([label, key]) => (
            <div className="readiness-row" key={key}>
              <span>{label}</span>
              <span className={status?.[key] ? "green" : "muted"}>
                {status?.[key] ? "Configured" : "Not configured"}
              </span>
            </div>
          ))}
          <p className="required-note" style={{ marginTop: 20 }}>
            Credentials are configured on the server. Never enter API secrets in
            project descriptions or AI prompts.
          </p>
          <hr />
          <h3>Appearance & accessibility</h3>
          <p className="muted" style={{ marginTop: 12 }}>
            The editor uses a high-contrast dark workspace. Use browser zoom to
            adjust text size. Keyboard shortcuts are available through the
            command center.
          </p>
          <hr />
          <Link href="/reset-password" className="subtle-link">
            Change your password
          </Link>
        </section>
      </div>
    </>
  );
}
function Usage() {
  const projects = useWorkspace((s) => s.projects),
    [data, setData] = useState<{
      usage: Record<string, number>;
      subscription: { plan: string; status: string };
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Usage data unavailable."));
  }, []);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Workspace usage</h1>
          <p>Understand the resources behind your designs.</p>
        </div>
        <span className="badge">
          {data?.subscription.plan.toUpperCase() ?? "LOCAL DEMO"}
        </span>
      </div>
      {error && (
        <div className="notice" style={{ marginBottom: 20 }}>
          {error} Local demo activity is not billed.
        </div>
      )}
      <div className="stat-grid">
        {[
          ["AI requests", data?.usage.ai_requests],
          ["AI tokens", data?.usage.ai_tokens],
          ["Simulations", data?.usage.simulations],
          ["Server exports", data?.usage.exports],
          ["Local projects", projects.filter((p) => p.demo).length],
        ].map(([label, value]) => (
          <div className="stat" key={String(label)}>
            <p>{label}</p>
            <strong>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
      <div className="panel panel-pad">
        <h3>How usage is counted</h3>
        <p className="muted" style={{ marginTop: 12 }}>
          AI requests reserve allowance before provider execution. Failed
          requests may consume a request allowance; token totals reflect
          returned provider usage. Local demo editing and local downloads do not
          consume server quotas.
        </p>
      </div>
    </>
  );
}
function Billing() {
  const [error, setError] = useState("");
  async function portal() {
    try {
      const r = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      window.location.assign(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing portal unavailable.");
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Plans & billing</h1>
          <p>Space to grow with your next idea.</p>
        </div>
        <Button variant="outline" onClick={portal}>
          Manage subscription <ExternalLink />
        </Button>
      </div>
      {error && <div className="notice">{error}</div>}
      <PricingCards />
      <p className="required-note" style={{ marginTop: 20 }}>
        Plan status is verified server-side through Stripe webhooks. A checkout
        redirect alone never grants paid access.
      </p>
    </>
  );
}
function Teams() {
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Build together</h1>
          <p>Give each collaborator the right seat at the workbench.</p>
        </div>
      </div>
      <div className="panel empty">
        <Users />
        <h3>Collaboration starts inside a project</h3>
        <p style={{ maxWidth: 460 }}>
          Open a cloud project and choose Share to invite an editor, commenter,
          or viewer. Organization-wide teams and shared libraries are a future
          extension.
        </p>
        <Button asChild>
          <Link href="/projects">
            Open your projects <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="grid-3" style={{ marginTop: 24 }}>
        {[
          ["Editor", "Can change the design and create checkpoints."],
          [
            "Commenter",
            "Can discuss and resolve comments. Cannot edit the design.",
          ],
          ["Viewer", "Can inspect a shared project without modifying it."],
        ].map(([role, desc]) => (
          <div className="panel panel-pad" key={role}>
            <h3>{role}</h3>
            <p className="muted" style={{ marginTop: 10 }}>
              {desc}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
