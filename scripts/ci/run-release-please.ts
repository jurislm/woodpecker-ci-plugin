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
  const code = await run([
    "bunx", "release-please", mode,
    `--token=${token}`, `--repo-url=https://github.com/${repository.fullName}`,
    "--target-branch=main", "--config-file=release-please-config.json",
    "--manifest-file=.release-please-manifest.json",
  ]).catch(() => -1);
  if (code !== 0) throw new Error(`Release Please failed: ${mode}`);
}

if (import.meta.main) {
  try {
    await runReleasePlease(process.argv[2], process.env.GITHUB_API_TOKEN, fetch,
      (args) => Bun.spawn(args, { stdout: "inherit", stderr: "inherit" }).exited);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release failed");
    process.exitCode = 1;
  }
}
