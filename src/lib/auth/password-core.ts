import { Buffer } from "node:buffer";
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return `${Buffer.from(salt).toString("hex")}:${Buffer.from(hash).toString("hex")}`;
}

export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return `${Buffer.from(salt).toString("hex")}:${Buffer.from(hash).toString("hex")}`;
}

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

export async function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  const separatorIndex = stored.indexOf(":");

  if (separatorIndex === -1) {
    return false;
  }

  const salt = Buffer.from(stored.slice(0, separatorIndex), "hex");
  const storedHash = Buffer.from(stored.slice(separatorIndex + 1), "hex");

  if (salt.length !== SALT_LENGTH || storedHash.length !== KEY_LENGTH) {
    return false;
  }

  const candidateHash = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return timingSafeEqual(storedHash, candidateHash);
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });
}
