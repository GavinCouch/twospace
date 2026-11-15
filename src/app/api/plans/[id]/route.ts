import { route } from '@/server/http';
import { editPlan, deletePlan } from '@/server/plans';
export const PATCH = route((request, { id }) => editPlan(request, id));
export const DELETE = route((request, { id }) => deletePlan(request, id));
