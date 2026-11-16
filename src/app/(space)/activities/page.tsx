import type { Metadata } from "next";
import { Suspense } from "react";
import ActivitiesPage from "@/features/activities/activities-page";

export const metadata: Metadata = { title: "Activities" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="panel" role="status" aria-label="Loading activities">
          <div className="loading-line" />
          <div className="loading-line" />
          <div className="loading-line" />
        </div>
      }
    >
      <ActivitiesPage />
    </Suspense>
  );
}
