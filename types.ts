export enum ActivityType {
  SIGHTSEEING = 'SIGHTSEEING',
  FOOD = 'FOOD',
  TRANSPORT = 'TRANSPORT',
  LODGING = 'LODGING',
  OTHER = 'OTHER'
}

export interface Activity {
  id: string;
  time: string;
  title: string;
  location?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  cost?: number; // New field for cost
  type: ActivityType;
}

export interface ItineraryDay {
  id: string;
  date: string; // ISO string
  activities: Activity[];
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  days: ItineraryDay[];
  coverImage?: string;
  lat?: number;
  lng?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}