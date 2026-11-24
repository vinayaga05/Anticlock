import { introVideoMediaIdFromPublicProfile } from "../content/providerIntroClip.js";

type PublicProfile = { id: string; publicProfile: unknown; isPrivate: boolean };
type IntroRef = { providerId: string; mediaId: string };
type HiddenIntro = { providerId: string | null; mediaId: string };
type CardMedia = {
  avatarUrl: string | null;
  coverUrl: string | null;
  introVideoUrl: string | null;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const mediaId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Resolve named, public profile media only; never application/KYC attachments.
 * A page shares each lookup, and an unavailable asset leaves its image fallback intact. */
export async function resolveMarketplaceMedia(
  rows: PublicProfile[],
  resolve: (id: string, kind: "image" | "video") => Promise<string | null>,
  loadHiddenIntros: (intros: IntroRef[]) => Promise<HiddenIntro[]>
): Promise<Map<string, CardMedia>> {
  const intros = rows.flatMap((row) => {
    if (row.isPrivate) return [];
    const id = introVideoMediaIdFromPublicProfile(object(row.publicProfile));
    return id ? [{ providerId: row.id, mediaId: id }] : [];
  });
  const hidden = intros.length ? await loadHiddenIntros(intros) : [];
  const hiddenPairs = new Set(
    hidden.map((intro) => `${intro.providerId}:${intro.mediaId}`)
  );
  const allowedIntros = new Map(
    intros
      .filter(
        (intro) => !hiddenPairs.has(`${intro.providerId}:${intro.mediaId}`)
      )
      .map((intro) => [intro.providerId, intro.mediaId])
  );

  const lookups = new Map<string, Promise<string | null>>();
  const url = (id: unknown, kind: "image" | "video") => {
    if (!mediaId(id)) return Promise.resolve(null);
    const key = `${kind}:${id}`;
    if (!lookups.has(key))
      lookups.set(
        key,
        resolve(id, kind).catch(() => null)
      );
    return lookups.get(key)!;
  };
  return new Map(
    await Promise.all(
      rows.map(async (row) => {
        const profile = object(
          object(object(row.publicProfile).common).profile
        );
        const covers = Array.isArray(profile.coverMediaIds)
          ? profile.coverMediaIds
          : [];
        const [avatarUrl, coverUrl, introVideoUrl] = await Promise.all([
          url(profile.logoMediaId, "image"),
          url(covers[0], "image"),
          url(allowedIntros.get(row.id), "video"),
        ]);
        return [row.id, { avatarUrl, coverUrl, introVideoUrl }] as const;
      })
    )
  );
}
