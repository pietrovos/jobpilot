"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="site-shell grid min-h-screen place-items-center p-6">
    <section className="max-w-md space-y-4" role="alert">
      <h1 className="text-2xl font-black">Something went wrong</h1>
      <p>We could not load this page. If you were saving changes, check your data before submitting again.</p>
      <button className="border border-sky-300 px-4 py-2" onClick={reset}>Try again</button>
    </section>
  </main>;
}
