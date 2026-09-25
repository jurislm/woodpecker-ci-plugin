export interface BunPackDryRun {
  paths: string[];
  totalFiles: number;
}

export function parseBunPackOutput(output: string): BunPackDryRun {
  const paths = [...output.matchAll(/^packed\s+\S+\s+(.+)$/gmu)].map((match) => match[1]!.trim());
  const totalFiles = Number(output.match(/Total files:\s*(\d+)/u)?.[1]);
  if (!Number.isInteger(totalFiles) || paths.length !== totalFiles) {
    throw new Error(`Could not parse Bun pack output: ${paths.length} paths, total ${totalFiles}`);
  }
  return { paths, totalFiles };
}
