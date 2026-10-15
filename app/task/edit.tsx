import { useLocalSearchParams } from 'expo-router';
import { TaskForm } from '../../components/task/TaskForm';

/** Edit task: opened from the Tasks tab, Today, a course, Alerts and Search. */
export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  return <TaskForm mode="edit" taskId={Number.isInteger(taskId) && taskId > 0 ? taskId : -1} />;
}
