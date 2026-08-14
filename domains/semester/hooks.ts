import { useState, useCallback, useEffect } from 'react';
import { SemesterRepository } from './repository';
import { semesters } from './model';

type Semester = typeof semesters.$inferSelect;

export function useSemesters() {
  const [semestersList, setSemestersList] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSemesters = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await SemesterRepository.getAllSemesters();
      const active = await SemesterRepository.getActiveSemester();
      setSemestersList(all);
      setActiveSemester(active || null);
    } catch (err) {
      console.error('Error fetching semesters:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  const addSemester = async (data: any) => {
    await SemesterRepository.addSemester(data);
    await fetchSemesters();
  };

  const updateSemester = async (id: number, data: any) => {
    await SemesterRepository.updateSemester(id, data);
    await fetchSemesters();
  };

  const deleteSemester = async (id: number) => {
    await SemesterRepository.deleteSemester(id);
    await fetchSemesters();
  };

  return {
    semesters: semestersList,
    activeSemester,
    isLoading,
    refresh: fetchSemesters,
    addSemester,
    updateSemester,
    deleteSemester,
  };
}
