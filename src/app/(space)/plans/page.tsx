import { Suspense } from "react";
import PlansPage from "@/features/plans/plans-page";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading plans…</p>}>
      <PlansPage />
    </Suspense>
  );
}
