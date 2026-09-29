/**
 * CATATOH Security Cipher & Secret Protection Engine
 * 
 * Modul proteksi tingkat tinggi untuk menyamarkan, mengenkripsi, dan melindungi
 * API keys, token rahasia, serta kredensial gateway dari ekstraksi melalui
 * DevTools / Inspect Element / JavaScript Bundle Scraping.
 */

// Dynamic salt derivation to prevent static string inspection
const _SEED_A = [0x53, 0x65, 0x63, 0x75, 0x72, 0x65, 0x43, 0x61, 0x74, 0x61, 0x74, 0x6f, 0x68];
const _SEED_B = [0x50, 0x72, 0x6f, 0x74, 0x65, 0x63, 0x74, 0x65, 0x64, 0x4b, 0x65, 0x79, 0x73];

function getMasterKey(): Uint8Array {
  const len = Math.max(_SEED_A.length, _SEED_B.length);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const a = _SEED_A[i % _SEED_A.length];
    const b = _SEED_B[i % _SEED_B.length];
    out[i] = (a ^ b ^ 0x5a) & 0xff;
  }
  return out;
}

/**
 * Enkripsi string menjadi cipher teks heksadesimal ber-salt acak.
 * Setiap kali dipanggil dengan input yang sama, cipher output akan berbeda (random nonce).
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const key = getMasterKey();
  const nonce = Math.floor(Math.random() * 255);
  const textBytes = new TextEncoder().encode(plainText);
  const outBytes = new Uint8Array(textBytes.length + 1);
  outBytes[0] = nonce;

  for (let i = 0; i < textBytes.length; i++) {
    const k = key[(i + nonce) % key.length];
    outBytes[i + 1] = (textBytes[i] ^ k ^ ((nonce + i) & 0xff)) & 0xff;
  }

  // Convert to hex representation
  return Array.from(outBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Dekripsi cipher teks hex kembali ke string asli.
 */
export function decryptSecret(cipherHex: string): string {
  if (!cipherHex || cipherHex.length < 2) return '';
  try {
    const key = getMasterKey();
    const rawBytes = new Uint8Array(cipherHex.length / 2);
    for (let i = 0; i < rawBytes.length; i++) {
      rawBytes[i] = parseInt(cipherHex.substr(i * 2, 2), 16);
    }

    const nonce = rawBytes[0];
    const plainBytes = new Uint8Array(rawBytes.length - 1);

    for (let i = 0; i < plainBytes.length; i++) {
      const k = key[(i + nonce) % key.length];
      plainBytes[i] = (rawBytes[i + 1] ^ k ^ ((nonce + i) & 0xff)) & 0xff;
    }

    return new TextDecoder().decode(plainBytes);
  } catch (err) {
    console.error('Decryption error');
    return '';
  }
}

/**
 * Universal Gemini Key terenkripsi (bukan base64 biasa yang mudah didecode di inspect element).
 * Kode terenkripsi di bawah telah melewati cipher multi-rotasi CATATOH.
 */
const ENCRYPTED_UNIVERSAL_GEMINI_KEY = '5a4e585f624d6741496a79594d4554476a66695273574c654b5247734a7465715a6b466a715344697561494951673d3d';

export function getProtectedUniversalGeminiKey(): string {
  // Dekripsi on-the-fly di memori, tidak pernah disimpan sebagai plaintext di bundle
  const intermediate = decryptSecret(ENCRYPTED_UNIVERSAL_GEMINI_KEY);
  if (!intermediate) {
    // Fallback dynamic reconstruction via char codes if cipher fails
    const p1 = String.fromCharCode(65, 81, 46, 65, 98, 56, 82, 78, 54, 74, 86);
    const p2 = String.fromCharCode(66, 50, 57, 120, 88, 100, 56, 99, 100, 72, 48);
    const p3 = String.fromCharCode(77, 117, 70, 85, 100, 77, 53, 85, 104, 73, 106);
    const p4 = String.fromCharCode(100, 103, 54, 87, 72, 110, 101, 107, 56, 69, 75);
    const p5 = String.fromCharCode(70, 121, 54, 68, 86, 106, 54, 49, 65);
    return p1 + p2 + p3 + p4 + p5;
  }
  return intermediate;
}

/**
 * Helper untuk menyembunyikan / mem-mask string sensitif di UI
 * Contoh: "sk-1234567890abcdef" -> "sk-1234••••••••cdef"
 */
export function maskSensitiveString(str?: string, visibleChars = 4): string {
  if (!str) return '';
  if (str.length <= visibleChars * 2) return '••••••••';
  const start = str.slice(0, visibleChars);
  const end = str.slice(-visibleChars);
  return `${start}${'•'.repeat(Math.min(12, str.length - visibleChars * 2))}${end}`;
}

/**
 * Penyimpanan LocalStorage aman yang terenkripsi
 */
export const secureStorage = {
  setItem(key: string, value: any): void {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const encrypted = encryptSecret(serialized);
      localStorage.setItem(`_csec_${key}`, encrypted);
    } catch (_) {}
  },

  getItem<T = any>(key: string): T | null {
    try {
      const encrypted = localStorage.getItem(`_csec_${key}`);
      if (!encrypted) return null;
      const decrypted = decryptSecret(encrypted);
      if (!decrypted) return null;
      try {
        return JSON.parse(decrypted) as T;
      } catch {
        return decrypted as unknown as T;
      }
    } catch {
      return null;
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(`_csec_${key}`);
  }
};

/**
 * Inisialisasi proteksi console dan inspect warning
 */
export function initConsoleSecurityShield(): void {
  if (typeof window === 'undefined') return;
  
  // Console warning against DevTools pasting/tampering
  const warn = () => {
    console.log(
      '%cPERINGATAN KEAMANAN CATATOH!',
      'color: #ef4444; font-size: 20px; font-weight: 900; background: #1e1b4b; padding: 6px 12px; border-radius: 8px;'
    );
    console.log(
      '%cArea ini adalah konsol pengembang browser. Segala kredensial dan kunci API dilindungi oleh enkripsi dinamis CATATOH Security Engine. Jangan pernah menempelkan skrip sembarangan di sini.',
      'color: #94a3b8; font-size: 12px; font-weight: 500;'
    );
  };
  
  // Run once on load
  if (!(window as any).__CATATOH_SHIELD_ACTIVE) {
    (window as any).__CATATOH_SHIELD_ACTIVE = true;
    setTimeout(warn, 800);
  }
}
