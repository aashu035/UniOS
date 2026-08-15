/**
 * calculateAttendanceMetrics
 * Applies standard university math to calculate attendance including Duty Leaves / Medical Freezes.
 */
export function calculateAttendanceMetrics(records: any[]) {
  let present = 0;
  let absent = 0;
  let exempt = 0; // Duty / Medical Freeze

  records.forEach(record => {
    if (record.status === 'present') present++;
    else if (record.status === 'absent') absent++;
    else if (record.status === 'exempt') exempt++;
  });

  const effectiveTotal = present + absent + exempt;
  const effectivePresent = present + exempt;

  const percentage = effectiveTotal > 0 ? (effectivePresent / effectiveTotal) * 100 : 0;

  return {
    present,
    absent,
    exempt,
    total: effectiveTotal,
    percentage: Math.round(percentage),
    hasData: effectiveTotal > 0,
  };
}
