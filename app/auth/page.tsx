import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign In | Talkode",
  description: "Sign in to your Talkode recruiter account.",
};

export default function AuthPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-white px-4 py-12 sm:px-8">
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <AuthForm />

        <section className="flex flex-col border border-line bg-[#f8f9f6] px-8 py-8">
          <div className="mb-7">
            <span className="text-base font-semibold text-secondary">Get access</span>
            <p className="mt-1 text-xs text-neutral">
              Talkode is in closed beta right now. Reach out to request an account.
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <a
              href="mailto:tanush.obili@berkeley.edu?subject=Talkode%20Access%20Request&body=Hi%2C%20I%27d%20like%20to%20request%20access%20to%20Talkode."
              className="flex h-9 w-full items-center justify-center border border-[#141414] bg-white px-3 text-sm font-semibold text-secondary transition duration-150 hover:bg-[#f0f0f0]"
            >
              Email us
            </a>

            <p className="text-[11px] leading-relaxed text-neutral">
              Send us a note at{" "}
              <a
                href="mailto:tanush.obili@berkeley.edu"
                className="font-medium text-secondary underline underline-offset-2"
              >
                tanush.obili@berkeley.edu
              </a>{" "}
              and we&apos;ll get back to you soon.
            </p>
          </div>

          <p className="mt-auto pt-8 text-[10px] leading-relaxed text-neutral">
            Already have an account? Sign in on the left.
          </p>
        </section>
      </div>
    </main>
  );
}
