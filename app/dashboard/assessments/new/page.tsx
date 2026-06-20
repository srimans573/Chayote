import type { Metadata } from "next";
import { getCreateAssessmentData } from "@/app/dashboard/data";
import { CreateAssessmentForm } from "@/app/dashboard/assessments/new/CreateAssessmentForm";

export const metadata: Metadata = {
  title: "Create Assessment | Chayote",
};

export default async function NewAssessmentPage() {
  const { error, templates } = await getCreateAssessmentData();

  return (
    <>
      <section>
        <h1 className="text-[28px] font-black leading-tight text-[#202322]">
          Create assessment
        </h1>
        <p className="mt-2 text-sm text-[#55594f]">
          React code-review assessment backed by Supabase code files.
        </p>
      </section>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      <CreateAssessmentForm templates={templates} />
    </>
  );
}
