/**
 * Where the generator reads from and writes to, resolved from this file's own
 * location so every entry point agrees regardless of the working directory a
 * script was started in.
 *
 * Its own module because the three filesystem-touching parts of the generator
 * — build-content.js, tokens.js, check-links.js — all need these, and having
 * them own the constants instead would mean check-links.js importing from the
 * file that imports check-links.js.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const contentDir = join(root, "content");
export const publicDir = join(root, "public");

/** An absolute path as it reads in an error message: relative to the repo. */
export const rel = (path) => path.slice(root.length + 1);
