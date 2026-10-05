"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { importCapturedPosting } from "@/app/actions/applications";
import { decodeCapturePayload } from "@/lib/bookmarklet";
import type { ExtractJobState } from "@/lib/job-import";
import { AddApplicationModal } from "../add-application-dialog";
import type { UserDocumentItem } from "../document-types";

const STORAGE_KEY = "jobpilot-capture";

function readStored() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function store(value: string | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows may block storage; the capture then only survives this page load.
  }
}

// Returns the prefilled form state, a reason nothing can be shown, or null while
// the browser is sent to log in first.
async function readCapture(signedIn: boolean): Promise<ExtractJobState | "empty" | "invalid" | null> {
  // Keep the capture out of the address bar and history once it has been read.
  const fragment = window.location.hash.slice(1);
  if (fragment) {
    store(fragment);
    window.history.replaceState(null, "", "/capture");
  }
  const captured = fragment || readStored();
  if (!captured) return "empty";
  if (!signedIn) {
    window.location.replace("/login?next=/capture");
    return null;
  }
  store(null);
  try {
    return await importCapturedPosting(decodeCapturePayload(captured));
  } catch {
    return "invalid";
  }
}

export function CaptureImport({ signedIn, documents }: { signedIn: boolean; documents: UserDocumentItem[] }) {
  const router = useRouter();
  const started = useRef(false);
  const [result, setResult] = useState<ExtractJobState | null>(null);
  const [status, setStatus] = useState<"reading" | "empty" | "invalid">("reading");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    readCapture(signedIn).then((outcome) => {
      if (typeof outcome === "string") setStatus(outcome);
      else if (outcome) setResult(outcome);
    });
  }, [signedIn]);

  if (result?.alreadySaved) {
    return (
      <div className="mx-auto mt-24 max-w-md border border-amber-300/30 bg-slate-950/70 p-6 text-center">
        <p role="status" className="font-bold text-amber-100">{result.message}</p>
        <p className="mt-3 text-sm text-slate-400">
          It was not saved again. <Link href="/" className="text-sky-300 underline">Go to your applications</Link>
        </p>
      </div>
    );
  }

  if (result) {
    return <AddApplicationModal documents={documents} isExpanded initialState={result} onAutofillReady={() => {}} onClose={() => router.push("/")} />;
  }

  return (
    <div className="mx-auto mt-24 max-w-md border border-white/10 bg-slate-950/70 p-6 text-center">
      <p role="status" className="font-bold text-slate-200">
        {status === "reading" ? "Reading the job page..." : status === "empty" ? "Nothing was captured." : "That capture could not be read."}
      </p>
      {status === "reading" ? null : (
        <p className="mt-3 text-sm text-slate-400">
          Open a job posting and click <Link href="/bookmarklet" className="text-sky-300 underline">Save to JobPilot</Link> in your bookmarks bar.
        </p>
      )}
    </div>
  );
}
