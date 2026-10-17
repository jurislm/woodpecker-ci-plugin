import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Environment = Record<string, string | undefined>;

export const PLUGIN_ENV_PATH_VARIABLE = "JURISLM_PLUGIN_ENV";

const PLACEHOLDER = /^\$\{[^}]*\}$/u;
const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u;

function isUnset(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return !trimmed || PLACEHOLDER.test(trimmed);
}

/** Parses a dotenv-style file (`KEY=value` or `export KEY=value`) without evaluating shell syntax. */
export function parsePluginEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/u)) {
    const match = ASSIGNMENT.exec(rawLine.trim());
    if (!match) continue;
    const [, name, rawValue] = match;
    const quote = rawValue[0];
    if (quote === '"' || quote === "'") {
      const end = rawValue.indexOf(quote, 1);
      if (end > 0) values[name] = rawValue.slice(1, end);
    } else {
      values[name] = rawValue.replace(/\s+#.*$/u, "").trim();
    }
  }
  return values;
}

export function pluginEnvPath(env: Environment): string {
  const override = env[PLUGIN_ENV_PATH_VARIABLE];
  if (override && !isUnset(override)) return override.trim();
  return join(env.HOME?.trim() || homedir(), ".config", "jurislm", "plugin.env");
}

/**
 * Returns a copy of `env` where each named variable that is missing, empty, or an unsubstituted
 * `${...}` placeholder is filled from the JurisLM plugin env file. Real host values always win;
 * unresolved placeholders are dropped so callers report the variable as missing.
 */
export function withPluginEnv(
  env: Environment,
  names: readonly string[],
  readText: (path: string) => string = (path) => readFileSync(path, "utf8"),
  warn: (message: string) => void = (message) => console.error(message),
): Environment {
  const missing = names.filter((name) => isUnset(env[name]));
  if (missing.length === 0) return env;
  let fileValues: Record<string, string> = {};
  const path = pluginEnvPath(env);
  try {
    fileValues = parsePluginEnv(readText(path));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") warn(`Could not read plugin env file ${path} (${code ?? "unknown error"})`);
  }
  const resolved: Environment = { ...env };
  for (const name of missing) {
    if (isUnset(fileValues[name])) delete resolved[name];
    else resolved[name] = fileValues[name];
  }
  return resolved;
}
