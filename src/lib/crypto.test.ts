import { describe, it, expect } from 'vitest';
import { encryptText, decryptText } from './crypto';

describe('crypto', () => {
  it('should encrypt and decrypt text', async () => {
    const plain = 'my-secret-token';
    const cipher = await encryptText(plain);
    expect(cipher).not.toBe(plain);
    const decrypted = await decryptText(cipher);
    expect(decrypted).toBe(plain);
  });

  it('should return empty string as-is', async () => {
    expect(await encryptText('')).toBe('');
    expect(await decryptText('')).toBe('');
  });

  it('should produce different ciphertext for same plaintext (random IV)', async () => {
    const plain = 'test-value';
    const cipher1 = await encryptText(plain);
    const cipher2 = await encryptText(plain);
    expect(cipher1).not.toBe(cipher2);
  });

  it('should decrypt back to original for various strings', async () => {
    const tests = [
      'simple',
      'with spaces and 中文',
      'special chars: !@#$%^&*()',
      'a'.repeat(500),
    ];
    for (const plain of tests) {
      const cipher = await encryptText(plain);
      const decrypted = await decryptText(cipher);
      expect(decrypted).toBe(plain);
    }
  });
});
