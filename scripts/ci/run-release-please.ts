import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReleaseRepository, releaseRepoId } from "./release-repository";

export async function runReleasePlease(
  mode: string | undefined,
  token: string | undefined,
  request: typeof fetch,
  run: (args: string[]) => Promise<number>,
): Promise<void> {
  if (mode !== "github-release" && mode !== "release-pr") throw new Error("Unsupported release mode");
  if (!token) throw new Error("GITHUB_API_TOKEN is required");
  let response: Response;
  try {
    response = await request(`https://api.github.com/repositories/${releaseRepoId}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("GitHub repository lookup failed");
  }
  if (!response.ok || response.redirected) throw new Error("GitHub repository lookup failed");
  const repository = parseReleaseRepository(await response.json().catch(() => null));
  let temporary: string | undefined;
  try {
    temporary = await mkdtemp(join(tmpdir(), "woodpecker-release-"));
    const tokenPath = join(temporary, "token");
    await writeFile(tokenPath, token, { flag: "wx", mode: 0o600 });
    const code = await run([
      "bunx", "release-please", mode,
      `--token=${tokenPath}`, `--repo-url=https://github.com/${repository.fullName}`,
      "--target-branch=main", "--config-file=release-please-config.json",
      "--manifest-file=.release-please-manifest.json",
    ]);
    if (code !== 0) throw new Error();
  } catch {
    throw new Error(`Release Please failed: ${mode}`);
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true })
      .catch(() => { throw new Error("Release Please credential cleanup failed"); });
  }
}

export async function spawnReleasePlease(
  args: string[],
  token: string | undefined,
  write: (stdout: string, stderr: string) => void,
): Promise<number> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "GITHUB_API_TOKEN"));
  const child = Bun.spawn(args, { env, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  const redact = (output: string) => token ? output.replaceAll(token, "[REDACTED]") : output;
  write(redact(stdout), redact(stderr));
  return code;
}

if (import.meta.main) {
  try {
    const token = process.env.GITHUB_API_TOKEN;
    await runReleasePlease(process.argv[2], token, fetch, (args) => spawnReleasePlease(args, token, (stdout, stderr) => {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release failed");
    process.exitCode = 1;
  }
}
