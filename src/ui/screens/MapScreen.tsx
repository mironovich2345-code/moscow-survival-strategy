import { useState } from 'react';
import { activeStoryTrigger, type DistrictDefinition, type LocationDefinition } from '@game/index';
import { useGameStore } from '../store/gameStore';
import { GAME_CONTENT } from '@data/content';
import { ErrorBanner } from '../components/ErrorBanner';
import { ExpeditionList } from '../components/ExpeditionList';
import { SquadPanel } from '../components/SquadPanel';
import { RISK_LABELS } from '../labels';

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
              <ul className="district__locations">
                {locations
                  .filter((location) => location.districtId === district.id)
                  .map((location) =>
                    location.kind === 'base' ? (
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
