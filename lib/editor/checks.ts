import type { CheckReport, CheckResult, DesignDocument } from "@/types/project";
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function runChecks(d: DesignDocument): CheckReport {
  const results: CheckResult[] = [];
  let total = 0;
  let passed = 0;
  const check = (
    ok: boolean,
    rule: string,
    category: CheckResult["category"],
    severity: CheckResult["severity"],
    message: string,
    objectId?: string,
  ) => {
    total++;
    if (ok) {
      passed++;
      return;
    }
    const id = rule + ":" + (objectId ?? "board");
    results.push({
      id,
      rule,
      category,
      severity,
      message,
      objectId,
      suppressed: d.suppressions.find((s) => s.ruleId === id)?.reason,
    });
  };
  const refs = new Set<string>();
  for (const c of d.components) {
    const p = d.parts.find((p) => p.id === c.partId);
    check(
      !refs.has(c.reference),
      "duplicate-reference",
      "Electrical",
      "error",
      `${c.reference}: duplicate reference`,
      c.id,
    );
    refs.add(c.reference);
    check(
      !!p,
      "missing-part",
      "Components",
      "error",
      `${c.reference}: component definition missing`,
      c.id,
    );
    check(
      !!p?.footprint,
      "missing-footprint",
      "Components",
      "error",
      `${c.reference}: footprint missing`,
      c.id,
    );
    check(
      !!p?.mpn,
      "missing-mpn",
      "Components",
      "warning",
      `${c.reference}: manufacturer part number missing`,
      c.id,
    );
    check(
      p?.lifecycle !== "Obsolete",
      "obsolete-part",
      "Components",
      "warning",
      `${c.reference}: obsolete part`,
      c.id,
    );
    check(
      c.pcbX >= 0 &&
        c.pcbX <= d.board.width &&
        c.pcbY >= 0 &&
        c.pcbY <= d.board.height,
      "placement-bounds",
      "PCB",
      "error",
      `${c.reference}: component origin outside board`,
      c.id,
    );
    for (const pin of p?.pins ?? []) {
      if (pin.required)
        check(
          d.nets.some((n) =>
            n.connections.some(
              (x) => x.componentId === c.id && x.pinId === pin.id,
            ),
          ),
          "floating-" + pin.id,
          "Electrical",
          "error",
          `${c.reference}.${pin.name}: required pin is unconnected`,
          c.id,
        );
    }
  }
  for (const n of d.nets) {
    check(
      n.connections.length >= 2,
      "single-pin-net",
      "Electrical",
      "warning",
      `${n.name}: fewer than two connected pins`,
      n.connections[0]?.componentId,
    );
    const outputs = n.connections.filter((x) => {
      const c = d.components.find((c) => c.id === x.componentId);
      return (
        d.parts
          .find((p) => p.id === c?.partId)
          ?.pins.find((p) => p.id === x.pinId)?.type === "output"
      );
    });
    check(
      outputs.length <= 1,
      "output-conflict",
      "Electrical",
      "error",
      `${n.name}: multiple driven outputs`,
      outputs[0]?.componentId,
    );
    // Route coverage is not inferred from the presence of one trace.
    if (n.connections.length > 1)
      check(
        false,
        "routing-unverified",
        "PCB",
        "warning",
        `${n.name}: pad-to-pad route connectivity is not verified`,
        n.connections[0]?.componentId,
      );
  }
  for (const t of d.traces) {
    check(
      t.width >= d.rules.minWidth,
      "trace-width",
      "PCB",
      "error",
      `Trace ${t.id.slice(0, 6)} is narrower than ${d.rules.minWidth} mm`,
      t.id,
    );
    check(
      t.layer < d.board.layers,
      "trace-layer",
      "PCB",
      "error",
      "Trace is on a layer outside the board stack",
      t.id,
    );
    check(
      t.points.every(
        (p) =>
          p.x - t.width / 2 >= d.rules.edgeClearance &&
          p.y - t.width / 2 >= d.rules.edgeClearance &&
          p.x + t.width / 2 <= d.board.width - d.rules.edgeClearance &&
          p.y + t.width / 2 <= d.board.height - d.rules.edgeClearance,
      ),
      "edge-clearance",
      "PCB",
      "error",
      "Trace copper is too close to the board edge",
      t.id,
    );
  }
  for (const v of d.vias) {
    check(
      v.drill < v.diameter,
      "via-annulus",
      "PCB",
      "error",
      "Via drill must be smaller than its copper diameter",
      v.id,
    );
    check(
      !!d.nets.find((n) => n.id === v.netId),
      "via-net",
      "PCB",
      "error",
      "Via has no valid net",
      v.id,
    );
  }
  for (let i = 0; i < d.traces.length; i++)
    for (let j = i + 1; j < d.traces.length; j++) {
      const a = d.traces[i],
        b = d.traces[j];
      if (a.layer !== b.layer || a.netId === b.netId) continue;
      let minimum = Infinity;
      for (let k = 1; k < a.points.length; k++)
        for (let l = 1; l < b.points.length; l++)
          minimum = Math.min(
            minimum,
            segmentDistance(
              a.points[k - 1],
              a.points[k],
              b.points[l - 1],
              b.points[l],
            ),
          );
      check(
        minimum >= (a.width + b.width) / 2 + d.rules.clearance,
        "trace-clearance-" + j,
        "PCB",
        "error",
        "Different-net traces violate copper clearance",
        a.id,
      );
    }
  return {
    results,
    passed,
    total,
    checkedAt: new Date().toISOString(),
    coverage: [
      "Required logical pins",
      "Duplicate references",
      "Driven output conflicts",
      "Footprint and MPN metadata",
      "Component origins within outline",
      "Trace width and layer",
      "Trace-to-edge and trace-to-trace clearance",
      "Via annulus",
    ],
  };
}
function pointSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const len = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!len) return distance(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len),
  );
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
export function segmentDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
) {
  const cross = (p: typeof a, q: typeof a, r: typeof a) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (
    cross(a, b, c) * cross(a, b, d) < 0 &&
    cross(c, d, a) * cross(c, d, b) < 0
  )
    return 0;
  return Math.min(
    pointSegment(a, c, d),
    pointSegment(b, c, d),
    pointSegment(c, a, b),
    pointSegment(d, a, b),
  );
}
