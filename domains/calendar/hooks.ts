import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { CalendarRepository } from './repository';
import { compareTimeStrings } from '../../core/utils/time';

export function useCalendar(dayOfWeek: number, specificDateString?: string) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await CalendarRepository.getEventsForDay(dayOfWeek, specificDateString);
      const sortedData = [...data].sort((a, b) => compareTimeStrings(a.startTime, b.startTime));
      setEvents(sortedData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load calendar events'));
    } finally {
      setIsLoading(false);
    }
  }, [dayOfWeek, specificDateString]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  return { events, isLoading, error, refreshEvents: loadEvents };
}

export function useHasClassToday(workspaceId: number, date: Date = new Date()) {
  const [hasClass, setHasClass] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkClass = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      const dayOfWeek = date.getDay();
      const specificDateStr = date.toISOString().split('T')[0];
      const data = await CalendarRepository.getEventsForDay(dayOfWeek, specificDateStr);
      const exists = data.some(event => event.workspaceId === workspaceId);
      setHasClass(exists);
    } catch (err) {
      console.error(err);
      setHasClass(false);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, date.getTime()]);

  useFocusEffect(
    useCallback(() => {
      checkClass();
    }, [checkClass])
  );

  return { hasClass, isLoading };
}

export function useHeroCardContext(events: any[], name: string) {
  const [now, setNow] = useState(new Date());

  // Update time every minute to keep dynamic state fresh
  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(interval);
    }, [])
  );

  const hour = now.getHours();
  let greeting = 'Good Evening,';
  if (hour < 12) greeting = 'Good Morning,';
  else if (hour < 17) greeting = 'Good Afternoon,';

  // Find next event
  const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const nextEvent = events.find(e => compareTimeStrings(currentTimeStr, e.startTime) < 0);
  const currentEvent = events.find(e => compareTimeStrings(e.startTime, currentTimeStr) <= 0 && compareTimeStrings(currentTimeStr, e.endTime) < 0);

  let subtitle = '';
  if (currentEvent) {
    subtitle = `Currently in ${currentEvent.title || currentEvent.workspaceName}`;
  } else if (nextEvent) {
    subtitle = `Next class: ${nextEvent.title || nextEvent.workspaceName} at ${nextEvent.startTime}`;
  } else if (events.length > 0) {
    subtitle = 'You are all done for today!';
  } else {
    subtitle = 'No classes today, enjoy your day!';
  }

  return { greeting, title: name, subtitle, nextEvent, currentEvent };
}
