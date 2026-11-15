import { Suspense } from "react";
import ActivitiesPage from "@/features/activities/activities-page";
export default function Page() { return <Suspense fallback={<p>Loading activities…</p>}><ActivitiesPage/></Suspense>; }
