import type { Metadata } from "next";
import { getCandidateDetailsData } from "@/app/dashboard/data";
import { CandidateDetail } from "@/components/dashboard/CandidateDetail";

export const metadata: Metadata = {
  title: "Candidate | Talkode",
};

type CandidateDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id } = await params;
  const { candidate, error } = await getCandidateDetailsData(id);

  if (!candidate) {
    return (
      <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
        {error ?? "Candidate not found."}
      </p>
    );
  }

  return <CandidateDetail candidate={candidate} />;
}
