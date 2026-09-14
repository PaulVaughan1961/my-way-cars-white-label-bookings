"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

const REQUEST_TIMEOUT_MS = 12000;

class RequestTimeoutError extends Error {
  constructor() {
    super("The login request timed out.");
    this.name = "RequestTimeoutError";
  }
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new RequestTimeoutError()),
      timeoutMs
    );
  });

  try {
    return await Promise.race([operation(), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

function isCredentialError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = String(
    (error as { message?: unknown }).message ?? ""
  ).toLowerCase();

  return (
    message.includes("invalid login credentials") ||
    message.includes("email not confirmed")
  );
}

function reportLoginFailure(stage: string, error: unknown) {
  const candidate =
    error && typeof error === "object"
      ? (error as { code?: unknown; status?: unknown })
      : {};

  console.error(`[operator-login:${stage}]`, {
    name: error instanceof Error ? error.name : "ServiceError",
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    status:
      typeof candidate.status === "number" ? candidate.status : undefined,
  });
}

function waitBeforeRetry() {
  return new Promise<void>((resolve) => setTimeout(resolve, 500));
}

function OperatorLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabase();
  const urlReason = searchParams.get("error");
  const urlErrorMessage =
    urlReason === "temporary-service"
      ? "The login service could not verify your access. Please wait a moment and try again."
      : urlReason === "not-operator"
        ? "This account does not have operator access."
        : "";
  const urlRetryPath =
    urlReason === "temporary-service"
      ? safeNextPath(searchParams.get("next"))
      : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [retryPath, setRetryPath] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [loading, setLoading] = useState(false);
  const displayedErrorMessage =
    errorMessage || (!hasInteracted ? urlErrorMessage : "");
  const displayedRetryPath =
    retryPath || (!hasInteracted ? urlRetryPath : "");

  async function checkOperator(userId: string) {
    return withTimeout(async () =>
      await supabase
        .from("operator_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle()
    );
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setHasInteracted(true);
    setErrorMessage("");
    setNoticeMessage("");
    setRetryPath("");

    try {
      const loginResult = await withTimeout(() =>
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
      );

      if (loginResult.error || !loginResult.data.user) {
        if (loginResult.error) {
          reportLoginFailure("password-sign-in", loginResult.error);
        }

        setErrorMessage(
          isCredentialError(loginResult.error)
            ? "The email address or password is incorrect."
            : "The login service is temporarily unavailable. Please wait a moment and try again."
        );
        return;
      }

      let operatorResult = await checkOperator(loginResult.data.user.id);

      if (operatorResult.error) {
        await waitBeforeRetry();
        operatorResult = await checkOperator(loginResult.data.user.id);
      }

      if (operatorResult.error) {
        reportLoginFailure("operator-access", operatorResult.error);
        setErrorMessage(
          "You signed in, but your operator access could not be verified. Please wait a moment and try again."
        );
        setRetryPath(
          safeNextPath(
            new URLSearchParams(window.location.search).get("next")
          )
        );
        return;
      }

      if (!operatorResult.data) {
        await supabase.auth.signOut();
        setErrorMessage("This account does not have operator access.");
        return;
      }

      const requestedPath = new URLSearchParams(
        window.location.search
      ).get("next");

      router.replace(safeNextPath(requestedPath));
      router.refresh();
    } catch (error) {
      reportLoginFailure("request", error);
      setErrorMessage(
        error instanceof RequestTimeoutError
          ? "The login service took too long to respond. Please try again."
          : "The login service is temporarily unavailable. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function retryExistingSession() {
    if (loading) return;
    setLoading(true);
    setHasInteracted(true);
    setErrorMessage("");
    router.replace(safeNextPath(displayedRetryPath));
    router.refresh();
  }

  async function sendPasswordReset() {
    setHasInteracted(true);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Enter your email address first.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setNoticeMessage("");
    setRetryPath("");

    try {
      const result = await withTimeout(() =>
        supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/operator-reset`,
        })
      );

      if (result.error) {
        reportLoginFailure("password-reset", result.error);
        setErrorMessage(
          "The password reset service is temporarily unavailable. Please try again."
        );
        return;
      }

      setNoticeMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      reportLoginFailure("password-reset-request", error);
      setErrorMessage(
        "The password reset service took too long to respond. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Way Cars</h1>
          <p className="mt-1 text-sm text-slate-600">Operator login</p>
        </div>

        <label className="block text-sm font-medium text-slate-800">
          Email address
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          />
        </label>

        {displayedErrorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {displayedErrorMessage}
          </div>
        )}

        {noticeMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {noticeMessage}
          </div>
        )}

        {displayedRetryPath && (
          <button
            type="button"
            disabled={loading}
            onClick={retryExistingSession}
            className="w-full rounded-xl border border-slate-900 px-4 py-3 font-medium text-slate-900 disabled:opacity-60"
          >
            Try again
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => void sendPasswordReset()}
          className="w-full text-sm font-medium text-blue-700 underline disabled:opacity-60"
        >
          Forgotten your password?
        </button>
      </form>
    </main>
  );
}

export default function OperatorLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
            Loading sign-in…
          </div>
        </main>
      }
    >
      <OperatorLoginForm />
    </Suspense>
  );
}
