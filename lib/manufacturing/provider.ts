import "server-only";
import type { DesignDocument } from "@/types/project";
import { HttpError } from "@/lib/db/server";
export interface ManufacturingProvider {
  exportGerber(document: DesignDocument): Promise<ArrayBuffer>;
}
export const manufacturingProvider: ManufacturingProvider = {
  async exportGerber(document) {
    if (!process.env.MANUFACTURING_PROVIDER_URL)
      throw new HttpError(503, "Fabrication exporter not configured.");
    const url = new URL(process.env.MANUFACTURING_PROVIDER_URL);
    if (url.protocol !== "https:")
      throw new HttpError(503, "Manufacturing provider requires HTTPS.");
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Bearer " + (process.env.MANUFACTURING_PROVIDER_KEY ?? ""),
      },
      body: JSON.stringify({
        format: "gerber",
        document,
        requireVerifiedFootprints: true,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok)
      throw new HttpError(
        502,
        "Fabrication provider rejected this design. Verify geometry and footprints.",
      );
    if (!r.headers.get("content-type")?.includes("application/zip"))
      throw new HttpError(
        502,
        "Provider did not return a fabrication ZIP archive.",
      );
    const data = await r.arrayBuffer();
    if (data.byteLength > 25_000_000)
      throw new HttpError(502, "Fabrication archive exceeds size limit.");
    const magic = new Uint8Array(data);
    if (magic[0] !== 80 || magic[1] !== 75)
      throw new HttpError(502, "Invalid archive returned by provider.");
    return data;
  },
};
