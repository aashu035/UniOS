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

  // DCRUST B.Tech Ordinance 2024-25, clause 9, and the Samarth portal:
  // Present: conducted +1, attended +1
  // Absent: conducted +1, attended +0
  // Exempt/Leave: conducted +1, attended +0. Leave is condoned later on documents
  //   (chairperson up to 10%, clause 9.4); it is not attendance.
  // Cancelled/Holiday: conducted +0, attended +0 (excluded)
  const effectiveTotal = present + absent + exempt;
  const effectivePresent = present;

  const percentage = effectiveTotal > 0 ? (effectivePresent / effectiveTotal) * 100 : null;

  return {
    present,
    absent,
    exempt,
    cancelledOrHoliday,
    total: effectiveTotal,
    percentage: percentage !== null ? Math.round(percentage) : null,
    hasData: effectiveTotal > 0,
  };
}

