import { readProject } from "../plugins/research-engine/engine.mjs";
import { projectRoot } from "../src/server-utils";
import AppClient from "./AppClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const project = await readProject(projectRoot);
  return <AppClient initialProject={project} />;
}
