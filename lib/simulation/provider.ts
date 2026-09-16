import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/db/server";
import type { DesignDocument } from "@/types/project";
export const simulationRequestSchema = z
  .object({
    analysis: z.enum(["dc", "sweep", "transient", "ac"]),
    stop: z.number().positive().max(1e9),
    step: z.number().positive(),
    netlist: z.string().min(10).max(100000),
    revision: z.number().int().nonnegative(),
  })
  .refine((v) => v.step <= v.stop, "Step must not exceed stop");
const simulationResultSchema = z.object({
  samples: z
    .array(z.record(z.string(), z.number().finite()))
    .min(1)
    .max(100000),
  signals: z.array(z.string()).min(1).max(20),
  xLabel: z.string(),
  provenance: z.string().min(1),
});
export interface SimulationProvider {
  run(
    input: z.infer<typeof simulationRequestSchema>,
    document: DesignDocument,
  ): Promise<z.infer<typeof simulationResultSchema>>;
}
export const simulationProvider: SimulationProvider = {
  async run(input, document) {
    if (!process.env.SIMULATION_PROVIDER_URL)
      throw new HttpError(503, "Simulation engine not configured.");
    if (
      /(?:\.control|\.include|\.lib|shell|source|wrdata|write)\b/i.test(
        input.netlist,
      )
    )
      throw new HttpError(
        400,
        "Netlist file access and control commands are not allowed. Provide an inline, model-complete netlist.",
      );
    const url = new URL(process.env.SIMULATION_PROVIDER_URL);
    if (url.protocol !== "https:")
      throw new HttpError(503, "Simulation provider requires HTTPS.");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (process.env.SIMULATION_PROVIDER_KEY ?? ""),
      },
      body: JSON.stringify({ input, document }),
      signal: AbortSignal.timeout(45000),
      redirect: "error",
    });
    if (!response.ok)
      throw new HttpError(
        502,
        "Simulation provider failed. Check its configuration.",
      );
    const text = await response.text();
    if (text.length > 10_000_000)
      throw new HttpError(502, "Simulation result exceeds the size limit.");
    return simulationResultSchema.parse(JSON.parse(text));
  },
};
