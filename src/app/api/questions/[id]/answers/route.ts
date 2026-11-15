import { route } from '@/server/http';
import { answerQuestion } from '@/server/activities';
export const POST = route((request, { id }) => answerQuestion(request, id));
