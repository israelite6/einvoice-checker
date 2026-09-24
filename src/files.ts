// Reading user files: size limit and character decoding by BOM or XML declaration (not only UTF-8).

export const MAX_BYTES = 20 * 1024 * 1024;

const ENCODING = /^<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/;

export function decodeXml(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const declared = ENCODING.exec(head)?.[1];
  try {
    return new TextDecoder(declared ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export async function readXmlFile(file: File): Promise<string> {
  return decodeXml(new Uint8Array(await file.arrayBuffer()));
}
