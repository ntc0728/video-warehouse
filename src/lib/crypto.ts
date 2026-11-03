/**
 * 客户端 AES-GCM 加密/解密工具
 * 用于敏感配置（TMDB Token、百度翻译 Secret Key）的加密存储
 *
 * 注意：crypto.subtle 仅在安全上下文（localhost / https）可用
 *
 * ⚠️ 安全边界（2026-11-03 明确，别高估它的作用）
 * ─────────────────────────────────────────────────────────────
 * 密钥 `ENCRYPTION_KEY` 是**写死在前端源码里的常量**，会随 bundle 一起下发
 * （dist 里可 grep 到）。因此本模块**只做到「让 localStorage 里的值不是明文」**：
 *   ✅ 防：随手打开 devtools → Application → localStorage 一眼看到 token 原值；
 *          截图 / 日志 / 同步到云端的 localStorage dump 里不出现明文。
 *   ❌ 不防：任何能执行本页 JS 的人（自身浏览器 devtools、恶意扩展、XSS、
 *          同源脚本）—— 他们能直接调 decryptText() 或读内存里的明文。
 *
 * 这不是实现缺陷，而是纯前端存储的**本质上限**：客户端持有解密能力，就不可能
 * 对客户端保密。真正的凭据保护必须放在服务端（OAuth 授权码换 token、后端代理
 * 转发请求、token 不下发前端）。
 *
 * 结论：请把它当作「防肩窥的混淆层」，**不要**在安全评审 / 文档里表述为
 * 「加密保护敏感数据」。若将来要提升，方向是「token 不下发前端」而非换密钥。
 */

// ⚠️ 硬编码密钥：随 bundle 下发，不构成安全边界（详见文件头「安全边界」）。
//    改动它会让所有已加密的存量数据解密失败（decryptText 的 catch 会回落成密文字符串），
//    故除非同时提供迁移逻辑，切勿修改。
const ENCRYPTION_KEY = 'video-warehouse-v1';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptText(plain: string): Promise<string> {
  if (!plain) return plain;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plain),
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return arrayBufferToBase64(combined);
}

export async function decryptText(cipher: string): Promise<string> {
  if (!cipher) return cipher;
  try {
    const key = await getKey();
    const data = new Uint8Array(base64ToArrayBuffer(cipher));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // 兼容旧明文数据：解密失败时直接返回原字符串
    return cipher;
  }
}
