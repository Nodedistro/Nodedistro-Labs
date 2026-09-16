import { z } from "zod";
export const pinSchema = z.object({
  id: z.string().max(60),
  name: z.string().max(60),
  type: z.enum(["input", "output", "power", "ground", "passive"]),
  required: z.boolean(),
});
export const partSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(160),
  category: z.string().max(60),
  manufacturer: z.string().max(100),
  mpn: z.string().max(100),
  description: z.string().max(600),
  package: z.string().max(100),
  footprint: z.string().max(150),
  datasheet: z.string().max(500),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().nullable(),
  lifecycle: z.enum(["Active", "NRND", "Obsolete", "Unknown"]),
  pins: z.array(pinSchema).max(200),
  tags: z.array(z.string()).max(30),
});
export const componentSchema = z.object({
  id: z.string().max(80),
  partId: z.string().max(80),
  reference: z.string().min(1).max(30),
  value: z.string().max(100),
  x: z.number().finite().min(-10000).max(10000),
  y: z.number().finite().min(-10000).max(10000),
  rotation: z.number().finite(),
  pcbX: z.number().finite(),
  pcbY: z.number().finite(),
  side: z.enum(["top", "bottom"]),
  block: z.string().max(120),
});
export const netSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(80),
  connections: z
    .array(z.object({ componentId: z.string(), pinId: z.string() }))
    .max(500),
});
export const traceSchema = z.object({
  id: z.string(),
  netId: z.string(),
  layer: z.number().int().min(0).max(31),
  width: z.number().positive().max(20),
  points: z
    .array(z.object({ x: z.number().finite(), y: z.number().finite() }))
    .min(2)
    .max(1000),
});
export const rulesSchema = z.object({
  minWidth: z.number().positive(),
  clearance: z.number().positive(),
  viaDiameter: z.number().positive(),
  viaDrill: z.number().positive(),
  edgeClearance: z.number().nonnegative(),
  differentialGap: z.number().positive(),
});
export const documentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000),
  requirements: z.array(z.string().max(1000)).max(100),
  components: z.array(componentSchema).max(1000),
  nets: z.array(netSchema).max(2000),
  parts: z.array(partSchema).max(1000),
  traces: z.array(traceSchema).max(10000),
  vias: z
    .array(
      z.object({
        id: z.string(),
        x: z.number().finite(),
        y: z.number().finite(),
        netId: z.string(),
        diameter: z.number().positive(),
        drill: z.number().positive(),
      }),
    )
    .max(10000),
  annotations: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().max(1000),
        x: z.number(),
        y: z.number(),
      }),
    )
    .max(500),
  board: z.object({
    width: z.number().positive().max(1000),
    height: z.number().positive().max(1000),
    layers: z.union([z.literal(2), z.literal(4), z.literal(6)]),
    thickness: z.number().positive(),
    copperWeight: z.number().positive(),
    finish: z.string().max(60),
    mask: z.string().max(60),
  }),
  rules: rulesSchema,
  suppressions: z
    .array(
      z.object({ ruleId: z.string(), reason: z.string().min(5).max(1000) }),
    )
    .max(1000),
  planApproved: z.boolean(),
});
export type Part = z.infer<typeof partSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Net = z.infer<typeof netSchema>;
export type Trace = z.infer<typeof traceSchema>;
export type DesignDocument = z.infer<typeof documentSchema>;
export type Project = {
  id: string;
  document: DesignDocument;
  revision: number;
  updatedAt: string;
  starred: boolean;
  isPublic: boolean;
  demo: boolean;
  role: "owner" | "editor" | "commenter" | "viewer";
};
export type Operation = {
  id: string;
  type: string;
  before: DesignDocument;
  after: DesignDocument;
  author: string;
  timestamp: string;
};
export type CheckResult = {
  id: string;
  rule: string;
  category: "Electrical" | "PCB" | "Components";
  severity: "error" | "warning";
  message: string;
  objectId?: string;
  suppressed?: string;
};
export type CheckReport = {
  results: CheckResult[];
  checkedAt: string;
  coverage: string[];
  passed: number;
  total: number;
};
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ADD_COMPONENT"), component: componentSchema }),
  z.object({ type: z.literal("REMOVE_COMPONENT"), id: z.string() }),
  z.object({
    type: z.literal("CHANGE_VALUE"),
    id: z.string(),
    value: z.string().max(100),
  }),
  z.object({
    type: z.literal("MOVE_COMPONENT"),
    id: z.string(),
    x: z.number(),
    y: z.number(),
  }),
  z.object({ type: z.literal("CREATE_NET"), net: netSchema }),
  z.object({
    type: z.literal("CONNECT_NET"),
    netId: z.string(),
    componentId: z.string(),
    pinId: z.string(),
  }),
  z.object({
    type: z.literal("DISCONNECT_NET"),
    netId: z.string(),
    componentId: z.string(),
    pinId: z.string(),
  }),
  z.object({
    type: z.literal("ADD_LABEL"),
    id: z.string(),
    text: z.string().max(1000),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal("UPDATE_REQUIREMENT"),
    index: z.number().int().nonnegative(),
    value: z.string().max(1000),
  }),
  z.object({
    type: z.literal("REPLACE_COMPONENT"),
    id: z.string(),
    partId: z.string(),
  }),
]);
export type DesignAction = z.infer<typeof actionSchema>;
export const proposalSchema = z.object({
  message: z.string(),
  reason: z.string(),
  actions: z.array(actionSchema).max(100),
  warnings: z.array(z.string()),
  requiresApproval: z.literal(true),
});
export type Proposal = z.infer<typeof proposalSchema>;
export const planSchema = z.object({
  summary: z.string(),
  requirements: z.array(z.string()),
  architecture: z.array(z.string()),
  blocks: z.array(
    z.object({
      name: z.string(),
      purpose: z.string(),
      components: z.array(z.string()),
    }),
  ),
  powerTree: z.array(z.string()),
  components: z.array(z.object({ partId: z.string(), reason: z.string() })),
  interfaces: z.array(z.string()),
  constraints: z.array(z.string()),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
  nextSteps: z.array(z.string()),
});
export type EngineeringPlan = z.infer<typeof planSchema>;
