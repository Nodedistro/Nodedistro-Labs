"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Sparkles,
  Layers,
  MousePointer2,
  CheckCircle2,
  GitBranch,
  Users,
  Box,
  Cpu,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BoardPreview } from "@/components/pcb/board-preview";
import { demoDocument } from "@/lib/editor/demo";
export function PublicNav() {
  return (
    <nav className="public-nav">
      <Logo />
      <div className="nav-links">
        <Link href="/#workflow">Workflow</Link>
        <Link href="/explore">Explore projects</Link>
        <Link href="/pricing">Pricing</Link>
      </div>
      <div className="row">
        <Button asChild variant="ghost">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">
            Open workspace <ArrowRight />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
const options = {
  device: [
    "environmental sensor",
    "IoT controller",
    "LED controller",
    "data logger",
    "audio controller",
    "robotics control board",
    "smart home sensor",
    "development board",
    "battery monitoring board",
  ],
  connectivity: [
    "Wi-Fi + Bluetooth",
    "Wi-Fi",
    "Bluetooth Low Energy",
    "USB",
    "Ethernet",
    "CAN",
    "I2C",
    "SPI",
    "UART",
    "LoRaWAN",
    "Zigbee",
    "none",
  ],
  power: [
    "USB-C 5V",
    "USB-C Power Delivery",
    "battery",
    "AA batteries",
    "DC input",
    "solar",
    "external regulated supply",
  ],
  application: [
    "prototype",
    "consumer electronics",
    "education",
    "robotics",
    "IoT",
    "industrial electronics",
    "research",
  ],
};
export default function Home() {
  const router = useRouter();
  const [values, setValues] = useState({
    device: options.device[0],
    connectivity: options.connectivity[0],
    power: options.power[0],
    application: options.application[0],
  });
  const [prompt, setPrompt] = useState("");
  const start = () =>
    router.push(
      "/projects/new?prompt=" +
        encodeURIComponent(
          prompt ||
            `Create an ${values.device} with ${values.connectivity}, powered by ${values.power}, for ${values.application}.`,
        ),
    );
  return (
    <div className="public">
      <PublicNav />
      <main>
        <section className="hero">
          <span className="pill">
            <Sparkles size={12} /> A new workspace for hardware ideas
          </span>
          <h1>
            Great electronics start
            <br />
            with <em>an idea.</em>
          </h1>
          <p>
            Turn the circuit in your head into something you can hold. Plan with
            AI, design with precision, and stay in control of every connection.
          </p>
          <div className="row">
            <Button onClick={start} variant="secondary">
              Start designing <ArrowRight />
            </Button>
            <Button asChild variant="outline">
              <Link href="/explore">Explore projects</Link>
            </Button>
          </div>
          <div className="idea-builder">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              WHAT WILL YOU BUILD?
            </div>
            <div className="idea-sentence">
              Make me a{" "}
              <select
                aria-label="Device"
                value={values.device}
                onChange={(e) =>
                  setValues({ ...values, device: e.target.value })
                }
              >
                {options.device.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>{" "}
              with{" "}
              <select
                aria-label="Connectivity"
                value={values.connectivity}
                onChange={(e) =>
                  setValues({ ...values, connectivity: e.target.value })
                }
              >
                {options.connectivity.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>{" "}
              powered by{" "}
              <select
                aria-label="Power"
                value={values.power}
                onChange={(e) =>
                  setValues({ ...values, power: e.target.value })
                }
              >
                {options.power.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>{" "}
              for{" "}
              <select
                aria-label="Application"
                value={values.application}
                onChange={(e) =>
                  setValues({ ...values, application: e.target.value })
                }
              >
                {options.application.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              .
            </div>
            <div className="idea-prompt">
              <input
                className="input"
                aria-label="Describe anything instead"
                placeholder="Or describe anything instead…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") start();
                }}
              />
              <Button variant="secondary" onClick={start}>
                <Sparkles /> Build an engineering plan
              </Button>
            </div>
          </div>
          <div className="public-preview">
            <div className="preview-bar">
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span className="preview-dot" />
              <span style={{ marginLeft: 16 }}>Wi-Fi Environmental Sensor</span>
              <span className="spacer" />
              <span>PCB / Placement study</span>
            </div>
            <div className="preview-workspace">
              <div className="preview-side">
                <div className="eyebrow">PROJECT EXPLORER</div>
                <p>⌄ Environmental sensor</p>
                <p>　 Schematic</p>
                <p style={{ color: "#e4ac72" }}>　 PCB layout</p>
                <p>　 Bill of materials</p>
                <hr />
                <div className="eyebrow">LAYERS</div>
                <p>Top copper</p>
                <p>Bottom copper</p>
                <p>Top silkscreen</p>
              </div>
              <Link
                href="/project/demo-sensor"
                className="preview-center"
                aria-label="Open interactive demo editor"
              >
                <BoardPreview document={demoDocument()} />
              </Link>
              <div className="preview-side">
                <div className="row" style={{ color: "#e4ac72" }}>
                  <Sparkles size={15} /> Your engineering copilot
                </div>
                <p style={{ lineHeight: 1.9 }}>
                  Every good design starts with the right questions.
                </p>
                <p>
                  Review the power architecture, inspect component choices, and
                  approve each proposed change.
                </p>
                <Link
                  href="/project/demo-sensor"
                  style={{
                    display: "inline-block",
                    color: "#e4ac72",
                    marginTop: 20,
                  }}
                >
                  Try the demo workspace →
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section id="workflow" className="public-section">
          <div className="eyebrow">FROM FIRST THOUGHT TO FIRST BOARD</div>
          <h2 style={{ marginTop: 15 }}>
            One workspace.
            <br />
            Every part of the process.
          </h2>
          <div className="steps-grid">
            {[
              [
                "Describe",
                "Start with what you want to make. A few words, a detailed brief, or something in between.",
              ],
              [
                "Plan",
                "Review requirements, power architecture, component choices, and explicit assumptions.",
              ],
              [
                "Schematic",
                "Place parts, make connections, and refine the circuit with a contextual AI assistant.",
              ],
              [
                "Layout",
                "Shape your board, position components, and manually route copper across layers.",
              ],
              [
                "Validate",
                "Inspect deterministic checks. Run a real simulation when your provider is connected.",
              ],
              [
                "Manufacture",
                "Review the BOM, export design data, and connect a verified fabrication exporter.",
              ],
            ].map(([title, copy], i) => (
              <article className="step" key={title}>
                <span className="number">0{i + 1} /</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="public-section" style={{ paddingTop: 10 }}>
          <div className="between">
            <div>
              <div className="eyebrow">ENGINEERING, WITH INTENTION</div>
              <h2 style={{ marginTop: 15 }}>
                Your decisions.
                <br />A little more superpower.
              </h2>
            </div>
            <Button asChild variant="secondary">
              <Link href="/project/demo-sensor">
                Explore the editor <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="steps-grid">
            {[
              [
                Cpu,
                "Component intelligence",
                "Search a structured library, manage your BOM, and track missing supply-chain information.",
              ],
              [
                GitBranch,
                "A history you can trust",
                "Create checkpoints, inspect changes, and restore earlier work without erasing history.",
              ],
              [
                Users,
                "Built to work together",
                "Share projects with explicit roles, add comments, and connect live presence.",
              ],
              [
                MousePointer2,
                "Precise schematic capture",
                "An infinite canvas, logical pins, net labels, and reversible editing operations.",
              ],
              [
                CheckCircle2,
                "Honest validation",
                "Rule checks, AI recommendations, and provider results remain clearly distinct.",
              ],
              [
                Box,
                "See the bigger picture",
                "Move between schematics, board placement, a simplified 3D view, and manufacturing review.",
              ],
            ].map(([Icon, title, copy]) => {
              const I = Icon as typeof Layers;
              return (
                <article className="step" key={String(title)}>
                  <I size={21} />
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <Logo />
        <span>Thoughtfully connected. Independently designed.</span>
        <Link href="/pricing">Plans & pricing</Link>
      </footer>
    </div>
  );
}
