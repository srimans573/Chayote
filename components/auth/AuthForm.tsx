"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/auth/actions";
import {
  initialAuthState,
  type AuthFormState,
} from "@/app/auth/form-state";

type AuthMode = "sign-in" | "sign-up";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
      {message}
    </p>
  );
}

function Message({
  message,
  status,
}: {
  message?: string;
  status: AuthFormState["status"];
}) {
  if (!message || status === "idle") {
    return null;
  }

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
  const errorId = `${name}-error`;

  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-medium leading-none text-secondary"
        htmlFor={name}
      >
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
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
      <div id={errorId}>
        <FieldError message={error} />
      </div>
    </div>
  );
}

function SubmitButton({
  children,
  pending,
}: {
  children: string;
  pending: boolean;
}) {
  return (
    <button
      className="flex h-9 w-full items-center justify-center bg-primary px-3 text-sm font-semibold text-secondary transition duration-150 hover:bg-[#d7ff5a] focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      <span>{pending ? "Processing" : children}</span>
    </button>
  );
}

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialAuthState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialAuthState,
  );
  const activeState = mode === "sign-in" ? signInState : signUpState;
  const pending = mode === "sign-in" ? signInPending : signUpPending;
  const formAction = mode === "sign-in" ? signInAction : signUpAction;

  return (
    <section className="w-full max-w-85 border border-line bg-panel px-5 py-6">
      <div className="mb-5">
        <span className="text-base font-semibold text-secondary">talkode</span>
      </div>

      <div className="mb-4 grid grid-cols-2 border border-line p-1">
        {(["sign-in", "sign-up"] as const).map((option) => (
          <button
            className={
              mode === option
                ? "h-8 bg-secondary text-xs font-semibold text-white"
                : "h-8 text-xs font-semibold text-neutral transition duration-150 hover:text-secondary"
            }
            key={option}
            onClick={() => setMode(option)}
            type="button"
          >
            {option === "sign-in" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <Message message={activeState.message} status={activeState.status} />
      </div>

      <form action={formAction} className="space-y-3.5">
        <TextInput
          autoComplete="email"
          error={activeState.fieldErrors?.email}
          label="Email"
          name="email"
          placeholder="name@company.com"
          type="email"
        />
        <TextInput
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          error={activeState.fieldErrors?.password}
          label="Password"
          name="password"
          placeholder="Password"
          type="password"
        />
        <SubmitButton pending={pending}>
          {mode === "sign-in" ? "Sign in" : "Sign up"}
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-xs text-neutral">
        {mode === "sign-in"
          ? "Sign in with your recruiter account."
          : "Create an account and go straight to the dashboard."}
      </p>
    </section>
  );
}
