#!/usr/bin/env node
/**
 * Generates a salted scrypt hash suitable for OWNER_RECOVERY_KEY_HASH or PIN hashing.
 * Usage: node scripts/hash-secret.mjs "your-secret-value"
 */
import crypto from "node:crypto";

const input = process.argv[2];
if (!input || input.length < 6) {
  console.error('Usage: node scripts/hash-secret.mjs "<secret-at-least-6-chars>"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const derived = crypto.scryptSync(input, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
console.log(`scrypt$${salt}$${derived}`);
