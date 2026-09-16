import { WoodpeckerClient } from "../src/client.ts";
import { loadConfig } from "../src/config.ts";
import { operations } from "../src/generated/operations.ts";

const client = new WoodpeckerClient(loadConfig());
for (const name of [
  "woodpecker_get_currently_authenticated_user",
  "woodpecker_get_version",
  "woodpecker_get_user_s_repositories",
]) {
  const operation = operations.find((candidate) => candidate.name === name);
  if (!operation) throw new Error("Generated operation not found: " + name);
  const result = await client.request(operation, {});
  console.error(name + ": HTTP " + result.status);
}
