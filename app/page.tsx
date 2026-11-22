import { listProjects, readProject, recoverInterruptedProjects } from "../plugins/research-engine/engine.mjs";
import { activeProjectIds } from "../src/research-runtime.mjs";
import { projectRoot } from "../src/server-utils";
import AppClient from "./AppClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  await recoverInterruptedProjects(projectRoot, activeProjectIds()).catch(() => {});
  const [project, listed] = await Promise.all([
    readProject(projectRoot),
    listProjects(projectRoot),
  ]);
  return <AppClient initialProject={project} initialProjects={listed.projects} />;
}
