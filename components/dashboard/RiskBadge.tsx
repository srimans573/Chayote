import type { CandidateRisk } from "@/app/dashboard/data";

function riskClass(risk: CandidateRisk) {
  if (risk === "high") {
    return "bg-[#ffe7df] text-[#80321d]";
  }

  if (risk === "medium") {
    return "bg-[#fff0c2] text-[#6f5314]";
  }

  return "bg-[#e5e8df] text-[#4f564a]";
}

export function RiskBadge({
  label,
  risk,
}: {
  label: string;
  risk: CandidateRisk;
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskClass(risk)}`}>
      {label}
    </span>
  );
}
