"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PricingCards() {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function checkout(plan: string) {
    setBusy(plan);
    setError("");
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout unavailable.");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      {error && (
        <div className="notice" role="alert" style={{ marginTop: 20 }}>
          {error}
        </div>
      )}
      <div className="price-cards">
        {[
          {
            id: "free",
            name: "Free",
            subtitle: "Room for the first spark.",
            price: "$0",
            features: [
              "3 cloud projects",
              "20 AI requests / month",
              "Schematic and PCB editing",
              "Local demo workspace",
            ],
          },
          {
            id: "pro",
            name: "Pro",
            subtitle: "For ideas that keep growing.",
            price: "Configured at checkout",
            features: [
              "100 cloud projects",
              "500 AI requests / month",
              "Project checkpoints",
              "Configured simulation & exports",
            ],
          },
          {
            id: "team",
            name: "Team",
            subtitle: "More room to create together.",
            price: "Configured at checkout",
            features: [
              "1,000 cloud projects",
              "2,000 AI requests / month",
              "Project sharing and permissions",
              "Expanded usage allowance",
            ],
          },
        ].map((plan) => (
          <article
            className={"price-card " + (plan.id === "pro" ? "featured" : "")}
            key={plan.id}
          >
            <div className="between">
              <h3>{plan.name}</h3>
              {plan.id === "pro" && (
                <span className="badge amber">FOR BUILDERS</span>
              )}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              {plan.subtitle}
            </p>
            <div
              className="price"
              style={{ fontSize: plan.id === "free" ? 38 : 21 }}
            >
              {plan.price}
            </div>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>
                  <Check size={14} />
                  {f}
                </li>
              ))}
            </ul>
            {plan.id === "free" ? (
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  Start designing <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button
                variant={plan.id === "pro" ? "default" : "outline"}
                disabled={!!busy}
                onClick={() => checkout(plan.id)}
              >
                {busy === plan.id ? "Opening checkout…" : "Choose " + plan.name}
                <ArrowRight />
              </Button>
            )}
          </article>
        ))}
      </div>
      <p className="required-note" style={{ marginTop: 20 }}>
        Paid prices are set in your Stripe account and displayed before payment.
        Simulation and fabrication capabilities depend on configured providers.
      </p>
    </>
  );
}
