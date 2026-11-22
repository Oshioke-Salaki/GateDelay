import { execFileSync } from "node:child_process";

const sourceExtensions = /\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/i;
const markdownFence = /^\s*(?:`{3,}|~{3,})/;

function runGit(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...options });
}

let stagedFiles;
try {
  stagedFiles = runGit([
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
    "-z",
  ]).split("\0").filter((file) => sourceExtensions.test(file));
} catch (error) {
  console.error(`Unable to inspect staged files: ${error.message}`);
  process.exit(2);
}

const failures = [];
for (const file of stagedFiles) {
  let content;
  try {
    content = runGit(["show", `:${file}`]);
  } catch (error) {
    console.error(`Unable to read staged file ${file}: ${error.message}`);
    process.exitCode = 2;
    continue;
  }

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (markdownFence.test(line)) {
      failures.push(`${file}:${index + 1}: Markdown code fence found in staged source`);
    }
  }
}

if (failures.length > 0) {
  console.error(`${failures.join("\n")}\nRemove copied Markdown fences and rerun npm run check:staged-source.`);
  process.exitCode = 1;
} else {
  console.log(`Staged source check passed (${stagedFiles.length} file${stagedFiles.length === 1 ? "" : "s"}).`);
}