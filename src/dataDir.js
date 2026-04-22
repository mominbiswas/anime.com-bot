import path from "node:path";

export function getDataDir() {
  const configuredDataDir = process.env.DATA_DIR?.trim();

  if (configuredDataDir) {
    return path.resolve(configuredDataDir);
  }

  return path.resolve(process.cwd(), "data");
}
