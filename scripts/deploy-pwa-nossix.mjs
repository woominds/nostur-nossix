// scripts/deploy-pwa-nossix.mjs

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const HOST = "s13444.usc1.stableserver.net";
const USER = "jbaticac";
const SSH_KEY = path.join(process.env.HOME || "", ".ssh/nostur_fastcomet_deploy");

const LOCAL_DIST = "dist/";
const REMOTE_PATH = "/home/jbaticac/nossix.nostur.com.ar/app/";

function run(command) {
  console.log(`\n$ ${command}\n`);
  execSync(command, { stdio: "inherit" });
}

if (!existsSync("dist/index.html")) {
  console.error("No existe dist/index.html. Ejecutá primero npm run build:web.");
  process.exit(1);
}

if (!existsSync(SSH_KEY)) {
  console.error(`No existe la key SSH: ${SSH_KEY}`);
  process.exit(1);
}

run(
  `rsync -avz --delete -e "ssh -i ${SSH_KEY}" ${LOCAL_DIST} ${USER}@${HOST}:${REMOTE_PATH}`
);

console.log("\nPWA NOSSIX subida correctamente:");
console.log("https://nossix.nostur.com.ar/app/");