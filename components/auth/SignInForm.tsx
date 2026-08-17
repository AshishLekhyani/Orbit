"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { Button } from "@/components/shared/Button";

type Status = "idle" | "sending" | "sent" | "error";
type CodeStatus = "idle" | "verifying" | "error";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = safeRedirectPath(searchParams.get("redirect"));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [codeError, setCodeError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (status === "sent") {
      codeInputRef.current?.focus();
    }
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeStatus("verifying");
    setCodeError("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setCodeStatus("error");
      setCodeError(error.message);
      return;
    }

    const profileReady = await fetch("/api/auth/ensure-profile", { method: "POST" })
      .then((response) => response.ok)
      .catch(() => false);

    if (!profileReady) {
      setCodeStatus("error");
      setCodeError("Signed in, but your account setup didn't finish. Check your connection and try again.");
      return;
    }

    router.push(destination);
  }

  if (status === "sent") {
    return (
      <div className="rounded-md border border-border-strong bg-[#141518] p-4">
        <p className="text-body text-text-primary">Check your email</p>
        <p className="mt-1.5 text-ui text-text-secondary">
          We sent a sign-in link to <span className="text-text-primary">{email}</span>. Click it
          on this device, or enter the code from that email below.
        </p>

        <form onSubmit={handleVerifyCode} className="mt-3.5">
          <input
            ref={codeInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Code from email"
            className="h-9.5 w-full rounded-btn border border-border-strong bg-bg-editor px-2.75 text-center font-mono text-[15px] tracking-[0.2em] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/[0.14]"
          />
          {codeStatus === "error" && (
            <p className="mt-2 text-ui text-danger-text">{codeError}</p>
          )}
          <Button
            type="submit"
            disabled={codeStatus === "verifying" || code.length < 6}
            className="mt-2.5 h-9.5 w-full"
          >
            {codeStatus === "verifying" ? "Verifying…" : "Verify code"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email" className="mb-1.75 block text-xs text-text-tertiary">
        Email
      </label>
      <input
        id="email"
        ref={emailInputRef}
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        className="h-9.5 w-full rounded-btn border border-border-strong bg-[#141518] px-2.75 text-[13.5px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/[0.14]"
      />
      {status === "error" && (
        <p className="mt-2 text-ui text-danger-text">{errorMessage}</p>
      )}
      <Button
        type="submit"
        disabled={status === "sending" || !email}
        className="mt-3 h-9.5 w-full"
      >
        {status === "sending" ? "Sending…" : "Continue"}
      </Button>
    </form>
  );
}
