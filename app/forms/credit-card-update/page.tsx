"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, SubmitHandler } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { HippaDisclaimerModal } from "@/components/HippaDisclaimerModal"
import FormSuccess from "@/components/FormSuccess"

// -----------------------------
// Utilities
// -----------------------------
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT",
  "NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]
const PHONE_PLACEHOLDER = "(###) ###-####"
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]

// -----------------------------
// Validation Schema (zod)
// -----------------------------
const schema = z.object({
  // Patient Information
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  dob: z.string().min(1, "Required"),
  accountNumber: z.string().min(1, "Required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),

  billingAddress: z.string().min(1, "Required"),
  billingCity: z.string().min(1, "Required"),
  billingState: z.string().min(1, "Required"),
  billingZip: z.string().min(1, "Required"),

  // Card Details
  cardType: z.enum(["Debit", "Credit"], { required_error: "Select card type" }),
  cardNumber: z.string().min(12, "Enter full card number"),
  cardExpMonth: z.string().min(2, "MM is required"),
  cardExpYear: z.string().min(4, "YYYY is required"),
  cardCvv: z.string().min(3, "CVV is required"),
  cardholderName: z.string().min(1, "Required"),

  // Consent
  consentName: z.string().min(1, "Type your full name to sign"),
  consentDate: z.string().min(1, "Required"),
  consentAgree: z.boolean().refine((v) => v === true, {
    message: "You must agree to the consent statement",
  }),
})

type FormData = z.infer<typeof schema>

// -----------------------------
// Small UI helpers
// -----------------------------
function SectionCard(props: { title: string; children: React.ReactNode; caption?: string }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 md:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-emerald-900">{props.title}</h2>
        {props.caption ? (
          <p className="mt-1 text-sm text-muted-foreground">{props.caption}</p>
        ) : null}
      </div>
      {props.children}
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-emerald-900">{children}</label>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "h-12 md:h-13 w-full rounded-xl border border-black/10 bg-background px-4 outline-none ring-offset-background " +
        "focus:ring-2 focus:ring-emerald-500 " +
        (props.className ?? "")
      }
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "min-h-36 w-full rounded-xl border border-black/10 bg-background px-4 py-3 outline-none ring-offset-background " +
        "focus:ring-2 focus:ring-emerald-500 " +
        (props.className ?? "")
      }
    />
  )
}

function Select({
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={
        "h-12 md:h-13 w-full rounded-xl border border-black/10 bg-background px-4 outline-none ring-offset-background " +
        "focus:ring-2 focus:ring-emerald-500 " +
        (className ?? "")
      }
    />
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

// -----------------------------
// Page
// -----------------------------
export default function CreditCardUpdateFormPage() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [serverMsg, setServerMsg] = useState<string | null>(null)

  const years = useMemo(() => {
    const now = new Date().getFullYear()
    return Array.from({ length: 13 }, (_, i) => String(now + i))
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      billingState: "MA",
      cardType: "Credit",
    },
  })

  // When users type, clear server message
  useEffect(() => setServerMsg(null), [])

  // Guard: If card number present, make exp + cvv required visually (zod already validates)
  const cardNumberEntered = watch("cardNumber")

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setStatus("submitting")
    setServerMsg(null)
    try {
      const res = await fetch("/api/forms/credit-card-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      let json: any = {}
      try {
        json = await res.json()
      } catch {}
      if (!res.ok) throw new Error(json?.error || "Submission failed")

      setStatus("success")
      setServerMsg("Card details updated successfully. Thank you!")
      reset({ billingState: "MA", cardType: "Credit" })
    } catch (e: any) {
      setStatus("error")
      setServerMsg(e?.message || "Something went wrong")
    }
  }

  if (!disclaimerAccepted) {
    return <HippaDisclaimerModal onAccept={() => setDisclaimerAccepted(true)} />
  }

  if (status === "success") {
    return (
      <FormSuccess
        title="Card details updated!"
        message={serverMsg || "Thank you — your billing information has been securely submitted."}
        onReset={() => { setStatus("idle"); setServerMsg(null) }}
        resetLabel="Update another card"
      />
    )
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h1 className="mt-6 text-pretty text-3xl font-semibold md:text-5xl">
            Credit Card Update Request
          </h1>
          <p className="mt-4 max-w-2xl text-sm/6 text-white/80 md:text-base/7">
            Use this secure form to update the card we keep on file for recurring charges. We only store the last 4 digits and tokenized reference through our processor.
          </p>
        </div>
      </section>

      {/* FORM */}
      <section className="bg-[#faf7f3]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* 1) Patient Information */}
            <SectionCard
              title="Patient Information"
              caption="Provide the patient details and billing address associated with the card."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>First name</Label>
                  <Input placeholder="First name" {...register("firstName")} />
                  <FieldError message={errors.firstName?.message} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input placeholder="Last name" {...register("lastName")} />
                  <FieldError message={errors.lastName?.message} />
                </div>
                <div>
                  <Label>Date of birth</Label>
                  <Input type="date" {...register("dob")} />
                  <FieldError message={errors.dob?.message} />
                </div>

                <div>
                  <Label>Account number</Label>
                  <Input placeholder="Patient account #" {...register("accountNumber")} />
                  <FieldError message={errors.accountNumber?.message} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input placeholder={PHONE_PLACEHOLDER} {...register("phone")} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" placeholder="you@example.com" {...register("email")} />
                  <FieldError message={errors.email?.message} />
                </div>

                <div className="md:col-span-3">
                  <Label>Billing address</Label>
                  <Input placeholder="Street address" {...register("billingAddress")} />
                  <FieldError message={errors.billingAddress?.message} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input placeholder="City" {...register("billingCity")} />
                  <FieldError message={errors.billingCity?.message} />
                </div>
                <div>
                  <Label>State</Label>
                  <Select {...register("billingState")}>
                    {US_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.billingState?.message} />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input inputMode="numeric" placeholder="ZIP" {...register("billingZip")} />
                  <FieldError message={errors.billingZip?.message} />
                </div>
              </div>
            </SectionCard>

            {/* 2) Card Details */}
            <SectionCard
              title="Card Details"
              caption="We use secure, PCI-compliant processing. Do not email card information."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <Label>Card type</Label>
                  <Select {...register("cardType")}>
                    <option value="">Select</option>
                    <option>Debit</option>
                    <option>Credit</option>
                  </Select>
                  <FieldError message={errors.cardType?.message} />
                </div>
                <div className="md:col-span-2">
                  <Label>Card number</Label>
                  <Input inputMode="numeric" placeholder="#### #### #### ####" {...register("cardNumber")} />
                  <FieldError message={errors.cardNumber?.message} />
                </div>
                <div>
                  <Label>CVV</Label>
                  <Input inputMode="numeric" placeholder="CVV" {...register("cardCvv")} />
                  <FieldError message={errors.cardCvv?.message} />
                </div>

                <div>
                  <Label>Exp. month</Label>
                  <Select {...register("cardExpMonth")}>
                    <option value="">MM</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.cardExpMonth?.message} />
                </div>
                <div>
                  <Label>Exp. year</Label>
                  <Select {...register("cardExpYear")}>
                    <option value="">YYYY</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.cardExpYear?.message} />
                </div>
                <div className="md:col-span-2">
                  <Label>Cardholder name</Label>
                  <Input placeholder="as printed on card" {...register("cardholderName")} />
                  <FieldError message={errors.cardholderName?.message} />
                </div>
              </div>

              {cardNumberEntered ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  For security, we may verify the update via phone or a one-time authorization.
                </p>
              ) : null}
            </SectionCard>

            {/* 3) Consent */}
            <SectionCard
              title="Consent"
              caption="I authorize North Falmouth Pharmacy to use this card for recurring charges related to pharmacy services. I understand I can revoke or update this authorization by submitting a new form."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Typed signature (full name)</Label>
                  <Input placeholder="Type full name to sign" {...register("consentName")} />
                  <FieldError message={errors.consentName?.message} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" {...register("consentDate")} />
                  <FieldError message={errors.consentDate?.message} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("consentAgree")} />
                <span>I agree to the consent statement above.</span>
              </label>
              <FieldError message={errors.consentAgree?.message} />
            </SectionCard>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-600 px-7 text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting..." : "Update Card on File"}
              </button>
              {status !== "idle" && (
                <span
                  className={`text-sm ${
                    status === "success" ? "text-green-700" : status === "error" ? "text-red-700" : "text-muted-foreground"
                  }`}
                >
                  {serverMsg}
                </span>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}