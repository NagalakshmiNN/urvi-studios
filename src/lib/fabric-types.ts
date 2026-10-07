/**
 * Standard fabric types for structured filtering on the shop page.
 *
 * These are the most commonly used fabric categories in Indian women's
 * ethnic and fusion wear. Each product can be tagged with one or more
 * of these via the admin panel — stored as pipe-separated values in
 * the `fabricTags` column (e.g. "Cotton|Georgette").
 *
 * The free-text `fabric` field on products stays for descriptive copy
 * ("Pure handloom cotton with zari border"); this list is only for the
 * filter chips on the shop page.
 */
export const FABRIC_TYPES = [
  "Cotton",
  "Cambric Cotton",
  "Slub Cotton",
  "Hakoba Cotton",
  "Mul Cotton",
  "Poplin Cotton",
  "Dobby Cotton",
  "Silk",
  "Rayon",
  "Georgette",
  "Chiffon",
  "Crepe",
  "Linen",
  "Chanderi",
  "Muslin",
  "Khadi",
  "Viscose",
  "Polyester",
  "Kalamkari",
  "Ajrakh",
  "Bandhani",
  "Ikat",
  "Block Print",
  "Jamdani",
] as const;

export type FabricType = (typeof FABRIC_TYPES)[number];
