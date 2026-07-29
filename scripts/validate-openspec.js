import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const openspecCli = fileURLToPath(
  new URL("../node_modules/@fission-ai/openspec/bin/openspec.js", import.meta.url),
);
const projects = [
  repositoryRoot,
  fileURLToPath(
    new URL("../demo/representative-openspec", import.meta.url),
  ),
];

for (const cwd of projects) {
  const result = spawnSync(
    process.execPath,
    [openspecCli, "validate", "--all", "--strict", "--no-interactive"],
    {
      cwd,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
