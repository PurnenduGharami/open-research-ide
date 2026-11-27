import JSZip from "jszip";
import { saveImportedProject, verifyProjectEvidenceHashes } from "../plugins/research-engine/engine.mjs";
import { ensureWorkspaceScaffold, writeWorkspaceFile } from "./workspace-files.mjs";

export async function importProjectBundle(root, bufferOrString) {
  const isBuffer = Buffer.isBuffer(bufferOrString) || bufferOrString instanceof Uint8Array;
  const buf = isBuffer ? Buffer.from(bufferOrString) : Buffer.from(String(bufferOrString || ""), "utf8");
  if (buf.byteLength < 10) {
    throw new Error("Uploaded bundle is empty");
  }

  // PKZIP signature ("PK\x03\x04")
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const zip = await JSZip.loadAsync(buf);
    const projectEntry = zip.file("research-project.json");
    if (!projectEntry) {
      throw new Error("ZIP bundle is missing research-project.json");
    }
    const rawProject = JSON.parse(await projectEntry.async("string"));
    const savedProject = await saveImportedProject(root, rawProject);
    await ensureWorkspaceScaffold(root, savedProject.projectId, savedProject);

    let filesRestored = 0;
    const entries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith("files/"));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = entry.name.slice("files/".length);
      if (!rel || rel.includes("..")) continue;
      const contentBuf = await entry.async("nodebuffer");
      await writeWorkspaceFile(root, savedProject.projectId, rel, contentBuf);
      filesRestored += 1;
    }

    const hasRoCrate = Boolean(zip.file("ro-crate-metadata.json"));
    const verification = verifyProjectEvidenceHashes(savedProject);
    return { project: savedProject, filesRestored, hasRoCrate, verification };
  }

  // Fallback: raw research-project.json upload
  const rawProject = JSON.parse(buf.toString("utf8"));
  const savedProject = await saveImportedProject(root, rawProject);
  await ensureWorkspaceScaffold(root, savedProject.projectId, savedProject);
  const verification = verifyProjectEvidenceHashes(savedProject);
  return { project: savedProject, filesRestored: 0, hasRoCrate: false, verification };
}
