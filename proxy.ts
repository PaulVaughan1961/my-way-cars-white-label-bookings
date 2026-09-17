import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const REQUEST_TIMEOUT_MS = 12000;

class RequestTimeoutError extends Error {
  constructor() {
    super("The authentication request timed out.");
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

function waitBeforeRetry() {
  return new Promise<void>((resolve) => setTimeout(resolve, 350));
}

function isMissingSessionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = String(
    (error as { message?: unknown }).message ?? ""
  ).toLowerCase();
  return message.includes("auth session missing");
}

function reportAuthFailure(stage: string, error: unknown) {
  const candidate =
    error && typeof error === "object"
      ? (error as { code?: unknown; status?: unknown })
      : {};

  console.error(`[operator-auth:${stage}]`, {
    name: error instanceof Error ? error.name : "ServiceError",
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    status:
      typeof candidate.status === "number" ? candidate.status : undefined,
  });
}

function loginRedirect(
  request: NextRequest,
  cookieResponse: NextResponse,
  reason?: "temporary-service" | "not-operator",
  includeNext = false
) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/operator-login";
  loginUrl.search = "";

  if (reason) loginUrl.searchParams.set("error", reason);
  if (includeNext) {
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
  }

  const redirect = NextResponse.redirect(loginUrl);
  cookieResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    async function getUser() {
      return withTimeout(() => supabase.auth.getUser());
    }

    let userResult = await getUser();

    if (userResult.error && !isMissingSessionError(userResult.error)) {
      await waitBeforeRetry();
      userResult = await getUser();
    }

    if (userResult.error) {
      if (isMissingSessionError(userResult.error)) {
        return loginRedirect(request, response, undefined, true);
      }

      reportAuthFailure("user-check", userResult.error);
      return loginRedirect(request, response, "temporary-service", true);
    }

    const user = userResult.data.user;
    if (!user) {
      return loginRedirect(request, response, undefined, true);
    }

    if (request.nextUrl.pathname.startsWith("/operator-onboarding")) {
      return response;
    }

    async function checkOperator() {
      return withTimeout(async () =>
        await supabase
          .from("operator_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle()
      );
    }

    let operatorResult = await checkOperator();

    if (operatorResult.error) {
      await waitBeforeRetry();
      operatorResult = await checkOperator();
    }

    if (operatorResult.error) {
      reportAuthFailure("operator-check", operatorResult.error);
      return loginRedirect(request, response, "temporary-service", true);
    }

    if (!operatorResult.data) {
      return loginRedirect(request, response, "not-operator");
    }

    return response;
  } catch (error) {
    reportAuthFailure("request", error);
    return loginRedirect(request, response, "temporary-service", true);
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/add/:path*",
    "/edit/:path*",
    "/calendar/:path*",
    "/customers/:path*",
    "/accounts/:path*",
    "/drivers/:path*",
    "/business-setup/:path*",
    "/operator-onboarding/:path*",
    "/receipt/:path*",
    "/receipt-multi/:path*",
  ],
};
