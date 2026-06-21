import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Auth | Talkode",
  description: "Sign in or create a Talkode account.",
};

export default function AuthPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-8 sm:px-8">
      <AuthForm />
    </main>
  );
}
