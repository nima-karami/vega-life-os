import { execFileSync } from "node:child_process";
import { isCommitSha } from "./change-scope.mjs";

export function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// --no-renames: a rename otherwise lists only its destination, hiding the slice it left.
export function listChangedFilesSince(baseSha, cwd, headRef = "HEAD") {
  if (!isCommitSha(baseSha) || /^0+$/.test(baseSha)) return undefined;
  try {
    const baseCommit = runGit(["rev-parse", "--verify", "--quiet", `${baseSha}^{commit}`], cwd);
    return runGit(["diff", "--name-only", "--no-renames", baseCommit, headRef], cwd)
      .split("\n")
      .filter(Boolean);
  } catch {
    return undefined;
  }
}
