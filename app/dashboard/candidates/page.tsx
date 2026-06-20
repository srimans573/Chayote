import type { Metadata } from "next";
import { getCandidatesData } from "@/app/dashboard/data";
import { RiskBadge } from "@/components/dashboard/RiskBadge";

export const metadata: Metadata = {
  title: "Candidates | Chayote",
};

export default async function CandidatesPage() {
  const { candidates, error } = await getCandidatesData();

  return (
    <>
      <section className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[28px] font-black leading-tight text-[#202322]">
            Candidates
          </h1>
          <p className="mt-2 text-sm text-[#55594f]">
            Supabase-backed candidate records.
          </p>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-[8px] border border-[#f0eeea] bg-white">
        {candidates.length > 0 ? (
          <>
            <div className="grid grid-cols-[1fr_1fr_0.65fr_0.45fr_0.5fr_0.7fr] border-b border-[#f0eeea] px-4 py-3 text-xs font-semibold text-[#4d5148]">
              <span>Candidate</span>
              <span>Role</span>
              <span>Stage</span>
              <span>Score</span>
              <span>Risk</span>
              <span>Activity</span>
            </div>
            {candidates.map((candidate) => (
              <div
                className="grid min-h-[72px] grid-cols-[1fr_1fr_0.65fr_0.45fr_0.5fr_0.7fr] items-center border-b border-[#f0eeea] px-4 last:border-b-0"
                key={candidate.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{candidate.name}</p>
                  <p className="mt-1 truncate text-xs text-[#62675e]">
                    {candidate.id}
                  </p>
                </div>
                <p className="text-sm text-[#51564d]">{candidate.roleName}</p>
                <p className="text-sm font-medium">{candidate.stageLabel}</p>
                <p className="text-sm font-semibold">{candidate.score ?? "-"}</p>
                <RiskBadge label={candidate.riskLabel} risk={candidate.risk} />
                <span className="text-sm text-[#62675e]">
                  {candidate.activityLabel}
                </span>
              </div>
            ))}
          </>
        ) : (
          <p className="px-4 py-8 text-sm text-[#62675e]">
            No candidates found in Supabase.
          </p>
        )}
      </section>
    </>
  );
}
