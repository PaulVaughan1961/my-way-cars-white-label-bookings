"use client";

import { Suspense, useEffect, useState } from "react";
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

  return message.includes("invalid login credentials");
}

function isEmailNotConfirmedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = String(
    (error as { message?: unknown }).message ?? ""
  ).toLowerCase();

  return message.includes("email not confirmed");
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
  const urlErrorCode = searchParams.get("error_code");
  const urlErrorDescription = searchParams.get("error_description") ?? "";
  const verificationComplete =
    searchParams.get("verification") === "complete" ||
    searchParams.get("registered") === "1";
  const confirmationFailed =
    urlReason === "access_denied" ||
    urlErrorCode === "otp_expired" ||
    urlErrorDescription.toLowerCase().includes("expired") ||
    urlErrorDescription.toLowerCase().includes("invalid");
  const confirmationExpired =
    urlErrorCode === "otp_expired" ||
    urlErrorDescription.toLowerCase().includes("expired");
  const urlErrorMessage =
    confirmationFailed
      ? confirmationExpired
        ? "This verification link is invalid or has expired. Enter your email address and request a new link."
        : "Email verification could not be completed. Enter your email address and request a new link."
      : urlReason === "temporary-service"
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
  const [showVerificationResend, setShowVerificationResend] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [loading, setLoading] = useState(false);
  const displayedErrorMessage =
    errorMessage || (!hasInteracted ? urlErrorMessage : "");
  const displayedRetryPath =
    retryPath || (!hasInteracted ? urlRetryPath : "");
  const displayedNoticeMessage =
    noticeMessage ||
    (!hasInteracted && verificationComplete && !confirmationFailed
      ? "Email verification completed. Sign in to finish setting up your business."
      : "");
  const displayedVerificationResend =
    showVerificationResend || (!hasInteracted && confirmationFailed);

  useEffect(() => {
    const pendingEmail = window.sessionStorage.getItem(
      "pendingOperatorEmail"
    );
    if (pendingEmail) {
      setEmail((current) => current || pendingEmail);
    }
  }, []);

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
    setShowVerificationResend(false);

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

        if (isEmailNotConfirmedError(loginResult.error)) {
          setErrorMessage(
            "This email address has not been verified. Request a new verification link below."
          );
          setShowVerificationResend(true);
        } else {
          setErrorMessage(
            isCredentialError(loginResult.error)
              ? "The email address or password is incorrect."
              : "The login service is temporarily unavailable. Please wait a moment and try again."
          );
        }
        return;
      }

      window.sessionStorage.removeItem("pendingOperatorEmail");

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
        router.replace("/operator-onboarding");
        router.refresh();
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

  async function resendVerification() {
    setHasInteracted(true);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Enter your email address first.");
      setShowVerificationResend(true);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setNoticeMessage("");
    setRetryPath("");

    try {
      const result = await withTimeout(() =>
        supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/operator-login?verification=complete`,
          },
        })
      );

      if (result.error) {
        reportLoginFailure("verification-resend", result.error);
        setErrorMessage(
          "A new verification email could not be sent. Please wait a moment and try again."
        );
        setShowVerificationResend(true);
        return;
      }

      window.sessionStorage.setItem("pendingOperatorEmail", cleanEmail);
      setShowVerificationResend(false);
      setNoticeMessage(
        "A new verification email has been sent. Check your inbox and use the newest link."
      );
    } catch (error) {
      reportLoginFailure("verification-resend-request", error);
      setErrorMessage(
        "The verification service took too long to respond. Please try again."
      );
      setShowVerificationResend(true);
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
          <h1 className="text-2xl font-bold text-slate-900">Operator Portal</h1>
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

        {displayedNoticeMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {displayedNoticeMessage}
          </div>
        )}

        {displayedVerificationResend && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void resendVerification()}
            className="w-full rounded-xl border border-slate-900 px-4 py-3 font-medium text-slate-900 disabled:opacity-60"
          >
            Resend verification email
          </button>
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

        <a
          href="/operator-register"
          className="block text-center text-sm font-medium text-blue-700 underline"
        >
          Create an operator account
        </a>
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
