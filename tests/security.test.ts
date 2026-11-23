import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashSecret,
  verifySecret,
  signSessionToken,
  verifySessionToken,
  signBackupBundle,
  verifyBackupBundle,
  hashClientIp,
} from "../src/lib/server/crypto";

describe("Security Crypto Module", () => {
  it("hashes secrets with unique random salts and verifies accurately", () => {
    const hashA = hashSecret("256900");
    const hashB = hashSecret("256900");

    assert.ok(hashA.startsWith("scrypt$"));
    assert.notEqual(hashA, hashB, "Same PIN must produce distinct salted hashes");
    assert.equal(verifySecret("256900", hashA), true);
    assert.equal(verifySecret("256900", hashB), true);
    assert.equal(verifySecret("256901", hashA), false);
    assert.equal(verifySecret("", hashA), false);
    assert.equal(verifySecret("256900", "invalid-format"), false);
  });

  it("signs and verifies HMAC session tokens and rejects tampering or expiry", () => {
    const secret = "a".repeat(64);
    const now = 1_800_000_000;
    const token = signSessionToken(
      { staffName: "พี่ฟ้า", role: "admin", sessionVersion: 3 },
      secret,
      now
    );

    const verified = verifySessionToken(token, secret, now + 60);
    assert.ok(verified);
    assert.equal(verified.staffName, "พี่ฟ้า");
    assert.equal(verified.role, "admin");
    assert.equal(verified.sessionVersion, 3);

    // Wrong secret rejected
    assert.equal(verifySessionToken(token, "b".repeat(64), now + 60), null);

    // Expired token rejected
    assert.equal(verifySessionToken(token, secret, now + 60 * 60 * 13), null);

    // Tampered payload rejected
    const [, sig] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        staffName: "attacker",
        role: "admin",
        sessionVersion: 3,
        iat: now,
        exp: now + 99999,
      })
    ).toString("base64url");
    assert.equal(verifySessionToken(`${tamperedPayload}.${sig}`, secret, now + 60), null);
  });

  it("signs and verifies off-site backup bundles and detects any payload tampering", () => {
    const secret = "s".repeat(64);
    const payload = {
      rooms: [{ id: "m1-5", name: "ม.1/5" }],
      students: [{ id: "00001", first_name: "สมชาย" }],
      attendance_sessions: [],
      attendance_entries: [],
    };

    const bundle = signBackupBundle(payload, "หัวหน้าสีฟ้า", secret);
    const okResult = verifyBackupBundle(bundle, secret);
    assert.equal(okResult.valid, true);

    // Tamper with a student name inside payload -> checksum mismatch
    const tampered = structuredClone(bundle);
    tampered.payload.students[0].first_name = "แอบแก้";
    const tamperedResult = verifyBackupBundle(tampered, secret);
    assert.equal(tamperedResult.valid, false);

    // Wrong signing secret -> HMAC signature mismatch
    const wrongKeyResult = verifyBackupBundle(bundle, "z".repeat(64));
    assert.equal(wrongKeyResult.valid, false);
  });

  it("deterministically hashes client IP with server secret without leaking raw IP", () => {
    const ipHash = hashClientIp("203.0.113.42", "secret-pepper-value");
    assert.equal(ipHash.length, 64);
    assert.ok(!ipHash.includes("203.0.113.42"));
    assert.equal(ipHash, hashClientIp("203.0.113.42", "secret-pepper-value"));
  });
});
