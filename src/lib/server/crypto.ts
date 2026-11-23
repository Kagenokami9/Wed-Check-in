import crypto from "node:crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SCRYPT_KEY_LEN = 64;
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type SessionRole = "member" | "admin";

export interface SignedSessionPayload {
  staffName: string;
  role: SessionRole;
  sessionVersion: number;
  iat: number;
  exp: number;
}

export interface SignedBackupBundle<TPayload = unknown> {
  schemaVersion: 1;
  exportedAt: string;
  exportedBy: string;
  checksumSha256: string;
  signatureHmacSha256: string;
  payload: TPayload;
}

/**
 * Hashes a PIN or Owner Recovery Key with a unique 16-byte random salt using scrypt.
 * Format: scrypt$<salt_hex>$<derived_hex>
 */
export function hashSecret(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(plain, salt, SCRYPT_KEY_LEN, SCRYPT_PARAMS)
    .toString("hex");
  return `scrypt$${salt}$${derived}`;
}

/**
 * Constant-time verification of a plaintext PIN/secret against a stored scrypt hash.
 */
export function verifySecret(plain: string, storedHash: string): boolean {
  if (!plain || !storedHash) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  try {
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== SCRYPT_KEY_LEN) return false;
    const actual = crypto.scryptSync(plain, saltHex, SCRYPT_KEY_LEN, SCRYPT_PARAMS);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function computeSha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashClientIp(ip: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`ip:${ip}`).digest("hex");
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function hmacSign(message: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("base64url");
}

export function signSessionToken(
  input: { staffName: string; role: SessionRole; sessionVersion: number },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  const payload: SignedSessionPayload = {
    staffName: input.staffName,
    role: input.role,
    sessionVersion: input.sessionVersion,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = hmacSign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): SignedSessionPayload | null {
  if (!token || !secret) return null;
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex !== token.lastIndexOf(".")) return null;

  const encodedPayload = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = hmacSign(encodedPayload, secret);
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as SignedSessionPayload;
    if (
      !parsed ||
      typeof parsed.staffName !== "string" ||
      (parsed.role !== "member" && parsed.role !== "admin") ||
      typeof parsed.sessionVersion !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp <= nowSeconds) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function signBackupBundle<TPayload>(
  payload: TPayload,
  exportedBy: string,
  secret: string
): SignedBackupBundle<TPayload> {
  const exportedAt = new Date().toISOString();
  const payloadCanonical = canonicalJson(payload);
  const checksumSha256 = computeSha256(payloadCanonical);
  const signingInput = `v1|${exportedAt}|${exportedBy}|${checksumSha256}`;
  const signatureHmacSha256 = crypto
    .createHmac("sha256", secret)
    .update(signingInput, "utf8")
    .digest("hex");

  return {
    schemaVersion: 1,
    exportedAt,
    exportedBy,
    checksumSha256,
    signatureHmacSha256,
    payload,
  };
}

export function verifyBackupBundle<TPayload = unknown>(
  bundle: unknown,
  secret: string
): { valid: true; bundle: SignedBackupBundle<TPayload> } | { valid: false; error: string } {
  if (!bundle || typeof bundle !== "object") {
    return { valid: false, error: "รูปแบบไฟล์ Backup ไม่ถูกต้อง" };
  }

  const candidate = bundle as Partial<SignedBackupBundle<TPayload>>;
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.exportedAt !== "string" ||
    typeof candidate.exportedBy !== "string" ||
    typeof candidate.checksumSha256 !== "string" ||
    typeof candidate.signatureHmacSha256 !== "string" ||
    !candidate.payload ||
    typeof candidate.payload !== "object"
  ) {
    return { valid: false, error: "โครงสร้างไฟล์ Backup ไม่สมบูรณ์หรือเวอร์ชันไม่รองรับ" };
  }

  const actualChecksum = computeSha256(canonicalJson(candidate.payload));
  if (actualChecksum !== candidate.checksumSha256) {
    return {
      valid: false,
      error: "Checksum ของไฟล์ Backup ไม่ตรง (ไฟล์อาจเสียหายหรือถูกแก้ไข)",
    };
  }

  const signingInput = `v1|${candidate.exportedAt}|${candidate.exportedBy}|${candidate.checksumSha256}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(signingInput, "utf8")
    .digest("hex");

  const a = Buffer.from(candidate.signatureHmacSha256, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      valid: false,
      error: "ลายเซ็นดิจิทัลของไฟล์ Backup ไม่ถูกต้อง (ไฟล์ไม่ได้ออกโดยระบบนี้หรือถูกดัดแปลง)",
    };
  }

  return { valid: true, bundle: candidate as SignedBackupBundle<TPayload> };
}
