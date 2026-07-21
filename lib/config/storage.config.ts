/**
 * Storage path conventions. All paths are generated here so the layout can
 * change in one place. Layout:
 *   mills/{mill-slug}/fabrics/{FABRIC_CODE}/images/{filename}
 *   mills/{mill-slug}/fabrics/{FABRIC_CODE}/documents/{filename}
 */
export const storagePaths = {
  fabricImage: (millSlug: string, fabricCode: string, filename: string) =>
    `mills/${millSlug}/fabrics/${sanitize(fabricCode)}/images/${sanitize(filename)}`,
  fabricDocument: (millSlug: string, fabricCode: string, filename: string) =>
    `mills/${millSlug}/fabrics/${sanitize(fabricCode)}/documents/${sanitize(filename)}`,
};

export function sanitize(segment: string): string {
  return segment
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}
