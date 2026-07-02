"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { getInsights, type SessionInsights } from "@/lib/voiceAgent";

function scoreColor(score: number) {
  if (score >= 4) return "bg-[#d7ff5a]";
  if (score >= 3) return "bg-[#fde68a]";
  return "bg-[#fecaca]";
}

function scoreLabel(score: number) {
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Strong";
  if (score >= 2.5) return "Developing";
  return "Needs work";
}

function Results({ sessionId }: { sessionId: string }) {
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const { insights: data } = await getInsights(sessionId);
        if (cancelled) return;
        if (data?.generated_at) {
          setInsights(data);
        } else {
          // Not ready yet — retry after 4s
          setTimeout(() => {
            if (!cancelled) {
              setAttempts((n) => n + 1);
            }
          }, 4000);
        }
      } catch {
        if (!cancelled) {
          // Backend may still be processing — keep polling for up to 3 min
          if (attempts < 45) {
            setTimeout(() => {
              if (!cancelled) setAttempts((n) => n + 1);
            }, 4000);
          } else {
            setError("Your feedback is taking longer than expected. Try refreshing in a minute.");
          }
        }
      }
    }

    void poll();
    return () => { cancelled = true; };
  }, [sessionId, attempts]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f5] px-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="mt-4 text-center text-sm text-[#62675e]">{error}</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f7f7f5] px-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#c8f500]" />
        <p className="text-sm font-medium text-[#62675e]">Analysing your interview…</p>
        <p className="text-xs text-[#9aa093]">This usually takes 30–60 seconds.</p>
      </div>
    );
  }

  const avgScore =
    insights.rubric_scores?.length > 0
      ? insights.rubric_scores.reduce((s, r) => s + r.score, 0) /
        insights.rubric_scores.length
      : null;

  return (
    <div className="min-h-screen bg-[#f7f7f5] px-4 py-16">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#c8f500]">
            <CheckCircle2 className="h-7 w-7 text-[#111510]" />
          </div>
          <h1 className="text-3xl font-black text-[#202322]">Your results</h1>
          <p className="mt-2 text-sm text-[#62675e]">
            Here's personalised feedback based on your interview.
          </p>
          {avgScore !== null && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 shadow-sm ring-1 ring-[#e8e6e1]">
              <span className="text-2xl font-black text-[#202322]">
                {avgScore.toFixed(1)}
              </span>
              <span className="text-sm text-[#62675e]">/ 5 overall</span>
            </div>
          )}
        </div>

        {/* Summary */}
        {insights.summary && (
          <section className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-[#e8e6e1]">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#9aa093]">
              How you did
            </h2>
            <p className="text-[15px] leading-relaxed text-[#2e3228]">{insights.summary}</p>
          </section>
        )}

        {/* Strengths */}
        {insights.strengths?.length > 0 && (
          <section className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-[#e8e6e1]">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#9aa093]">
              What you did well
            </h2>
            <ul className="space-y-2">
              {insights.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-[15px] text-[#2e3228]">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c8f500]" />
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Areas to work on */}
        {insights.gaps?.length > 0 && (
          <section className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-[#e8e6e1]">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#9aa093]">
              Areas to work on
            </h2>
            <ul className="space-y-2">
              {insights.gaps.map((g, i) => (
                <li key={i} className="flex gap-2 text-[15px] text-[#2e3228]">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#fbbf24]" />
                  {g}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Skill breakdown */}
        {insights.rubric_scores?.length > 0 && (
          <section className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-[#e8e6e1]">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#9aa093]">
              Skill breakdown
            </h2>
            <div className="space-y-4">
              {insights.rubric_scores.map((item, i) => (
                <div key={i}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#202322]">{item.question}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold text-[#111510] ${scoreColor(item.score)}`}
                    >
                      {scoreLabel(item.score)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0eeea]">
                    <div
                      className={`h-full rounded-full transition-all ${scoreColor(item.score)}`}
                      style={{ width: `${(item.score / 5) * 100}%` }}
                    />
                  </div>
                  {item.reason && (
                    <p className="mt-1 text-xs text-[#9aa093]">{item.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="mb-4 text-sm text-[#62675e]">
            Want to see how your real interviews are evaluated?
          </p>
          <a
            href="/"
            className="inline-block rounded-[3px] bg-[#202322] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3a3f37]"
          >
            Learn about Talkode
          </a>
        </div>
      </div>
    </div>
  );
}

function ResultsInner() {
  const params = useSearchParams();
  const sessionId = params.get("session");

  if (!sessionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f5] px-4">
        <p className="text-sm text-[#62675e]">No session ID provided.</p>
      </div>
    );
  }

  return <Results sessionId={sessionId} />;
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsInner />
    </Suspense>
  );
}
