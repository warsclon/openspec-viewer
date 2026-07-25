import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createServer as createNetServer } from "node:net";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import { archiveChange, createChange, writeArtifact } from "../../src/openspec/mutate.js";
import { readNotes, writeNotes } from "../../src/openspec/notes.js";
import { createTestProject, type TestProject } from "../helpers/fixture.js";

const projects: TestProject[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});

describe("change lifecycle", () => {
  it("uses an injected command runner and falls back deterministically", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];

    const result = await createChange(root, "add-export", {
      description: "Add a fictional export.",
      runCommand: async (command: string, args: string[], cwd: string) => {
        calls.push({ command, args, cwd });
        return { code: 1, stdout: "", stderr: "fixture runner unavailable" };
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "openspec",
      args: [
        "new",
        "change",
        "add-export",
        "--json",
        "--description",
        "Add a fictional export.",
      ],
    });
    expect(calls[0].cwd).not.toBe(project.projectDir);
    expect(calls[0].cwd.startsWith(tmpdir())).toBe(true);
    expect(existsSync(dirname(calls[0].cwd))).toBe(false);
    expect(result.stdout).toBe("fixture runner unavailable");
    expect(existsSync(join(result.path, ".openspec.yaml"))).toBe(true);
    expect(readFileSync(join(result.path, "tasks.md"), "utf8")).toContain(
      "- [ ] 1.1 First task",
    );
  });

  it("publishes a successful generated change only after the command completes", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    let commandCwd = "";

    const result = await createChange(root, "generated-change", {
      runCommand: async (_command, _args, cwd) => {
        commandCwd = cwd;
        const generated = join(
          cwd,
          "openspec",
          "changes",
          "generated-change",
        );
        mkdirSync(join(generated, "specs"), { recursive: true });
        writeFileSync(join(generated, "proposal.md"), "generated\n", "utf8");
        return { code: 0, stdout: "created\n", stderr: "" };
      },
    });

    expect(commandCwd).not.toBe(project.projectDir);
    expect(existsSync(dirname(commandCwd))).toBe(false);
    expect(readFileSync(join(result.path, "proposal.md"), "utf8")).toBe(
      "generated\n",
    );
    expect(result.stdout).toBe("created\n");
  });

  it("reports post-commit workspace cleanup failures without reporting the create as failed", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    const result = await createChange(root, "cleanup-warning", {
      runCommand: async (_command, _args, cwd) => {
        const generated = join(
          cwd,
          "openspec",
          "changes",
          "cleanup-warning",
        );
        mkdirSync(generated, { recursive: true });
        writeFileSync(join(generated, "proposal.md"), "generated\n", "utf8");
        return { code: 0, stdout: "created\n", stderr: "" };
      },
      removeWorkspace: (workspaceRoot) => {
        rmSync(workspaceRoot, { recursive: true, force: true });
        throw new Error("injected cleanup failure");
      },
    });

    expect(readFileSync(join(result.path, "proposal.md"), "utf8")).toBe(
      "generated\n",
    );
    expect(result.cleanupWarning).toBe(
      "Temporary command workspace cleanup could not be completed",
    );
  });

  it("uses direct no-replace directory publication on Windows", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    let renameCalls = 0;

    const result = await createChange(root, "windows-publication", {
      runCommand: async (_command, _args, cwd) => {
        const generated = join(
          cwd,
          "openspec",
          "changes",
          "windows-publication",
        );
        mkdirSync(generated, { recursive: true });
        writeFileSync(join(generated, "proposal.md"), "generated\n", "utf8");
        return { code: 0, stdout: "created\n", stderr: "" };
      },
      changePublish: {
        platform: "win32",
        renameDirectory: (source, destination) => {
          renameCalls += 1;
          expect(existsSync(destination)).toBe(false);
          renameSync(source, destination);
        },
      },
    });

    expect(renameCalls).toBe(1);
    expect(readFileSync(join(result.path, "proposal.md"), "utf8")).toBe(
      "generated\n",
    );
  });

  it("falls back when the OpenSpec executable is unavailable", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    const result = await createChange(root, "add-offline-mode", {
      runCommand: async () => {
        const error = new Error("spawn openspec ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
    });

    expect(result.stdout).toBe("spawn openspec ENOENT");
    expect(existsSync(join(result.path, "proposal.md"))).toBe(true);
    expect(existsSync(join(result.path, "design.md"))).toBe(true);
    expect(existsSync(join(result.path, "tasks.md"))).toBe(true);
  });

  it("creates the first change when the project has no changes directory", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    rmSync(root.changesDir, { recursive: true, force: true });

    const result = await createChange(root, "first-change", {
      runCommand: async () => ({
        code: 127,
        stdout: "",
        stderr: "openspec unavailable",
      }),
    });

    expect(existsSync(join(result.path, "proposal.md"))).toBe(true);
    expect(existsSync(join(result.path, "tasks.md"))).toBe(true);
  });

  it("removes a partial change when the command fails", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const partialPath = join(root.changesDir, "partial-change");
    let workspaceRoot = "";

    await expect(
      createChange(root, "partial-change", {
        runCommand: async (_command, _args, cwd) => {
          workspaceRoot = dirname(cwd);
          const workspacePartial = join(
            cwd,
            "openspec",
            "changes",
            "partial-change",
          );
          mkdirSync(workspacePartial, { recursive: true });
          writeFileSync(
            join(workspacePartial, "proposal.md"),
            "partial\n",
            "utf8",
          );
          return { code: 2, stdout: "", stderr: "generation failed" };
        },
      }),
    ).rejects.toThrow("generation failed");
    expect(existsSync(partialPath)).toBe(false);
    expect(workspaceRoot).not.toBe("");
    expect(existsSync(workspaceRoot)).toBe(false);
    expect(existsSync(join(root.changesDir, "add-dark-mode", "proposal.md"))).toBe(true);
  });

  it("removes an incomplete fallback scaffold before it becomes visible", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const dest = join(root.changesDir, "broken-scaffold");
    let workspaceRoot = "";
    rmSync(root.changesDir, { recursive: true, force: true });
    const opts = {
      runCommand: async (_command: string, _args: string[], cwd: string) => {
        workspaceRoot = dirname(cwd);
        return {
          code: 127,
          stdout: "",
          stderr: "openspec unavailable",
        };
      },
      writeScaffold: (stagingPath: string) => {
        writeFileSync(join(stagingPath, "proposal.md"), "partial\n", "utf8");
        throw new Error("scaffold write failed");
      },
    } as unknown as NonNullable<Parameters<typeof createChange>[2]>;

    await expect(
      createChange(root, "broken-scaffold", opts),
    ).rejects.toThrow("scaffold write failed");
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(root.changesDir)).toBe(false);
    expect(workspaceRoot).not.toBe("");
    expect(existsSync(workspaceRoot)).toBe(false);
  });

  it("rejects lifecycle copies containing symbolic links", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const outsidePath = join(project.projectDir, "outside.md");
    writeFileSync(outsidePath, "outside remains private\n", "utf8");
    symlinkSync(
      outsidePath,
      join(root.openspecDir, "linked-outside.md"),
    );
    let commandCalls = 0;

    await expect(
      createChange(root, "blocked-symlink", {
        runCommand: async () => {
          commandCalls += 1;
          return { code: 0, stdout: "", stderr: "" };
        },
      }),
    ).rejects.toThrow(
      "Symbolic links are not supported in OpenSpec lifecycle operations",
    );

    expect(commandCalls).toBe(0);
    expect(readFileSync(outsidePath, "utf8")).toBe(
      "outside remains private\n",
    );
    expect(existsSync(join(root.changesDir, "blocked-symlink"))).toBe(false);
  });

  it.skipIf(process.platform === "win32")(
    "rejects unsupported filesystem entries before copying or running commands",
    async () => {
      const project = createTestProject();
      projects.push(project);
      const root = findOpenspecRoot(project.projectDir);
      const socketPath = join(root.openspecDir, "unsupported.sock");
      const socket = createNetServer();
      let copyCalls = 0;
      let commandCalls = 0;

      await new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.listen(socketPath, resolve);
      });

      try {
        await expect(
          createChange(root, "blocked-socket", {
            copyWorkspace: () => {
              copyCalls += 1;
            },
            runCommand: async () => {
              commandCalls += 1;
              return { code: 0, stdout: "", stderr: "" };
            },
          }),
        ).rejects.toThrow(
          "Unsupported filesystem entry in OpenSpec lifecycle operation",
        );
        expect(copyCalls).toBe(0);
        expect(commandCalls).toBe(0);
        expect(existsSync(join(root.changesDir, "blocked-socket"))).toBe(false);
      } finally {
        await new Promise<void>((resolve, reject) => {
          socket.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        rmSync(socketPath, { force: true });
      }
    },
  );

  it("does not replace a change directory created while generation runs", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const destination = join(root.changesDir, "concurrent-change");

    await expect(
      createChange(root, "concurrent-change", {
        runCommand: async (_command, _args, cwd) => {
          const generated = join(
            cwd,
            "openspec",
            "changes",
            "concurrent-change",
          );
          mkdirSync(generated, { recursive: true });
          writeFileSync(join(generated, "proposal.md"), "generated\n", "utf8");
          mkdirSync(destination);
          writeFileSync(
            join(destination, "proposal.md"),
            "concurrent\n",
            "utf8",
          );
          return { code: 0, stdout: "created\n", stderr: "" };
        },
      }),
    ).rejects.toThrow("Change already exists: concurrent-change");

    expect(readFileSync(join(destination, "proposal.md"), "utf8")).toBe(
      "concurrent\n",
    );
  });

  it("rejects a changes-directory symlink swap without writing outside the project", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const outsideDir = mkdtempSync(
      join(tmpdir(), "openspec-viewer-outside-changes-"),
    );
    const originalChangesDir = join(root.openspecDir, "changes-before-swap");
    let workspaceRoot = "";

    try {
      await expect(
        createChange(root, "escaped-change", {
          runCommand: async (_command, _args, cwd) => {
            workspaceRoot = dirname(cwd);
            const generated = join(
              cwd,
              "openspec",
              "changes",
              "escaped-change",
            );
            mkdirSync(generated, { recursive: true });
            writeFileSync(join(generated, "proposal.md"), "generated\n", "utf8");
            renameSync(root.changesDir, originalChangesDir);
            symlinkSync(outsideDir, root.changesDir, "dir");
            return { code: 0, stdout: "created\n", stderr: "" };
          },
        }),
      ).rejects.toThrow(
        "OpenSpec changes directory changed while create was running",
      );

      expect(readdirSync(outsideDir)).toEqual([]);
      expect(workspaceRoot).not.toBe("");
      expect(existsSync(workspaceRoot)).toBe(false);
    } finally {
      rmSync(root.changesDir, { force: true });
      if (existsSync(originalChangesDir)) {
        renameSync(originalChangesDir, root.changesDir);
      }
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it("rejects a generated change containing a symbolic link and cleans the workspace", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const outsidePath = join(project.projectDir, "outside.md");
    const destination = join(root.changesDir, "linked-change");
    let workspaceRoot = "";
    writeFileSync(outsidePath, "outside remains private\n", "utf8");

    await expect(
      createChange(root, "linked-change", {
        runCommand: async (_command, _args, cwd) => {
          workspaceRoot = dirname(cwd);
          const generated = join(
            cwd,
            "openspec",
            "changes",
            "linked-change",
          );
          mkdirSync(generated, { recursive: true });
          symlinkSync(outsidePath, join(generated, "proposal.md"));
          return { code: 0, stdout: "created\n", stderr: "" };
        },
      }),
    ).rejects.toThrow(
      "Symbolic links are not supported in OpenSpec lifecycle operations",
    );

    expect(existsSync(destination)).toBe(false);
    expect(workspaceRoot).not.toBe("");
    expect(existsSync(workspaceRoot)).toBe(false);
    expect(readFileSync(outsidePath, "utf8")).toBe(
      "outside remains private\n",
    );
  });

  it("validates create names and existing targets before running a command", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    let commandCalls = 0;
    const runCommand = async () => {
      commandCalls += 1;
      return { code: 0, stdout: "", stderr: "" };
    };

    await expect(
      createChange(root, "Invalid Name", { runCommand }),
    ).rejects.toThrow("Invalid name. Use kebab-case");
    await expect(
      createChange(root, "add-dark-mode", { runCommand }),
    ).rejects.toThrow("Change already exists: add-dark-mode");
    expect(commandCalls).toBe(0);
  });

  it("archives with explicit arguments and reports command output", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const activePath = join(root.changesDir, "add-dark-mode");
    const archivedPath = join(root.archiveDir, "2026-07-25-add-dark-mode");
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];

    const result = await archiveChange(root, "add-dark-mode", {
      skipSpecs: true,
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd });
        renameSync(
          join(cwd, "openspec", "changes", "add-dark-mode"),
          join(cwd, "openspec", "changes", "archive", "2026-07-25-add-dark-mode"),
        );
        return { code: 0, stdout: "archived\n", stderr: "" };
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "openspec",
      args: ["archive", "add-dark-mode", "-y", "--json", "--skip-specs"],
    });
    expect(calls[0].cwd).not.toBe(project.projectDir);
    expect(calls[0].cwd.startsWith(tmpdir())).toBe(true);
    expect(existsSync(dirname(calls[0].cwd))).toBe(false);
    expect(result).toEqual({ stdout: "archived\n", stderr: "" });
    expect(existsSync(activePath)).toBe(false);
    expect(existsSync(archivedPath)).toBe(true);
    expect(
      readFileSync(
        join(project.projectDir, ".openspec-viewer", ".gitignore"),
        "utf8",
      ),
    ).toBe("# local openspec-viewer state (do not commit)\n*\n");
    expect(
      existsSync(
        join(project.projectDir, ".openspec-viewer", "lifecycle"),
      ),
    ).toBe(false);
  });

  it("reports an archive command-workspace cleanup failure after commit", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const archivedPath = join(root.archiveDir, "2026-07-25-add-dark-mode");

    const result = await archiveChange(root, "add-dark-mode", {
      runCommand: async (_command, _args, cwd) => {
        renameSync(
          join(cwd, "openspec", "changes", "add-dark-mode"),
          join(
            cwd,
            "openspec",
            "changes",
            "archive",
            "2026-07-25-add-dark-mode",
          ),
        );
        return { code: 0, stdout: "archived\n", stderr: "" };
      },
      removeWorkspace: (workspaceRoot) => {
        rmSync(workspaceRoot, { recursive: true, force: true });
        throw new Error("injected command-workspace cleanup failure");
      },
    });

    expect(result.cleanupWarning).toBe(
      "Temporary command workspace cleanup could not be completed",
    );
    expect(existsSync(join(root.changesDir, "add-dark-mode"))).toBe(false);
    expect(existsSync(archivedPath)).toBe(true);
  });

  it("reports an archive publish-root cleanup failure after commit", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const archivedPath = join(root.archiveDir, "2026-07-25-add-dark-mode");
    let cleanupCalls = 0;

    const result = await archiveChange(root, "add-dark-mode", {
      runCommand: async (_command, _args, cwd) => {
        renameSync(
          join(cwd, "openspec", "changes", "add-dark-mode"),
          join(
            cwd,
            "openspec",
            "changes",
            "archive",
            "2026-07-25-add-dark-mode",
          ),
        );
        return { code: 0, stdout: "archived\n", stderr: "" };
      },
      publishOperations: {
        cleanupPublishRoot: (cleanup) => {
          cleanupCalls += 1;
          cleanup();
          throw new Error("injected publish-root cleanup failure");
        },
      },
    });

    expect(cleanupCalls).toBe(1);
    expect(result.cleanupWarning).toBe(
      "Archive committed, but local staging cleanup could not be completed under .openspec-viewer/lifecycle",
    );
    expect(existsSync(join(root.changesDir, "add-dark-mode"))).toBe(false);
    expect(existsSync(archivedPath)).toBe(true);
  });

  it("rejects a symbolic link produced by archive without publishing it", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
    const proposalBefore = readFileSync(proposalPath, "utf8");
    const outsidePath = join(project.projectDir, "outside.md");
    let workspaceRoot = "";
    writeFileSync(outsidePath, "outside remains private\n", "utf8");

    await expect(
      archiveChange(root, "add-dark-mode", {
        runCommand: async (_command, _args, cwd) => {
          workspaceRoot = dirname(cwd);
          symlinkSync(
            outsidePath,
            join(cwd, "openspec", "archive-output-link.md"),
          );
          return { code: 0, stdout: "archived\n", stderr: "" };
        },
      }),
    ).rejects.toThrow(
      "Symbolic links are not supported in OpenSpec lifecycle operations",
    );

    expect(readFileSync(proposalPath, "utf8")).toBe(proposalBefore);
    expect(existsSync(join(root.openspecDir, "archive-output-link.md"))).toBe(
      false,
    );
    expect(workspaceRoot).not.toBe("");
    expect(existsSync(workspaceRoot)).toBe(false);
    expect(readFileSync(outsidePath, "utf8")).toBe(
      "outside remains private\n",
    );
  });

  it.each(["viewer", "lifecycle"] as const)(
    "rejects a symlinked local %s directory during archive publication",
    async (symlinkTarget) => {
      const project = createTestProject();
      projects.push(project);
      const root = findOpenspecRoot(project.projectDir);
      const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
      const proposalBefore = readFileSync(proposalPath, "utf8");
      const outsideDir = mkdtempSync(
        join(tmpdir(), "openspec-viewer-outside-state-"),
      );
      const viewerPath = join(project.projectDir, ".openspec-viewer");
      let workspaceRoot = "";

      if (symlinkTarget === "viewer") {
        symlinkSync(outsideDir, viewerPath, "dir");
      } else {
        mkdirSync(viewerPath);
        symlinkSync(outsideDir, join(viewerPath, "lifecycle"), "dir");
      }

      try {
        await expect(
          archiveChange(root, "add-dark-mode", {
            runCommand: async (_command, _args, cwd) => {
              workspaceRoot = dirname(cwd);
              renameSync(
                join(cwd, "openspec", "changes", "add-dark-mode"),
                join(
                  cwd,
                  "openspec",
                  "changes",
                  "archive",
                  "2026-07-25-add-dark-mode",
                ),
              );
              return { code: 0, stdout: "archived\n", stderr: "" };
            },
          }),
        ).rejects.toThrow("Unsafe local lifecycle directory");

        expect(readFileSync(proposalPath, "utf8")).toBe(proposalBefore);
        expect(readdirSync(outsideDir)).toEqual([]);
        expect(workspaceRoot).not.toBe("");
        expect(existsSync(workspaceRoot)).toBe(false);
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    },
  );

  it("keeps local notes ignored when they are created during archive publication", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const viewerPath = join(project.projectDir, ".openspec-viewer");
    mkdirSync(viewerPath);
    writeFileSync(join(viewerPath, ".gitignore"), "!notes/\n", "utf8");
    let noteWritten = false;
    const opts = {
      runCommand: async (_command: string, _args: string[], cwd: string) => {
        renameSync(
          join(cwd, "openspec", "changes", "add-dark-mode"),
          join(
            cwd,
            "openspec",
            "changes",
            "archive",
            "2026-07-25-add-dark-mode",
          ),
        );
        return { code: 0, stdout: "archived\n", stderr: "" };
      },
      publishOperations: {
        linkFile: (source: string, destination: string) => {
          if (!noteWritten) {
            noteWritten = true;
            writeNotes(
              root,
              "add-dark-mode",
              "Remember this concurrent note.\n",
            );
          }
          linkSync(source, destination);
        },
      },
    } as unknown as NonNullable<Parameters<typeof archiveChange>[2]>;

    await archiveChange(root, "add-dark-mode", opts);

    expect(noteWritten).toBe(true);
    expect(readNotes(root, "add-dark-mode")).toBe(
      "Remember this concurrent note.\n",
    );
    expect(
      readFileSync(
        join(project.projectDir, ".openspec-viewer", ".gitignore"),
        "utf8",
      ),
    ).toBe(
      "!notes/\n# local openspec-viewer state (do not commit)\n*\n",
    );
    expect(existsSync(join(project.projectDir, ".gitignore"))).toBe(false);
  });

  it("leaves an active change intact when archive fails", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
    const mainSpecPath = join(root.specsDir, "interface", "spec.md");
    const partialArchivePath = join(root.archiveDir, "2026-07-25-add-dark-mode");
    const proposalBefore = readFileSync(proposalPath, "utf8");
    const mainSpecBefore = readFileSync(mainSpecPath, "utf8");
    let workspaceRoot = "";

    await expect(
      archiveChange(root, "add-dark-mode", {
        runCommand: async (_command, _args, cwd) => {
          workspaceRoot = dirname(cwd);
          writeFileSync(
            join(cwd, "openspec", "changes", "add-dark-mode", "proposal.md"),
            "partial proposal edit\n",
            "utf8",
          );
          writeFileSync(
            join(cwd, "openspec", "specs", "interface", "spec.md"),
            "partial main spec edit\n",
            "utf8",
          );
          renameSync(
            join(cwd, "openspec", "changes", "add-dark-mode"),
            join(cwd, "openspec", "changes", "archive", "2026-07-25-add-dark-mode"),
          );
          return {
            code: 3,
            stdout: "",
            stderr: "archive rejected",
          };
        },
      }),
    ).rejects.toThrow("archive rejected");
    expect(readFileSync(proposalPath, "utf8")).toBe(proposalBefore);
    expect(readFileSync(mainSpecPath, "utf8")).toBe(mainSpecBefore);
    expect(existsSync(partialArchivePath)).toBe(false);
    expect(workspaceRoot).not.toBe("");
    expect(existsSync(workspaceRoot)).toBe(false);
  });

  it("preserves a concurrent live edit when an archive command fails", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
    let releaseCommand!: (result: {
      code: number;
      stdout: string;
      stderr: string;
    }) => void;
    let commandStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      commandStarted = resolve;
    });

    const archive = archiveChange(root, "add-dark-mode", {
      runCommand: async () => {
        commandStarted();
        return new Promise((resolve) => {
          releaseCommand = resolve;
        });
      },
    });
    await started;

    writeArtifact(root, "add-dark-mode", "proposal", "Concurrent edit");

    releaseCommand({ code: 3, stdout: "", stderr: "archive rejected" });
    await expect(archive).rejects.toThrow("archive rejected");
    expect(readFileSync(proposalPath, "utf8")).toBe("Concurrent edit\n");
  });

  it("rejects a successful archive result if the live project changed concurrently", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
    const archivedPath = join(root.archiveDir, "2026-07-25-add-dark-mode");
    let commandStarted!: () => void;
    let releaseCommand!: () => void;
    const started = new Promise<void>((resolve) => {
      commandStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });

    const archive = archiveChange(root, "add-dark-mode", {
      runCommand: async (_command, _args, cwd) => {
        commandStarted();
        await release;
        renameSync(
          join(cwd, "openspec", "changes", "add-dark-mode"),
          join(cwd, "openspec", "changes", "archive", "2026-07-25-add-dark-mode"),
        );
        return { code: 0, stdout: "archived\n", stderr: "" };
      },
    });
    await started;

    writeArtifact(root, "add-dark-mode", "proposal", "Concurrent edit");
    releaseCommand();

    await expect(archive).rejects.toThrow(
      "OpenSpec project changed while archive was running",
    );
    expect(readFileSync(proposalPath, "utf8")).toBe("Concurrent edit\n");
    expect(existsSync(archivedPath)).toBe(false);
  });

  it("detects a content-identical permission change while archive runs", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
    const originalMode = lstatSync(proposalPath).mode & 0o777;
    const concurrentMode = originalMode === 0o600 ? 0o640 : 0o600;
    let commandStarted!: () => void;
    let releaseCommand!: () => void;
    const started = new Promise<void>((resolve) => {
      commandStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });

    try {
      const archive = archiveChange(root, "add-dark-mode", {
        runCommand: async (_command, _args, cwd) => {
          commandStarted();
          await release;
          renameSync(
            join(cwd, "openspec", "changes", "add-dark-mode"),
            join(
              cwd,
              "openspec",
              "changes",
              "archive",
              "2026-07-25-add-dark-mode",
            ),
          );
          return { code: 0, stdout: "archived\n", stderr: "" };
        },
      });
      await started;

      chmodSync(proposalPath, concurrentMode);
      releaseCommand();

      await expect(archive).rejects.toThrow(
        "OpenSpec project changed while archive was running",
      );
      expect(lstatSync(proposalPath).mode & 0o777).toBe(concurrentMode);
    } finally {
      chmodSync(proposalPath, originalMode);
    }
  });

  it(
    "rolls back an archive failure after part of the delta was published",
    async () => {
      const project = createTestProject();
      projects.push(project);
      const root = findOpenspecRoot(project.projectDir);
      const activePath = join(root.changesDir, "add-dark-mode");
      const proposalPath = join(activePath, "proposal.md");
      const mainSpecPath = join(root.specsDir, "interface", "spec.md");
      const archivedPath = join(root.archiveDir, "2026-07-25-add-dark-mode");
      const proposalBefore = readFileSync(proposalPath, "utf8");
      const mainSpecBefore = readFileSync(mainSpecPath, "utf8");
      let commandCalls = 0;

      const opts = {
        runCommand: async (_command: string, _args: string[], cwd: string) => {
          commandCalls += 1;
          const workspaceActive = join(
            cwd,
            "openspec",
            "changes",
            "add-dark-mode",
          );
          const workspaceArchive = join(
            cwd,
            "openspec",
            "changes",
            "archive",
            "2026-07-25-add-dark-mode",
          );
          renameSync(workspaceActive, workspaceArchive);
          writeFileSync(
            join(cwd, "openspec", "specs", "interface", "spec.md"),
            "updated by archive\n",
            "utf8",
          );
          return { code: 0, stdout: "archived\n", stderr: "" };
        },
        publishOperations: {
          cleanupPublishRoot: (cleanup: () => void) => {
            cleanup();
            throw new Error("injected cleanup failure");
          },
          linkFile: (source: string, destination: string) => {
            if (destination === mainSpecPath) {
              throw new Error("injected publish failure");
            }
            linkSync(source, destination);
          },
        },
      } as unknown as NonNullable<Parameters<typeof archiveChange>[2]>;

      let failure:
        | (Error & { cleanupError?: Error })
        | undefined;
      try {
        await archiveChange(root, "add-dark-mode", opts);
      } catch (error) {
        failure = error as Error & { cleanupError?: Error };
      }

      expect(failure?.message).toBe("injected publish failure");
      expect(failure?.cleanupError?.message).toBe("injected cleanup failure");
      expect(commandCalls).toBe(1);
      expect(readFileSync(proposalPath, "utf8")).toBe(proposalBefore);
      expect(readFileSync(mainSpecPath, "utf8")).toBe(mainSpecBefore);
      expect(existsSync(archivedPath)).toBe(false);
      expect(
        existsSync(
          join(project.projectDir, ".openspec-viewer", "lifecycle"),
        ),
      ).toBe(
        false,
      );
    },
  );

  it("cleans its workspace when archive preparation fails", async () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    let commandCalls = 0;
    let workspaceRoot = "";
    const opts = {
      copyWorkspace: (_source: string, destination: string) => {
        workspaceRoot = dirname(dirname(destination));
        mkdirSync(destination, { recursive: true });
        throw new Error("workspace copy failed");
      },
      runCommand: async () => {
        commandCalls += 1;
        return { code: 0, stdout: "", stderr: "" };
      },
    } as unknown as NonNullable<Parameters<typeof archiveChange>[2]>;

    await expect(
      archiveChange(root, "add-dark-mode", opts),
    ).rejects.toThrow("workspace copy failed");

    expect(commandCalls).toBe(0);
    expect(workspaceRoot).not.toBe("");
    expect(existsSync(workspaceRoot)).toBe(false);
  });
});
