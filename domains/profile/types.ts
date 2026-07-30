import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { students } from './model';

export type Student = InferSelectModel<typeof students>;
export type NewStudent = InferInsertModel<typeof students>;
