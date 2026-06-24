import { useState } from 'react';

interface Props {
  onRenew: (months: number) => void;
  clientName: string;
}

export function RenewButton({ onRenew }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customMonths, setCustomMonths] = useState('');

  const handleCustomRenew = () => {
    const months = parseInt(customMonths, 10);
    if (months > 0) {
      onRenew(months);
      setShowCustom(false);
      setCustomMonths('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onRenew(1)}
        className="text-xs bg-success text-white px-3 py-1.5 rounded font-medium hover:opacity-90 transition-opacity"
        title="Renovar 1 mes"
      >
        Mensal
      </button>

      {!showCustom ? (
        <button
          onClick={() => setShowCustom(true)}
          className="text-xs bg-accent text-white px-3 py-1.5 rounded font-medium hover:opacity-90 transition-opacity"
          title="Renovar varios meses"
        >
          2+ meses
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="2"
            value={customMonths}
            onChange={(e) => setCustomMonths(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomRenew(); }}
            placeholder="Meses"
            className="w-16 text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
            autoFocus
          />
          <button
            onClick={handleCustomRenew}
            className="text-xs bg-success text-white px-2 py-1.5 rounded font-medium hover:opacity-90 transition-opacity"
          >
            OK
          </button>
          <button
            onClick={() => { setShowCustom(false); setCustomMonths(''); }}
            className="text-xs border border-border px-2 py-1.5 rounded font-medium hover:bg-gray-50 transition-colors"
          >
            X
          </button>
        </div>
      )}
    </div>
  );
}
