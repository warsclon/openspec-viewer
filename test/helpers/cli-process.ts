import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";

export type CliProcess = {
  child: ChildProcessWithoutNullStreams;
  url: string;
  port: number;
  stdout: () => string;
  stderr: () => string;
  stop: () => Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    forced: boolean;
  }>;
};

export type StartCliProcessOptions = {
  executable: string;
  prefixArgs?: string[];
  projectDir?: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  readyTimeoutMs?: number;
  stopTimeoutMs?: number;
};

export async function startCliProcess(
  options: StartCliProcessOptions,
): Promise<CliProcess> {
  const env = { ...process.env, ...options.env };
  delete env.NODE_PATH;

  const child = spawn(
    options.executable,
    [
      ...(options.prefixArgs ?? []),
      ...(options.projectDir ? ["--path", options.projectDir] : []),
      "--host",
      "127.0.0.1",
      "--port",
      "0",
      "--no-open",
      ...(options.args ?? []),
    ],
    {
      cwd: options.cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const closed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });

  let readyTimer: NodeJS.Timeout | undefined;
  let readyAddress: { url: string; port: number };
  try {
    readyAddress = await Promise.race([
      new Promise<{ url: string; port: number }>((resolve, reject) => {
        const inspect = () => {
          const match = stdout.match(
            /UI:\s+(http:\/\/127\.0\.0\.1:(\d+))/,
          );
          if (match) {
            child.stdout.off("data", inspect);
            resolve({ url: match[1], port: Number(match[2]) });
          }
        };
        child.stdout.on("data", inspect);
        child.once("error", reject);
        inspect();
      }),
      closed.then(({ code, signal }) => {
        throw new Error(
          `CLI exited before readiness (code ${String(code)}, signal ${String(signal)}): ${stderr || stdout}`,
        );
      }),
      new Promise<never>((_resolve, reject) => {
        readyTimer = setTimeout(
          () =>
            reject(
              new Error(
                `CLI readiness timed out after ${options.readyTimeoutMs ?? 5000}ms: ${stderr || stdout}`,
              ),
            ),
          options.readyTimeoutMs ?? 5000,
        );
      }),
    ]);
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
    await closed;
    throw error;
  } finally {
    if (readyTimer) clearTimeout(readyTimer);
  }

  let stopPromise:
    | Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
        forced: boolean;
      }>
    | undefined;

  return {
    child,
    url: readyAddress.url,
    port: readyAddress.port,
    stdout: () => stdout,
    stderr: () => stderr,
    stop: () => {
      stopPromise ??= (async () => {
        if (child.exitCode !== null || child.signalCode !== null) {
          return { ...(await closed), forced: false };
        }

        child.kill("SIGTERM");
        let timer: NodeJS.Timeout | undefined;
        try {
          const result = await Promise.race([
            closed,
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error("CLI termination timed out")),
                options.stopTimeoutMs ?? 3000,
              );
            }),
          ]);
          return { ...result, forced: false };
        } catch {
          child.kill("SIGKILL");
          return { ...(await closed), forced: true };
        } finally {
          if (timer) clearTimeout(timer);
        }
      })();
      return stopPromise;
    },
  };
}
