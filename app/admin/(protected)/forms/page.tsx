"use client"
import { useState } from "react"
import { UserCheck, CreditCard, Syringe, ClipboardList } from "lucide-react"
import EnrollmentsPage from "../enrollments/page"
import CreditCardsPage from "../credit-cards/page"
import VaccinesPage from "../vaccines/page"

const TABS = [
  { id: "enrollments", label: "Enrollments", icon: UserCheck, Comp: EnrollmentsPage },
  { id: "credit-cards", label: "Credit Cards", icon: CreditCard, Comp: CreditCardsPage },
  { id: "vaccines", label: "Vaccines", icon: Syringe, Comp: VaccinesPage },
]

// One "Forms" page that tabs between the enrollment, credit-card and vaccine
// submission views (each is its own self-contained client page).
export default function FormsPage() {
  const [tab, setTab] = useState("enrollments")
  const Active = TABS.find(t => t.id === tab)!.Comp

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><ClipboardList className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Forms</h1>
          <p className="text-sm text-gray-500">Enrollment, credit-card, and vaccine submissions in one place.</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium ${tab === t.id ? "text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
            {tab === t.id && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-emerald-600" />}
          </button>
        ))}
      </div>

      <Active />
    </div>
  )
}
