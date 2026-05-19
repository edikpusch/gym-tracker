export type BodyWeightEntry = {
  id: string;
  weight: number;
  timestamp: number;
  note?: string;
};

export const BODY_WEIGHT_KEY = "gym-tracker-body-weight";

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function isValidEntry(value: unknown): value is BodyWeightEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<BodyWeightEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.weight === "number" &&
    typeof entry.timestamp === "number" &&
    (entry.note === undefined || typeof entry.note === "string")
  );
}

function readEntries() {
  if (!canUseStorage()) {
    return [] as BodyWeightEntry[];
  }

  try {
    const raw = window.localStorage.getItem(BODY_WEIGHT_KEY);
    if (!raw) {
      return [] as BodyWeightEntry[];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as BodyWeightEntry[];
    }

    return parsed
      .filter(isValidEntry)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Body weight entries could not be read:", error);
    return [] as BodyWeightEntry[];
  }
}

function writeEntries(entries: BodyWeightEntry[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(BODY_WEIGHT_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Body weight entries could not be written:", error);
  }
}

export function getBodyWeightEntries() {
  return readEntries();
}

export function saveBodyWeightEntry({
  weight,
  timestamp,
  note,
}: {
  weight: number;
  timestamp?: number;
  note?: string;
}) {
  const nextEntry: BodyWeightEntry = {
    id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
    weight,
    timestamp: timestamp ?? Date.now(),
    note: note?.trim() ? note.trim() : undefined,
  };

  const entries = readEntries();
  entries.push(nextEntry);
  writeEntries(entries.sort((a, b) => b.timestamp - a.timestamp));

  return nextEntry;
}

export function deleteBodyWeightEntry(id: string) {
  const entries = readEntries();
  const nextEntries = entries.filter((entry) => entry.id !== id);
  writeEntries(nextEntries);
}

export function clearBodyWeightEntries() {
  writeEntries([]);
}
