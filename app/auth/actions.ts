"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/app/auth/form-state";
import { isAuthRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type AuthField = "email" | "password";

function readFormString(formData: FormData, key: AuthField) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function configurationError(): AuthFormState {
  return {
    message:
      "The database is not configured yet. Add the project URL and publishable key.",
    status: "error",
  };
}

function validateCredentials(formData: FormData) {
  const email = readFormString(formData, "email").toLowerCase();
  const password = readFormString(formData, "password");
  const fieldErrors: AuthFormState["fieldErrors"] = {};

  if (!validateEmail(email)) {
    fieldErrors.email = "Enter a valid work email.";
  }

  if (!password) {
    fieldErrors.password = "Enter your password.";
  }

  return {
    email,
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
    password,
  };
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const credentials = validateCredentials(formData);

  if (!credentials.isValid) {
    return {
      fieldErrors: credentials.fieldErrors,
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;

  try {
    supabase = await createClient();
  } catch {
    return configurationError();
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error || !data.user) {
    return {
      message:
        "We could not authenticate that recruiter account. Check credentials and account status.",
      status: "error",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("recruiter_profiles")
    .select("role,status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !isAuthRole(profile.role) ||
    profile.status !== "active"
  ) {
    await supabase.auth.signOut();

    return {
      message:
        "Access is limited to active recruiter and manager accounts.",
      status: "error",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readFormString(formData, "email").toLowerCase();
  const password = readFormString(formData, "password");
  const fieldErrors: AuthFormState["fieldErrors"] = {};

  if (!validateEmail(email)) {
    fieldErrors.email = "Enter a valid work email.";
  }

  if (!password) {
    fieldErrors.password = "Enter your password.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  const emailParts = email.split("@");
  const fallbackFullName = emailParts[0]?.replace(/[._-]+/g, " ").trim() || email;
  const fallbackCompanyName =
    emailParts[1]?.replace(/[._-]+/g, " ").trim() || "Talkode";
  const role = "recruiter" as const;

  let supabase: Awaited<ReturnType<typeof createClient>>;

  try {
    supabase = await createClient();
  } catch {
    return configurationError();
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    options: {
      data: {
        company_name: fallbackCompanyName,
        full_name: fallbackFullName,
        role,
      },
    },
    password,
  });

  if (error) {
    return {
      message: "We could not create that account. Use a valid email and password.",
      status: "error",
    };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (!signInError && signInData.user) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return {
    message:
      "Account created, but the server did not return an active session. Check auth settings to allow direct sign up.",
    status: "error",
  };
}
