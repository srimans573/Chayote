import Link from "next/link";
import type { DashboardCandidate } from "@/app/dashboard/data";

export function CandidatesExplorer({
  candidates,
}: {
  candidates: DashboardCandidate[];
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-[8px] border border-[#f0eeea] bg-white">
      {candidates.length > 0 ? (
        <>
          <div className="grid grid-cols-[1fr_1fr_0.7fr] border-b border-[#f0eeea] px-4 py-3 text-xs font-semibold text-[#4d5148]">
            <span>Candidate</span>
            <span>Role</span>
            <span>Activity</span>
          </div>
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/dashboard/candidates/${candidate.id}`}
              className="grid min-h-[72px] w-full grid-cols-[1fr_1fr_0.7fr] items-center border-b border-[#f0eeea] px-4 text-left last:border-b-0 transition hover:bg-[#faf9f7]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{candidate.name}</p>
                <p className="mt-1 truncate text-xs text-[#62675e]">{candidate.id}</p>
              </div>
              <p className="text-sm text-[#51564d]">{candidate.assessmentTitle}</p>
              <span className="text-sm text-[#62675e]">{candidate.activityLabel}</span>
            </Link>
          ))}
        </>
      ) : (
        <p className="px-4 py-8 text-sm text-[#62675e]">No candidates found.</p>
      )}
    </section>
  );
}
