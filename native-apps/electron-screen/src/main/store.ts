import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

let data: Record<string, unknown> = {};
let loaded = false;

function storePath(): string {
  return join(app.getPath("userData"), "config.json");
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const p = storePath();
    if (existsSync(p)) {
      data = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    }
  } catch {
    data = {};
  }
}

function save(): void {
  try {
    const dir = app.getPath("userData");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(storePath(), JSON.stringify(data, null, 2), "utf8");
  } catch {}
}

export const store = {
  get: <T>(key: string): T | null => {
    load();
    return key in data ? (data[key] as T) : null;
  },
  set: (key: string, value: unknown): void => {
    load();
    data[key] = value;
    save();
  },
  delete: (key: string): void => {
    load();
    delete data[key];
    save();
  },
};
