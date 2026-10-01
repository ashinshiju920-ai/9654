import "server-only";

import { Buffer } from "node:buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing using Node.js built-in scrypt.
 *
 * scrypt is a memory-hard key derivation function that is resistant to brute
 * force attacks.  Using the built-in `node:crypto` module avoids external
 * native dependencies that can cause deployment issues on certain VPS setups.
 *
 * Format: `<salt_hex>:<hash_hex>`
 * Salt:   32 bytes (256 bits) of cryptographically secure randomness
 * Hash:   64 bytes output from scrypt
 * Cost:   N=16384 (2^14), r=8, p=1 — recommended minimum for interactive logins
 */

const SCRYPT_COST = 16384; // N — CPU/memory cost parameter (2^14)
const SCRYPT_BLOCK_SIZE = 8; // r — block size
const SCRYPT_PARALLELIZATION = 1; // p — parallelization parameter
const KEY_LENGTH = 64; // output bytes
const SALT_LENGTH = 32; // salt bytes

/**
 * Hash a plaintext password.
 *
 * @returns A string in the format `salt:hash` (both hex-encoded).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return `${Buffer.from(salt).toString("hex")}:${Buffer.from(hash).toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * Uses `timingSafeEqual` to prevent timing attacks.
 *
 * @returns `true` if the password matches.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const separatorIndex = stored.indexOf(":");

  if (separatorIndex === -1) {
    return false;
  }

  const salt = Buffer.from(stored.slice(0, separatorIndex), "hex");
  const storedHash = Buffer.from(stored.slice(separatorIndex + 1), "hex");

  if (salt.length !== SALT_LENGTH || storedHash.length !== KEY_LENGTH) {
    return false;
  }

  const candidateHash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return timingSafeEqual(storedHash, candidateHash);
}
