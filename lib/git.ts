import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { repoCachePath } from "./paths";

const run = promisify(execFile);

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a git URL to a local checkout, cloning on first use. The clone is cached by
 * normalized URL and reused across Maps and sessions; it is never re-pulled implicitly,
 * so a Map's Nodes don't shift under the user mid-exploration.
 */
export async function ensureClone(url: string): Promise<string> {
  const target = repoCachePath(url);
  if (await exists(target)) return target;
  await run("git", ["clone", "--depth", "1", url, target], {
    timeout: 10 * 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return target;
}

/** Explicit refresh: pull the latest commit for a cached clone. */
export async function refreshClone(url: string): Promise<{ path: string; head: string }> {
  const target = await ensureClone(url);
  await run("git", ["fetch", "--depth", "1", "origin"], { cwd: target, timeout: 10 * 60_000 });
  const { stdout: branch } = await run(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd: target },
  );
  await run("git", ["reset", "--hard", `origin/${branch.trim()}`], { cwd: target });
  const { stdout: head } = await run("git", ["rev-parse", "--short", "HEAD"], { cwd: target });
  return { path: target, head: head.trim() };
}
