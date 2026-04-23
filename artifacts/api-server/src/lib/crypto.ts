import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SEPARATOR = ":";

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return buf;
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  if (!key) {
    console.warn("[crypto] ENCRYPTION_KEY is not set — storing credential as plain text. Set ENCRYPTION_KEY to enable encryption.");
    return plaintext;
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), encrypted.toString("hex"), tag.toString("hex")].join(SEPARATOR);
}

export function decryptCredential(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  const parts = ciphertext.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credential format.");
  }
  const [ivHex, encryptedHex, tagHex] = parts;
  const key = getKey();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set — cannot decrypt stored credential.");
  }
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return false;
  return parts[0].length === IV_LENGTH * 2;
}

export function safeDecrypt(value: string): string {
  if (!value) return value;
  return isEncrypted(value) ? decryptCredential(value) : value;
}
