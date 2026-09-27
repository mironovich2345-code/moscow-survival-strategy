import { ERROR_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';

export function ErrorBanner() {
  const error = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);
  if (!error) return null;
  return (
    <div className="error" role="alert">
      {ERROR_LABELS[error]}{' '}
      <button type="button" onClick={clearError}>
        ×
      </button>
    </div>
  );
}
