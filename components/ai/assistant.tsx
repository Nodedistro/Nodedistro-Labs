"use client";
import { useState } from "react";
import {
  Sparkles,
  ArrowUp,
  ShieldCheck,
  Layers,
  ChevronRight,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Project, Proposal } from "@/types/project";
import { toast } from "sonner";
export function Assistant({
  project: p,
  onClose,
  onChecks,
}: {
  project: Project;
  onClose: () => void;
  onChecks: () => void;
}) {
  const [prompt, setPrompt] = useState(""),
    [messages, setMessages] = useState<{ role: string; text: string }[]>([]),
    [lastPrompt, setLastPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [proposal, setProposal] = useState<
      | (Proposal & { id: string; revision: number; sourceDocument?: string })
      | null
    >(null);
  async function send(text = prompt) {
    if (!text.trim() || busy) return;
    setPrompt("");
    setLastPrompt(text);
    setMessages((ms) => [...ms, { role: "user", text }]);
    if (p.demo) {
      setMessages((ms) => [
        ...ms,
        {
          role: "assistant",
          text: "AI is not connected to this local demo. Connect Supabase, sign in, and save a cloud project to use your server-side OpenAI key. You can run deterministic checks now; no AI review has been performed.",
        },
      ]);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: p.id,
          prompt: text,
          revision: p.revision,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setMessages((ms) => [...ms, { role: "assistant", text: data.message }]);
      if (data.actions?.length)
        setProposal({ ...data, sourceDocument: JSON.stringify(p.document) });
    } catch (e) {
      setMessages((ms) => [
        ...ms,
        {
          role: "assistant",
          text:
            e instanceof Error ? e.message : "AI unavailable. Try again later.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  async function decide(decision: "apply" | "reject") {
    if (!proposal) return;
    const current = useWorkspace.getState().projects.find((x) => x.id === p.id);
    if (
      decision === "apply" &&
      JSON.stringify(current?.document) !== proposal.sourceDocument
    ) {
      toast.error(
        "The design changed after this proposal. Request a new proposal.",
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          decision,
          revision: proposal.revision,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      if (
        data.project &&
        JSON.stringify(
          useWorkspace.getState().projects.find((x) => x.id === p.id)?.document,
        ) !== proposal.sourceDocument
      ) {
        throw Error(
          "Cloud changes were applied, but this window changed while waiting. Export your local design before reloading to resolve the conflict.",
        );
      }
      if (data.project) {
        useWorkspace
          .getState()
          .edit(p.id, "Apply approved AI changes", (d) =>
            Object.assign(d, data.project.document),
          );
        useWorkspace.getState().upsert(data.project);
      }
      setProposal(null);
      toast.success(
        decision === "apply"
          ? "Approved changes applied and recorded."
          : "Proposal rejected.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="assistant-head">
        <div className="row">
          <Sparkles size={16} className="ai-spark" />
          <h3>Engineering copilot</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setMessages([]);
            setProposal(null);
            setPrompt("");
            setLastPrompt("");
          }}
          aria-label="Start new AI thread"
          title="Start new AI thread"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close assistant"
        >
          <X />
        </Button>
      </div>
      <div className="assistant-scroll">
        <div className="assistant-intro">
          <div className="spark-box">
            <Sparkles size={18} />
          </div>
          <h3>
            A second set of eyes.
            <br />
            For every connection.
          </h3>
          <p>
            I can help you reason through your circuit, explore component
            choices, and plan your next step.
          </p>
        </div>
        <div className="assistant-suggestions">
          {[
            "Review my schematic",
            "Check the power architecture",
            "Add USB-C input protection",
            "Optimize the bill of materials",
          ].map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}>
              <Sparkles size={12} />
              {s}
              <span className="spacer" />
              <ChevronRight size={11} />
            </button>
          ))}
        </div>
        {messages.map((m, i) => (
          <div key={i} className={"chat-message " + m.role}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 5 }}>
              {m.role === "user" ? "YOU" : "ENGINEERING COPILOT"}
            </div>
            {m.text}
            {m.role === "assistant" &&
              i === messages.length - 1 &&
              lastPrompt &&
              !busy &&
              !p.demo && (
                <button
                  className="assistant-retry"
                  onClick={() => send(lastPrompt)}
                >
                  Try again
                </button>
              )}
          </div>
        ))}
        {busy && (
          <div className="row muted" style={{ padding: 15 }}>
            <Loader2 size={14} className="animate-spin" /> Reviewing project
            context…
          </div>
        )}
        {proposal && (
          <div className="proposal">
            <h4>PROPOSED CHANGES</h4>
            <p>{proposal.reason}</p>
            <ul>
              {proposal.actions.map((a, i) => (
                <li key={i}>
                  {a.type.replaceAll("_", " ")} ·{" "}
                  {"id" in a
                    ? a.id
                    : "component" in a
                      ? a.component.reference
                      : "netId" in a
                        ? a.netId
                        : "net" in a
                          ? a.net.name
                          : "Requirement"}
                </li>
              ))}
            </ul>
            {proposal.warnings.map((w, i) => (
              <p key={i} className="accent">
                {w}
              </p>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <Button size="sm" disabled={busy} onClick={() => decide("apply")}>
                <Check />
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => decide("reject")}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPrompt("Modify the proposed changes: ")}
              >
                Modify
              </Button>
            </div>
          </div>
        )}
        <div className="assistant-context">
          <div className="eyebrow">CONNECTED CONTEXT</div>
          <p className="row">
            <Layers size={13} /> {p.document.components.length} components ·{" "}
            {p.document.nets.length} nets
          </p>
          <p className="row">
            <ShieldCheck size={13} /> Changes require your approval
          </p>
          <p>Recommendations are not engineering validation.</p>
          <Button
            size="sm"
            variant="outline"
            style={{ marginTop: 15 }}
            onClick={onChecks}
          >
            Run deterministic checks
          </Button>
        </div>
      </div>
      <form
        className="assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label="Ask engineering copilot"
          className="input"
          placeholder="Ask about your design…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="between">
          <span>
            {p.demo
              ? "Local demo · AI not connected"
              : "Project context included"}
          </span>
          <Button
            size="icon"
            type="submit"
            aria-label="Send message"
            disabled={busy || !prompt.trim()}
          >
            <ArrowUp />
          </Button>
        </div>
      </form>
    </>
  );
}
