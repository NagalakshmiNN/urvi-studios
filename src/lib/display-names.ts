// How a person's name is shown on screen. Stored records keep whatever name
// they were saved under; this only changes what people read.

const SHOWN_AS: Record<string, string> = {
  lakshmi: "RamaVijaya",
  nagalakshmi: "RamaVijaya",
};

export function displayName(name: string): string {
  const key = name.trim().toLowerCase();
  return SHOWN_AS[key] ?? name;
}
