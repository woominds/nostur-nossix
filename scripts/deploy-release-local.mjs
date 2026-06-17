import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const CONFIG = {
  tenant: process.env.TENANT || "nossix",
  version: process.env.VERSION || "",
  platform: process.env.PLATFORM || "all",
  sourceDir: process.env.RELEASE_SOURCE_DIR || "dist",
  outputDir: process.env.RELEASE_OUTPUT_DIR || "deploy-out",
  remoteUser: process.env.REMOTE_USER || "",
  remoteHost: process.env.REMOTE_HOST || "",
  remoteBasePath: process.env.REMOTE_BASE_PATH || "",
  dryRun: process.env.DRY_RUN === "true"
};

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function log(message) {
  console.log(`\n${message}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return listFilesRecursive(fullPath);
    }

    return [fullPath];
  });
}

function copyFile(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  console.log(`   ✅ ${path.basename(source)}`);
}

function getPlatformFiles(allFiles, platform, version) {
  const normalizedPlatform = platform.toLowerCase();

 if (normalizedPlatform === "mac") {
  return allFiles.filter((file) => {
    const name = path.basename(file);

    return (
      name === "latest-mac.yml" ||
      name === `NOSTUR-${version}-arm64-mac.dmg` ||
      name === `NOSTUR-${version}-arm64-mac.dmg.blockmap` ||
      name === `NOSTUR-${version}-arm64-mac.zip` ||
      name === `NOSTUR-${version}-arm64-mac.zip.blockmap`
    );
  });
}

if (normalizedPlatform === "win") {
  return allFiles.filter((file) => {
    const name = path.basename(file);

    return (
      name === "latest.yml" ||
      name === `NOSTUR-Setup-${version}.exe` ||
      name === `NOSTUR-Setup-${version}.exe.blockmap`
    );
  });
}

  fail(`Plataforma inválida: ${platform}. Usá mac, win o all.`);
}

function deployPlatform(platform) {
  const sourceAbsolute = path.resolve(ROOT, CONFIG.sourceDir);

  if (!fs.existsSync(sourceAbsolute)) {
    fail(`No existe la carpeta de releases: ${sourceAbsolute}`);
  }

  const allFiles = listFilesRecursive(sourceAbsolute);
  const platformFiles = getPlatformFiles(allFiles, platform, CONFIG.version);

  if (platformFiles.length === 0) {
    fail(
      `No encontré archivos para plataforma ${platform} versión ${CONFIG.version} dentro de ${sourceAbsolute}`
    );
  }

  const localTargetDir = path.resolve(
    ROOT,
    CONFIG.outputDir,
    CONFIG.tenant,
    "desktop",
    platform
  );

  ensureDir(localTargetDir);

  log(`📦 Preparando release ${CONFIG.tenant} / ${platform} / ${CONFIG.version}`);

  platformFiles.forEach((file) => {
    copyFile(file, path.join(localTargetDir, path.basename(file)));
  });

  if (!CONFIG.remoteUser || !CONFIG.remoteHost || !CONFIG.remoteBasePath) {
    log("⚠️ No hay datos SSH completos. Se preparó solo la carpeta local.");
    console.log(`\nCarpeta local:\n${localTargetDir}\n`);
    return;
  }

  const remoteTarget = `${CONFIG.remoteUser}@${CONFIG.remoteHost}:${CONFIG.remoteBasePath}/${CONFIG.tenant}/desktop/${platform}/`;

  log(`🚀 Subida por rsync`);
  console.log(`Origen:  ${localTargetDir}/`);
  console.log(`Destino: ${remoteTarget}`);

  if (CONFIG.dryRun) {
    log("🧪 DRY_RUN activo. No se subió nada.");
    return;
  }

 const sshKeyPath = process.env.SSH_KEY_PATH || "";

const rsyncArgs = [
  "-avz",
  "--progress"
];

if (sshKeyPath) {
  rsyncArgs.push("-e", `ssh -i ${sshKeyPath}`);
}

rsyncArgs.push(`${localTargetDir}/`, remoteTarget);

const rsync = spawnSync("rsync", rsyncArgs, {
  stdio: "inherit"
});

  if (rsync.status !== 0) {
    fail("Falló la subida por rsync.");
  }

  log(`✅ Release subida correctamente: ${platform}`);
}

function main() {
  if (!CONFIG.version) {
    fail("Falta VERSION. Ejemplo: VERSION=0.1.3");
  }

  const platforms =
    CONFIG.platform === "all"
      ? ["mac", "win"]
      : [CONFIG.platform];

  console.log("\n==============================");
  console.log(" NOSTUR — Deploy local release");
  console.log("==============================");
  console.log(`Tenant:     ${CONFIG.tenant}`);
  console.log(`Versión:    ${CONFIG.version}`);
  console.log(`Plataforma: ${CONFIG.platform}`);
  console.log(`Source:     ${CONFIG.sourceDir}`);
  console.log(`Output:     ${CONFIG.outputDir}`);

  platforms.forEach(deployPlatform);

  log("✅ Proceso terminado.");
}

main();