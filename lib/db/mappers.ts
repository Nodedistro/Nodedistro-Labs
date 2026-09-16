import type { Project } from "@/types/project";
// Map database transport records at the boundary; never trust client-provided roles.
export function projectFromRow(
  row: Record<string, unknown>,
  role = "viewer",
): Project {
  return {
    id: String(row.id),
    document: row.document as Project["document"],
    revision: Number(row.revision),
    updatedAt: String(row.updated_at),
    starred: false,
    isPublic: row.is_public === true,
    demo: false,
    role: role as Project["role"],
  };
}
