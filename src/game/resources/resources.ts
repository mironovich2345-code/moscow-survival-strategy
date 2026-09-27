export const RESOURCE_KINDS = [
  'food',
  'water',
  'medicine',
  'ammunition',
  'fuel',
  'materials',
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export type Resources = Readonly<Record<ResourceKind, number>>;

export type ResourceDelta = Readonly<Partial<Record<ResourceKind, number>>>;

export function createResources(initial: ResourceDelta = {}): Resources {
  const result: Record<ResourceKind, number> = {
    food: 0,
    water: 0,
    medicine: 0,
    ammunition: 0,
    fuel: 0,
    materials: 0,
  };
  for (const kind of RESOURCE_KINDS) {
    result[kind] = Math.max(0, Math.floor(initial[kind] ?? 0));
  }
  return result;
}

/** Applies a (possibly negative) delta. Stock never drops below zero. */
export function applyResourceDelta(resources: Resources, delta: ResourceDelta): Resources {
  const result: Record<ResourceKind, number> = { ...resources };
  for (const kind of RESOURCE_KINDS) {
    const change = delta[kind];
    if (change !== undefined) {
      result[kind] = Math.max(0, result[kind] + change);
    }
  }
  return result;
}

export function hasResources(resources: Resources, cost: ResourceDelta): boolean {
  return RESOURCE_KINDS.every((kind) => resources[kind] >= (cost[kind] ?? 0));
}

export function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === 'string' && (RESOURCE_KINDS as readonly string[]).includes(value);
}
