"use client"

// Big, unmistakable confirmation shown after a public form is submitted.
// Replaces the tiny inline "submitted" text so customers clearly see it worked.
export default function FormSuccess({
  title = "Submitted!",
  message,
  onReset,
  resetLabel = "Submit another",
}: {
  title?: string
  message?: string
  onReset?: () => void
  resetLabel?: string
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#faf7f3] px-6 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-emerald-100 bg-white p-10 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <svg viewBox="0 0 24 24" className="h-11 w-11 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-600">
          {message || "Thank you — we've received your information. Our team will be in touch shortly."}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {onReset && (
            <button
              onClick={onReset}
              className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
            >
              {resetLabel}
            </button>
          )}
          <a
            href="/"
            className="w-full rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  )
}
