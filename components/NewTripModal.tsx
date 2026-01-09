import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Type, Loader2, Map as MapIcon, Check } from 'lucide-react';

export interface NewTripData {
  destination: string;
  title: string;
  startDate: string;
  endDate: string;
  lat?: number;
  lng?: number;
}

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewTripData) => Promise<void> | void;
  onOpenMapPicker: () => void;
  selectedLocation?: { lat: number; lng: number } | null;
}

export const NewTripModal: React.FC<NewTripModalProps> = ({ isOpen, onClose, onSave, onOpenMapPicker, selectedLocation }) => {
  const [formData, setFormData] = useState<NewTripData>({
    destination: '',
    title: '',
    startDate: '',
    endDate: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Update internal state when parent passes back a selected location
  useEffect(() => {
    if (selectedLocation) {
      setFormData(prev => ({ ...prev, lat: selectedLocation.lat, lng: selectedLocation.lng }));
    }
  }, [selectedLocation]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.destination || !formData.startDate || !formData.endDate) return;
    
    setIsLoading(true);
    await onSave(formData);
    setIsLoading(false);
    onClose();
    // Reset form
    setFormData({ destination: '', title: '', startDate: '', endDate: '' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">Nova Viagem</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-500" />
              Destino
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  placeholder="Ex: Tóquio, Japão"
                  className="w-full px-4 py-2.5 bg-white text-slate-900 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  value={formData.destination}
                  onChange={(e) => setFormData({...formData, destination: e.target.value})}
                />
              </div>
              <button
                type="button"
                onClick={onOpenMapPicker}
                className={`flex-shrink-0 px-3 py-2 border rounded-xl transition-all flex items-center gap-2 ${
                  formData.lat 
                    ? 'bg-brand-50 border-brand-200 text-brand-700' 
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
                title="Definir localização no mapa"
              >
                {formData.lat ? <Check className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
                <span className="text-xs font-medium hidden sm:inline">{formData.lat ? 'Definido' : 'Mapa'}</span>
              </button>
            </div>
            {formData.lat && (
              <p className="text-xs text-brand-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Localização do mapa salva
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Type className="w-4 h-4 text-brand-500" />
              Título da Viagem
            </label>
            <input
              type="text"
              placeholder="Ex: Minhas Férias Incríveis"
              className="w-full px-4 py-2.5 bg-white text-slate-900 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
            <p className="text-xs text-slate-500">Opcional. Se vazio, usaremos o destino.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-500" />
                Início
              </label>
              <input
                type="date"
                required
                style={{ colorScheme: 'light' }}
                className="w-full px-4 py-2.5 bg-white text-slate-900 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-500" />
                Fim
              </label>
              <input
                type="date"
                required
                min={formData.startDate}
                style={{ colorScheme: 'light' }}
                className="w-full px-4 py-2.5 bg-white text-slate-900 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Viagem'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};