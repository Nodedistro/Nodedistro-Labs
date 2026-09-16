"use client";
import { useState } from "react";
import { Activity, Play, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types/project";
export function Simulation({ project: p }: { project: Project }) {
  const [analysis, setAnalysis] = useState("transient"),
    [stop, setStop] = useState("0.01"),
    [step, setStep] = useState("0.00001"),
    [netlist, setNetlist] = useState(""),
    [status, setStatus] = useState("Simulation engine not configured."),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{
      samples: Record<string, number>[];
      signals: string[];
      xLabel: string;
      provenance: string;
    } | null>(null);
  async function run() {
    setBusy(true);
    setResult(null);
    try {
      if (p.demo)
        throw Error(
          "Simulation engine not configured for local demo projects. Connect a cloud project and a simulation provider.",
        );
      const r = await fetch(`/api/projects/${p.id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          stop: Number(stop),
          step: Number(step),
          netlist,
          revision: p.revision,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setResult(data);
      setStatus("Provider result received. Review the model assumptions.");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Simulation could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-tab">
      <div className="page-title">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            TEST YOUR ASSUMPTIONS
          </div>
          <h1>Circuit simulation</h1>
          <p>Real models. Reproducible results.</p>
        </div>
        <span className="badge amber">
          {result ? "PROVIDER RESULT" : "NOT RUN"}
        </span>
      </div>
      <div className="simulation-layout">
        <div className="panel simulation-config">
          <h3 style={{ marginBottom: 18 }}>Analysis setup</h3>
          <div className="stack">
            <label className="field">
              <span>Analysis type</span>
              <select
                className="input"
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
              >
                <option value="dc">DC operating point</option>
                <option value="sweep">DC sweep</option>
                <option value="transient">Transient analysis</option>
                <option value="ac">AC analysis</option>
              </select>
            </label>
            <label className="field">
              <span>Stop / upper bound</span>
              <input
                className="input"
                type="number"
                min="0.0000001"
                step="any"
                value={stop}
                onChange={(e) => setStop(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Step size</span>
              <input
                className="input"
                type="number"
                min="0.0000001"
                step="any"
                value={step}
                onChange={(e) => setStep(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Verified SPICE netlist</span>
              <textarea
                className="input textarea mono"
                value={netlist}
                onChange={(e) => setNetlist(e.target.value)}
                placeholder="Paste a model-complete SPICE netlist. Logical demo symbols have no SPICE models."
              />
            </label>
            <Button onClick={run} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />}Run
              simulation
            </Button>
          </div>
        </div>
        <div className="panel simulation-chart">
          {result ? (
            <>
              <div style={{ padding: 20, fontSize: 12 }}>
                {result.provenance}
              </div>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.samples}>
                    <CartesianGrid stroke="#30383e" />
                    <XAxis
                      dataKey="x"
                      label={{
                        value: result.xLabel,
                        position: "insideBottomRight",
                        offset: -5,
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        background: "#20272c",
                        border: "1px solid #48515a",
                      }}
                    />
                    <Legend />
                    {result.signals.map((s, i) => (
                      <Line
                        key={s}
                        dataKey={s}
                        dot={false}
                        stroke={["#e4ac72", "#80c6ac", "#8dbce5"][i % 3]}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="empty" style={{ flex: 1 }}>
              <Activity />
              <h3>No simulation results</h3>
              <p style={{ maxWidth: 360 }}>{status}</p>
              <p className="required-note" style={{ maxWidth: 400 }}>
                Nodedistro Labs never substitutes example waveforms for engineering
                results. Supply verified models and connect an
                ngspice-compatible provider.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="notice" style={{ marginTop: 20 }} role="status">
        {status}
      </div>
    </section>
  );
}
