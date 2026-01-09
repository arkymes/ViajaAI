import React from 'react';
import { Utensils, Camera, Bus, Bed, MapPin } from 'lucide-react';
import { ActivityType } from '../types';

interface ActivityIconProps {
  type: ActivityType;
  className?: string;
}

export const ActivityIcon: React.FC<ActivityIconProps> = ({ type, className = "w-5 h-5" }) => {
  switch (type) {
    case ActivityType.FOOD:
      return <Utensils className={className} />;
    case ActivityType.SIGHTSEEING:
      return <Camera className={className} />;
    case ActivityType.TRANSPORT:
      return <Bus className={className} />;
    case ActivityType.LODGING:
      return <Bed className={className} />;
    default:
      return <MapPin className={className} />;
  }
};
