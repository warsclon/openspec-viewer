import { watch } from "node:fs";
import type { ProjectRoot } from "./discover.js";

export type WatchEvent = {
  type: "change";
  path: string;
  at: string;
};

export type WatchHandle = {
  on: (event: "error", listener: () => void) => unknown;
  close: () => void;
};

export type WatchFactory = (
  path: string,
  options: { recursive: true },
  listener: (event: "rename" | "change", filename: string | Buffer | null) => void,
) => WatchHandle;

const defaultWatchFactory: WatchFactory = (path, options, listener) =>
  watch(path, options, listener);

export function watchOpenspec(
  root: ProjectRoot,
  onEvent: (event: WatchEvent) => void,
  debounceMs = 250,
  watchFactory: WatchFactory = defaultWatchFactory,
): { close: () => void } {
  const watchers: WatchHandle[] = [];
  let timer: NodeJS.Timeout | null = null;
  let lastPath = root.openspecDir;
  let closed = false;

  const fire = (filename: string | null) => {
    if (closed) return;
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
    const w = watchFactory(root.openspecDir, { recursive: true }, (_event, filename) => {
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
      if (closed) return;
      closed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
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
