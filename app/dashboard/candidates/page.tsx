import type { Metadata } from "next";
import { getCandidatesData } from "@/app/dashboard/data";
import { CandidatesExplorer } from "@/components/dashboard/CandidatesExplorer";

export const metadata: Metadata = {
  title: "Candidates | Talkode",
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
            Candidate records. Click a candidate to see their interview.
          </p>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      <CandidatesExplorer candidates={candidates} />
    </>
  );
}
