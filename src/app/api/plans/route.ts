import { route } from '@/server/http';
import { createPlan } from '@/server/plans';
export const POST = route(createPlan);
