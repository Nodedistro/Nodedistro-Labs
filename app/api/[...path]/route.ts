import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { apiError, jsonBody, sameOrigin, rateLimit } from "@/lib/http";
import {
  authenticate,
  authorizeProject,
  serverDb,
  HttpError,
} from "@/lib/db/server";
import { projectFromRow } from "@/lib/db/mappers";
import { documentSchema, proposalSchema, partSchema } from "@/types/project";
import { validateTopology, applyActions } from "@/lib/editor/actions";
import { runChecks } from "@/lib/editor/checks";
import { searchCatalog } from "@/lib/components/catalog";
import { createPlan, chat, review } from "@/lib/ai/provider";
import {
  simulationProvider,
  simulationRequestSchema,
} from "@/lib/simulation/provider";
import { manufacturingProvider } from "@/lib/manufacturing/provider";
import { bomRows, csv, placementRows } from "@/lib/manufacturing/exports";
import { billingRequest, webhook } from "@/lib/billing";
export const runtime = "nodejs";
export const maxDuration = 60;
const uuid = z.string().uuid();
const commentMap = (c: Record<string, unknown>) => ({
  id: c.id,
  projectId: c.project_id,
  objectId: c.object_id,
  parentId: c.parent_id,
  text: c.body,
  resolved: c.resolved,
  author: "Collaborator " + String(c.author_id).slice(0, 6),
  createdAt: c.created_at,
});
function dbError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "PGRST205" || error.code === "42P01")
    throw new HttpError(
      503,
      "Cloud database setup is incomplete. Apply supabase/schema.sql to the configured Supabase project. Local demo projects remain available.",
    );
  if (error.message.includes("revision_conflict"))
    throw new HttpError(
      409,
      "Conflict detected. Export your local changes, then reload the latest project.",
    );
  if (error.message.includes("Project limit"))
    throw new HttpError(403, "Your plan’s project limit has been reached.");
  throw new HttpError(
    503,
    "The database could not complete this operation. Check the schema and permissions.",
  );
}
async function aiQuota() {
  const { db } = await authenticate();
  const { data, error } = await db.rpc("pcb_consume_ai");
  dbError(error);
  if (!data)
    throw new HttpError(
      429,
      "Your monthly AI request allowance has been reached.",
    );
}
async function dispatch(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params,
      route = path.join("/"),
      method = request.method,
      url = new URL(request.url);
    if (route === "billing/webhook" && method === "POST")
      return await webhook(request);
    if (method !== "GET") {
      sameOrigin(request);
      await rateLimit(
        route.startsWith("ai/") ? "ai" : "mutations",
        route.startsWith("ai/") ? 10 : 60,
      );
    }
    if (route === "health" && method === "GET")
      return Response.json({
        application: "Nodedistro Labs",
        cloud: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        ai: !!process.env.OPENAI_API_KEY,
        simulation: !!process.env.SIMULATION_PROVIDER_URL,
        fabrication: !!process.env.MANUFACTURING_PROVIDER_URL,
      });
    if (route === "components/search" && method === "GET") {
      const query = z
        .string()
        .max(200)
        .parse(url.searchParams.get("q") ?? "");
      return Response.json({
        components: searchCatalog(query),
        source: "illustrative catalog",
        liveInventory: false,
      });
    }
    if (route === "explore" && method === "GET") {
      const db = await serverDb();
      const { data, error } = await db
        .from("pcb_projects")
        .select("*")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(60);
      dbError(error);
      return Response.json({
        projects: data?.map((r) => projectFromRow(r)) ?? [],
      });
    }
    if (route === "projects" && method === "GET") {
      const { db, user } = await authenticate();
      const { data, error } = await db
        .from("pcb_projects")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);
      dbError(error);
      const { data: members } = await db
        .from("pcb_project_members")
        .select("project_id,role")
        .eq("user_id", user.id);
      return Response.json({
        projects: (data ?? [])
          .filter(
            (p) =>
              p.owner_id === user.id ||
              members?.some((m) => m.project_id === p.id),
          )
          .map((p) =>
            projectFromRow(
              p,
              p.owner_id === user.id
                ? "owner"
                : (members?.find((m) => m.project_id === p.id)?.role ??
                    "viewer"),
            ),
          ),
      });
    }
    if (route === "projects" && method === "POST") {
      const { db } = await authenticate();
      const body = z
        .object({ document: documentSchema, planId: uuid.optional() })
        .parse(await jsonBody(request));
      validateTopology(body.document);
      const { data, error } = await db.rpc("pcb_create_project", {
        p_document: body.document,
        p_plan_id: body.planId ?? null,
      });
      dbError(error);
      return Response.json(
        { project: projectFromRow(data, "owner") },
        { status: 201 },
      );
    }
    if (path[0] === "projects" && path[1]) {
      const id = uuid.parse(path[1]);
      const write = method !== "GET";
      const { db, user, project, role } = await authorizeProject(
        id,
        write && path[2] !== "comments",
      );
      if (path.length === 2 && method === "GET")
        return Response.json({ project: projectFromRow(project, role) });
      if (path.length === 2 && method === "PATCH") {
        const body = z
          .object({
            document: documentSchema,
            revision: z.number().int().nonnegative(),
            description: z.string().max(200),
          })
          .parse(await jsonBody(request));
        validateTopology(body.document);
        const { data, error } = await db.rpc("pcb_save_project", {
          p_id: id,
          p_revision: body.revision,
          p_document: body.document,
          p_description: body.description,
        });
        dbError(error);
        return Response.json({ project: projectFromRow(data, role) });
      }
      if (path[2] === "checks" && method === "POST") {
        const report = runChecks(documentSchema.parse(project.document));
        const { error } = await db.from("pcb_drc_results").insert({
          project_id: id,
          data: { ...report, revision: project.revision },
        });
        dbError(error);
        return Response.json(report);
      }
      if (path[2] === "simulate" && method === "POST") {
        const input = simulationRequestSchema.parse(await jsonBody(request));
        if (input.revision !== project.revision)
          throw new HttpError(409, "Save the latest design before simulating.");
        const result = await simulationProvider.run(
          input,
          documentSchema.parse(project.document),
        );
        const { error } = await db.from("pcb_simulations").insert({
          project_id: id,
          data: { input, result, revision: project.revision },
        });
        dbError(error);
        await db.rpc("pcb_record_usage", { p_simulations: 1 });
        return Response.json(result);
      }
      if (path[2] === "export" && method === "POST") {
        const input = z
          .object({
            format: z.enum(["gerber", "bom", "placement", "archive"]),
            revision: z.number().int(),
          })
          .parse(await jsonBody(request));
        if (input.revision !== project.revision)
          throw new HttpError(409, "Save the latest design before exporting.");
        const doc = documentSchema.parse(project.document);
        if (input.format === "gerber") {
          const archive = await manufacturingProvider.exportGerber(doc);
          await db.from("pcb_manufacturing_exports").insert({
            project_id: id,
            data: {
              format: "gerber",
              revision: project.revision,
              status: "provider-generated",
              manufacturerVerified: false,
            },
          });
          await db.rpc("pcb_record_usage", { p_exports: 1 });
          return new Response(archive, {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": 'attachment; filename="fabrication.zip"',
            },
          });
        }
        const content =
          input.format === "archive"
            ? JSON.stringify({
                format: "nodedistro-labs",
                version: 1,
                document: doc,
              })
            : csv(input.format === "bom" ? bomRows(doc) : placementRows(doc));
        await db.rpc("pcb_record_usage", { p_exports: 1 });
        return new Response(content, {
          headers: {
            "Content-Type":
              input.format === "archive" ? "application/json" : "text/csv",
            "Content-Disposition": `attachment; filename="${input.format}.${input.format === "archive" ? "json" : "csv"}"`,
          },
        });
      }
      if (path[2] === "versions" && method === "GET") {
        const { data, error } = await db
          .from("pcb_versions")
          .select("*")
          .eq("project_id", id)
          .order("created_at", { ascending: false })
          .limit(100);
        dbError(error);
        return Response.json({
          versions: data?.map((v) => ({
            id: v.id,
            name: v.name,
            document: v.document,
            revision: v.revision,
            createdAt: v.created_at,
          })),
        });
      }
      if (path[2] === "versions" && method === "POST") {
        const body = z
          .object({
            name: z.string().trim().min(1).max(120),
            revision: z.number().int(),
          })
          .parse(await jsonBody(request));
        const { data, error } = await db.rpc("pcb_checkpoint", {
          p_id: id,
          p_revision: body.revision,
          p_name: body.name,
        });
        dbError(error);
        return Response.json({
          version: {
            id: data!.id,
            name: data.name,
            document: data.document,
            createdAt: data.created_at,
          },
        });
      }
      if (path[2] === "publish" && method === "POST") {
        if (role !== "owner")
          throw new HttpError(403, "Only the owner can change visibility.");
        const { isPublic } = z
          .object({ isPublic: z.boolean() })
          .parse(await jsonBody(request));
        const { error } = await db.rpc("pcb_publish_project", {
          p_id: id,
          p_public: isPublic,
        });
        dbError(error);
        return Response.json({ isPublic });
      }
      if (path[2] === "comments" && method === "GET") {
        const { data, error } = await db
          .from("pcb_comments")
          .select("*")
          .eq("project_id", id)
          .order("created_at")
          .limit(500);
        dbError(error);
        return Response.json({ comments: data?.map(commentMap) ?? [] });
      }
      if (path[2] === "comments" && method === "POST") {
        if (!["owner", "editor", "commenter"].includes(role))
          throw new HttpError(403, "Comment permission is required.");
        const body = z
          .object({
            text: z.string().trim().min(1).max(4000),
            objectId: z.string().max(100).optional(),
            parentId: uuid.optional(),
          })
          .parse(await jsonBody(request));
        if (body.parentId) {
          const { data: parent } = await db
            .from("pcb_comments")
            .select("id")
            .eq("id", body.parentId)
            .eq("project_id", id)
            .maybeSingle();
          if (!parent) throw new HttpError(400, "Reply target not found.");
        }
        const { data, error } = await db
          .from("pcb_comments")
          .insert({
            project_id: id,
            author_id: user.id,
            body: body.text,
            object_id: body.objectId,
            parent_id: body.parentId,
          })
          .select()
          .single();
        dbError(error);
        return Response.json({ comment: commentMap(data) });
      }
      if (path[2] === "comments" && method === "PATCH") {
        if (!["owner", "editor", "commenter"].includes(role))
          throw new HttpError(403, "Comment permission is required.");
        const body = z
          .object({ id: uuid, resolved: z.boolean() })
          .parse(await jsonBody(request));
        const { data, error } = await db
          .from("pcb_comments")
          .update({
            resolved: body.resolved,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.id)
          .eq("project_id", id)
          .select("id")
          .single();
        dbError(error);
        return Response.json({ id: data!.id });
      }
    }
    if (route === "ai/plan" && method === "POST") {
      const { db, user } = await authenticate();
      const input = z
        .object({
          prompt: z.string().min(10).max(8000),
          requirements: z
            .record(z.string().max(100), z.string().max(200))
            .refine((r) => Object.keys(r).length <= 30),
        })
        .parse(await jsonBody(request));
      if (!process.env.OPENAI_API_KEY)
        throw new HttpError(
          503,
          "AI unavailable: configure your server-side OpenAI key.",
        );
      await aiQuota();
      const { plan, tokens } = await createPlan(
        input.prompt,
        input.requirements,
      );
      const { data, error } = await db
        .from("pcb_ai_plans")
        .insert({ user_id: user.id, prompt: input.prompt, plan })
        .select("id")
        .single();
      dbError(error);
      await db.rpc("pcb_record_usage", { p_tokens: tokens });
      return Response.json({ id: data!.id, plan });
    }
    if ((route === "ai/chat" || route === "ai/review") && method === "POST") {
      const input = z
        .object({
          projectId: uuid,
          prompt: z.string().min(1).max(8000).optional(),
          revision: z.number().int(),
        })
        .parse(await jsonBody(request));
      const { db, user, project } = await authorizeProject(
        input.projectId,
        true,
      );
      if (project.revision !== input.revision)
        throw new HttpError(409, "Save your latest changes before asking AI.");
      if (!process.env.OPENAI_API_KEY)
        throw new HttpError(
          503,
          "AI unavailable: configure your server-side OpenAI key.",
        );
      await aiQuota();
      const doc = documentSchema.parse(project.document);
      if (route === "ai/review") {
        const result = await review(doc);
        await db.rpc("pcb_record_usage", { p_tokens: result.tokens });
        await db.from("pcb_ai_messages").insert({
          project_id: project.id,
          data: {
            kind: "review",
            result: result.review,
            revision: project.revision,
          },
        });
        return Response.json(result.review);
      }
      const { proposal, tokens } = await chat(
        input.prompt ?? "Review this design.",
        doc,
      );
      if (proposal.actions.length) applyActions(doc, proposal.actions);
      const { data, error } = await db
        .from("pcb_ai_actions")
        .insert({
          project_id: project.id,
          user_id: user.id,
          proposal,
          base_revision: project.revision,
        })
        .select("id")
        .single();
      dbError(error);
      await db.from("pcb_ai_messages").insert({
        project_id: project.id,
        data: {
          prompt: input.prompt,
          response: proposal.message,
          revision: project.revision,
        },
      });
      await db.rpc("pcb_record_usage", { p_tokens: tokens });
      return Response.json({
        ...proposal,
        id: data!.id,
        revision: project.revision,
      });
    }
    if (route === "ai/actions" && method === "POST") {
      const input = z
        .object({
          proposalId: uuid,
          decision: z.enum(["apply", "reject"]),
          revision: z.number().int(),
        })
        .parse(await jsonBody(request));
      const { db, user } = await authenticate();
      const { data: stored, error } = await db
        .from("pcb_ai_actions")
        .select("*")
        .eq("id", input.proposalId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single();
      if (error || !stored)
        throw new HttpError(404, "Proposal is no longer available.");
      const { project, role } = await authorizeProject(stored.project_id, true);
      if (input.decision === "reject") {
        const { error } = await db.rpc("pcb_reject_proposal", {
          p_id: stored.id,
        });
        dbError(error);
        return Response.json({ status: "rejected" });
      }
      if (
        project.revision !== input.revision ||
        stored.base_revision !== input.revision
      )
        throw new HttpError(
          409,
          "This proposal is out of date. Request a new proposal for the current design.",
        );
      const proposal = proposalSchema.parse(stored.proposal),
        doc = applyActions(
          documentSchema.parse(project.document),
          proposal.actions,
        );
      const { data, error: saveError } = await db.rpc("pcb_save_project", {
        p_id: project.id,
        p_revision: input.revision,
        p_document: doc,
        p_description: "Approved AI proposal",
        p_proposal_id: stored.id,
      });
      dbError(saveError);
      return Response.json({ project: projectFromRow(data, role) });
    }
    if (route === "invitations" && method === "POST") {
      const input = z
        .object({
          projectId: uuid,
          email: z.email().max(254),
          role: z.enum(["viewer", "commenter", "editor"]),
        })
        .parse(await jsonBody(request));
      const { db, user, role } = await authorizeProject(input.projectId, true);
      if (role !== "owner")
        throw new HttpError(403, "Only the owner can invite collaborators.");
      const token = randomBytes(32).toString("hex"),
        hash = createHash("sha256").update(token).digest("hex");
      const { error } = await db.from("pcb_invitations").insert({
        project_id: input.projectId,
        email: input.email.toLowerCase(),
        role: input.role,
        created_by: user.id,
        token_hash: hash,
      });
      dbError(error);
      return Response.json({
        url:
          process.env.NEXT_PUBLIC_APP_URL +
          "/invitations/accept?token=" +
          token,
      });
    }
    if (route === "invitations/accept" && method === "POST") {
      const { db } = await authenticate();
      const { token } = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(await jsonBody(request));
      const { data, error } = await db.rpc("pcb_accept_invitation", {
        p_hash: createHash("sha256").update(token).digest("hex"),
      });
      if (error)
        throw new HttpError(
          403,
          "Invitation expired or does not match your verified email.",
        );
      return Response.json({ projectId: data });
    }
    if (route === "usage" && method === "GET") {
      const { db, user } = await authenticate();
      const { data: usage } = await db
        .from("pcb_usage")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", new Date().toISOString().slice(0, 7) + "-01")
        .maybeSingle();
      const { data: subscription } = await db
        .from("pcb_subscriptions")
        .select("plan,status")
        .eq("user_id", user.id)
        .maybeSingle();
      return Response.json({
        usage: usage ?? {
          ai_requests: 0,
          ai_tokens: 0,
          simulations: 0,
          exports: 0,
        },
        subscription: subscription ?? { plan: "free", status: "inactive" },
      });
    }
    if (route === "libraries" && method === "GET") {
      const { db, user } = await authenticate();
      const { data, error } = await db
        .from("pcb_custom_components")
        .select("*")
        .eq("owner_id", user.id);
      dbError(error);
      return Response.json({ components: data ?? [] });
    }
    if (route === "components" && method === "POST") {
      const { db, user } = await authenticate();
      const input = partSchema.parse(await jsonBody(request));
      const { data, error } = await db
        .from("pcb_custom_components")
        .insert({ owner_id: user.id, name: input.name, data: input })
        .select()
        .single();
      dbError(error);
      return Response.json({ component: data });
    }
    if (route.startsWith("billing/") && method === "POST")
      return await billingRequest(route, request);
    throw new HttpError(404, "Endpoint not found.");
  } catch (e) {
    return apiError(e);
  }
}
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const response = await dispatch(request, context);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export { handler as GET, handler as POST, handler as PATCH };
