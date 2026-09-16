import type { DesignDocument } from "@/types/project";
export function bomRows(d: DesignDocument) {
  return d.components.map((c) => {
    const p = d.parts.find((p) => p.id === c.partId);
    return {
      Reference: c.reference,
      Quantity: 1,
      Manufacturer: p?.manufacturer ?? "",
      MPN: p?.mpn ?? "",
      Description: c.value,
      Package: p?.package ?? "",
      Supplier: "Not connected",
      Stock: p?.stock ?? "Unknown",
      "Unit Price": p?.price ?? 0,
      "Extended Price": p?.price ?? 0,
      Lifecycle: p?.lifecycle ?? "Unknown",
      Alternate: "",
    };
  });
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    columns.map(escape).join(","),
    ...rows.map((r) => columns.map((k) => escape(r[k])).join(",")),
  ].join("\r\n");
}
export function placementRows(d: DesignDocument) {
  return d.components.map((c) => ({
    Reference: c.reference,
    "X (mm)": c.pcbX,
    "Y (mm)": c.pcbY,
    "Rotation (deg)": c.rotation,
    Side: c.side,
    Value: c.value,
    Status: "Unverified component origin; check manufacturer convention",
  }));
}
