#!/usr/bin/env node
/**
 * Creates `.env.local` safely on the local machine with:
 * - Pre-filled SUPABASE_URL for project `blue-check-in`
 * - Randomly generated 64-char hex SESSION_SECRET
 * - Randomly generated OWNER_RECOVERY_KEY (displayed ONCE locally so the owner can save it offline)
 *   stored strictly as a salted scrypt hash in OWNER_RECOVERY_KEY_HASH.
 *
 * Refuses to overwrite an existing `.env.local` unless `--force` is passed.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const targetPath = path.join(projectRoot, ".env.local");

const force = process.argv.includes("--force");
if (fs.existsSync(targetPath) && !force) {
  console.log("[init-env] .env.local already exists. Pass --force to regenerate.");
  process.exit(0);
}

const sessionSecret = crypto.randomBytes(32).toString("hex");
const ownerKeyPlain = `BLUE-OWNER-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
const salt = crypto.randomBytes(16).toString("hex");
const ownerKeyHash = `scrypt$${salt}$${crypto
  .scryptSync(ownerKeyPlain, salt, 64, { N: 16384, r: 8, p: 1 })
  .toString("hex")}`;

const envContent = `# Server-Only Environment Variables for BLUE CHECK-IN (NEVER commit this file)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_replace_with_your_key

SESSION_SECRET=${sessionSecret}

INITIAL_STAFF_PIN=256900
INITIAL_ADMIN_PIN=996900

OWNER_RECOVERY_KEY_HASH=${ownerKeyHash}
`;

fs.writeFileSync(targetPath, envContent, { encoding: "utf8", mode: 0o600 });

console.log("Created .env.local successfully.");
console.log("");
console.log("1) Paste your SUPABASE_URL and Supabase Secret Key (`sb_secret_...`) from:");
console.log("   https://supabase.com/dashboard/project/<your-project-ref>/settings/api-keys");
console.log("   into .env.local");
console.log("");
console.log("2) Save your Owner Recovery Key offline (shown ONCE, only its scrypt hash is stored):");
console.log(`   OWNER_RECOVERY_KEY = ${ownerKeyPlain}`);
