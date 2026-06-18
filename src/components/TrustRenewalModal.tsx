interface Props {
  isOpen: boolean;
  clientName: string;
  initialDate: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
}

export function TrustRenewalModal({ isOpen, clientName, initialDate, onClose, onConfirm }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-2">Renovar em Confiança</h2>
          <p className="text-sm text-gray-500 mb-4">
            Defina a data prometida de pagamento para {clientName}.
          </p>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              onConfirm(String(formData.get('trustPaymentDate') ?? ''));
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1">Data prometida</label>
              <input
                type="date"
                name="trustPaymentDate"
                required
                defaultValue={initialDate}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-warning text-white rounded-lg py-2 font-medium hover:opacity-90 transition-opacity"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-border rounded-lg py-2 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}