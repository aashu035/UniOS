import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { CalendarRepository } from './repository';
import { compareTimeStrings } from '../../core/utils/time';
import { getLocalDateString } from '../../core/utils/date';

// useCalendar and useHasClassToday have been removed as part of the architecture rectification.
// Please use ScheduleService and AttendanceService instead.

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
