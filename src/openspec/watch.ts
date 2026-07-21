import { watch, type FSWatcher } from "node:fs";
import type { ProjectRoot } from "./discover.js";

export type WatchEvent = {
  type: "change";
  path: string;
  at: string;
};

export function watchOpenspec(
  root: ProjectRoot,
  onEvent: (event: WatchEvent) => void,
  debounceMs = 250,
): { close: () => void } {
  const watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | null = null;
  let lastPath = root.openspecDir;

  const fire = (filename: string | null) => {
    lastPath = filename ? `${root.openspecDir}/${filename}` : root.openspecDir;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onEvent({
        type: "change",
        path: lastPath,
        at: new Date().toISOString(),
      });
    }, debounceMs);
  };

  try {
    // recursive is supported on macOS/Windows; Linux Node 20+ also in many builds
    const w = watch(root.openspecDir, { recursive: true }, (_event, filename) => {
      fire(typeof filename === "string" ? filename : null);
    });
    w.on("error", () => {
      // fallback: ignore watcher errors (permissions / deleted root)
    });
    watchers.push(w);
  } catch {
    // no-op if watch unsupported
  }

  return {
    close: () => {
      if (timer) clearTimeout(timer);
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          // ignore
        }
      }
    },
  };
}
