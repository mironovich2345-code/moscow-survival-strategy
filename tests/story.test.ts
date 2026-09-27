import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID, MAXIM_RECRUIT, TRAITS } from '@data/characters';
import { GAME_CONTENT } from '@data/content';
import { EVENTS, STORY_EVENTS } from '@data/events';
import { PM_PISTOL_1, WORK_JACKET_1 } from '@data/items';
import { FITNESS_CLUB_ID, LEFORTOVO_PHARMACY_ID } from '@data/locations';
import { MAX_GROUP_SIZE, createCharacter, groupSize, isAvailableForSquad, type Character } from '@game/characters';
import { choiceBlocker, validateExpedition } from '@game/expeditions';
import {
  GAME_STATE_VERSION,
  applyCommand,
  deserializeGame,
  loadGame,
  saveGame,
  type CommandResult,
  type GameCommand,
  type GameState,
} from '@game/gameState';
import { findItemLocationErrors } from '@game/inventory';
import {
  activeStoryTrigger,
  combatRole,
  getFlag,
  getTrust,
  setFlag,
  trustCategory,
  whereabouts,
} from '@game/story';
import type { GameContent } from '@game/world';
import { SAVE_V1, SAVE_V5 } from './fixtures/saves';
import { LEGACY_MAXIM, MemoryStorage, content, endTurns, newCampaign, newGame } from './helpers';

/** Story events on, random events off: arrival behaviour is fully predictable. */
const storyOnly: GameContent = { ...GAME_CONTENT, events: STORY_EVENTS };

const apply = (state: GameState, command: GameCommand, world: GameContent = storyOnly): CommandResult =>
  applyCommand(state, command, world);
function run(state: GameState, command: GameCommand, world: GameContent = storyOnly): GameState {
  const result = apply(state, command, world);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const trip = (state: GameState) => state.expeditions[0]!;
const maxim = (state: GameState) => state.characters.find((c) => c.id === MAXIM_ID);
const status = (state: GameState) => state.recruits[MAXIM_ID]?.status;
const choose = (state: GameState, choiceId: string, world: GameContent = storyOnly) =>
  run(state, { type: 'resolveEvent', expeditionId: trip(state).id, choiceId }, world);

function toClub(state: GameState, memberIds: readonly string[] = [HERO_ID]): GameState {
  return run(state, { type: 'sendExpedition', locationId: FITNESS_CLUB_ID, memberIds });
}
/** Send the hero and walk until the story pauses the trip. */
const arrive = (state: GameState) => endTurns(toClub(state), 1, storyOnly);

/** Hero meets Maxim (entered the club), decision pending. */
const meet = (seed = 1) => choose(arrive(newCampaign(seed)), 'enter');

function extra(id: string): Character {
  return createCharacter({ ...LEGACY_MAXIM, id, name: id, traits: [], equipment: { sidearm: null, primary: null, melee: null, body: null, backpack: null } });
}

// ---------------------------------------------------------------------------

describe('new campaign', () => {
  it('starts with the hero alone; Maxim exists only as a recruit', () => {
    const state = newCampaign();
    expect(state.characters.map((c) => c.id)).toEqual([HERO_ID]);
    expect(groupSize(state.characters)).toBe(1);
    expect(maxim(state)).toBeUndefined();
    expect(status(state)).toBe('unavailable');
    expect(getFlag(state, 'maxim_location_known')).toBe(true);
    expect(getFlag(state, 'maxim_met')).toBe(false);
    // Maxim's items do not exist yet.
    expect(Object.keys(state.items).sort()).toEqual([PM_PISTOL_1, WORK_JACKET_1].sort());
    expect(findItemLocationErrors(state)).toEqual([]);
  });

  it('the fitness club is on the map in Lefortovo and open for the hero', () => {
    const club = content.locations[FITNESS_CLUB_ID]!;
    expect(club).toMatchObject({ districtId: 'lefortovo', kind: 'fitness_club', risk: 'low', expeditionTurns: 2 });
    expect(club.description).not.toBe('');
    expect(validateExpedition(newCampaign(), content, FITNESS_CLUB_ID, [HERO_ID])).toBeNull();
  });
});

describe('story mission requirements', () => {
  it('the hero must go to the club while the story is open', () => {
    const state = { ...newCampaign(), characters: [...newCampaign().characters, extra('tester')] };
    expect(validateExpedition(state, content, FITNESS_CLUB_ID, ['tester'])).toBe('REQUIRED_MEMBER_MISSING');
    expect(apply(state, { type: 'sendExpedition', locationId: FITNESS_CLUB_ID, memberIds: ['tester'] })).toEqual({
      ok: false,
      error: 'REQUIRED_MEMBER_MISSING',
    });
    expect(validateExpedition(state, content, FITNESS_CLUB_ID, ['tester', HERO_ID])).toBeNull();
    // Ordinary places do not care.
    expect(validateExpedition(state, content, LEFORTOVO_PHARMACY_ID, ['tester'])).toBeNull();
  });
});

describe('story events vs random events', () => {
  it('on arrival the story event always wins, whatever the random roll', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const state = endTurns(toClub(newCampaign(seed)), 1, content); // random events ON
      expect(trip(state).pendingEventId).toBe('maxim_car');
      const types = state.log.filter((e) => e.type === 'expeditionEvent');
      expect(types).toEqual([expect.objectContaining({ eventId: 'maxim_car', story: true })]);
      expect(state.log.some((e) => e.type === 'locationArrived')).toBe(true);
    }
  });

  it('story events never come from the random pool', () => {
    for (let seed = 0; seed < 150; seed += 1) {
      const state = run(newCampaign(seed), { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] }, content);
      const after = endTurns(state, 1, content);
      const pending = after.expeditions[0]?.pendingEventId;
      if (pending) expect(Object.keys(EVENTS)).toContain(pending);
    }
    expect(Object.values(STORY_EVENTS).every((e) => e.kind === 'story')).toBe(true);
  });

  it('the trip is paused until the decision; the turn cannot end', () => {
    const state = arrive(newCampaign());
    expect(apply(state, { type: 'endTurn' })).toEqual({ ok: false, error: 'EVENT_PENDING' });
  });
});

describe('the Maxim chain', () => {
  it('«Знакомая машина» → leave: not met, trip aborted, can come back later', () => {
    let state = choose(arrive(newCampaign()), 'leave');
    expect(getFlag(state, 'maxim_met')).toBe(false);
    expect(status(state)).toBe('unavailable');
    expect(trip(state).aborted).toBe(true);
    state = endTurns(state, 1, storyOnly);
    expect(state.expeditions).toHaveLength(0);
    // Second visit: the car again.
    expect(trip(arrive(state)).pendingEventId).toBe('maxim_car');
  });

  it('enter → Maxim is found (met, available), decision pending', () => {
    const state = meet();
    expect(trip(state).pendingEventId).toBe('maxim_found');
    expect(getFlag(state, 'maxim_met')).toBe(true);
    expect(status(state)).toBe('available');
    expect(maxim(state)).toBeUndefined();
  });

  it('invite: Maxim joins the squad with freshly created axe and backpack, returns home', () => {
    const before = meet();
    const state = choose(before, 'invite');
    const m = maxim(state)!;
    expect(status(state)).toBe('recruited');
    expect(getFlag(state, 'maxim_recruited')).toBe(true);
    expect(m.assignment).toEqual({ type: 'expedition', expeditionId: trip(state).id });
    expect(trip(state).memberIds).toEqual([HERO_ID, MAXIM_ID]);
    expect(m.traits).toEqual(['reliable']);
    expect(m.condition.health).toBe(100);

    // Items: created exactly once, fresh unique ids, equipped, invariant holds.
    const axe = m.equipment.melee!;
    const pack = m.equipment.backpack!;
    expect(state.items[axe]?.defId).toBe('fire_axe');
    expect(state.items[pack]?.defId).toBe('tourist_backpack');
    // Fresh ids from the global counter: newer than anything that existed before.
    const counter = (id: string) => Number(id.split('-').at(-1));
    expect(axe).toMatch(/^fire_axe-\d+$/);
    expect(pack).toMatch(/^tourist_backpack-\d+$/);
    expect(counter(axe)).toBeGreaterThanOrEqual(before.nextId);
    expect(counter(pack)).toBe(counter(axe) + 1);
    expect(Object.keys(before.items)).not.toContain(axe);
    expect(Object.values(state.items).filter((i) => i.defId === 'fire_axe')).toHaveLength(1);
    expect(Object.values(state.items).filter((i) => i.defId === 'tourist_backpack')).toHaveLength(1);
    expect(new Set(Object.keys(state.items)).size).toBe(Object.keys(state.items).length);
    expect(findItemLocationErrors(state)).toEqual([]);

    // Trust: base 50 + 10.
    expect(getTrust(state, content, MAXIM_ID)).toBe(60);
    expect(trustCategory(60)).toBe('highTrust');

    // Journal.
    const types = state.log.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['locationArrived', 'expeditionEvent', 'eventChoice', 'recruitStatusChanged', 'characterRecruited', 'trustChanged']),
    );
    const recruited = state.log.find((e) => e.type === 'characterRecruited');
    expect(recruited).toMatchObject({ characterId: MAXIM_ID, items: [axe, pack] });

    // Home together; available for the next trip.
    const home = endTurns(state, 1, storyOnly);
    expect(home.expeditions).toHaveLength(0);
    expect(maxim(home)!.assignment).toEqual({ type: 'base' });
    expect(isAvailableForSquad(maxim(home)!)).toBe(true);
    expect(validateExpedition(home, content, LEFORTOVO_PHARMACY_ID, [MAXIM_ID])).toBeNull();
    // The club is an ordinary place now: no trigger, the hero is not required.
    expect(activeStoryTrigger(home, content, FITNESS_CLUB_ID)).toBeUndefined();
    expect(validateExpedition(home, content, FITNESS_CLUB_ID, [MAXIM_ID])).toBeNull();
    // Items are not duplicated by anything later.
    const after = endTurns(run(home, { type: 'sendExpedition', locationId: FITNESS_CLUB_ID, memberIds: [MAXIM_ID] }), 2, storyOnly);
    expect(Object.values(after.items).filter((i) => i.defId === 'fire_axe')).toHaveLength(1);
    expect(after.expeditions[0]?.pendingEventId ?? null).toBeNull();
  });

  it('stay: Maxim remains available in the club; a later visit lets you invite him', () => {
    let state = choose(meet(), 'stay');
    expect(status(state)).toBe('available');
    expect(maxim(state)).toBeUndefined();
    expect(getTrust(state, content, MAXIM_ID)).toBe(50); // no penalty
    state = endTurns(state, 1, storyOnly);
    expect(state.expeditions).toHaveLength(0);

    const again = arrive(state);
    expect(trip(again).pendingEventId).toBe('maxim_waiting');
    const joined = choose(again, 'invite');
    expect(status(joined)).toBe('recruited');
    expect(maxim(joined)).toBeDefined();
  });

  it('refuse: declined, maxim_refused, trust −20, chain closed', () => {
    const state = choose(meet(), 'refuse');
    expect(status(state)).toBe('declined');
    expect(getFlag(state, 'maxim_refused')).toBe(true);
    expect(getTrust(state, content, MAXIM_ID)).toBe(30);
    expect(maxim(state)).toBeUndefined();
    const home = endTurns(state, 1, storyOnly);
    expect(activeStoryTrigger(home, content, FITNESS_CLUB_ID)).toBeUndefined();
    expect(trip(endTurns(toClub(home), 1, storyOnly)).pendingEventId).toBeNull();
  });
});

describe('group capacity', () => {
  const crowd = (state: GameState, n: number): GameState => ({
    ...state,
    characters: [...state.characters, ...Array.from({ length: n }, (_, i) => extra(`p${i}`))],
  });

  it('a full group (12 alive) cannot recruit a 13th', () => {
    const met = meet();
    const full = crowd(met, MAX_GROUP_SIZE - 1);
    expect(groupSize(full.characters)).toBe(12);
    const invite = STORY_EVENTS.maxim_found.choices.find((c) => c.id === 'invite')!;
    expect(choiceBlocker(full, content, trip(full), invite)).toBe('GROUP_FULL');
    expect(apply(full, { type: 'resolveEvent', expeditionId: trip(full).id, choiceId: 'invite' })).toEqual({
      ok: false,
      error: 'GROUP_FULL',
    });
    // Leaving him is still possible.
    expect(apply(full, { type: 'resolveEvent', expeditionId: trip(full).id, choiceId: 'stay' }).ok).toBe(true);
  });

  it('the dead do not take a slot; potential recruits neither', () => {
    const met = meet();
    let full = crowd(met, MAX_GROUP_SIZE - 1);
    full = { ...full, characters: full.characters.map((c) => (c.id === 'p0' ? { ...c, assignment: { type: 'dead' } } : c)) };
    expect(groupSize(full.characters)).toBe(11);
    expect(status(full)).toBe('available'); // Maxim is not counted
    const joined = choose(full, 'invite');
    expect(groupSize(joined.characters)).toBe(12);
  });
});

describe('trust, traits, profile, flags', () => {
  it('trust categories', () => {
    expect(trustCategory(-100)).toBe('distrust');
    expect(trustCategory(-40)).toBe('distrust');
    expect(trustCategory(-39)).toBe('wary');
    expect(trustCategory(-10)).toBe('wary');
    expect(trustCategory(-9)).toBe('neutral');
    expect(trustCategory(19)).toBe('neutral');
    expect(trustCategory(20)).toBe('trust');
    expect(trustCategory(59)).toBe('trust');
    expect(trustCategory(60)).toBe('highTrust');
    expect(getTrust(newCampaign(), content, MAXIM_ID)).toBe(MAXIM_RECRUIT.baseTrust);
  });

  it('traits are content; a character can have several; the hero has none', () => {
    expect(TRAITS.reliable.name).toBe('Надёжный');
    expect(TRAITS.reliable.description).toBe('Редко бросает своих и спокойнее большинства действует под давлением.');
    expect(newCampaign().characters[0]!.traits).toEqual([]);
    const twoTraits = createCharacter({ ...LEGACY_MAXIM, traits: ['reliable', 'other'] });
    expect(twoTraits.traits).toHaveLength(2);
  });

  it('profile: combat role and whereabouts', () => {
    const squad = newGame();
    const hero = squad.characters[0]!;
    const legacyMaxim = squad.characters[1]!;
    expect(combatRole(hero, squad, content.items)).toBe('shooter');
    expect(combatRole(legacyMaxim, squad, content.items)).toBe('melee');
    const unarmed = { ...hero, equipment: { sidearm: null, primary: null, melee: null, body: null, backpack: null } };
    expect(combatRole(unarmed, squad, content.items)).toBe('support');
    expect(whereabouts(hero, squad)).toEqual({ type: 'base' });
    const away = choose(meet(), 'invite');
    expect(whereabouts(maxim(away)!, away)).toEqual({ type: 'expedition', locationId: FITNESS_CLUB_ID });
    expect(whereabouts({ ...hero, assignment: { type: 'dead' } }, squad)).toEqual({ type: 'dead' });
  });

  it('story flags: one shared table, missing reads as false', () => {
    const state = newCampaign();
    expect(getFlag(state, 'never_set')).toBe(false);
    const next = setFlag(setFlag(state, 'alice_seen', 'day12'), 'arena_heat', 3);
    expect(next.storyFlags).toMatchObject({ maxim_location_known: true, alice_seen: 'day12', arena_heat: 3 });
    expect(state.storyFlags).not.toHaveProperty('alice_seen');
  });
});

describe('save / load and migrations', () => {
  it('mid-story and after recruiting, save/load is lossless', () => {
    const storage = new MemoryStorage();
    const pending = meet();
    saveGame(storage, pending);
    expect(loadGame(storage)).toEqual(pending);
    const joined = choose(loadGame(storage)!, 'invite');
    saveGame(storage, joined);
    expect(loadGame(storage)).toEqual(joined);
  });

  it('v5 → v6: the test Maxim of an old campaign stays in the group', () => {
    const state = deserializeGame(JSON.stringify(SAVE_V5));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(GAME_STATE_VERSION);
    expect(maxim(state!)).toBeDefined();
    expect(status(state!)).toBe('recruited');
    expect(state!.storyFlags).toMatchObject({ maxim_location_known: true, maxim_met: true, maxim_recruited: true });
    expect(getTrust(state!, content, MAXIM_ID)).toBe(50);
    expect(maxim(state!)!.traits).toEqual(['reliable']);
    expect(state!.characters[0]!.traits).toEqual([]);
    expect(findItemLocationErrors(state!)).toEqual([]);
    // The club story is closed for such campaigns; the game plays on.
    expect(activeStoryTrigger(state!, content, FITNESS_CLUB_ID)).toBeUndefined();
    const home = endTurns(state!, 3);
    expect(home.expeditions).toHaveLength(0);
  });

  it('v5 → v6: a dead test Maxim is recorded as dead; a campaign without him gets the story', () => {
    const dead = {
      ...SAVE_V5,
      characters: SAVE_V5.characters.map((c) =>
        c.id === 'maxim'
          ? { ...c, assignment: { type: 'dead' }, condition: { ...c.condition, health: 0 }, equipment: { sidearm: null, primary: null, melee: null, body: null, backpack: null } }
          : c,
      ),
      expeditions: SAVE_V5.expeditions.map((e) => ({ ...e, memberIds: ['hero'], lostItems: ['fire_axe-1', 'tourist_backpack-1'] })),
    };
    expect(status(deserializeGame(JSON.stringify(dead))!)).toBe('dead');

    const noMaxim = { ...SAVE_V5, characters: SAVE_V5.characters.filter((c) => c.id !== 'maxim') };
    const withoutItems = {
      ...noMaxim,
      items: Object.fromEntries(Object.entries(SAVE_V5.items).filter(([id]) => id !== 'fire_axe-1' && id !== 'tourist_backpack-1')),
      expeditions: SAVE_V5.expeditions.map((e) => ({ ...e, memberIds: ['hero'] })),
    };
    const state = deserializeGame(JSON.stringify(withoutItems));
    expect(state).not.toBeNull();
    expect(status(state!)).toBe('unavailable');
    expect(state!.storyFlags).toEqual({ maxim_location_known: true });
  });

  it('the oldest (v1) save with the test Maxim still loads through the whole chain', () => {
    const state = deserializeGame(JSON.stringify(SAVE_V1));
    expect(state?.version).toBe(GAME_STATE_VERSION);
    expect(maxim(state!)).toBeDefined();
    expect(status(state!)).toBe('recruited');
  });
});
