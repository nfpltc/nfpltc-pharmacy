"use client"

type Member = {
  name: string
  title: string
}

export function TeamSection() {
  const team: Member[] = [
    { name: "Sneha Krishnakumar PharmD, MS", title: "Pharmacy Manager" },
    { name: "Alexis Wing PharmD, MBA", title: "Pharmacist" },
    { name: "Angela Squarcia, RPH", title: "Pharmacist" },
    { name: "Suman Raj Medikondu, MBA", title: "Manager, Business Operations Analytics" },
  ]

  return (
    <section id="team" className="bg-white py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-[360px_1fr]">
        {/* Left intro panel */}
        <div className="rounded-3xl bg-emerald-600 p-8 text-white md:sticky md:top-24 md:self-start">
          <h2 className="text-3xl font-extrabold tracking-tight">Our Team</h2>
          <p className="mt-4 text-white/90">
            Meet the people behind your care. Our pharmacists and operations
            team coordinate closely with families and facilities to keep
            medication management safe and simple.
          </p>
        </div>

        {/* Right: 2x2 simple cards (name + title under name) */}
        <div className="grid gap-6 sm:grid-cols-2">
          {team.map((m) => (
            <article
              key={m.name}
              className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-emerald-900">{m.name}</h3>
              <p className="mt-1 text-sm text-emerald-700/80">{m.title}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
