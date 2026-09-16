import type { DesignDocument } from "@/types/project";

type PinRef = { reference: string; pin: string };
type Result = {
  document: DesignDocument;
  changes: string[];
  skipped: string[];
};

/**
 * Applies only topology fixes that are unambiguous from the generated
 * component labels. It deliberately refuses USB-C CC and enable wiring.
 */
export function autoFixSafeConnectivity(input: DesignDocument): Result {
  const d = structuredClone(input);
  const changes: string[] = [];
  const skipped: string[] = [];
  const component = (reference: string) =>
    d.components.find((c) => c.reference === reference);
  const pinId = (reference: string, pin: string) => {
    const c = component(reference);
    const part = c && d.parts.find((p) => p.id === c.partId);
    const found = part?.pins.find(
      (p) => p.id === pin || p.name.toLowerCase() === pin.toLowerCase(),
    );
    return c && found ? { componentId: c.id, pinId: found.id } : null;
  };
  const connected = (ref: { componentId: string; pinId: string }) =>
    d.nets.find((n) =>
      n.connections.some(
        (x) => x.componentId === ref.componentId && x.pinId === ref.pinId,
      ),
    );
  const ensureNet = (name: string, refs: PinRef[]) => {
    const pins = refs.map((r) => ({
      label: `${r.reference}.${r.pin}`,
      ref: pinId(r.reference, r.pin),
    }));
    const missing = pins.filter((p) => !p.ref);
    if (missing.length) {
      skipped.push(
        `${name}: component or pin not found (${missing.map((p) => p.label).join(", ")})`,
      );
      return;
    }
    const occupied = pins
      .map((p) => ({ ...p, net: connected(p.ref!) }))
      .filter((p) => p.net);
    const foreign = occupied.find((p) => p.net!.name !== name);
    if (foreign) {
      skipped.push(
        `${name}: ${foreign.label} is already connected to ${foreign.net!.name}`,
      );
      return;
    }
    const net =
      d.nets.find((n) => n.name === name) ??
      (() => {
        const created = {
          id: `autofix-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name,
          connections: [] as { componentId: string; pinId: string }[],
        };
        d.nets.push(created);
        return created;
      })();
    for (const p of pins) {
      if (
        !net.connections.some(
          (x) =>
            x.componentId === p.ref!.componentId && x.pinId === p.ref!.pinId,
        )
      ) {
        net.connections.push(p.ref!);
        changes.push(`Connected ${p.label} to ${name}`);
      }
    }
  };
  ensureNet("VBUS", [
    { reference: "J1", pin: "VBUS" },
    { reference: "U3", pin: "VIN" },
    { reference: "C4", pin: "1" },
  ]);
  ensureNet("GND", [
    { reference: "J1", pin: "GND" },
    { reference: "U3", pin: "GND" },
    { reference: "C4", pin: "2" },
    { reference: "C5", pin: "2" },
  ]);
  // The generated regulator pattern uses C5 pin 1 as the output-side
  // capacitor terminal. This is still a logical connection; its footprint
  // polarity and placement require separate physical review.
  ensureNet("VOUT", [
    { reference: "U3", pin: "VOUT" },
    { reference: "C5", pin: "1" },
  ]);
  if (component("J1") && component("R2")) {
    skipped.push(
      "USB-C CC1/CC2: not auto-wired because the design has one resistor and two independent CC pins; choose the intended Rd topology.",
    );
  }
  if (component("U3"))
    skipped.push(
      "U3.EN: not auto-wired; choose an always-on VIN tie or a controlled enable signal.",
    );
  return { document: d, changes, skipped };
}
