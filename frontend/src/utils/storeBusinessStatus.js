const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseTimeToMinutes(timeText) {
  if (!timeText || typeof timeText !== 'string') return null;
  const [hourText, minuteText] = timeText.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}

function getTaiwanNowParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekdayToken = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekdayIndex: weekdayMap[weekdayToken] ?? 0,
    nowMinutes: hour * 60 + minute,
  };
}

function isOpenByTodaySlot(slot, nowMinutes) {
  if (!slot || slot.is_closed) return false;

  const openMinutes = parseTimeToMinutes(slot.open);
  const closeMinutes = parseTimeToMinutes(slot.close);
  if (openMinutes === null || closeMinutes === null) return false;

  if (openMinutes === closeMinutes) {
    return true;
  }

  if (closeMinutes > openMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }

  // Overnight slot (e.g. 22:00-02:00)
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

function isOpenByYesterdayOvernightSlot(slot, nowMinutes) {
  if (!slot || slot.is_closed) return false;

  const openMinutes = parseTimeToMinutes(slot.open);
  const closeMinutes = parseTimeToMinutes(slot.close);
  if (openMinutes === null || closeMinutes === null) return false;

  // Only overnight slots can carry into next day.
  if (closeMinutes >= openMinutes) return false;

  return nowMinutes < closeMinutes;
}

export function getStoreBusinessStatus(store, now = new Date()) {
  if (!store) {
    return {
      isOpenNow: false,
      canReserveWhenClosed: false,
      statusText: '休息中',
    };
  }

  const reservationEnabled = Boolean(store.enable_reservation);
  const openingHours = store.opening_hours;

  if (!openingHours || typeof openingHours !== 'object') {
    const fallbackOpen = Boolean(store.is_open);
    return {
      isOpenNow: fallbackOpen,
      canReserveWhenClosed: !fallbackOpen && reservationEnabled,
      statusText: fallbackOpen
        ? '營業中'
        : (reservationEnabled ? '休息中，可預約訂位' : '休息中'),
    };
  }

  const { weekdayIndex, nowMinutes } = getTaiwanNowParts(now);
  const todayKey = DAY_KEYS[weekdayIndex];
  const yesterdayKey = DAY_KEYS[(weekdayIndex + 6) % 7];

  const todaySlot = openingHours[todayKey];
  const yesterdaySlot = openingHours[yesterdayKey];

  const isOpenNow =
    isOpenByTodaySlot(todaySlot, nowMinutes) ||
    isOpenByYesterdayOvernightSlot(yesterdaySlot, nowMinutes);

  return {
    isOpenNow,
    canReserveWhenClosed: !isOpenNow && reservationEnabled,
    statusText: isOpenNow
      ? '營業中'
      : (reservationEnabled ? '休息中，可預約訂位' : '休息中'),
  };
}
