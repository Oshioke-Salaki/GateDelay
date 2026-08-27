/**
 * Shape of a resolved market as rendered by the archive.
 *
 * Lives here rather than in `app/archive/page.tsx` because `ArchiveView`
 * previously imported it *from* the page while the page imported the component —
 * a cycle that only held together because the import was type-only. Any future
 * value export on either side would have turned it into a real one.
 */
export interface ArchivedMarket {
  id: string;
  title: string;
  description: string;
  category: string;
  resolvedOutcome: "yes" | "no" | "cancelled";
  resolutionDate: string;
  volume: number;
  participants: number;
  createdAt: string;
  endDate: string;
  finalPrice: number;
}

/** Narrowing guard for values crossing the network boundary. */
export function isArchivedMarket(value: unknown): value is ArchivedMarket {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.title === "string" &&
    typeof m.resolutionDate === "string" &&
    typeof m.volume === "number" &&
    typeof m.participants === "number"
  );
}
