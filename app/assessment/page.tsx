import { Suspense } from "react";
import type { Metadata } from "next";
import { CandidateAssessmentFlow } from "@/app/assessment/CandidateAssessmentFlow";

export const metadata: Metadata = {
  title: "Assessment Lobby | Chayote",
  description: "Enter an assessment code and prepare your equipment.",
};

export default function AssessmentPage() {
  return (
    <Suspense>
      <CandidateAssessmentFlow />
    </Suspense>
  );
}
