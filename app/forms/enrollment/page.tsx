"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, SubmitHandler, useWatch } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { HippaDisclaimerModal } from "@/components/HippaDisclaimerModal"
import FormSuccess from "@/components/FormSuccess"

// ---------- Utilities ----------
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT",
  "NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]
const PHONE_PLACEHOLDER = "(###) ###-####"
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]

// ---------- Validation (zod) ----------
const schema = z
  .object({
    // Start Info
    todaysDate: z.string().min(1, "Required"),
    startDate: z.string().min(1, "Required"),
    startTime: z.string().min(1, "Required"),

    // Submitter
    submitterRelation: z.enum(["Self/Resident", "Responsible Party"]),
    submitterFirstName: z.string().optional(),
    submitterLastName: z.string().optional(),
    submitterPhone: z.string().optional(),
    submitterEmail: z.string().min(1, "Email is required").email("Please enter a valid email"),

    // Resident
    lastName: z.string().min(1, "Required"),
    firstName: z.string().min(1, "Required"),
    middleInitial: z.string().optional(),
    dob: z.string().min(1, "Required"),
    ssn: z
      .string()
      .min(4, "Last four digits required")
      .max(4, "Only last four digits")
      .regex(/^\d{4}$/, "Enter 4 digits"),
    gender: z.enum(["Female","Male","Non-binary","Prefer not to say"]),
    homeAddress: z.string().min(1, "Required"),
    city: z.string().min(1, "Required"),
    state: z.string().min(1, "Required"),
    zip: z.string().min(1, "Required"),
    allergies: z.string().min(1, "Required"),

    // Facility (keep as-is)
    facilityName: z.string().min(1, "Required"),
    roomNumber: z.string().min(1, "Required"),
    facilityAddress: z.string().min(1, "Required"),
    facilityCity: z.string().min(1, "Required"),
    facilityState: z.string().min(1, "Required"),
    facilityZip: z.string().min(1, "Required"),

    movingFrom: z.enum(["Home", "Rehab", "Hospital", "Assisted Living"]).optional(),
    hospitalRehabName: z.string().optional(),
    hospitalRehabPhone: z.string().optional(),

    // PCP
    pcpName: z.string().min(1, "Required"),
    pcpSpecialty: z.string().min(1, "Required"),
    pcpAddress: z.string().min(1, "Required"),
    pcpPhone: z.string().min(1, "Required"),
    pcpFax: z.string().min(1, "Required"),

    // Billing / Insurance
    rxMemberId: z.string().min(1, "Required"),
    rxGrp: z.string().min(1, "Required"),
    rxBin: z.string().min(1, "Required"),
    rxPcn: z.string().min(1, "Required"),

    cardType: z.enum(["Debit", "Credit"]),
    cardNumber: z.string().min(1, "Required"),
    cardExpMonth: z.string().min(1, "Required"),
    cardExpYear: z.string().min(1, "Required"),
    cardCvv: z.string().min(1, "Required"),
    cardholderName: z.string().min(1, "Required"),

    billingAddress: z.string().min(1, "Required"),
    billingCity: z.string().min(1, "Required"),
    billingState: z.string().min(1, "Required"),
    billingZip: z.string().min(1, "Required"),

    additionalContactName: z.string().min(1, "Required"),
    additionalContactPhone: z.string().min(1, "Required"),

    // Authorization
    authName: z.string().min(1, "Type your full name to sign"),
    authDate: z.string().min(1, "Required"),
    authAgree: z.boolean().refine((v) => v === true, {
      message: "You must agree to the authorization statement",
    }),
  })
  // Conditional: if Responsible Party, submitter fields required
  .superRefine((vals, ctx) => {
    if (vals.submitterRelation === "Responsible Party") {
      if (!vals.submitterFirstName) ctx.addIssue({ code: "custom", message: "Required", path: ["submitterFirstName"] })
      if (!vals.submitterLastName) ctx.addIssue({ code: "custom", message: "Required", path: ["submitterLastName"] })
      if (!vals.submitterPhone) ctx.addIssue({ code: "custom", message: "Required", path: ["submitterPhone"] })
    }
  })

type FormData = z.infer<typeof schema>

// ---------- Small UI helpers ----------
function ReqLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-medium text-emerald-900">
      {children} <span className="text-red-600">*</span>
    </label>
  )
}
function OptLabel({ children }: { children: React.ReactNode }) {
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

// ---------- Page ----------
export default function EnrollmentFormPage() {
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
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      submitterRelation: "Self/Resident",
      gender: "Female",
      state: "MA",
      facilityState: "MA",
      billingState: "MA",
    },
  })

  const submitterRelation = useWatch({ control, name: "submitterRelation" })

  useEffect(() => setServerMsg(null), [])

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setStatus("submitting")
    setServerMsg(null)
    try {
      const res = await fetch("/api/forms/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      let json: any = {}
      try { json = await res.json() } catch {}
      if (!res.ok) throw new Error(json?.error || "Submission failed")

      setStatus("success")
      setServerMsg("Enrollment submitted successfully. Thank you!")
      reset({ submitterRelation: "Self/Resident", gender: "Female", state: "MA", facilityState: "MA", billingState: "MA" })
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
        title="Enrollment submitted!"
        message={serverMsg || "Thank you — we've received your enrollment. Our team will review it and be in touch shortly."}
        onReset={() => { setStatus("idle"); setServerMsg(null) }}
        resetLabel="Submit another enrollment"
      />
    )
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h1 className="mt-6 text-pretty text-3xl font-semibold md:text-5xl">Customer Enrollment</h1>
          <p className="mt-4 max-w-2xl text-sm/6 text-white/80 md:text-base/7">
            Please complete the information below.
          </p>
        </div>
      </section>

      {/* FORM */}
      <section className="bg-[#faf7f3]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Start Information */}
            <SectionCard title="Start Information">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <ReqLabel>Today’s Date</ReqLabel>
                  <Input type="date" {...register("todaysDate")} />
                  <FieldError message={errors.todaysDate?.message} />
                </div>
                <div>
                  <ReqLabel>Start Date</ReqLabel>
                  <Input type="date" {...register("startDate")} />
                  <FieldError message={errors.startDate?.message} />
                </div>
                <div className="md:col-span-2">
                  <ReqLabel>Start Time</ReqLabel>
                  <Input type="time" {...register("startTime")} />
                  <FieldError message={errors.startTime?.message} />
                </div>
              </div>
            </SectionCard>

            {/* Submitter Information (NEW) */}
            <SectionCard title="Submitter Information" caption="Tell us who is filling this form.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <ReqLabel>What is your relation to the resident?</ReqLabel>
                  <Select {...register("submitterRelation")}>
                    <option>Self/Resident</option>
                    <option>Responsible Party</option>
                  </Select>
                  <FieldError message={errors.submitterRelation?.message} />
                </div>

                {submitterRelation === "Responsible Party" && (
                  <>
                    <div>
                      <ReqLabel>Submitter First Name</ReqLabel>
                      <Input {...register("submitterFirstName")} placeholder="Your first name" />
                      <FieldError message={errors.submitterFirstName?.message} />
                    </div>
                    <div>
                      <ReqLabel>Submitter Last Name</ReqLabel>
                      <Input {...register("submitterLastName")} placeholder="Your last name" />
                      <FieldError message={errors.submitterLastName?.message} />
                    </div>
                    <div>
                      <ReqLabel>Phone</ReqLabel>
                      <Input {...register("submitterPhone")} placeholder={PHONE_PLACEHOLDER} />
                      <FieldError message={errors.submitterPhone?.message} />
                    </div>
                  </>
                )}
                {/* Email is always required — shown for both Self/Resident and Responsible Party */}
                <div>
                  <ReqLabel>Email</ReqLabel>
                  <Input type="email" {...register("submitterEmail")} placeholder="you@example.com" />
                  <FieldError message={errors.submitterEmail?.message} />
                </div>
              </div>
            </SectionCard>

            {/* Resident Information */}
            <SectionCard title="Resident Information">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <ReqLabel>Last name</ReqLabel>
                  <Input placeholder="Last name" {...register("lastName")} />
                  <FieldError message={errors.lastName?.message} />
                </div>
                <div>
                  <ReqLabel>First name</ReqLabel>
                  <Input placeholder="First name" {...register("firstName")} />
                  <FieldError message={errors.firstName?.message} />
                </div>
                <div>
                  <OptLabel>Middle initial (optional)</OptLabel>
                  <Input maxLength={1} placeholder="M" {...register("middleInitial")} />
                </div>

                <div>
                  <ReqLabel>Date of birth</ReqLabel>
                  <Input type="date" {...register("dob")} />
                  <FieldError message={errors.dob?.message} />
                </div>
                <div>
                  <ReqLabel>SSN (last 4 only)</ReqLabel>
                  <Input inputMode="numeric" maxLength={4} placeholder="####" {...register("ssn")} />
                  <FieldError message={errors.ssn?.message} />
                </div>
                <div>
                  <ReqLabel>Gender</ReqLabel>
                  <Select {...register("gender")}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </Select>
                  <FieldError message={errors.gender?.message} />
                </div>

                <div className="md:col-span-3">
                  <ReqLabel>Home address</ReqLabel>
                  <Input placeholder="Street address" {...register("homeAddress")} />
                  <FieldError message={errors.homeAddress?.message} />
                </div>
                <div>
                  <ReqLabel>City</ReqLabel>
                  <Input placeholder="City" {...register("city")} />
                  <FieldError message={errors.city?.message} />
                </div>
                <div>
                  <ReqLabel>State</ReqLabel>
                  <Select {...register("state")}>
                    {US_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.state?.message} />
                </div>
                <div>
                  <ReqLabel>ZIP</ReqLabel>
                  <Input inputMode="numeric" placeholder="ZIP" {...register("zip")} />
                  <FieldError message={errors.zip?.message} />
                </div>

                <div className="md:col-span-3">
                  <ReqLabel>
                    Allergies / Please provide as much detail as possible regarding issue or question
                  </ReqLabel>
                  <Textarea placeholder="Describe allergies or concerns in detail" {...register("allergies")} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Please do not enter any personal health information that is not requested here.
                  </p>
                  <FieldError message={errors.allergies?.message} />
                </div>
              </div>
            </SectionCard>

            {/* Facility Information */}
            <SectionCard title="Facility Information" caption="Provide the facility address if the resident is moving to a community.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <ReqLabel>Facility name</ReqLabel>
                  <Input placeholder="Community / Facility" {...register("facilityName")} />
                  <FieldError message={errors.facilityName?.message} />
                </div>
                <div>
                  <ReqLabel>Room number</ReqLabel>
                  <Input placeholder="Room / Apt" {...register("roomNumber")} />
                  <FieldError message={errors.roomNumber?.message} />
                </div>

                <div className="md:col-span-3">
                  <ReqLabel>Facility address</ReqLabel>
                  <Input placeholder="Street address" {...register("facilityAddress")} />
                  <FieldError message={errors.facilityAddress?.message} />
                </div>
                <div>
                  <ReqLabel>Facility city</ReqLabel>
                  <Input placeholder="City" {...register("facilityCity")} />
                  <FieldError message={errors.facilityCity?.message} />
                </div>
                <div>
                  <ReqLabel>Facility state</ReqLabel>
                  <Select {...register("facilityState")}>
                    {US_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.facilityState?.message} />
                </div>
                <div>
                  <ReqLabel>Facility ZIP</ReqLabel>
                  <Input inputMode="numeric" placeholder="ZIP" {...register("facilityZip")} />
                  <FieldError message={errors.facilityZip?.message} />
                </div>

                <div>
                  <OptLabel>Moving from</OptLabel>
                  <Select {...register("movingFrom")}>
                    <option value="">Select</option>
                    <option>Home</option>
                    <option>Rehab</option>
                    <option>Hospital</option>
                    <option>Assisted Living</option>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <OptLabel>Hospital/Rehab facility name</OptLabel>
                  <Input placeholder="If applicable" {...register("hospitalRehabName")} />
                </div>
                <div className="md:col-span-3">
                  <OptLabel>Hospital/Rehab phone</OptLabel>
                  <Input placeholder={PHONE_PLACEHOLDER} {...register("hospitalRehabPhone")} />
                </div>

                <p className="md:col-span-3 text-xs text-muted-foreground">
                  If the resident has a supply of medication prior to moving in, most insurances will not cover an early refill.
                </p>
              </div>
            </SectionCard>

            {/* PCP Information */}
            <SectionCard title="Primary Care Provider (PCP)">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <ReqLabel>Physician name</ReqLabel>
                  <Input {...register("pcpName")} placeholder="PCP name" />
                  <FieldError message={errors.pcpName?.message} />
                </div>
                <div>
                  <ReqLabel>Specialty</ReqLabel>
                  <Input {...register("pcpSpecialty")} placeholder="e.g., Internal Medicine" />
                  <FieldError message={errors.pcpSpecialty?.message} />
                </div>
                <div>
                  <ReqLabel>Phone</ReqLabel>
                  <Input placeholder={PHONE_PLACEHOLDER} {...register("pcpPhone")} />
                  <FieldError message={errors.pcpPhone?.message} />
                </div>
                <div className="md:col-span-2">
                  <ReqLabel>Office address</ReqLabel>
                  <Input {...register("pcpAddress")} placeholder="Address" />
                  <FieldError message={errors.pcpAddress?.message} />
                </div>
                <div>
                  <ReqLabel>Fax</ReqLabel>
                  <Input placeholder="Fax" {...register("pcpFax")} />
                  <FieldError message={errors.pcpFax?.message} />
                </div>
              </div>
            </SectionCard>

            {/* Billing / Insurance */}
            <SectionCard title="Billing & Insurance">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <ReqLabel>Prescription drug insurance — Member ID</ReqLabel>
                  <Input {...register("rxMemberId")} />
                  <FieldError message={errors.rxMemberId?.message} />
                </div>
                <div>
                  <ReqLabel>RXGRP</ReqLabel>
                  <Input {...register("rxGrp")} />
                  <FieldError message={errors.rxGrp?.message} />
                </div>
                <div>
                  <ReqLabel>RXBIN</ReqLabel>
                  <Input {...register("rxBin")} />
                  <FieldError message={errors.rxBin?.message} />
                </div>
                <div>
                  <ReqLabel>RXPCN</ReqLabel>
                  <Input {...register("rxPcn")} />
                  <FieldError message={errors.rxPcn?.message} />
                </div>

                <div>
                  <ReqLabel>Card type</ReqLabel>
                  <Select {...register("cardType")}>
                    <option>Debit</option>
                    <option>Credit</option>
                  </Select>
                  <FieldError message={errors.cardType?.message} />
                </div>
                <div className="md:col-span-2">
                  <ReqLabel>Card number</ReqLabel>
                  <Input inputMode="numeric" placeholder="#### #### #### ####" {...register("cardNumber")} />
                  <FieldError message={errors.cardNumber?.message} />
                </div>
                <div>
                  <ReqLabel>CVV</ReqLabel>
                  <Input inputMode="numeric" placeholder="CVV" {...register("cardCvv")} />
                  <FieldError message={errors.cardCvv?.message} />
                </div>

                <div>
                  <ReqLabel>Exp. month</ReqLabel>
                  <Select {...register("cardExpMonth")}>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.cardExpMonth?.message} />
                </div>
                <div>
                  <ReqLabel>Exp. year</ReqLabel>
                  <Select {...register("cardExpYear")}>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.cardExpYear?.message} />
                </div>
                <div className="md:col-span-2">
                  <ReqLabel>Cardholder name</ReqLabel>
                  <Input {...register("cardholderName")} />
                  <FieldError message={errors.cardholderName?.message} />
                </div>

                <div className="md:col-span-4">
                  <ReqLabel>Billing address (statements mailed here)</ReqLabel>
                  <Input {...register("billingAddress")} />
                  <FieldError message={errors.billingAddress?.message} />
                </div>
                <div>
                  <ReqLabel>City</ReqLabel>
                  <Input {...register("billingCity")} />
                  <FieldError message={errors.billingCity?.message} />
                </div>
                <div>
                  <ReqLabel>State</ReqLabel>
                  <Select {...register("billingState")}>
                    {US_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.billingState?.message} />
                </div>
                <div>
                  <ReqLabel>ZIP</ReqLabel>
                  <Input inputMode="numeric" {...register("billingZip")} />
                  <FieldError message={errors.billingZip?.message} />
                </div>

                <div className="md:col-span-2">
                  <ReqLabel>HCP/POA/Family/Additional Contact — Name</ReqLabel>
                  <Input {...register("additionalContactName")} />
                  <FieldError message={errors.additionalContactName?.message} />
                </div>
                <div className="md:col-span-2">
                  <ReqLabel>Phone</ReqLabel>
                  <Input placeholder={PHONE_PLACEHOLDER} {...register("additionalContactPhone")} />
                  <FieldError message={errors.additionalContactPhone?.message} />
                </div>
              </div>
            </SectionCard>

            {/* Authorization & Signature */}
            <SectionCard
              title="Authorization & Signature"
              caption="I authorize North Falmouth Pharmacy to bill my credit/debit card on a recurring basis for all services rendered."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <ReqLabel>Typed signature (full name)</ReqLabel>
                  <Input placeholder="Type full name to sign" {...register("authName")} />
                  <FieldError message={errors.authName?.message} />
                </div>
                <div>
                  <ReqLabel>Date</ReqLabel>
                  <Input type="date" {...register("authDate")} />
                  <FieldError message={errors.authDate?.message} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("authAgree")} />
                <span>I agree to the authorization statement above.</span>
              </label>
              <FieldError message={errors.authAgree?.message} />
            </SectionCard>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex h-12 items-center justify-center rounded-full bg-orange-500 px-7 text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting..." : "Submit Enrollment"}
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
