export function isWoodpeckerCi(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.CI_SYSTEM_NAME === "woodpecker";
}

export function ciMetadataValue(
  name: string,
  environment: Record<string, string | undefined> = process.env,
): string | undefined {
  return isWoodpeckerCi(environment) ? environment[name] || undefined : undefined;
}
