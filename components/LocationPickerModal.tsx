import React, { useEffect, useRef, useState } from 'react';
import { X, Check, MapPin, Search, Loader2, Navigation } from 'lucide-react';

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
  defaultCenter = { lat: -23.5505, lng: -46.6333 } // Sao Paulo Default
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selectedPos, setSelectedPos] = useState<{lat: number, lng: number} | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Handle automatic geolocation on open if no point is set
  useEffect(() => {
    if (isOpen && !initialLat && !initialLng && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // If the user hasn't selected a point yet, move map to them
          if (!selectedPos && mapInstanceRef.current) {
            const { latitude, longitude } = position.coords;
            mapInstanceRef.current.setView([latitude, longitude], 13);
          }
        },
        (error) => console.log("Geolocation error:", error),
        { enableHighAccuracy: true }
      );
    }
  }, [isOpen, initialLat]);

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Determine start position
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
      updateMarker(lat, lng);
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

  const updateMarker = (lat: number, lng: number) => {
     if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
      }
      setSelectedPos({ lat, lng });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const numLat = parseFloat(lat);
        const numLng = parseFloat(lon);
        
        mapInstanceRef.current.setView([numLat, numLng], 13);
        updateMarker(numLat, numLng);
      } else {
        setSearchError('Local não encontrado.');
      }
    } catch (err) {
      setSearchError('Erro na busca.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCurrentLocation = () => {
     if (navigator.geolocation) {
       setIsSearching(true); // Reuse loading state
       navigator.geolocation.getCurrentPosition(
         (pos) => {
            const { latitude, longitude } = pos.coords;
            mapInstanceRef.current.setView([latitude, longitude], 15);
            updateMarker(latitude, longitude);
            setIsSearching(false);
         },
         () => {
           setSearchError('Permissão negada ou erro de GPS.');
           setIsSearching(false);
         }
       )
     }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden relative">
        
        {/* Header with Search */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-600" />
              Selecionar Localização
            </h3>
            <p className="text-xs text-slate-500">Clique no mapa para marcar o ponto exato.</p>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-slate-100">
          <div ref={mapRef} className="absolute inset-0 z-0" />
          
          {/* Search Overlay */}
          <div className="absolute top-4 left-4 right-14 sm:right-auto sm:w-80 z-[400]">
             <form onSubmit={handleSearch} className="relative shadow-lg rounded-xl">
               <input 
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Pesquisar lugar (ex: Av. Paulista)"
                 className="w-full pl-10 pr-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-brand-500 bg-white/95 backdrop-blur-sm text-sm"
               />
               <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
               {isSearching && <Loader2 className="w-4 h-4 text-brand-500 animate-spin absolute right-3 top-3.5" />}
             </form>
             {searchError && (
               <div className="mt-2 bg-red-100 text-red-600 text-xs px-3 py-2 rounded-lg border border-red-200 shadow-sm animate-fade-in">
                 {searchError}
               </div>
             )}
          </div>

          {/* GPS Button */}
          <button 
             onClick={handleCurrentLocation}
             className="absolute bottom-6 right-6 z-[400] bg-white p-3 rounded-full shadow-lg hover:bg-slate-50 text-slate-600 hover:text-brand-600 transition-colors"
             title="Usar minha localização"
          >
            <Navigation className="w-5 h-5" />
          </button>
        </div>

        {/* Footer */}
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