import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/** A separate key is mandatory in production. Development ciphertext is never a production fallback. */
function encryptionKey(): Buffer {
  const configured = process.env.FITNESS_DATA_ENCRYPTION_KEY;
  if (configured) {
    const key = /^[a-f\d]{64}$/i.test(configured)
      ? Buffer.from(configured, "hex")
      : Buffer.from(configured, "base64");
    if (key.byteLength !== 32)
      throw new Error(
        "FITNESS_DATA_ENCRYPTION_KEY must encode 32 random bytes."
      );
    return key;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("FITNESS_DATA_ENCRYPTION_KEY is required in production.");
  return createHash("sha256")
    .update("anticlock-development-fitness-data-not-for-production")
    .digest();
}
export function assertFitnessPrivacyConfigured(): void {
  encryptionKey();
}
export function encryptFitnessData(ownerId: string, value: unknown): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(Buffer.from(`fitness:v1:${ownerId}`));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptFitnessData<T>(ownerId: string, value: string): T {
  const [version, nonce, tag, encrypted, ...rest] = value.split(".");
  if (version !== "v1" || !nonce || !tag || !encrypted || rest.length)
    throw new Error("Invalid fitness ciphertext.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(nonce, "base64url")
  );
  decipher.setAAD(Buffer.from(`fitness:v1:${ownerId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  ) as T;
}
