import { Injectable } from '@nestjs/common';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addMinutes, addDays, startOfDay, format, isBefore, isAfter } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import type { WeeklySchedule, WorkingHours } from '@barberflow/shared-types';

const SLOT_INTERVAL_MIN = 30;   // granularity of offered slots
const DAYS_TO_SHOW = 7;         // how many days ahead to look
const MAX_DATE_OPTIONS = 5;     // max date options shown to user
const MAX_TIME_OPTIONS = 10;    // max time slots shown per day

export interface AvailableDay {
  date: string;           // YYYY-MM-DD in tenant timezone
  dateFormatted: string;  // "lunes 15 de enero" in Spanish
}

export interface AvailableSlot {
  scheduledAt: Date;      // UTC
  label: string;          // "10:00 am" in tenant timezone
  id: string;             // ISO string used as list reply ID
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns up to MAX_DATE_OPTIONS days with available slots.
   * If barberId is null, checks across all active barbers.
   */
  async getAvailableDays(
    tenantId: string,
    barberId: string | null,
    serviceDurationMin: number,
    timezone: string,
  ): Promise<AvailableDay[]> {
    const barbers = await this.getBarbers(tenantId, barberId);
    if (barbers.length === 0) return [];

    const result: AvailableDay[] = [];
    const now = new Date();

    for (let i = 0; i < DAYS_TO_SHOW && result.length < MAX_DATE_OPTIONS; i++) {
      const checkDate = addDays(now, i === 0 ? 0 : i);
      const localDateStr = this.toLocalDateStr(checkDate, timezone);

      for (const barber of barbers) {
        const slots = await this.getSlotsForBarberDay(
          tenantId,
          barber.id,
          barber.workingHoursJson as WeeklySchedule,
          serviceDurationMin,
          localDateStr,
          timezone,
          now,
        );

        if (slots.length > 0) {
          result.push({
            date: localDateStr,
            dateFormatted: this.formatDateLong(localDateStr, timezone),
          });
          break; // found at least one slot for this day, move to next day
        }
      }
    }

    return result;
  }

  /**
   * Returns available time slots for a specific barber (or any barber) on a date.
   */
  async getAvailableSlots(
    tenantId: string,
    barberId: string | null,
    serviceDurationMin: number,
    date: string,
    timezone: string,
  ): Promise<{ slots: AvailableSlot[]; resolvedBarberId: string | null }> {
    const barbers = await this.getBarbers(tenantId, barberId);
    if (barbers.length === 0) return { slots: [], resolvedBarberId: null };

    const now = new Date();
    const allSlots: AvailableSlot[] = [];
    let resolvedBarberId: string | null = null;

    for (const barber of barbers) {
      const slots = await this.getSlotsForBarberDay(
        tenantId,
        barber.id,
        barber.workingHoursJson as WeeklySchedule,
        serviceDurationMin,
        date,
        timezone,
        now,
      );

      if (slots.length > 0 && resolvedBarberId === null) {
        resolvedBarberId = barber.id;
      }

      for (const slot of slots) {
        if (!allSlots.find((s) => s.id === slot.id)) {
          allSlots.push(slot);
        }
      }
    }

    allSlots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    return {
      slots: allSlots.slice(0, MAX_TIME_OPTIONS),
      resolvedBarberId: barberId ?? resolvedBarberId,
    };
  }

  private async getSlotsForBarberDay(
    tenantId: string,
    barberId: string,
    schedule: WeeklySchedule,
    serviceDurationMin: number,
    localDateStr: string,
    timezone: string,
    now: Date,
  ): Promise<AvailableSlot[]> {
    const dayName = this.getDayName(localDateStr, timezone);
    const workingHours = schedule[dayName as keyof WeeklySchedule];

    if (!workingHours) return [];

    // Build slot candidates
    const dayStartUTC = fromZonedTime(`${localDateStr}T${workingHours.start}:00`, timezone);
    const dayEndUTC = fromZonedTime(`${localDateStr}T${workingHours.end}:00`, timezone);

    const existingAppointments = await this.getExistingAppointments(
      tenantId,
      barberId,
      dayStartUTC,
      dayEndUTC,
    );

    const slots: AvailableSlot[] = [];
    let cursor = dayStartUTC;
    const latestStart = addMinutes(dayEndUTC, -serviceDurationMin);

    while (!isAfter(cursor, latestStart)) {
      const slotEnd = addMinutes(cursor, serviceDurationMin);

      const inBreak = this.isInBreak(cursor, slotEnd, workingHours, localDateStr, timezone);
      const conflicting = this.isConflicting(cursor, slotEnd, existingAppointments);
      const isPast = isBefore(cursor, now);

      if (!inBreak && !conflicting && !isPast) {
        const label = this.formatTime(cursor, timezone);
        slots.push({
          scheduledAt: cursor,
          label,
          id: cursor.toISOString(),
        });
      }

      cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
    }

    return slots;
  }

  private async getExistingAppointments(
    tenantId: string,
    barberId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ scheduledAt: Date; durationMin: number }>> {
    const db = this.prisma.forTenant(tenantId);

    // @ts-expect-error — extended client
    const appointments = await db.appointment.findMany({
      where: {
        barberId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledAt: { gte: from, lt: to },
      },
      select: { scheduledAt: true, durationMin: true },
    });

    return appointments as Array<{ scheduledAt: Date; durationMin: number }>;
  }

  private async getBarbers(
    tenantId: string,
    barberId: string | null,
  ): Promise<Array<{ id: string; workingHoursJson: unknown }>> {
    const db = this.prisma.forTenant(tenantId);

    const where = barberId
      ? { id: barberId, status: 'ACTIVE' as const }
      : { status: 'ACTIVE' as const };

    // @ts-expect-error
    return db.barber.findMany({ where, select: { id: true, workingHoursJson: true } });
  }

  private isInBreak(
    slotStart: Date,
    slotEnd: Date,
    hours: WorkingHours,
    localDateStr: string,
    timezone: string,
  ): boolean {
    if (!hours.breaks) return false;

    return hours.breaks.some((b) => {
      const breakStart = fromZonedTime(`${localDateStr}T${b.start}:00`, timezone);
      const breakEnd = fromZonedTime(`${localDateStr}T${b.end}:00`, timezone);
      return isBefore(slotStart, breakEnd) && isAfter(slotEnd, breakStart);
    });
  }

  private isConflicting(
    slotStart: Date,
    slotEnd: Date,
    appointments: Array<{ scheduledAt: Date; durationMin: number }>,
  ): boolean {
    return appointments.some((appt) => {
      const apptEnd = addMinutes(appt.scheduledAt, appt.durationMin);
      return isBefore(slotStart, apptEnd) && isAfter(slotEnd, appt.scheduledAt);
    });
  }

  // Converts UTC Date → local YYYY-MM-DD string in tenant timezone
  toLocalDateStr(date: Date, timezone: string): string {
    return format(toZonedTime(date, timezone), 'yyyy-MM-dd');
  }

  // "monday", "tuesday", etc. for WeeklySchedule lookup
  private getDayName(localDateStr: string, timezone: string): string {
    const d = fromZonedTime(`${localDateStr}T12:00:00`, timezone);
    return format(toZonedTime(d, timezone), 'EEEE').toLowerCase();
  }

  // "lunes 15 de enero"
  formatDateLong(localDateStr: string, timezone: string): string {
    const d = fromZonedTime(`${localDateStr}T12:00:00`, timezone);
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d);
  }

  // "10:00 am"
  formatTime(utcDate: Date, timezone: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(utcDate);
  }
}
