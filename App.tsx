import React, { useState, useEffect } from 'react';
import { Plus, Calendar, MapPin, MessageCircle, Trash2, Clock, LogOut, LogIn, UserCircle, Map as MapIcon, List, Check, DollarSign, ChevronRight, Menu, X, Plane, Globe } from 'lucide-react';
import { Trip, ItineraryDay, Activity, ActivityType } from './types';
import { ActivityIcon } from './components/ActivityIcon';
import { ChatPanel } from './components/ChatPanel';
import { LoginScreen } from './components/LoginScreen';
import { NewTripModal, NewTripData } from './components/NewTripModal';
import { TripMap } from './components/TripMap';
import { LocationPickerModal } from './components/LocationPickerModal';
import { subscribeToAuthChanges, logout, signInWithGoogle } from './services/firebase';
import { User } from 'firebase/auth';

// Helper to validate trip structure matches expected types to prevent crashes
const isValidTrip = (trip: any): trip is Trip => {
  return (
    typeof trip === 'object' &&
    trip !== null &&
    typeof trip.id === 'string' &&
    Array.isArray(trip.days)
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Initialize empty, load from local storage
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<{dayId: string, activity?: Activity} | null>(null);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  // Map/View State
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Location Picker State
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [locationPickerMode, setLocationPickerMode] = useState<'activity' | 'trip_creation'>('activity');
  const [tempTripLocation, setTempTripLocation] = useState<{lat: number, lng: number} | null>(null);

  // Global "Last Used" Center for Map
  const [lastMapCenter, setLastMapCenter] = useState<{lat: number, lng: number}>({ lat: -23.5505, lng: -46.6333 }); // Default Sao Paulo

  // Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
      setAuthLoading(false);
      // If user logs in, we might want to exit guest mode
      if (u) setIsGuestMode(false);
    });
    return () => unsubscribe();
  }, []);

  // Local Storage Persistence (Robust Loading)
  useEffect(() => {
    const savedTrips = localStorage.getItem('viajaai_trips');
    if (savedTrips) {
      try {
        const parsed = JSON.parse(savedTrips);
        if (Array.isArray(parsed) && parsed.length > 0) {
           // Validate each trip to ensure it has required fields like 'days'
           const validTrips = parsed.filter(isValidTrip);
           
           if (validTrips.length > 0) {
             setTrips(validTrips);
             setSelectedTripId(validTrips[0].id);
             // If loaded trips, update lastMapCenter to the first trip's location if available
             if (validTrips[0].lat) {
                setLastMapCenter({ lat: validTrips[0].lat!, lng: validTrips[0].lng! });
             }
           }
        }
      } catch (e) {
        console.error("Error loading local trips", e);
        // Recovery mechanism: Clear bad data
        localStorage.removeItem('viajaai_trips');
      }
    }
  }, []);

  useEffect(() => {
    // Persist trips whenever they change
    if (trips.length > 0) {
      localStorage.setItem('viajaai_trips', JSON.stringify(trips));
    } else {
      // If user deletes all trips, clear storage
      localStorage.removeItem('viajaai_trips');
    }
  }, [trips]);

  // Derived state with Safe Fallback
  const selectedTrip = trips.find(t => t.id === selectedTripId) || trips[0];

  // Update map center when trip changes, if trip has coordinates
  useEffect(() => {
    if (selectedTrip?.lat && selectedTrip?.lng) {
      setLastMapCenter({ lat: selectedTrip.lat, lng: selectedTrip.lng });
    }
  }, [selectedTripId, selectedTrip]);

  // --- COST CALCULATION ---
  const calculateTotalCost = () => {
    // Safe reduce with optional chaining
    return selectedTrip?.days?.reduce((total, day) => {
      return total + (day.activities?.reduce((dayTotal, act) => dayTotal + (act.cost || 0), 0) || 0);
    }, 0) || 0;
  };
  
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };


  // --- TRIP LOGIC ---

  const generateDays = (start: string, end: string): ItineraryDay[] => {
    const days: ItineraryDay[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Ensure accurate loop regardless of time zones by using noon
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0);
    const endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0);

    while (current <= endLimit) {
      days.push({
        id: `day-${current.getTime()}`,
        date: current.toISOString().split('T')[0],
        activities: []
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const handleCreateTrip = (data: NewTripData) => {
    const newDays = generateDays(data.startDate, data.endDate);
    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      title: data.title || data.destination,
      destination: data.destination,
      startDate: data.startDate,
      endDate: data.endDate,
      coverImage: `https://picsum.photos/1200/400?random=${Date.now()}`,
      days: newDays,
      lat: data.lat,
      lng: data.lng
    };

    setTrips(prev => [newTrip, ...prev]);
    setSelectedTripId(newTrip.id);
    
    // Update global map center
    if (data.lat && data.lng) {
      setLastMapCenter({ lat: data.lat, lng: data.lng });
    }
    setTempTripLocation(null);
  };

  // Activity Handlers exposed to UI and Chat
  const handleAddActivity = (dayId: string, activityData?: Partial<Activity>) => {
    const newActivity: Activity = {
      id: Date.now().toString() + Math.random().toString().slice(2,5), // Random ID
      time: '12:00',
      title: 'Nova Atividade',
      type: ActivityType.OTHER,
      cost: 0,
      ...activityData
    };
    
    setTrips(prevTrips => {
      return prevTrips.map(trip => {
        if (trip.id !== selectedTripId) return trip;
        
        const updatedDays = (trip.days || []).map(day => {
          if (day.id === dayId) {
            return { ...day, activities: [...(day.activities || []), newActivity].sort((a,b) => a.time.localeCompare(b.time)) };
          }
          return day;
        });

        return { ...trip, days: updatedDays };
      });
    });
    
    // Only open edit mode if called from UI (no data passed), not from Chat
    if (!activityData) {
      setEditingActivity({ dayId, activity: newActivity });
    }
  };

  const handleDeleteActivity = (dayId: string, activityId: string) => {
    setTrips(prevTrips => {
      return prevTrips.map(trip => {
        if (trip.id !== selectedTripId) return trip;

        const updatedDays = (trip.days || []).map(day => {
          if (day.id === dayId) {
            return { ...day, activities: (day.activities || []).filter(a => a.id !== activityId) };
          }
          return day;
        });
        return { ...trip, days: updatedDays };
      });
    });
  };

  const handleUpdateActivity = (dayId: string, activityId: string, updates: Partial<Activity>) => {
    setTrips(prevTrips => {
      return prevTrips.map(trip => {
        if (trip.id !== selectedTripId) return trip;

        const updatedDays = (trip.days || []).map(day => {
          if (day.id === dayId) {
            const newActivities = (day.activities || []).map(a => 
              a.id === activityId ? { ...a, ...updates } : a
            );
            return { ...day, activities: newActivities.sort((a,b) => a.time.localeCompare(b.time)) };
          }
          return day;
        });
        return { ...trip, days: updatedDays };
      });
    });
  };

  // UI Save Wrapper
  const handleSaveActivityUI = (dayId: string, updatedActivity: Activity) => {
    handleUpdateActivity(dayId, updatedActivity.id, updatedActivity);
    setEditingActivity(null);
  };

  // Map Picker Handlers
  const handleLocationSelected = (lat: number, lng: number) => {
    // Update global memory of last location
    setLastMapCenter({ lat, lng });

    if (locationPickerMode === 'activity' && editingActivity && editingActivity.activity) {
      setEditingActivity({
        ...editingActivity,
        activity: {
          ...editingActivity.activity,
          lat,
          lng,
          location: editingActivity.activity.location || 'Local selecionado no mapa'
        }
      });
    } else if (locationPickerMode === 'trip_creation') {
      setTempTripLocation({ lat, lng });
    }
    setIsLocationPickerOpen(false);
  };

  // Loading State
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  // Not Logged In & Not Guest
  if (!user && !isGuestMode) {
    return <LoginScreen onGuestLogin={() => setIsGuestMode(true)} />;
  }

  // --- EMPTY STATE (NO TRIPS) ---
  if (!selectedTrip) {
    return (
      <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden relative">
        {/* Simple Header */}
        <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center z-10">
           <h1 className="text-xl font-bold bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">ViajaAI</h1>
           {user && (
             <button onClick={() => logout()} className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-2">
               <LogOut className="w-4 h-4" /> Sair
             </button>
           )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
          <div className="w-24 h-24 bg-brand-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <Globe className="w-12 h-12 text-brand-600" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Sua próxima aventura começa aqui</h2>
          <p className="text-slate-500 max-w-md mb-8 text-lg">
            Você ainda não tem nenhuma viagem planejada. Crie seu primeiro roteiro e deixe a IA te ajudar a explorar o mundo.
          </p>
          <button 
            onClick={() => {
              setTempTripLocation(null);
              setIsNewTripModalOpen(true);
            }}
            className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-brand-500/30 transition-all flex items-center gap-3 transform hover:scale-105"
          >
            <Plus className="w-6 h-6" />
            Criar Nova Viagem
          </button>
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-brand-200/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Logic for Empty State */}
        <NewTripModal 
          isOpen={isNewTripModalOpen}
          onClose={() => setIsNewTripModalOpen(false)}
          onSave={handleCreateTrip}
          onOpenMapPicker={() => {
            setLocationPickerMode('trip_creation');
            setIsLocationPickerOpen(true);
          }}
          selectedLocation={tempTripLocation}
        />
        <LocationPickerModal
          isOpen={isLocationPickerOpen}
          onClose={() => setIsLocationPickerOpen(false)}
          initialLat={undefined}
          initialLng={undefined}
          defaultCenter={lastMapCenter}
          onSelect={handleLocationSelected}
        />
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar Toggle (Mobile) */}
      <button 
        className="md:hidden fixed top-4 left-4 z-40 bg-white p-2 rounded-lg shadow-md border border-slate-200"
        onClick={() => setSidebarOpen(!isSidebarOpen)}
      >
        <Menu className="w-5 h-5 text-slate-600" />
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col shadow-xl md:shadow-none
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
              ViajaAI
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">PLANEJAMENTO INTELIGENTE</p>
          </div>
          <button className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-2 mb-2">
            Minhas Viagens
          </div>
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => {
                setSelectedTripId(trip.id);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 group relative overflow-hidden border ${
                selectedTripId === trip.id 
                  ? 'bg-brand-50 border-brand-200 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
              }`}
            >
              {selectedTripId === trip.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 rounded-l-xl"></div>
              )}
              <div className={`font-medium truncate ${selectedTripId === trip.id ? 'text-brand-800' : 'text-slate-700'}`}>
                {trip.destination}
              </div>
              <div className="flex items-center justify-between mt-1">
                 <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(trip.startDate).toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'})}
                 </span>
                 {selectedTripId === trip.id && <ChevronRight className="w-3 h-3 text-brand-400" />}
              </div>
            </button>
          ))}
          
          <button 
            onClick={() => {
              setTempTripLocation(null);
              setIsNewTripModalOpen(true);
            }}
            className="w-full mt-2 flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova Viagem
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
           {user ? (
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3 overflow-hidden">
                 {user.photoURL ? (
                   <img src={user.photoURL} alt={user.displayName || 'User'} className="w-9 h-9 rounded-full border border-slate-200 shadow-sm" />
                 ) : (
                   <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-brand-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                      {user.email?.substring(0,2).toUpperCase()}
                   </div>
                 )}
                 <div className="flex flex-col truncate">
                   <span className="text-sm font-semibold text-slate-700 truncate">{user.displayName || 'Viajante'}</span>
                   <span className="text-[10px] text-slate-400 truncate">Conta Google</span>
                 </div>
               </div>
               <button onClick={() => logout()} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sair">
                 <LogOut className="w-4 h-4" />
               </button>
             </div>
           ) : (
             <div className="flex flex-col gap-2">
               <button 
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
               >
                 <LogIn className="w-3.5 h-3.5" />
                 Fazer Login
               </button>
               <div className="text-center text-[10px] text-slate-400">Para salvar na nuvem</div>
             </div>
           )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden w-full">
        
        {/* Top Bar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20 sticky top-0">
          <div className="flex items-center gap-4 pl-8 md:pl-0">
             <div>
               <h2 className="text-lg font-bold text-slate-800 leading-tight">
                 {selectedTrip.title}
               </h2>
               <div className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                 <span>{new Date(selectedTrip.startDate).toLocaleDateString()} - {new Date(selectedTrip.endDate).toLocaleDateString()}</span>
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center bg-slate-100/80 p-1 rounded-lg border border-slate-200/50">
               <button 
                 onClick={() => setViewMode('list')}
                 className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2 transition-all ${
                   viewMode === 'list' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 <List className="w-3.5 h-3.5" />
                 Roteiro
               </button>
               <button 
                 onClick={() => setViewMode('map')}
                 className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2 transition-all ${
                   viewMode === 'map' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 <MapIcon className="w-3.5 h-3.5" />
                 Mapa
               </button>
            </div>

            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all shadow-sm group ${
                isChatOpen 
                  ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-brand-500/30' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-brand-300'
              }`}
            >
              <MessageCircle className={`w-4 h-4 ${isChatOpen ? 'text-white' : 'text-brand-500 group-hover:scale-110 transition-transform'}`} />
              <span className="hidden sm:inline">Assistente IA</span>
            </button>
          </div>
        </header>

        {viewMode === 'map' ? (
           <div className="flex-1 relative bg-slate-100">
             <TripMap trip={selectedTrip} />
           </div>
        ) : (
          /* Scrollable Itinerary Area */
          <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
            
            {/* Hero Cover */}
            <div className="relative h-64 md:h-80 w-full group">
              <img 
                src={selectedTrip.coverImage} 
                alt={selectedTrip.destination} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
              
              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 max-w-5xl mx-auto w-full">
                <div className="flex items-center gap-2 text-brand-200 text-sm font-semibold mb-2 uppercase tracking-wider">
                  <MapPin className="w-4 h-4" />
                  {selectedTrip.destination}
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-sm">{selectedTrip.title}</h1>
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white min-w-[150px]">
                     <div className="text-xs text-white/70 uppercase font-semibold mb-1">Custo Estimado</div>
                     <div className="text-3xl font-bold tracking-tight">{formatCurrency(calculateTotalCost())}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Days Grid */}
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-10 pb-32">
              {/* Add optional chaining here to prevent crash if days is undefined */}
              {selectedTrip.days?.map((day) => (
                <div key={day.id} className="relative pl-4 md:pl-0">
                  {/* Timeline Line (Desktop) */}
                  <div className="absolute left-8 top-12 bottom-0 w-px bg-slate-200 hidden md:block -z-10"></div>

                  <div className="flex flex-col md:flex-row gap-8">
                    {/* Date Column */}
                    <div className="md:w-48 flex-shrink-0">
                      <div className="sticky top-20 bg-white rounded-xl p-4 shadow-sm border border-slate-100 inline-block md:block z-10">
                        <div className="text-3xl font-bold text-slate-800">{new Date(day.date).getDate()}</div>
                        <div className="text-sm font-bold text-brand-600 uppercase tracking-wide">
                          {new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'long' })}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 capitalize">
                          {new Date(day.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {/* Activities Column */}
                    <div className="flex-1 space-y-4">
                      {/* Add optional chaining here */}
                      {day.activities?.length === 0 ? (
                        <button 
                            onClick={() => handleAddActivity(day.id)}
                            className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-brand-300 hover:bg-white transition-all group"
                          >
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                            <Plus className="w-5 h-5" />
                          </div>
                          <span className="font-medium text-sm">Adicionar primeira atividade</span>
                        </button>
                      ) : (
                        day.activities?.map((activity) => (
                          <div 
                            key={activity.id} 
                            className={`group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:border-brand-200 relative ${editingActivity?.activity?.id === activity.id ? 'ring-2 ring-brand-500' : ''}`}
                          >
                            {editingActivity?.activity?.id === activity.id ? (
                              // Edit Mode
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Horário</label>
                                    <input 
                                      type="time" 
                                      value={editingActivity.activity!.time}
                                      onChange={(e) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity!, time: e.target.value } })}
                                      className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Tipo</label>
                                    <select 
                                      value={editingActivity.activity!.type}
                                      onChange={(e) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity!, type: e.target.value as ActivityType } })}
                                      className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50"
                                    >
                                      {Object.values(ActivityType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>
                                </div>
                                
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Título</label>
                                    <input 
                                      type="text"
                                      value={editingActivity.activity!.title}
                                      onChange={(e) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity!, title: e.target.value } })}
                                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-slate-50"
                                      placeholder="Título da atividade"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="flex gap-2">
                                    <div className="relative flex-1">
                                      <input 
                                        type="text"
                                        value={editingActivity.activity!.location || ''}
                                        onChange={(e) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity!, location: e.target.value } })}
                                        className="w-full border border-slate-300 rounded-lg p-2 pl-8 text-sm bg-slate-50"
                                        placeholder="Localização"
                                      />
                                      <MapPin className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setLocationPickerMode('activity');
                                        setIsLocationPickerOpen(true);
                                      }}
                                      className={`p-2 rounded-lg border transition-colors ${
                                        editingActivity.activity?.lat 
                                        ? 'bg-brand-50 border-brand-200 text-brand-600' 
                                        : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                                      }`}
                                      title="Selecionar no mapa"
                                    >
                                      {editingActivity.activity?.lat ? <Check className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                                    </button>
                                  </div>

                                  {/* Cost Input */}
                                  <div className="relative">
                                      <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editingActivity.activity!.cost || ''}
                                        onChange={(e) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity!, cost: parseFloat(e.target.value) || 0 } })}
                                        className="w-full border border-slate-300 rounded-lg p-2 pl-8 text-sm bg-slate-50"
                                        placeholder="Custo (R$)"
                                      />
                                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
                                  <button onClick={() => setEditingActivity(null)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">CANCELAR</button>
                                  <button onClick={() => handleSaveActivityUI(day.id, editingActivity.activity!)} className="px-6 py-2 text-xs font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-sm transition-colors">SALVAR</button>
                                </div>
                              </div>
                            ) : (
                              // View Mode
                              <div className="flex items-start gap-5">
                                <div className={`p-4 rounded-2xl bg-slate-50 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors shadow-sm`}>
                                  <ActivityIcon type={activity.type} className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                  <div className="flex items-center gap-3 mb-1.5">
                                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md tabular-nums flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {activity.time}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border border-slate-200 px-1.5 py-0.5 rounded">{activity.type}</span>
                                      {activity.cost ? (
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md ml-auto border border-emerald-100 shadow-sm">
                                            {formatCurrency(activity.cost)}
                                        </span>
                                      ) : null}
                                  </div>
                                  <h3 className="text-xl font-bold text-slate-800 leading-tight mb-1">{activity.title}</h3>
                                  {activity.location && (
                                    <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                                      <MapPin className="w-3.5 h-3.5 text-brand-400" />
                                      {activity.location}
                                    </div>
                                  )}
                                  {activity.notes && (
                                    <div className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                      {activity.notes}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Actions */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 absolute right-3 top-3">
                                    <button 
                                      onClick={() => setEditingActivity({ dayId: day.id, activity })}
                                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                      title="Editar"
                                    >
                                      <Clock className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteActivity(day.id, activity.id)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      
                      <button 
                        onClick={() => handleAddActivity(day.id)}
                        className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:text-brand-600 hover:bg-white transition-all font-medium text-sm group opacity-0 group-hover:opacity-100 hover:opacity-100 border border-transparent hover:border-slate-200 hover:shadow-sm"
                      >
                        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Adicionar ao roteiro
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Chat Panel Overlay/Sidebar */}
      <ChatPanel 
        trip={selectedTrip} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        onAddActivity={handleAddActivity}
        onUpdateActivity={handleUpdateActivity}
        onRemoveActivity={handleDeleteActivity}
      />
      
      {/* New Trip Modal */}
      <NewTripModal 
        isOpen={isNewTripModalOpen}
        onClose={() => setIsNewTripModalOpen(false)}
        onSave={handleCreateTrip}
        onOpenMapPicker={() => {
          setLocationPickerMode('trip_creation');
          setIsLocationPickerOpen(true);
        }}
        selectedLocation={tempTripLocation}
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        initialLat={locationPickerMode === 'activity' ? editingActivity?.activity?.lat : tempTripLocation?.lat}
        initialLng={locationPickerMode === 'activity' ? editingActivity?.activity?.lng : tempTripLocation?.lng}
        defaultCenter={lastMapCenter}
        onSelect={handleLocationSelected}
      />
    </div>
  );
};

export default App;