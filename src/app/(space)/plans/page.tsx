import type { Metadata } from "next";
import { Suspense } from "react";
import PlansPage from "@/features/plans/plans-page";

export const metadata: Metadata = { title: "Plans" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="panel" role="status" aria-label="Loading plans">
          <div className="loading-line" />
          <div className="loading-line" />
          <div className="loading-line" />
        </div>
      }
    >
      <PlansPage />
    </Suspense>
  );
}
