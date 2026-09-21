// Kiosk Token Obfuscation and Verification
// Blends scan and manage URLs into indistinguishable cryptographic tokens
// so that teachers/observers cannot detect or guess differences in the URL.

const KIOSK_SECRET_SALT = 'KSK_SEC_9921_SCHOOL_AUTH';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function randomHex(len: number): string {
  const chars = '0123456789abcdef';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function generateKioskToken(userId: string, mode: 'scan' | 'manage'): string {
  const salt = randomHex(8);
  const modeFlag = mode === 'manage' ? 'm1' : 's0';
  const rawPayload = `${salt}:${userId}:${modeFlag}`;
  
  // Obfuscate using XOR masking with salt and secret key
  const keyStr = salt + KIOSK_SECRET_SALT + userId;
  const maskedChars: string[] = [];
  
  for (let i = 0; i < rawPayload.length; i++) {
    const charCode = rawPayload.charCodeAt(i);
    const keyChar = keyStr.charCodeAt(i % keyStr.length);
    const masked = charCode ^ keyChar;
    maskedChars.push(masked.toString(16).padStart(2, '0'));
  }
  
  const hexBody = maskedChars.join('');
  const checksum = simpleHash(hexBody + KIOSK_SECRET_SALT).toString(16).padStart(8, '0');
  
  return `${salt}${hexBody}${checksum}`;
}

export function verifyKioskToken(token: string | null | undefined, expectedUserId?: string): 'scan' | 'manage' {
  if (!token || token.length < 24) return 'scan';
  
  try {
    const salt = token.slice(0, 8);
    const checksum = token.slice(-8);
    const hexBody = token.slice(8, -8);
    
    // Verify checksum
    const expectedChecksum = simpleHash(hexBody + KIOSK_SECRET_SALT).toString(16).padStart(8, '0');
    if (checksum !== expectedChecksum) {
      // Fallback check: in case legacy token base64 is still in clipboard
      try {
        const decoded = atob(token);
        if (decoded === `admin_kiosk_${expectedUserId}`) {
          return 'manage';
        }
      } catch (legacyErr) {}
      return 'scan';
    }
    
    // Unmask
    const keyStr = salt + KIOSK_SECRET_SALT + (expectedUserId || '');
    let unmasked = '';
    for (let i = 0; i < hexBody.length; i += 2) {
      const hexPair = hexBody.slice(i, i + 2);
      const masked = parseInt(hexPair, 16);
      const keyChar = keyStr.charCodeAt((i / 2) % keyStr.length);
      unmasked += String.fromCharCode(masked ^ keyChar);
    }
    
    const parts = unmasked.split(':');
    if (parts.length >= 3 && parts[0] === salt) {
      const modeFlag = parts[2];
      if (modeFlag === 'm1') {
        if (expectedUserId && parts[1] !== expectedUserId) {
          return 'scan';
        }
        return 'manage';
      }
    }
  } catch (e) {
    // Safely fallback to scan mode
  }
  
  return 'scan';
}
