import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptCredential, decryptCredential, isEncrypted, safeDecrypt } from "./crypto";

const VALID_KEY = "a".repeat(64);

function withKey(key: string | undefined, fn: () => void) {
  const original = process.env.ENCRYPTION_KEY;
  if (key === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = key;
  }
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = original;
    }
  }
}

beforeEach(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe("encryptCredential", () => {
  it("returns a colon-separated string with three parts", () => {
    const result = encryptCredential("my-secret");
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
  });

  it("iv hex segment is 24 characters (12 bytes)", () => {
    const result = encryptCredential("my-secret");
    const [iv] = result.split(":");
    expect(iv).toHaveLength(24);
  });

  it("produces different ciphertext on each call (random IV)", () => {
    const a = encryptCredential("same-value");
    const b = encryptCredential("same-value");
    expect(a).not.toBe(b);
  });

  it("returns empty string unchanged", () => {
    expect(encryptCredential("")).toBe("");
  });

  it("returns plaintext when ENCRYPTION_KEY is not set (graceful pass-through)", () => {
    withKey(undefined, () => {
      expect(encryptCredential("hello")).toBe("hello");
    });
  });

  it("throws when ENCRYPTION_KEY is wrong length", () => {
    withKey("deadbeef", () => {
      expect(() => encryptCredential("hello")).toThrow("ENCRYPTION_KEY must be a 64-character hex string");
    });
  });
});

describe("decryptCredential", () => {
  it("round-trips a plaintext value", () => {
    const plaintext = "super-secret-token";
    const ciphertext = encryptCredential(plaintext);
    expect(decryptCredential(ciphertext)).toBe(plaintext);
  });

  it("round-trips unicode content", () => {
    const plaintext = "Ünïcödé & emoji 🔐";
    const ciphertext = encryptCredential(plaintext);
    expect(decryptCredential(ciphertext)).toBe(plaintext);
  });

  it("returns empty string unchanged", () => {
    expect(decryptCredential("")).toBe("");
  });

  it("throws on malformed ciphertext (wrong number of segments)", () => {
    expect(() => decryptCredential("onlyone")).toThrow("Invalid encrypted credential format");
    expect(() => decryptCredential("one:two")).toThrow("Invalid encrypted credential format");
  });
});

describe("isEncrypted", () => {
  it("returns true for a value produced by encryptCredential", () => {
    const ciphertext = encryptCredential("hello");
    expect(isEncrypted(ciphertext)).toBe(true);
  });

  it("returns false for a plain string", () => {
    expect(isEncrypted("plain-text-token")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isEncrypted("")).toBe(false);
  });

  it("returns false when only two colon-separated segments", () => {
    expect(isEncrypted("aabbcc:ddeeff")).toBe(false);
  });

  it("returns false when first segment is not 24 characters", () => {
    expect(isEncrypted("short:aabbcc:ddeeff")).toBe(false);
  });
});

describe("safeDecrypt", () => {
  it("decrypts a value that was encrypted", () => {
    const plaintext = "my-api-key";
    const ciphertext = encryptCredential(plaintext);
    expect(safeDecrypt(ciphertext)).toBe(plaintext);
  });

  it("returns a plain (non-encrypted) value unchanged", () => {
    expect(safeDecrypt("raw-token-123")).toBe("raw-token-123");
  });

  it("returns empty string unchanged", () => {
    expect(safeDecrypt("")).toBe("");
  });
});
