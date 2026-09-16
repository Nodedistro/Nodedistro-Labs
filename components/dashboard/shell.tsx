"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Folder,
  Clock,
  Users,
  Cpu,
  Library,
  LayoutTemplate,
  ChartNoAxesColumn,
  CreditCard,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { browserDb, cloudConfigured } from "@/lib/db/client";
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    if (!cloudConfigured()) {
      setAuthReady(true);
      return;
    }
    const db = browserDb();
    let active = true;
    db.auth
      .getUser()
      .then(({ data }) => {
        if (active) {
          setAccount(
            data.user?.email ?? (data.user ? "Signed-in account" : null),
          );
          setAuthReady(true);
        }
      })
      .catch(() => {
        if (active) setAuthReady(true);
      });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setAccount(
          session?.user.email ?? (session?.user ? "Signed-in account" : null),
        );
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const projects = useWorkspace((s) => s.projects);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const nav = [
    ["Home", "/dashboard", Home],
    ["Projects", "/projects", Folder],
    ["Recent", "/recent", Clock],
    ["Shared with me", "/shared", Users],
    ["Components", "/components", Cpu],
    ["Libraries", "/libraries", Library],
    ["Templates", "/templates", LayoutTemplate],
    ["Teams", "/teams", Users],
    ["AI Usage", "/usage", ChartNoAxesColumn],
    ["Billing", "/billing", CreditCard],
    ["Settings", "/settings", Settings],
  ] as const;
  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <Logo />
        <div className="workspace-switch">
          <span className="avatar">N</span>
          <span>Personal workspace</span>
          <ChevronDown size={13} />
        </div>
        <nav className="dash-nav">
          {nav.map(([label, href, Icon], i) => (
            <div key={href}>
              {i === 4 && <div className="eyebrow">Workspace</div>}
              {i === 8 && <div className="eyebrow">Manage</div>}
              <Link
                href={href}
                className={path === href ? "active" : ""}
                title={label}
              >
                <Icon />
                <span className="nav-label">{label}</span>
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="usage-mini">
            <div className="between">
              <span>
                {!authReady
                  ? "Checking account…"
                  : account
                    ? "Signed in"
                    : "Local demo workspace"}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              {account ??
                "You are browsing without an account. Demo designs stay on this device."}
            </p>
          </div>
          {authReady && !account && (
            <Button asChild size="sm">
              <Link href="/login">Sign in to your account</Link>
            </Button>
          )}
          <Link href={account ? "/settings" : "/login"} className="row">
            <span className="avatar">N</span>
            <span className="account-name" style={{ fontSize: 12 }}>
              Your workspace
              <br />
              <span className="muted" style={{ fontSize: 10 }}>
                Preferences & connections
              </span>
            </span>
          </Link>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <header className="dash-topbar">
          <span className="muted" style={{ fontSize: 12 }}>
            Workspace{" "}
            <span style={{ padding: "0 12px", color: "#555c65" }}>/</span>{" "}
            <span style={{ color: "#c5cbd2" }}>
              {nav.find((x) => x[1] === path)?.[0] ?? "New project"}
            </span>
          </span>
          <span className="spacer" />
          {authReady && !account && (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <button className="search-trigger" onClick={() => setSearch(true)}>
            <Search size={15} />
            <span className="search-label">Search anything…</span>
            <span className="kbd">⌘ K</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotifications(true)}
            aria-label="Notifications"
          >
            <Bell />
          </Button>
          <Link href="/explore" title="Explore public projects">
            <ArrowUpRight size={16} />
          </Link>
        </header>
        <main className="dash-content">{children}</main>
      </div>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent>
          <DialogTitle>Search workspace</DialogTitle>
          <DialogDescription>
            Find projects, components, templates, and commands.
          </DialogDescription>
          <input
            autoFocus
            className="input"
            aria-label="Search workspace"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a name or command…"
          />
          <div className="command-list">
            {[
              ...projects.map((p) => ({
                name: p.document.name,
                path: "/project/" + p.id,
              })),
              { name: "New Project", path: "/projects/new" },
              ...nav.map(([name, path]) => ({ name, path })),
            ]
              .filter((x) => x.name.toLowerCase().includes(query.toLowerCase()))
              .map((x) => (
                <button
                  key={x.path + x.name}
                  onClick={() => {
                    setSearch(false);
                    router.push(x.path);
                  }}
                >
                  <Search size={15} />
                  {x.name}
                  <span className="spacer" />
                  <ArrowUpRight size={13} />
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={notifications} onOpenChange={setNotifications}>
        <DialogContent>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>
            Invitations and project updates appear here.
          </DialogDescription>
          <div className="empty">
            <Bell />
            <h3>You’re all caught up</h3>
            <p>Local demo projects do not send notifications.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
