import { getStore } from "@netlify/blobs";

const STORE_NAME = "review-media";

/**
 * Returns the Netlify Blobs store for review media.
 * Only works when deployed to Netlify — returns null locally.
 */
export function getMediaStore() {
  try {
    return getStore({ name: STORE_NAME, consistency: "strong" });
  } catch {
    return null;
  }
}

/**
 * Check if a dataBase64 value is actually a blob reference.
 * Blob-stored media uses "blob:<key>" as a placeholder in the DB.
 */
export function isBlobRef(dataBase64: string): boolean {
  return dataBase64.startsWith("blob:");
}

/**
 * Extract the blob key from a "blob:<key>" reference.
 */
export function getBlobKey(dataBase64: string): string {
  return dataBase64.slice(5);
}
