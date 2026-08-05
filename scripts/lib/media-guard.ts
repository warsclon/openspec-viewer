/**
 * Sensitive-content guard for generated launch media.
 *
 * Rendered pixels are guarded upstream by the capture journey, which reads the
 * page text and refuses to screenshot a page containing machine paths. This
 * module guards the other half: the bytes *around* the pixels — PNG `tEXt`
 * chunks, XMP blocks, GIF comment extensions, encoder banners — where a tool
 * can silently record the absolute path it read from.
 */
import { homedir, tmpdir, userInfo } from "node:os";

/** Machine-identifying strings that must never reach a committed asset. */
export function machineTokens(): string[] {
  const tokens = [homedir(), tmpdir()];
  try {
    tokens.push(userInfo().username);
  } catch {
    // No password-file entry (some containers): the paths above still apply.
  }
  return tokens.filter((token) => token.length >= 3);
}

/**
 * Returns every token present in `bytes`, checked as both UTF-8 and UTF-16LE
 * so a token is not missed just because a writer widened it.
 */
export function findSensitiveTokens(
  bytes: Uint8Array,
  tokens: readonly string[],
): string[] {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return tokens.filter(
    (token) =>
      token.length > 0 &&
      (buffer.includes(token, 0, "utf8") ||
        buffer.includes(token, 0, "utf16le")),
  );
}

/** Throws when `bytes` carries any machine-identifying token. */
export function assertNoSensitiveTokens(
  label: string,
  bytes: Uint8Array,
  extraTokens: readonly string[] = [],
): void {
  const found = findSensitiveTokens(bytes, [
    ...machineTokens(),
    ...extraTokens,
  ]);
  if (found.length > 0) {
    throw new Error(
      `${label} embeds machine content: ${found.join(", ")}. ` +
        "Strip the asset metadata before committing it.",
    );
  }
}
