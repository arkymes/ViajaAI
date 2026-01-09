import React, { useEffect, useRef, useState } from 'react';
import { X, Check, MapPin } from 'lucide-react';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  defaultCenter?: { lat: number; lng: number };
}

declare const L: any;

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialLat, 
  initialLng,
  defaultCenter = { lat: 48.8566, lng: 2.3522 } // Fallback to Paris if absolutely nothing known
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selectedPos, setSelectedPos] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Determine start position:
    // 1. Editing an existing marker? Use that.
    // 2. Have a last known center (e.g. from Trip or previous click)? Use that.
    // 3. Default (Paris).
    const startPos: [number, number] = initialLat && initialLng 
      ? [initialLat, initialLng] 
      : [defaultCenter.lat, defaultCenter.lng];

    const map = L.map(mapRef.current).setView(startPos, 13);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Initial marker if editing existing pos
    if (initialLat && initialLng) {
      markerRef.current = L.marker([initialLat, initialLng]).addTo(map);
      setSelectedPos({ lat: initialLat, lng: initialLng });
    }

    // Click handler
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }
      setSelectedPos({ lat, lng });
    });

    // Invalidate size to ensure map renders correctly after modal open
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, initialLat, initialLng, defaultCenter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-600" />
              Selecionar Localização
            </h3>
            <p className="text-xs text-slate-500">Clique no mapa para marcar o ponto exato.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 relative bg-slate-100">
          <div ref={mapRef} className="absolute inset-0 z-0" />
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button 
            onClick={() => {
              if (selectedPos) {
                onSelect(selectedPos.lat, selectedPos.lng);
                onClose();
              }
            }}
            disabled={!selectedPos}
            className="px-6 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Confirmar Local
          </button>
        </div>

      </div>
    </div>
  );
};