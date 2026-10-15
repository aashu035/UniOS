import { useLocalSearchParams } from 'expo-router';
import { TaskForm } from '../../components/task/TaskForm';

/**
 * New task. `workspaceId` presets the course (shown locked, "Change" unlocks it);
 * `type` presets the type (the + sheet's "Add exam" passes `exam`).
 */
export default function AddTask() {
  const { workspaceId, type } = useLocalSearchParams<{ workspaceId?: string; type?: string }>();
  const id = workspaceId ? Number(workspaceId) : NaN;
  return <TaskForm mode="add" presetCourseId={Number.isInteger(id) && id > 0 ? id : null} presetType={type} />;
}
