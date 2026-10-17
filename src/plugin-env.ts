import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type Environment = Record<string, string | undefined>;
export type CredentialGroups = readonly (readonly string[])[];

export const PLUGIN_ENV_PATH_VARIABLE = "JURISLM_PLUGIN_ENV";

const PLACEHOLDER = /^\$\{[^}]*\}$/u;
const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u;

function isUnset(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return !trimmed || PLACEHOLDER.test(trimmed);
}

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
  const home = env.HOME?.trim() || homedir();
  const override = env[PLUGIN_ENV_PATH_VARIABLE];
  if (!override || isUnset(override)) return join(home, ".config", "jurislm", "plugin.env");
  const path = override.trim();
  return resolve(path === "~" || path.startsWith("~/") ? join(home, path.slice(1)) : path);
}

function readPluginEnv(path: string, readText: (path: string) => string, warn: (message: string) => void): Record<string, string> {
  try {
    return parsePluginEnv(readText(path));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") warn(`Could not read plugin env file ${path} (${code ?? "unknown error"})`);
    return {};
  }
}

export function withPluginEnv(
  env: Environment,
  groups: CredentialGroups,
  readText: (path: string) => string = (path) => readFileSync(path, "utf8"),
  warn: (message: string) => void = (message) => console.error(message),
): Environment {
  if (groups.every((group) => group.every((name) => !isUnset(env[name])))) return env;
  const fileValues = groups.some((group) => group.every((name) => isUnset(env[name]))) ? readPluginEnv(pluginEnvPath(env), readText, warn) : {};
  const resolved: Environment = { ...env };
  for (const group of groups) {
    const fillFromFile = group.every((name) => isUnset(env[name]));
    for (const name of group) {
      if (!isUnset(env[name])) continue;
      if (fillFromFile && !isUnset(fileValues[name])) resolved[name] = fileValues[name];
      else delete resolved[name];
    }
  }
  return resolved;
}
