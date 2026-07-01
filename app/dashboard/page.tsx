import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import {
  getDashboardData,
  type AssessmentStatus,
} from "@/app/dashboard/data";

export const metadata: Metadata = {
  title: "Dashboard | Talkode",
};

function statusClass(status: AssessmentStatus) {
  if (status === "live") {
    return "bg-[#d7ff5a] text-[#202322]";
  }

  if (status === "reviewing") {
    return "bg-[#202322] text-white";
  }

  if (status === "complete") {
    return "bg-[#e5e8df] text-[#4f564a]";
  }

  return "bg-[#efeeeb] text-[#555a51]";
}


export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-black leading-tight text-[#202322]">
            Dashboard
          </h1>
          {data.profile ? (
            <p className="mt-2 text-sm text-[#55594f]">
              {data.profile.full_name}
            </p>
          ) : null}
        </div>
        <Link
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[3px] bg-primary px-3 text-[13px] font-bold text-[#111510] transition duration-150 hover:bg-[#d7ff5a] sm:w-fit"
          href="/dashboard/assessments/new"
        >
          <Plus size={16} />
          Create assessment
        </Link>
      </section>

      {data.error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {data.error}
        </p>
      ) : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Assessments</h2>
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#353a32] transition duration-150 hover:text-[#111510]"
              href="/dashboard/assessments"
            >
              <span>View all</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-[#f0eeea] bg-white">
            {data.assessments.length > 0 ? (
              data.assessments.map((assessment) => (
                <article
                  className="border-b border-[#f0eeea] px-4 py-4 last:border-b-0"
                  key={assessment.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#202322]">
                        {assessment.title}
                      </p>
                      <p className="mt-1 text-sm text-[#62675e]">
                        {assessment.technologyLabel}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                        assessment.status,
                      )}`}
                    >
                      {assessment.statusLabel}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-[#6b7067]">
                        Candidates
                      </p>
                      <p className="mt-1 font-bold">{assessment.candidateCount}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#6b7067]">
                        Time
                      </p>
                      <p className="mt-1 font-bold">
                        {assessment.timeLimitMinutes}m
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#6b7067]">
                        Completion
                      </p>
                      <p className="mt-1 font-bold">
                        {assessment.completionPercent}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#62675e]">
                    <span>Expires {assessment.dueLabel}</span>
                    <Link
                      className="font-semibold text-[#202322] underline-offset-4 transition duration-150 hover:underline"
                      href={`/dashboard/assessments/${assessment.id}`}
                    >
                      Open
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p className="px-4 py-8 text-sm text-[#62675e]">
                No assessments found.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Candidates</h2>
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#353a32] transition duration-150 hover:text-[#111510]"
              href="/dashboard/candidates"
            >
              <span>View all</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-[#f0eeea] bg-white">
            {data.candidates.length > 0 ? (
              data.candidates.map((candidate) => (
                <Link
                  className="block border-b border-[#f0eeea] px-4 py-4 last:border-b-0 transition hover:bg-[#faf9f7]"
                  href={`/dashboard/candidates/${candidate.id}`}
                  key={candidate.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#202322]">
                        {candidate.name}
                      </p>
                      <p className="mt-1 text-sm text-[#62675e]">
                        {candidate.assessmentTitle}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-[#6b7067]">
                      {candidate.activityLabel}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="px-4 py-8 text-sm text-[#62675e]">
                No candidates found.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
