import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { WorkspacePage } from "@/components/workspace/pages";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (["projects", "recent", "shared"].includes(section))
    return <Dashboard filter={section} />;
  if (
    [
      "components",
      "libraries",
      "templates",
      "teams",
      "usage",
      "billing",
      "settings",
    ].includes(section)
  )
    return <WorkspacePage section={section} />;
  notFound();
}
