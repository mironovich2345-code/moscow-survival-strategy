import { addLogEntry } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import type { GameContent } from '../world';
import {
  DISTRICT_NOISE_DECAY_PER_TURN,
  MAX_DISTRICT_NOISE,
  SIGNIFICANT_NOISE_RISE,
} from './types';
import type { DistrictState, ThreatLevel } from './types';

/** 0–19 low, 20–39 medium, 40–69 high, 70+ extreme. */
export function threatFromNoise(noise: number): ThreatLevel {
  if (noise >= 70) return 'extreme';
  if (noise >= 40) return 'high';
  if (noise >= 20) return 'medium';
  return 'low';
}

export function districtOfLocation(content: GameContent, locationId: string): string | undefined {
  return content.locations[locationId]?.districtId;
}

/** Sets a district's noise (clamped 0–100), recomputes the threat and logs what the player may know. */
function setNoise(state: GameState, districtId: string, noise: number): GameState {
  const district = state.districts[districtId];
  if (!district) return state;
  const clamped = Math.max(0, Math.min(MAX_DISTRICT_NOISE, noise));
  const threatLevel = threatFromNoise(clamped);
  const updated: DistrictState = { ...district, noise: clamped, threatLevel };
  let next: GameState = { ...state, districts: { ...state.districts, [districtId]: updated } };
  if (district.discovered && threatLevel !== district.threatLevel) {
    next = addLogEntry(next, { type: 'threatChanged', districtId, from: district.threatLevel, to: threatLevel });
  }
  return next;
}

/** districtNoise += amount (max 100). A rise of 10+ in a discovered district is journaled. */
export function addDistrictNoise(state: GameState, districtId: string, amount: number): GameState {
  const district = state.districts[districtId];
  if (!district || amount <= 0) return state;
  let next = setNoise(state, districtId, district.noise + amount);
  const rise = (next.districts[districtId]?.noise ?? 0) - district.noise;
  if (district.discovered && rise >= SIGNIFICANT_NOISE_RISE) {
    next = addLogEntry(next, {
      type: 'districtNoiseRose',
      districtId,
      amount: rise,
      noise: next.districts[districtId]?.noise ?? 0,
    });
  }
  return next;
}

/** −5 noise per turn everywhere, never below 0. */
export function decayDistrictNoise(state: GameState): GameState {
  return Object.values(state.districts).reduce(
    (current, district) =>
      district.noise > 0 ? setNoise(current, district.districtId, district.noise - DISTRICT_NOISE_DECAY_PER_TURN) : current,
    state,
  );
}

/** Districts the player can see right now: the base district and wherever a squad is. */
export function observedDistricts(state: GameState, content: GameContent): Set<string> {
  const observed = new Set<string>();
  const base = districtOfLocation(content, state.baseLocationId);
  if (base) observed.add(base);
  for (const expedition of state.expeditions) {
    const district = districtOfLocation(content, expedition.locationId);
    if (district) observed.add(district);
  }
  return observed;
}
