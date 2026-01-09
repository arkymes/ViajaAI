import React, { useEffect, useRef } from 'react';
import { Trip, Activity } from '../types';
import { MapPin } from 'lucide-react';

interface TripMapProps {
  trip: Trip;
}

declare const L: any;

export const TripMap: React.FC<TripMapProps> = ({ trip }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up previous map instance if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Collect all points
    const points: { lat: number; lng: number; title: string; dayIndex: number }[] = [];
    trip.days.forEach((day, index) => {
      day.activities.forEach(act => {
        if (act.lat && act.lng) {
          points.push({ lat: act.lat, lng: act.lng, title: act.title, dayIndex: index + 1 });
        }
      });
    });

    // Determine initial center
    const initialCenter = points.length > 0 
      ? [points[0].lat, points[0].lng] 
      : [48.8566, 2.3522]; // Default to Paris if empty

    const map = L.map(mapRef.current).setView(initialCenter, 13);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Add markers
    if (points.length > 0) {
      const latLngs = points.map(p => [p.lat, p.lng]);
      
      // Add path line
      if (points.length > 1) {
        L.polyline(latLngs, { color: '#2563eb', weight: 3, opacity: 0.6, dashArray: '10, 10' }).addTo(map);
      }

      points.forEach((point) => {
        // Create custom icon using HTML
        const iconHtml = `
          <div class="relative w-8 h-8 rounded-full bg-brand-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transform -translate-x-1/2 -translate-y-1/2">
            ${point.dayIndex}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-map-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });

        L.marker([point.lat, point.lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(`<b>Dia ${point.dayIndex}</b><br>${point.title}`);
      });

      // Fit bounds to show all markers
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [trip]);

  if (trip.days.every(d => d.activities.every(a => !a.lat))) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 p-8 text-center">
        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
          <MapPin className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="font-semibold text-lg text-slate-700">Visualização de Mapa</h3>
        <p className="max-w-sm mt-2">Nenhuma atividade com localização definida no mapa. Edite suas atividades e clique no ícone de localização para adicionar pontos.</p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full z-0" />;
};