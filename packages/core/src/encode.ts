/**
 * Percent-encoding layer (ADR-0007 §2): canonical encoding covers exactly the
 * six structural characters (uppercase hex); decoding accepts any valid %XX
 * UTF-8 sequence. RFC 3986-style — '+' and space are literal.
 */

const ENCODE_RE = /[%,;:&=]/g;
const ENCODE_MAP: Readonly<Record<string, string>> = {
  "%": "%25",
  ",": "%2C",
  ";": "%3B",
  ":": "%3A",
  "&": "%26",
  "=": "%3D",
};

export function encodeValue(value: string): string {
  return value.replace(ENCODE_RE, (ch) => ENCODE_MAP[ch] as string);
}

/** Returns null on malformed percent-encoding or invalid UTF-8. */
export function decodeValue(token: string): string | null {
  if (!token.includes("%")) return token;
  try {
    return decodeURIComponent(token);
  } catch {
    return null;
  }
}
