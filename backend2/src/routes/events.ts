import { Router } from 'express';
import { supabase } from '../supabase';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/events — all events across user's servers
router.get('/events', authenticate, async (req, res) => {
  const userId = req.user!.id;

  // Get all server IDs the user is in (as member or class_rep)
  const { data: memberships } = await supabase
    .from('user_course_servers')
    .select('course_server_id')
    .eq('user_id', userId);

  const { data: ownedServers } = await supabase
    .from('course_servers')
    .select('id')
    .eq('class_rep_id', userId);

  const serverIds = [
    ...new Set([
      ...(memberships ?? []).map((m: any) => m.course_server_id),
      ...(ownedServers ?? []).map((s: any) => s.id),
    ]),
  ];

  if (serverIds.length === 0) {
    res.json({ events: [] });
    return;
  }

  const { data: events, error } = await supabase
    .from('events')
    .select('*, course_server:course_servers(id,name), unit:units(id,name,unit_code), creator:profiles!created_by(id,name)')
    .in('course_server_id', serverIds)
    .order('start_time', { ascending: true });

  if (error) {
    res.status(500).json({ message: error.message });
    return;
  }

  res.json({ events: events ?? [] });
});

// GET /api/course-servers/:serverId/events
router.get('/course-servers/:serverId/events', authenticate, async (req, res) => {
  const serverId = parseInt(req.params.serverId as string);
  const userId = req.user!.id;

  // Check membership
  const { data: member } = await supabase
    .from('user_course_servers')
    .select('user_id')
    .eq('course_server_id', serverId)
    .eq('user_id', userId)
    .single();

  const { data: server } = await supabase
    .from('course_servers')
    .select('class_rep_id')
    .eq('id', serverId)
    .single();

  if (!member && server?.class_rep_id !== userId) {
    res.status(403).json({ message: 'Not a member of this server.' });
    return;
  }

  const { data: events, error } = await supabase
    .from('events')
    .select('*, unit:units(id,name,unit_code), creator:profiles!created_by(id,name)')
    .eq('course_server_id', serverId)
    .order('start_time', { ascending: true });

  if (error) {
    res.status(500).json({ message: error.message });
    return;
  }

  res.json({ events: events ?? [] });
});

// POST /api/course-servers/:serverId/events — class_rep only
router.post('/course-servers/:serverId/events', authenticate, async (req, res) => {
  const serverId = parseInt(req.params.serverId as string);
  const userId = req.user!.id;

  const { data: server, error: serverError } = await supabase
    .from('course_servers')
    .select('class_rep_id')
    .eq('id', serverId)
    .single();

  if (serverError || !server) {
    res.status(404).json({ message: 'Server not found.' });
    return;
  }

  if (server.class_rep_id !== userId) {
    res.status(403).json({ message: 'Only the class rep can create events.' });
    return;
  }

  const { title, description, event_type, venue, start_time, end_time, all_day, unit_id } = req.body;

  if (!title || !event_type || !start_time) {
    res.status(422).json({ message: 'title, event_type and start_time are required.' });
    return;
  }

  const valid_types = ['lecture', 'cat', 'exam', 'assignment_due', 'other'];
  if (!valid_types.includes(event_type)) {
    res.status(422).json({ message: 'Invalid event_type.' });
    return;
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      course_server_id: serverId,
      unit_id: unit_id ?? null,
      created_by: userId,
      title,
      description: description ?? null,
      event_type,
      venue: venue ?? null,
      start_time,
      end_time: end_time ?? null,
      all_day: all_day ?? false,
    })
    .select('*, unit:units(id,name,unit_code), creator:profiles!created_by(id,name)')
    .single();

  if (error) {
    res.status(500).json({ message: error.message });
    return;
  }

  res.status(201).json({ event });
});

// PUT /api/events/:id — class_rep only
router.put('/events/:id', authenticate, async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const userId = req.user!.id;

  const { data: existing } = await supabase
    .from('events')
    .select('course_server_id, course_server:course_servers(class_rep_id)')
    .eq('id', eventId)
    .single();

  if (!existing) {
    res.status(404).json({ message: 'Event not found.' });
    return;
  }

  const server = existing.course_server as any;
  if (server?.class_rep_id !== userId) {
    res.status(403).json({ message: 'Only the class rep can update events.' });
    return;
  }

  const { title, description, event_type, venue, start_time, end_time, all_day, unit_id } = req.body;

  const { data: event, error } = await supabase
    .from('events')
    .update({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(event_type !== undefined && { event_type }),
      ...(venue !== undefined && { venue }),
      ...(start_time !== undefined && { start_time }),
      ...(end_time !== undefined && { end_time }),
      ...(all_day !== undefined && { all_day }),
      ...(unit_id !== undefined && { unit_id }),
    })
    .eq('id', eventId)
    .select('*, unit:units(id,name,unit_code), creator:profiles!created_by(id,name)')
    .single();

  if (error) {
    res.status(500).json({ message: error.message });
    return;
  }

  res.json({ event });
});

// DELETE /api/events/:id — class_rep only
router.delete('/events/:id', authenticate, async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const userId = req.user!.id;

  const { data: existing } = await supabase
    .from('events')
    .select('course_server_id, course_server:course_servers(class_rep_id)')
    .eq('id', eventId)
    .single();

  if (!existing) {
    res.status(404).json({ message: 'Event not found.' });
    return;
  }

  const server = existing.course_server as any;
  if (server?.class_rep_id !== userId) {
    res.status(403).json({ message: 'Only the class rep can delete events.' });
    return;
  }

  const { error } = await supabase.from('events').delete().eq('id', eventId);

  if (error) {
    res.status(500).json({ message: error.message });
    return;
  }

  res.json({ message: 'Event deleted.' });
});

export default router;
