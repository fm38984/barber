export type AppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'REMINDED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

export type AppointmentCreatedVia = 'WHATSAPP' | 'DASHBOARD';

export interface TimeSlot {
  start: string; // ISO 8601
  end: string;   // ISO 8601
  available: boolean;
}

export interface WorkingHours {
  start: string; // "09:00"
  end: string;   // "18:00"
  breaks?: Array<{ start: string; end: string }>;
}

export type WeeklySchedule = Partial<
  Record<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    WorkingHours
  >
>;
