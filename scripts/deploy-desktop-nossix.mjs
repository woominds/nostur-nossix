// scripts/deploy-desktop-nossix.mjs

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const target = process.argv[2];

const HOST = "s13444.usc1.stableserver.net";
const USER = "jbaticac";
const SSH_KEY = path.join(process.env.HOME || "", ".ssh/nostur_fastcomet_deploy");

const VERSION = "0.1.7";

const CONFIG = {
  mac: {
    remoteUpdatePath: "/home/jbaticac/nossix.nostur.com.ar/desktop/mac/",
    remoteDownloadPath: "/home/jbaticac/nossix.nostur.com.ar/downloads/mac/",
    files: [
      "release/latest-mac.yml",
      `release/NOSTUR-NOSSIX-${VERSION}-arm64-mac.dmg`,
      `release/NOSTUR-NOSSIX-${VERSION}-arm64-mac.dmg.blockmap`,
      `release/NOSTUR-NOSSIX-${VERSION}-arm64-mac.zip`,
      `release/NOSTUR-NOSSIX-${VERSION}-arm64-mac.zip.blockmap`
    ],
    downloadFile: `release/NOSTUR-NOSSIX-${VERSION}-arm64-mac.dmg`
  },
  win: {
    remoteUpdatePath: "/home/jbaticac/nossix.nostur.com.ar/desktop/win/",
    remoteDownloadPath: "/home/jbaticac/nossix.nostur.com.ar/downloads/win/",
    files: [
      "release/latest.yml",
      `release/NOSTUR-NOSSIX-Setup-${VERSION}.exe`,
      `release/NOSTUR-NOSSIX-Setup-${VERSION}.exe.blockmap`
    ],
    downloadFile: `release/NOSTUR-NOSSIX-Setup-${VERSION}.exe`
  }
};

function run(command) {
  console.log(`\n$ ${command}\n`);
  execSync(command, { stdio: "inherit" });
}

if (!target || !["mac", "win"].includes(target)) {
  console.error("Uso: node scripts/deploy-desktop-nossix.mjs mac|win");
  process.exit(1);
}

if (!existsSync(SSH_KEY)) {
  console.error(`No existe la key SSH: ${SSH_KEY}`);
  process.exit(1);
}

const config = CONFIG[target];

for (const file of config.files) {
  if (!existsSync(file)) {
    console.error(`Falta archivo requerido: ${file}`);
    process.exit(1);
  }
}

run(
  `rsync -avz -e "ssh -i ${SSH_KEY}" ${config.files.join(" ")} ${USER}@${HOST}:${config.remoteUpdatePath}`
);

if (existsSync(config.downloadFile)) {
  run(
    `rsync -avz -e "ssh -i ${SSH_KEY}" ${config.downloadFile} ${USER}@${HOST}:${config.remoteDownloadPath}`
  );
}

console.log(`\nDeploy desktop ${target.toUpperCase()} finalizado.`);