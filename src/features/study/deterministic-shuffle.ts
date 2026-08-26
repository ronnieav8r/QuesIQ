function keyForItem<T>(item: T, index: number) {
  if (item && typeof item === "object" && "id" in item) {
    return String((item as { id?: unknown }).id ?? index);
  }

  return `${String(item)}:${index}`;
}

function hashKey(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function deterministicShuffle<T>(items: T[], seed = "") {
  return items
    .map((item, index) => ({
      index,
      item,
      rank: hashKey(`${seed}:${keyForItem(item, index)}`),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ item }) => item);
}

export function deterministicBoolean(seed: string) {
  return hashKey(seed) % 2 === 0;
}

export function deterministicIndex(length: number, seed: string) {
  if (length <= 0) {
    return 0;
  }

  return hashKey(seed) % length;
}
