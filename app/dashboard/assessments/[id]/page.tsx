import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAssessmentDetailsData } from "@/app/dashboard/data";
import { CodebaseFilesModal } from "@/components/dashboard/CodebaseFilesModal";

export const metadata: Metadata = {
  title: "Assessment | Chayote",
};

type AssessmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
};

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: AssessmentDetailPageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const { assessment, codebaseFiles, error } =
    await getAssessmentDetailsData(id);

  return (
    <>
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#55594f] transition duration-150 hover:text-[#202322]"
            href="/dashboard/assessments"
          >
            <ArrowLeft size={14} />
            Assessments
          </Link>
          <h1 className="mt-3 text-[28px] font-black leading-tight text-[#202322]">
            {assessment?.title ?? "Assessment"}
          </h1>
          {assessment ? (
            <p className="mt-2 text-sm text-[#55594f]">
              {assessment.technologyLabel} · {assessment.timeLimitMinutes} minutes
            </p>
          ) : null}
        </div>

        {assessment ? (
          <CodebaseFilesModal
            files={codebaseFiles}
            title={`${assessment.title} codebase`}
          />
        ) : null}
      </section>

      {created === "1" ? (
        <p className="mt-4 rounded-[6px] border border-[#d7e8a6] bg-[#fbffe8] px-4 py-3 text-sm font-medium text-[#314200]">
          Assessment created.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      {assessment ? (
        <section className="mt-6 grid gap-5 xl:grid-cols-[360px_1fr]">
          <article className="rounded-[8px] border border-[#f0eeea] bg-white p-4">
            <p className="text-xs font-semibold text-[#62675e]">
              Candidate entry code
            </p>
            <p className="mt-4 rounded-[6px] border border-[#dedbd5] bg-[#fbfaf7] px-4 py-4 text-center font-mono text-[34px] font-black tracking-[0.18em] text-[#202322]">
              {assessment.candidateAccessCode}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#62675e]">
              Candidates can enter this code to start the assessment.
            </p>
          </article>

          <article className="rounded-[8px] border border-[#f0eeea] bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold text-[#62675e]">Status</p>
                <p className="mt-2 text-lg font-bold">{assessment.statusLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#62675e]">Time</p>
                <p className="mt-2 text-lg font-bold">
                  {assessment.timeLimitMinutes}m
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#62675e]">Expires</p>
                <p className="mt-2 text-lg font-bold">
                  {assessment.dueLabel}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#62675e]">Files</p>
                <p className="mt-2 text-lg font-bold">{codebaseFiles.length}</p>
              </div>
            </div>

            <div className="mt-5 border-t border-[#f0eeea] pt-4">
              <p className="text-xs font-semibold text-[#62675e]">
                Job description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4f554d]">
                {assessment.jobDescription}
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </>
  );
}
