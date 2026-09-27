import { useState } from 'react';
import { activeStoryTrigger, getFlag, type DistrictDefinition, type LocationDefinition } from '@game/index';
import { useGameStore } from '../store/gameStore';
import { GAME_CONTENT } from '@data/content';
import { ErrorBanner } from '../components/ErrorBanner';
import { ExpeditionList } from '../components/ExpeditionList';
import { SquadPanel } from '../components/SquadPanel';
import {
  CONTROLLER_LABELS,
  OPERATION_SEEN_LABELS,
  RISK_LABELS,
  THREAT_LABELS,
  factionDisplayName,
} from '../labels';

const districts: readonly DistrictDefinition[] = Object.values(GAME_CONTENT.districts);
const locations: readonly LocationDefinition[] = Object.values(GAME_CONTENT.locations);

export function MapScreen({ onBack }: { readonly onBack: () => void }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const game = useGameStore((s) => s.game);
  const selected = selectedLocationId ? GAME_CONTENT.locations[selectedLocationId] : undefined;

  return (
    <div className="screen map">
      <section className="panel">
        <h2>Карта: восток Москвы</h2>
        <div className="map__grid">
          {districts.map((district) => (
            <div
              key={district.id}
              className="district"
              style={{
                gridColumn: district.mapPosition.column,
                gridRow: district.mapPosition.row,
              }}
            >
              <h3>{district.name}</h3>
              <p className="muted">{district.description}</p>
              <DistrictStatus districtId={district.id} />
              <ul className="district__locations">
                {locations
                  .filter((location) => location.districtId === district.id)
                  .filter((location) => !location.hiddenUntilFlag || getFlag(game, location.hiddenUntilFlag) === true)
                  .map((location) =>
                    location.restricted ? (
                      <li key={location.id} className="location location--restricted" title={location.description}>
                        ⚠ {location.name} <span className="risk risk--high">опасная точка</span>
                      </li>
                    ) : location.kind === 'base' ? (
                      <li key={location.id} className="location location--base">
                        ⌂ {location.name}
                      </li>
                    ) : (
                      <li key={location.id}>
                        <button
                          type="button"
                          className={
                            location.id === selectedLocationId ? 'location active' : 'location'
                          }
                          onClick={() => setSelectedLocationId(location.id)}
                        >
                          {location.name}{' '}
                          {activeStoryTrigger(game, GAME_CONTENT, location.id) && <span className="tag">сюжет</span>}{' '}
                          <span className={`risk risk--${location.risk}`}>
                            риск: {RISK_LABELS[location.risk]}
                          </span>
                        </button>
                      </li>
                    ),
                  )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <ErrorBanner />

      {selected && (
        <SquadPanel
          key={selected.id}
          location={selected}
          onSent={() => {
            setSelectedLocationId(null);
            onBack();
          }}
        />
      )}

      <section className="panel">
        <h2>Отряды в пути</h2>
        <ExpeditionList />
      </section>
    </div>
  );
}

/**
 * Controller, noise, threat and known faction activity. Noise numbers are shown
 * as-is in the prototype; undiscovered districts show nothing.
 */
function DistrictStatus({ districtId }: { readonly districtId: string }) {
  const game = useGameStore((s) => s.game);
  const district = game.districts[districtId];
  if (!district) return null;
  if (!district.discovered) return <p className="small muted">Не разведан.</p>;
  const controllerFaction = Object.values(game.factions).find((f) => f.controlledDistricts.includes(districtId));
  const controller =
    district.controller === 'none'
      ? CONTROLLER_LABELS.none
      : controllerFaction
        ? factionDisplayName(controllerFaction.id, controllerFaction.contacted)
        : CONTROLLER_LABELS[district.controller];
  const activity = Object.values(game.factions)
    .filter((f) => f.lastKnownActivity?.districtId === districtId)
    .map((f) => `${OPERATION_SEEN_LABELS[f.lastKnownActivity!.operation]} (${factionDisplayName(f.id, f.contacted)})`);
  return (
    <dl className="district__status small">
      <div>
        <dt>Контроль</dt>
        <dd>{controller}</dd>
      </div>
      <div>
        <dt>Шум</dt>
        <dd>{district.noise}</dd>
      </div>
      <div>
        <dt>Угроза</dt>
        <dd className={`threat threat--${district.threatLevel}`}>{THREAT_LABELS[district.threatLevel]}</dd>
      </div>
      {activity.length > 0 && (
        <div>
          <dt>Активность</dt>
          <dd>{activity.join('; ')}</dd>
        </div>
      )}
    </dl>
  );
}
