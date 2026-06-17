import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const packageJsonPath = path.join(ROOT, "package.json");

function readPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.version || "";
  } catch {
    return "";
  }
}

const packageVersion = readPackageVersion();

const env = {
  ...process.env,

  TENANT: process.env.TENANT || "nossix",
  VERSION: process.env.VERSION || packageVersion,
  PLATFORM: process.env.PLATFORM || "all",

  RELEASE_SOURCE_DIR: process.env.RELEASE_SOURCE_DIR || "release",
  RELEASE_OUTPUT_DIR: process.env.RELEASE_OUTPUT_DIR || "deploy-out",

  REMOTE_USER: process.env.REMOTE_USER || "jbaticac",
  REMOTE_HOST: process.env.REMOTE_HOST || "s13444.usc1.stableserver.net",
  REMOTE_BASE_PATH:
    process.env.REMOTE_BASE_PATH || "/home/jbaticac/updates.nostur.com.ar",

  SSH_KEY_PATH: process.env.SSH_KEY_PATH || `${process.env.HOME}/.ssh/nostur_release`,

  DRY_RUN: process.env.DRY_RUN || "false"
};

if (!env.VERSION) {
  console.error("\n❌ No pude detectar VERSION.");
  console.error("Usá: VERSION=0.1.3 npm run deploy:nossix\n");
  process.exit(1);
}

console.log("\n==============================");
console.log(" NOSTUR — Deploy NOSSIX");
console.log("==============================");
console.log(`Tenant:     ${env.TENANT}`);
console.log(`Versión:    ${env.VERSION}`);
console.log(`Plataforma: ${env.PLATFORM}`);
console.log(`Dry run:    ${env.DRY_RUN}`);
console.log("");

const result = spawnSync("node", ["scripts/deploy-release-local.mjs"], {
  cwd: ROOT,
  env,
  stdio: "inherit"
});

process.exit(result.status ?? 1);