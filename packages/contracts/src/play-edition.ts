/** The personal-account Google Play edition has no health services or health records. */
export const PERSONAL_PLAY_EDITION = "personal-play";
export const PLAY_EDITION_HEADER = "X-Knock-Edition";

const healthIds =
  /^(?:health|fitness|wellness)(?:[._/]|$)|^(?:course|courses|ecom|ecommerce)\.(?:health|fitness|medicine|medical|pharmacy|supplements)(?:[._]|$)/i;
export function isPlayHealthCategory(value: unknown): boolean {
  return typeof value === "string" && healthIds.test(value);
}

export function isPlayHealthRecord(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ["treeId", "categoryId", "parentId"].some((key) =>
      isPlayHealthCategory(row[key])
    ) ||
    isPlayHealthCategory(row.id) ||
    isPlayHealthCategory(row.slug) ||
    ["doctor", "lab", "fitness"].includes(String(row.kind)) ||
    ["lab", "hospital"].includes(String(row.category)) ||
    (row.category === "appointment" && !row.categoryId) ||
    (Array.isArray(row.categoryIds) &&
      row.categoryIds.some(isPlayHealthCategory)) ||
    (Array.isArray(row.categories) && row.categories.some(isPlayHealthRecord))
  );
}

export function filterPersonalPlayResponse(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return value
      .filter((row) => !isPlayHealthRecord(row))
      .map(filterPersonalPlayResponse);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isPlayHealthRecord(item) ? null : filterPersonalPlayResponse(item),
    ])
  );
}

export function containsDirectPlayHealthRecord(value: unknown): boolean {
  return (
    isPlayHealthRecord(value) ||
    Boolean(
      value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.values(value).some(isPlayHealthRecord)
    )
  );
}
