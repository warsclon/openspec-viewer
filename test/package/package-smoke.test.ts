import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startCliProcess,
  type CliProcess,
} from "../helpers/cli-process.js";
import {
  createTestProject,
  type TestProject,
} from "../helpers/fixture.js";

type PackedFile = {
  path: string;
  size: number;
  mode: number;
};

type PackResult = {
  filename: string;
  files: PackedFile[];
  entryCount: number;
  name: string;
  version: string;
};

const repositoryRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
) as {
  name: string;
  version: string;
  license: string;
  dependencies?: Record<string, string>;
};

let tempRoot = "";
let installDir = "";
let tarballPath = "";
let pack: PackResult;
let installedBin = "";
let project: TestProject | undefined;
let cli: CliProcess | undefined;
const staleHostedOutput = join(
  repositoryRoot,
  "dist",
  "hosted-demo",
  "stale-demo.txt",
);

const expectedPackedFiles = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "demo/representative-openspec/openspec/changes/add-dark-mode/design.md",
  "demo/representative-openspec/openspec/changes/add-dark-mode/proposal.md",
  "demo/representative-openspec/openspec/changes/add-dark-mode/specs/interface/spec.md",
  "demo/representative-openspec/openspec/changes/add-dark-mode/tasks.md",
  "demo/representative-openspec/openspec/changes/archive/2026-07-01-legacy-search/proposal.md",
  "demo/representative-openspec/openspec/changes/archive/2026-07-01-legacy-search/specs/interface/spec.md",
  "demo/representative-openspec/openspec/changes/archive/2026-07-01-legacy-search/tasks.md",
  "demo/representative-openspec/openspec/changes/completed-export/proposal.md",
  "demo/representative-openspec/openspec/changes/completed-export/specs/export/spec.md",
  "demo/representative-openspec/openspec/changes/completed-export/tasks.md",
  "demo/representative-openspec/openspec/config.yaml",
  "demo/representative-openspec/openspec/specs/interface/spec.md",
  "dist/cli.d.ts",
  "dist/cli.js",
  "dist/demo.d.ts",
  "dist/demo.js",
  "dist/openspec/discover.d.ts",
  "dist/openspec/discover.js",
  "dist/openspec/hosted-demo.d.ts",
  "dist/openspec/hosted-demo.js",
  "dist/openspec/lifecycle-workspace.d.ts",
  "dist/openspec/lifecycle-workspace.js",
  "dist/openspec/mutate.d.ts",
  "dist/openspec/mutate.js",
  "dist/openspec/notes.d.ts",
  "dist/openspec/notes.js",
  "dist/openspec/project.d.ts",
  "dist/openspec/project.js",
  "dist/openspec/search.d.ts",
  "dist/openspec/search.js",
  "dist/openspec/spec-diff.d.ts",
  "dist/openspec/spec-diff.js",
  "dist/openspec/tasks.d.ts",
  "dist/openspec/tasks.js",
  "dist/openspec/watch.d.ts",
  "dist/openspec/watch.js",
  "dist/server.d.ts",
  "dist/server.js",
  "dist/ui/app.js",
  "dist/ui/index.html",
  "dist/ui/runtime-config.js",
  "dist/ui/search-contract.d.ts",
  "dist/ui/search-contract.js",
  "dist/ui/styles.css",
  "package.json",
].sort();

function npmEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    npm_config_cache: join(tempRoot, "npm-cache"),
    npm_config_audit: "false",
    npm_config_fund: "false",
  };
}

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "openspec-viewer-package-"));
  const packDir = join(tempRoot, "pack");
  installDir = join(tempRoot, "install");
  mkdirSync(packDir);
  mkdirSync(installDir);
  mkdirSync(join(repositoryRoot, "dist", "hosted-demo"), {
    recursive: true,
  });
  writeFileSync(staleHostedOutput, "must not be packed\n", "utf8");

  const output = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", packDir],
    {
      cwd: repositoryRoot,
      env: npmEnv(),
      encoding: "utf8",
    },
  );
  [pack] = JSON.parse(output) as PackResult[];
  tarballPath = join(packDir, pack.filename);

  writeFileSync(
    join(installDir, "package.json"),
    `${JSON.stringify({ private: true }, null, 2)}\n`,
    "utf8",
  );
  execFileSync(
    "npm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--no-save",
      tarballPath,
    ],
    {
      cwd: installDir,
      env: npmEnv(),
      encoding: "utf8",
    },
  );
  installedBin = join(
    installDir,
    "node_modules",
    ".bin",
    "openspec-viewer",
  );
});

afterAll(async () => {
  try {
    await cli?.stop();
  } finally {
    project?.cleanup();
    rmSync(join(repositoryRoot, "dist", "hosted-demo"), {
      recursive: true,
      force: true,
    });
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("packed and clean-installed CLI", () => {
  it("contains only intended public files with an executable CLI", () => {
    expect(pack.name).toBe("openspec-viewer");
    expect(pack.version).toBe(packageJson.version);
    expect(pack.entryCount).toBe(pack.files.length);
    expect(existsSync(tarballPath)).toBe(true);

    const paths = pack.files.map((file) => file.path).sort();
    expect(paths).toEqual(expectedPackedFiles);
    for (const path of paths) {
      expect(
        /(^|\/)(?:\.env(?:\.|$)|[^/]*\.(?:map|pem|key|p12)$|credentials?(?:\.|$)|secrets?(?:\.|$))/i.test(
          path,
        ),
        `sensitive or generated file in package: ${path}`,
      ).toBe(false);
    }

    const cliEntry = pack.files.find((file) => file.path === "dist/cli.js");
    expect(cliEntry).toBeDefined();
    expect((cliEntry!.mode & 0o111) !== 0).toBe(true);
  });

  it("installs package metadata, docs, UI, and only the declared runtime", () => {
    const packageRoot = join(
      installDir,
      "node_modules",
      "openspec-viewer",
    );
    const installedPackage = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as {
      name: string;
      version: string;
      license: string;
      dependencies?: Record<string, string>;
    };

    expect(installedPackage).toMatchObject({
      name: packageJson.name,
      version: packageJson.version,
      license: packageJson.license,
    });
    expect(installedPackage.dependencies ?? {}).toEqual(
      packageJson.dependencies ?? {},
    );
    expect(readFileSync(join(packageRoot, "README.md"), "utf8")).toContain(
      "# openspec-viewer",
    );
    expect(readFileSync(join(packageRoot, "LICENSE"), "utf8")).toContain(
      "MIT License",
    );
    expect(
      existsSync(join(packageRoot, "dist", "ui", "index.html")),
    ).toBe(true);
    expect(
      existsSync(
        join(
          packageRoot,
          "demo",
          "representative-openspec",
          "openspec",
          "config.yaml",
        ),
      ),
    ).toBe(true);
    expect(existsSync(join(packageRoot, "src"))).toBe(false);
    expect(existsSync(join(packageRoot, "test"))).toBe(false);
    expect(existsSync(join(packageRoot, "openspec"))).toBe(false);

    expect(lstatSync(installedBin).isSymbolicLink()).toBe(true);
    const target = realpathSync(installedBin);
    expect(target.startsWith(`${realpathSync(packageRoot)}/`)).toBe(true);
    expect(basename(target)).toBe("cli.js");
    expect((statSync(target).mode & 0o111) !== 0).toBe(true);
  });

  it("runs help, version, and invalid input only through the installed binary", () => {
    const run = (args: string[]) =>
      spawnSync(installedBin, args, {
        cwd: installDir,
        env: { ...process.env, NODE_PATH: undefined },
        encoding: "utf8",
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage:");
    expect(help.stdout).toContain("--demo");
    expect(help.stdout).toContain("--no-open");

    const version = run(["--version"]);
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toBe(packageJson.version);

    const unknown = run(["--unknown"]);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain("Unknown option: --unknown");

    const invalidPort = run(["--port", "65536"]);
    expect(invalidPort.status).toBe(1);
    expect(invalidPort.stderr).toContain("Invalid port: 65536");

    const missingProject = join(tempRoot, "missing-project");
    mkdirSync(missingProject);
    const before = readdirSync(missingProject);
    const missing = run(["--path", missingProject]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("No openspec/ folder found");
    expect(readdirSync(missingProject)).toEqual(before);
  });

  it("starts the installed binary against a fixture and terminates cleanly", async () => {
    project = createTestProject();
    cli = await startCliProcess({
      executable: installedBin,
      projectDir: project.projectDir,
      cwd: installDir,
    });

    const health = await fetch(`${cli.url}/api/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ ok: true, watchers: 0 });
    expect(cli.stdout()).toContain(`UI:       ${cli.url}`);
    expect(cli.stderr()).toBe("");

    const exit = await cli.stop();
    expect(exit.forced).toBe(false);
    expect(exit.signal).toBe("SIGTERM");
  });

  it("starts the bundled demo through the installed binary", async () => {
    cli = await startCliProcess({
      executable: installedBin,
      args: ["--demo"],
      cwd: installDir,
    });

    const project = await fetch(`${cli.url}/api/project`).then((response) =>
      response.json(),
    );
    expect(project).toMatchObject({
      mode: "demo",
      label: "Fictional demo project",
    });
    expect(cli.stdout()).toContain(
      "project:  Fictional demo project (temporary copy)",
    );
    expect(cli.stderr()).toBe("");

    const exit = await cli.stop();
    expect(exit.forced).toBe(false);
    expect(exit.signal).toBe("SIGTERM");
  });
});
