/**
 * calculateAttendanceMetrics
 * Applies standard university math to calculate attendance including Duty Leaves / Medical Freezes.
 */
export function calculateAttendanceMetrics(records: any[]) {
  let present = 0;
  let absent = 0;
  let exempt = 0; // Duty / Medical Freeze
  let cancelledOrHoliday = 0;

  records.forEach(record => {
    if (record.status === 'present') present++;
    else if (record.status === 'absent') absent++;
    else if (record.status === 'exempt') exempt++;
    else if (record.status === 'holiday' || record.status === 'cancelled') cancelledOrHoliday++;
  });

  // Exempt (Duty/Medical) counts as present. Holiday/Cancelled are completely ignored.
  const effectiveTotal = present + absent + exempt;
  const effectivePresent = present + exempt;

  const percentage = effectiveTotal > 0 ? (effectivePresent / effectiveTotal) * 100 : null;

  return {
    present: effectivePresent,
    absent,
    exempt,
    cancelledOrHoliday,
    total: effectiveTotal,
    percentage: percentage !== null ? Math.round(percentage) : null,
    hasData: effectiveTotal > 0,
  };
}
