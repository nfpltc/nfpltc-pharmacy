"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function NewResidentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    const payload = {
      full_name: (formData.get("full_name") as string)?.trim(),
      account_number: (formData.get("account_number") as string)?.trim(),
      dob: formData.get("dob") as string,
      email: (formData.get("email") as string)?.toLowerCase().trim(),
      password: formData.get("password") as string,
      role: "user",
    }

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to create resident" })
      } else {
        setMessage({ type: "success", text: "Resident created successfully!" })
        form.reset()
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F5EF]">
      {/* Hero */}
      <section
        className="relative isolate overflow-hidden"
        style={{
          background: "linear-gradient(135deg,#0EA171 0%, #0B8F79 50%, #0B7C79 100%)",
          paddingTop: "48px",
          paddingBottom: "56px",
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-6">
          <Link
            href="/admin/residents"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Residents
          </Link>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Add New Resident</h1>
          <p className="mt-2 text-white/90">
            Create a new resident account. They will be able to log in to the portal and view their statements.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-emerald-900/10 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-700/10 text-emerald-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Resident Details</h2>
              <p className="text-sm text-gray-600">Fill in all fields to create a new resident account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="e.g. John Smith"
                  className="h-11 bg-gray-50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  name="account_number"
                  placeholder="e.g. 4310"
                  className="h-11 bg-gray-50"
                  required
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  name="dob"
                  type="date"
                  className="h-11 bg-gray-50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="e.g. john@example.com"
                  className="h-11 bg-gray-50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Minimum 6 characters"
                minLength={6}
                className="h-11 bg-gray-50"
                required
              />
              <p className="text-xs text-gray-500">
                This will be the resident's login password for the portal.
              </p>
            </div>

            {message && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="h-11 bg-emerald-700 px-8 text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create Resident"}
              </Button>
              <Link href="/admin/residents">
                <Button type="button" variant="outline" className="h-11 px-6">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
