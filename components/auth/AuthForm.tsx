"use client";

import { useActionState } from "react";
import { signIn } from "@/app/auth/actions";
import { initialAuthState, type AuthFormState } from "@/app/auth/form-state";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
      {message}
    </p>
  );
}

function Message({ message, status }: { message?: string; status: AuthFormState["status"] }) {
  if (!message || status === "idle") return null;
  return (
    <div
      className={cx(
        "border px-3 py-2 text-sm leading-6",
        status === "success"
          ? "border-[#6d9200] bg-[#f4ffd9] text-[#314200]"
          : "border-red-300 bg-red-50 text-red-800",
      )}
      role="status"
    >
      {message}
    </div>
  );
}

function TextInput({
  autoComplete,
  error,
  label,
  name,
  placeholder,
  type = "text",
}: {
  autoComplete: string;
  error?: string;
  label: string;
  name: "email" | "password";
  placeholder: string;
  type?: "email" | "password" | "text";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium leading-none text-secondary" htmlFor={name}>
        {label}
      </label>
      <input
        aria-describedby={error ? `${name}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={cx(
          "h-9 w-full border bg-white px-3 text-[13px] text-secondary outline-none transition duration-150 placeholder:text-[#8a8f99]",
          error ? "border-red-400" : "border-line",
        )}
        id={name}
        name={name}
        placeholder={placeholder}
        required
        type={type}
      />
      <div id={`${name}-error`}>
        <FieldError message={error} />
      </div>
    </div>
  );
}

export function AuthForm() {
  const [state, action, pending] = useActionState(signIn, initialAuthState);

  return (
    <section className="w-full border border-line bg-panel px-8 py-8">
      <div className="mb-7">
        <span className="text-base font-semibold text-secondary">talkode</span>
        <p className="mt-1 text-xs text-neutral">Sign in to your recruiter account.</p>
      </div>

      {state.message && state.status !== "idle" && (
        <div className="mb-5">
          <Message message={state.message} status={state.status} />
        </div>
      )}

      <form action={action} className="space-y-4">
        <TextInput
          autoComplete="email"
          error={state.fieldErrors?.email}
          label="Email"
          name="email"
          placeholder="name@company.com"
          type="email"
        />
        <TextInput
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          label="Password"
          name="password"
          placeholder="Password"
          type="password"
        />
        <button
          className="flex h-9 w-full items-center justify-center bg-primary px-3 text-sm font-semibold text-secondary transition duration-150 hover:bg-[#d7ff5a] focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
