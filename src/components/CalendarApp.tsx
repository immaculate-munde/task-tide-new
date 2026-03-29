"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, X, Plus, CalendarDays, Loader2 } from "lucide-react";
import { events as eventsApi, courseServers as courseServersApi, type ApiEvent, type ApiCourseServer } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarAppProps {
  courseServers?: Array<{ id: number; name: string; class_rep_id?: string; units?: Array<{ id: number; name: string; unit_code: string }> }>;
  currentUserId?: string;
  userRole?: string;
}

type EventType = 'lecture' | 'cat' | 'exam' | 'assignment_due' | 'other';

interface HolidayEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  type: 'holiday';
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_COLORS: Record<string, string> = {
  lecture: '#2563eb',
  cat: '#ea580c',
  exam: '#dc2626',
  assignment_due: '#ca8a04',
  other: '#7e22ce',
  holiday: '#6b7280',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  lecture: 'Lecture',
  cat: 'CAT',
  exam: 'Exam',
  assignment_due: 'Assignment Due',
  other: 'Other',
};

const KENYA_HOLIDAYS: HolidayEvent[] = [
  { id: 'holiday-1', title: "New Year's Day", date: '2025-01-01', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-2', title: 'Labour Day', date: '2025-05-01', description: "International Workers' Day", type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-3', title: 'Madaraka Day', date: '2025-06-01', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-4', title: 'Mashujaa Day', date: '2025-10-20', description: "Heroes' Day", type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-5', title: 'Jamhuri Day', date: '2025-12-12', description: 'Independence Day', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-6', title: 'Christmas Day', date: '2025-12-25', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-7', title: 'Boxing Day', date: '2025-12-26', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-8', title: "New Year's Day", date: '2026-01-01', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-9', title: 'Labour Day', date: '2026-05-01', description: "International Workers' Day", type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-10', title: 'Madaraka Day', date: '2026-06-01', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-11', title: 'Mashujaa Day', date: '2026-10-20', description: "Heroes' Day", type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-12', title: 'Jamhuri Day', date: '2026-12-12', description: 'Independence Day', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-13', title: 'Christmas Day', date: '2026-12-25', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
  { id: 'holiday-14', title: 'Boxing Day', date: '2026-12-26', description: 'Public Holiday', type: 'holiday', color: EVENT_TYPE_COLORS.holiday },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarApp({ currentUserId, userRole }: CalendarAppProps) {
  const [backendEvents, setBackendEvents] = useState<ApiEvent[]>([]);
  const [ownedServers, setOwnedServers] = useState<ApiCourseServer[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingServers, setIsLoadingServers] = useState(true);

  // Selected event for popover
  const [selectedEvent, setSelectedEvent] = useState<ApiEvent | HolidayEvent | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Selected date panel
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [formServerId, setFormServerId] = useState<string>('');
  const [formUnitId, setFormUnitId] = useState<string>('');
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<string>('other');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formVenue, setFormVenue] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const isClassRep = userRole === 'class_rep';

  const selectedServerUnits = ownedServers.find(s => String(s.id) === formServerId)?.units ?? [];

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadEvents = useCallback(async () => {
    try {
      setIsLoadingEvents(true);
      const { events } = await eventsApi.listAll();
      setBackendEvents(events);
    } catch {
      setBackendEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  const loadServers = useCallback(async () => {
    if (!isClassRep || !currentUserId) {
      setIsLoadingServers(false);
      return;
    }
    try {
      setIsLoadingServers(true);
      const { course_servers } = await courseServersApi.list();
      // Filter to servers where the current user is the class_rep
      const owned = course_servers.filter(
        s => String(s.class_rep_id) === String(currentUserId)
      );
      setOwnedServers(owned);
    } catch {
      setOwnedServers([]);
    } finally {
      setIsLoadingServers(false);
    }
  }, [isClassRep, currentUserId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadServers(); }, [loadServers]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedEvent(null);
        setPopoverPos(null);
      }
    };
    if (selectedEvent) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedEvent]);

  // ---------------------------------------------------------------------------
  // Calendar events — merge backend + holidays
  // ---------------------------------------------------------------------------

  const calendarEvents = [
    ...KENYA_HOLIDAYS.map(h => ({
      id: h.id,
      title: h.title,
      start: h.date,
      allDay: true,
      backgroundColor: h.color,
      borderColor: h.color,
      extendedProps: { _type: 'holiday', _holiday: h },
    })),
    ...backendEvents.map(e => ({
      id: String(e.id),
      title: e.title,
      start: e.start_time,
      end: e.end_time ?? undefined,
      allDay: e.all_day,
      backgroundColor: EVENT_TYPE_COLORS[e.event_type] ?? EVENT_TYPE_COLORS.other,
      borderColor: EVENT_TYPE_COLORS[e.event_type] ?? EVENT_TYPE_COLORS.other,
      extendedProps: { _type: 'backend', _event: e },
    })),
  ];

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleEventClick = (info: any) => {
    const props = info.event.extendedProps;
    const rect = info.el.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    setPopoverPos({
      top: rect.bottom + scrollTop + 4,
      left: Math.min(rect.left + scrollLeft, window.innerWidth - 320),
    });

    if (props._type === 'holiday') {
      setSelectedEvent(props._holiday as HolidayEvent);
    } else {
      setSelectedEvent(props._event as ApiEvent);
    }
  };

  const handleDateClick = (info: any) => {
    setSelectedDate(info.dateStr);
    if (isClassRep) {
      setFormDate(info.dateStr);
    }
  };

  const handleDelete = async (eventId: number) => {
    try {
      await eventsApi.delete(eventId);
      setBackendEvents(prev => prev.filter(e => e.id !== eventId));
      setSelectedEvent(null);
      setPopoverPos(null);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete event.');
    }
  };

  const resetForm = () => {
    setFormServerId('');
    setFormUnitId('');
    setFormTitle('');
    setFormType('other');
    setFormDate('');
    setFormStartTime('');
    setFormEndTime('');
    setFormVenue('');
    setFormDescription('');
    setFormAllDay(false);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formServerId || !formTitle || !formType || !formDate) {
      setFormError('Server, title, type and date are required.');
      return;
    }
    if (!formAllDay && !formStartTime) {
      setFormError('Start time is required for non-all-day events.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const startTime = formAllDay ? `${formDate}T00:00:00` : `${formDate}T${formStartTime}:00`;
      const endTime = formAllDay
        ? undefined
        : formEndTime
        ? `${formDate}T${formEndTime}:00`
        : undefined;

      const { event } = await eventsApi.create(parseInt(formServerId), {
        title: formTitle,
        event_type: formType,
        start_time: startTime,
        end_time: endTime,
        all_day: formAllDay,
        venue: formVenue || undefined,
        description: formDescription || undefined,
        unit_id: formUnitId ? parseInt(formUnitId) : undefined,
      });

      setBackendEvents(prev => [...prev, event]);
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to create event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Selected date panel events
  // ---------------------------------------------------------------------------

  const eventsForSelectedDate = selectedDate
    ? [
        ...KENYA_HOLIDAYS.filter(h => h.date === selectedDate),
        ...backendEvents.filter(e => {
          const d = e.start_time.split('T')[0];
          return d === selectedDate;
        }),
      ]
    : [];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const isHoliday = (ev: ApiEvent | HolidayEvent): ev is HolidayEvent =>
    (ev as HolidayEvent).type === 'holiday';

  const canDeleteEvent = (ev: ApiEvent | HolidayEvent): boolean => {
    if (isHoliday(ev)) return false;
    if (!currentUserId) return false;
    const server = ownedServers.find(s => s.id === (ev as ApiEvent).course_server_id);
    return !!server;
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (iso: string) =>
    new Date(iso + (iso.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-background min-h-screen relative">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Shared Calendar
        </h1>
        {isClassRep && ownedServers.length > 0 && (
          <Button
            onClick={() => { setShowForm(f => !f); resetForm(); }}
            className="bg-purple-700 hover:bg-purple-800 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Event
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS[type] }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS.holiday }} />
          Holiday
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Calendar */}
        <div className="bg-card rounded-lg shadow-md p-3 sm:p-4 md:p-6 lg:col-span-2 order-1">
          {isLoadingEvents ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              height="600px"
              headerToolbar={{
                left: "prev,next",
                center: "title",
                right: "today",
              }}
              footerToolbar={{
                center: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={true}
              nowIndicator={true}
              dayMaxEvents={3}
              moreLinkText="more"
              dayHeaderFormat={{ weekday: 'short' }}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
            />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 order-2">
          {/* Create event form */}
          {isClassRep && showForm && ownedServers.length > 0 && (
            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">New Event</CardTitle>
                  <button
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{formError}</p>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="form-server" className="text-xs">Course Server *</Label>
                    <Select value={formServerId} onValueChange={v => { setFormServerId(v); setFormUnitId(''); }}>
                      <SelectTrigger id="form-server" className="h-8 text-sm">
                        <SelectValue placeholder="Select server" />
                      </SelectTrigger>
                      <SelectContent>
                        {ownedServers.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedServerUnits.length > 0 && (
                    <div className="space-y-1">
                      <Label htmlFor="form-unit" className="text-xs">Unit (optional)</Label>
                      <Select value={formUnitId} onValueChange={setFormUnitId}>
                        <SelectTrigger id="form-unit" className="h-8 text-sm">
                          <SelectValue placeholder="All units" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All units</SelectItem>
                          {selectedServerUnits.map((u: any) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.unit_code} — {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="form-title" className="text-xs">Title *</Label>
                    <Input
                      id="form-title"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Event title"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="form-type" className="text-xs">Type *</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger id="form-type" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_TYPE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="form-date" className="text-xs">Date *</Label>
                    <Input
                      id="form-date"
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="h-8 text-sm"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="form-allday"
                      checked={formAllDay}
                      onChange={e => setFormAllDay(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                    />
                    <Label htmlFor="form-allday" className="text-xs cursor-pointer">All day</Label>
                  </div>

                  {!formAllDay && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="form-start" className="text-xs">Start time *</Label>
                        <Input
                          id="form-start"
                          type="time"
                          value={formStartTime}
                          onChange={e => setFormStartTime(e.target.value)}
                          className="h-8 text-sm"
                          required={!formAllDay}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="form-end" className="text-xs">End time</Label>
                        <Input
                          id="form-end"
                          type="time"
                          value={formEndTime}
                          onChange={e => setFormEndTime(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="form-venue" className="text-xs">Venue</Label>
                    <Input
                      id="form-venue"
                      value={formVenue}
                      onChange={e => setFormVenue(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="e.g. Room 101"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="form-desc" className="text-xs">Description</Label>
                    <Textarea
                      id="form-desc"
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      className="text-sm resize-none"
                      rows={2}
                      placeholder="Optional details..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white h-8 text-sm"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
                    ) : (
                      'Create Event'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Selected date panel */}
          {selectedDate && (
            <Card className="border-purple-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {formatDate(selectedDate)}
                  </CardTitle>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {eventsForSelectedDate.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-2">No events on this day</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {eventsForSelectedDate.map(ev => {
                      const isHol = isHoliday(ev);
                      const color = isHol
                        ? EVENT_TYPE_COLORS.holiday
                        : EVENT_TYPE_COLORS[(ev as ApiEvent).event_type] ?? EVENT_TYPE_COLORS.other;
                      return (
                        <div
                          key={isHol ? ev.id : (ev as ApiEvent).id}
                          className="rounded p-2 border border-border"
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{ev.title}</p>
                              {isHol ? (
                                <p className="text-xs text-muted-foreground">{(ev as HolidayEvent).description}</p>
                              ) : (
                                <>
                                  {!(ev as ApiEvent).all_day && (ev as ApiEvent).start_time && (
                                    <p className="text-xs text-muted-foreground">
                                      {formatTime((ev as ApiEvent).start_time)}
                                      {(ev as ApiEvent).end_time && ` — ${formatTime((ev as ApiEvent).end_time!)}`}
                                    </p>
                                  )}
                                  {(ev as ApiEvent).venue && (
                                    <p className="text-xs text-muted-foreground">{(ev as ApiEvent).venue}</p>
                                  )}
                                </>
                              )}
                            </div>
                            {!isHol && canDeleteEvent(ev) && (
                              <button
                                onClick={() => handleDelete((ev as ApiEvent).id)}
                                className="text-red-400 hover:text-red-600 flex-shrink-0"
                                title="Delete event"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming events list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : backendEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No events yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {backendEvents.slice(0, 10).map(ev => {
                    const color = EVENT_TYPE_COLORS[ev.event_type] ?? EVENT_TYPE_COLORS.other;
                    return (
                      <div
                        key={ev.id}
                        className="rounded p-2 border border-gray-100"
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(ev.start_time.split('T')[0])}</p>
                            {ev.course_server && (
                              <p className="text-xs text-muted-foreground truncate">{ev.course_server.name}</p>
                            )}
                          </div>
                          <Badge
                            className="text-xs flex-shrink-0"
                            style={{ backgroundColor: color, color: '#fff', border: 'none' }}
                          >
                            {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event detail popover */}
      {selectedEvent && popoverPos && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-card text-card-foreground rounded-lg shadow-xl border border-border p-4 w-72"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">{selectedEvent.title}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isHoliday(selectedEvent) && canDeleteEvent(selectedEvent) && (
                <button
                  onClick={() => handleDelete((selectedEvent as ApiEvent).id)}
                  className="text-red-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => { setSelectedEvent(null); setPopoverPos(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isHoliday(selectedEvent) ? (
            <>
              <Badge style={{ backgroundColor: EVENT_TYPE_COLORS.holiday, color: '#fff', border: 'none' }} className="text-xs mb-2">
                Holiday
              </Badge>
              <p className="text-sm text-muted-foreground">{(selectedEvent as HolidayEvent).description}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatDate((selectedEvent as HolidayEvent).date)}</p>
            </>
          ) : (
            <>
              {(() => {
                const ev = selectedEvent as ApiEvent;
                const color = EVENT_TYPE_COLORS[ev.event_type] ?? EVENT_TYPE_COLORS.other;
                return (
                  <>
                    <Badge style={{ backgroundColor: color, color: '#fff', border: 'none' }} className="text-xs mb-2">
                      {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                    </Badge>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium">Date: </span>
                        {formatDate(ev.start_time.split('T')[0])}
                      </p>
                      {!ev.all_day && (
                        <p>
                          <span className="font-medium">Time: </span>
                          {formatTime(ev.start_time)}
                          {ev.end_time && ` — ${formatTime(ev.end_time)}`}
                        </p>
                      )}
                      {ev.venue && (
                        <p><span className="font-medium">Venue: </span>{ev.venue}</p>
                      )}
                      {ev.unit && (
                        <p><span className="font-medium">Unit: </span>{(ev.unit as any).unit_code} — {(ev.unit as any).name}</p>
                      )}
                      {ev.course_server && (
                        <p><span className="font-medium">Server: </span>{ev.course_server.name}</p>
                      )}
                      {ev.description && (
                        <p className="mt-1 text-foreground">{ev.description}</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
