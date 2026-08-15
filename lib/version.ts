/**
 * Einzige Quelle der Versionsnummer ist das Feld "version" in package.json.
 * next.config.ts liest es beim Build aus und reicht es als
 * NEXT_PUBLIC_APP_VERSION durch — dadurch kann die angezeigte Version nicht
 * mehr von der gepflegten abweichen.
 *
 * Der Fallback greift nur, wenn die Datei außerhalb eines Next-Builds
 * importiert wird (z. B. im Testlauf über tsx).
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0-dev";

/**
 * Kurzer Build-Hash des aktiven Service Workers, ermittelt aus dem Cache-Namen
 * (`gym-tracker-<hash>`, gesetzt von scripts/generate-precache-manifest.mjs).
 *
 * Die Versionsnummer sagt, welchen Stand der Code haben *sollte*. Dieser Hash
 * sagt, welcher Stand tatsächlich auf dem Gerät liegt — er ändert sich bei
 * jedem Deployment und ist damit der belastbare Nachweis, dass ein Update
 * angekommen ist.
 */
export async function getActiveBuildId(): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  try {
    const keys = await caches.keys();
    const match = keys.find((key) => key.startsWith("gym-tracker-"));
    return match ? match.slice("gym-tracker-".length) : null;
  } catch {
    return null;
  }
}
