import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectRoot } from "../src/openspec/discover.js";
import { notesPath } from "../src/openspec/notes.js";
import { watchOpenspec } from "../src/openspec/watch.js";

const root: ProjectRoot = {
  projectDir: "/fictional/project",
  openspecDir: "/fictional/project/openspec",
  changesDir: "/fictional/project/openspec/changes",
  specsDir: "/fictional/project/openspec/specs",
  archiveDir: "/fictional/project/openspec/changes/archive",
  configPath: "/fictional/project/openspec/config.yaml",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("OpenSpec watcher", () => {
  it("covers create, update, and rename notifications with reliable close", () => {
    vi.useFakeTimers();
    let watchedPath = "";
    let closeCalls = 0;
    let emitFilesystemEvent:
      | ((event: "rename" | "change", filename: string | Buffer | null) => void)
      | undefined;
    let emitError: (() => void) | undefined;
    const events: Array<{ type: string; path: string }> = [];
    const fakeWatch = (
      path: string,
      _options: { recursive: true },
      listener: (event: "rename" | "change", filename: string | Buffer | null) => void,
    ) => {
      watchedPath = path;
      emitFilesystemEvent = listener;
      return {
        on: (_event: "error", listener: () => void) => {
          emitError = listener;
        },
        close: () => {
          closeCalls += 1;
        },
      };
    };

    const watcher = watchOpenspec(
      root,
      (event) => events.push({ type: event.type, path: event.path }),
      25,
      fakeWatch,
    );
    expect(watchedPath).toBe(root.openspecDir);
    expect(notesPath(root, "add-search").startsWith(root.openspecDir)).toBe(
      false,
    );
    emitError?.();

    emitFilesystemEvent?.("rename", "changes/add-search/newly-created.md");
    vi.advanceTimersByTime(24);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([
      {
        type: "change",
        path: `${root.openspecDir}/changes/add-search/newly-created.md`,
      },
    ]);

    emitFilesystemEvent?.("change", "changes/add-search/tasks.md");
    vi.advanceTimersByTime(25);
    expect(events[1]).toEqual({
      type: "change",
      path: `${root.openspecDir}/changes/add-search/tasks.md`,
    });

    emitFilesystemEvent?.("rename", "changes/add-search/renamed-design.md");
    vi.advanceTimersByTime(25);
    expect(events[2]).toEqual({
      type: "change",
      path: `${root.openspecDir}/changes/add-search/renamed-design.md`,
    });

    emitFilesystemEvent?.("change", "changes/add-search/proposal.md");
    emitFilesystemEvent?.("rename", "changes/add-search/design.md");
    vi.advanceTimersByTime(25);
    expect(events[3]).toEqual({
      type: "change",
      path: `${root.openspecDir}/changes/add-search/design.md`,
    });

    emitFilesystemEvent?.("change", "changes/add-search/tasks.md");
    watcher.close();
    watcher.close();
    emitFilesystemEvent?.("change", "changes/add-search/tasks.md");
    vi.runAllTimers();
    expect(events).toHaveLength(4);
    expect(closeCalls).toBe(1);
  });
});
