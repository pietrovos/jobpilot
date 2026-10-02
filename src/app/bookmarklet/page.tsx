import Link from "next/link";
import { BookmarkletLink } from "./bookmarklet-link";

export default function BookmarkletPage() {
  return (
    <main id="main-content" className="site-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="site-brand text-sm font-bold uppercase tracking-[0.35em]">JobPilot</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight">Save to JobPilot</h1>
        <p className="mt-3 text-slate-300">
          Some job sites, such as Indeed and LinkedIn, block JobPilot from reading their pages. This button reads
          the posting from the page already open in your browser instead, then opens JobPilot with the details
          filled in for you to review.
        </p>
        <div className="mt-8 border border-white/10 bg-slate-950/60 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">Set it up once</p>
          <ol className="mt-4 grid list-decimal gap-2 pl-5 text-slate-300">
            <li>Show your bookmarks bar (Ctrl+Shift+B, or Cmd+Shift+B on a Mac).</li>
            <li>Drag this button onto the bookmarks bar:</li>
          </ol>
          <div className="mt-5"><BookmarkletLink /></div>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-sky-400">Use it</p>
          <p className="mt-2 text-slate-300">
            Open a job posting and click Save to JobPilot in your bookmarks bar. If a field comes out wrong, select
            the job description on the page first, then click it again.
          </p>
        </div>
        <p className="mt-6 text-sm text-slate-400">
          The button only reads the page you click it on, and sends what it reads to this JobPilot site, nowhere else.
          It works in desktop browsers; mobile browsers do not support bookmark buttons well.
        </p>
      </div>
    </main>
  );
}
