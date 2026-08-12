"use client"

import { useState } from "react"
import { useForm, useFieldArray, type UseFormRegister } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { HippaDisclaimerModal } from "@/components/HippaDisclaimerModal"
import { Printer } from "lucide-react"
import {
  ADMIN_TABLE_COLUMNS,
  ALL_SCREENING,
  COVID_SCREENING,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
  GENERAL_SCREENING,
  INSURANCE_TYPE_OPTIONS,
  LIVE_VACCINE_SCREENING,
  Q17_FOOTNOTE,
  Q18_CONDITIONS,
  RACE_OPTIONS,
  VACCINE_OPTIONS,
  type ScreeningQuestion,
} from "@/lib/vaccine-consent-form"

// ---------------------------------------------------------------------------
// Schema
//
// The screening questions are folded in from the shared definition rather than
// hand-listed, so adding a question to lib/vaccine-consent-form.ts is enough to
// have it validated here, rendered below, printed on the PDF and stored.
// ---------------------------------------------------------------------------
const yesNo = z.enum(["Yes", "No"])

/**
 * An optional dropdown. A `<select>` whose placeholder is selected submits ""
 * — which `z.enum([...]).optional()` rejects, because `optional()` only allows
 * `undefined`. Without this preprocessing, Gender/Race/Ethnicity are optional
 * on the printed form but impossible to leave blank on screen, and the patient
 * is shown a raw "Invalid enum value. Expected 'Female' | 'Male'…" message.
 */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(values).optional())

/**
 * An unanswered Yes/No question. react-hook-form hands back `null` for a radio
 * group with nothing selected, which `.optional()` rejects — so normalize both
 * `null` and `""` to `undefined` and let the refinements below decide which
 * questions actually have to be answered.
 */
const optionalYesNo = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  yesNo.optional()
)

const screeningShape: Record<string, z.ZodTypeAny> = {}
for (const q of ALL_SCREENING) {
  screeningShape[q.key] = optionalYesNo
  if (q.detail) screeningShape[q.detail.key] = z.string().optional()
  if (q.detailDate) screeningShape[q.detailDate.key] = z.string().optional()
}

const vaccineRowSchema = z.object({
  vaccine: z.string().optional(),
  mfr: z.string().optional(),
  dateAdmin: z.string().optional(),
  lotNo: z.string().optional(),
  expDate: z.string().optional(),
  dosage: z.string().optional(),
  injectionSite: z.string().optional(),
  visEuaDate: z.string().optional(),
  doseInSeries: z.string().optional(),
})

const schema = z
  .object({
    // Section A
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    age: z.string().min(1, "Required"),
    dob: z.string().min(1, "Required"),
    gender: optionalEnum(GENDER_OPTIONS),
    race: optionalEnum(RACE_OPTIONS),
    ethnicity: optionalEnum(ETHNICITY_OPTIONS),
    address: z.string().min(1, "Required"),
    city: z.string().min(1, "Required"),
    state: z.string().min(1, "Required"),
    zip: z.string().min(1, "Required"),
    email: z.union([z.string().email("Invalid email"), z.literal("")]).optional(),
    phone: z.string().min(1, "Required"),
    physicianName: z.string().optional(),
    physicianPhone: z.string().optional(),
    physicianFax: z.string().optional(),

    // Section B + C
    ...screeningShape,

    // Vaccines requested
    vaccinesRequested: z.array(z.string()).min(1, "Select at least one vaccine"),
    otherVaccineText: z.string().optional(),

    // Section C, question 18
    q18Conditions: z.array(z.string()).default([]),

    // Section D — consent
    consentName: z.string().min(1, "Type your full name to sign"),
    consentDate: z.string().min(1, "Required"),
    consentAgree: z.boolean().refine((v) => v === true, {
      message: "You must agree to the consent statement",
    }),

    // Section D — insurance
    insuranceTypes: z.array(z.string()).default([]),
    insurancePlanName: z.string().optional(),
    memberId: z.string().optional(),
    rxBin: z.string().optional(),
    rxPcn: z.string().optional(),
    groupNo: z.string().optional(),
    medicareCardNo: z.string().optional(),
    medicareId: z.string().optional(),
    ssn: z.string().optional(),
    authorizeBilling: z.boolean().default(false),

    // Clinic use
    vaccineRows: z.array(vaccineRowSchema).default([]),
    immunizerName: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.vaccinesRequested?.includes("Other") && !val.otherVaccineText?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["otherVaccineText"],
        message: "Please specify the other vaccine",
      })
    }

    // Every screening question must be answered before the form can be sent.
    // A blank answer is an unverified contraindication, not an implied "No",
    // so the pharmacist should never receive a partially screened patient —
    // including the product-scoped questions ("MMR only", "Typhoid only"),
    // which are answered so the record is complete whichever vaccine is given.
    for (const q of ALL_SCREENING) {
      if (!(val as any)[q.key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [q.key],
          message: "Please answer Yes or No",
        })
      }
    }
    // Follow-up lists are only meaningful when the answer was "Yes".
    for (const q of ALL_SCREENING) {
      if (!q.detail) continue
      if ((val as any)[q.key] === "Yes" && !String((val as any)[q.detail.key] ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [q.detail.key],
          message: "Required when you answer Yes",
        })
      }
    }
  })

type FormData = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const inputClass =
  "h-12 w-full rounded-md border border-black/10 bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-emerald-500"

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-white p-4 md:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

function InputField({
  label,
  name,
  register,
  error,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string
  name: any
  register: UseFormRegister<FormData>
  error?: string
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClass}
        {...register(name)}
      />
      <FieldError message={error} />
    </label>
  )
}

function SelectField({
  label,
  name,
  register,
  options,
  error,
  placeholder = "Select",
}: {
  label: string
  name: any
  register: UseFormRegister<FormData>
  options: readonly string[]
  error?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <select className={inputClass} defaultValue="" {...register(name)}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </label>
  )
}

/** A checkbox group backed by an array field. */
function CheckboxGroup({
  options,
  selected,
  onToggle,
  columns = 1,
}: {
  options: readonly string[]
  selected: string[]
  onToggle: (value: string, checked: boolean) => void
  columns?: number
}) {
  const grid = columns === 1 ? "grid-cols-1" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
  return (
    <div className={`grid gap-2 ${grid}`}>
      {options.map((opt) => (
        <label key={opt} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={(e) => onToggle(opt, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  )
}

/**
 * One screening question rendered as a Yes/No pair, laid out to mirror the
 * printed form: numbered question on the left, Yes/No columns on the right.
 */
function ScreeningRow({
  q,
  register,
  answer,
  errors,
}: {
  q: ScreeningQuestion
  register: UseFormRegister<FormData>
  answer?: string
  errors: Record<string, any>
}) {
  const detail = q.detail ?? q.detailDate
  return (
    <div className="border-b border-black/5 py-3 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <p className="text-sm">
          <span className="font-medium">{q.number}.</span> {q.text}
          {q.note && <span className="ml-1 text-xs font-medium text-emerald-700">({q.note})</span>}
        </p>
        <div className="flex shrink-0 gap-4">
          {(["Yes", "No"] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm">
              <input type="radio" value={opt} {...register(q.key as any)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
      <FieldError message={errors[q.key]?.message} />
      {detail && answer === "Yes" && (
        <div className="mt-2 sm:pl-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{detail.label}</span>
            <input
              type={q.detailDate ? "date" : "text"}
              className="h-10 w-full rounded-md border border-black/10 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              {...register(detail.key as any)}
            />
          </label>
          <FieldError message={errors[detail.key]?.message} />
        </div>
      )}
    </div>
  )
}

/** Turn the base64 PDF from the API into a browser download. */
function downloadBase64Pdf(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const emptyRow = {
  vaccine: "",
  mfr: "",
  dateAdmin: "",
  lotNo: "",
  expDate: "",
  dosage: "",
  injectionSite: "",
  visEuaDate: "",
  doseInSeries: "",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function VaccineConsentPage() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{
    recordId: string
    filename: string
    base64: string
    name: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vaccinesRequested: [],
      q18Conditions: [],
      insuranceTypes: [],
      authorizeBilling: false,
      consentAgree: false,
      consentDate: new Date().toISOString().slice(0, 10),
      vaccineRows: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "vaccineRows" })

  const values = watch()
  const vaccinesSel = values.vaccinesRequested ?? []
  const q18Sel = values.q18Conditions ?? []
  const insuranceSel = values.insuranceTypes ?? []

  const toggleArray = (name: "vaccinesRequested" | "q18Conditions" | "insuranceTypes") =>
    (value: string, checked: boolean) => {
      const current = new Set((values[name] as string[]) ?? [])
      if (checked) current.add(value)
      else current.delete(value)
      setValue(name, Array.from(current), { shouldValidate: true })
    }

  const onSubmit = async (data: FormData) => {
    setStatus("submitting")
    setServerMsg(null)
    try {
      const res = await fetch("/api/forms/vaccine-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Submission failed")

      setStatus("success")
      setServerMsg(null)
      if (json.pdf?.base64) {
        setReceipt({
          recordId: json.recordId,
          filename: json.pdf.filename,
          base64: json.pdf.base64,
          name: `${data.firstName} ${data.lastName}`.trim(),
        })
      }
      reset()
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e: any) {
      setStatus("error")
      setServerMsg(e?.message || "Something went wrong")
    }
  }

  if (!disclaimerAccepted) {
    return <HippaDisclaimerModal onAccept={() => setDisclaimerAccepted(true)} />
  }

  // ---- Success screen with the patient's copy of the PDF -------------------
  if (status === "success") {
    return (
      <main className="min-h-dvh bg-[#faf7f3]">
        <div className="mx-auto max-w-2xl px-6 py-20">
          <div className="rounded-2xl border bg-white p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              ✓
            </div>
            <h1 className="mt-5 text-2xl font-semibold">Consent form submitted</h1>
            <p className="mt-2 text-muted-foreground">
              Thank you{receipt?.name ? `, ${receipt.name}` : ""}. North Falmouth Pharmacy has received your
              vaccine consent form and will be in touch about your appointment.
            </p>
            {receipt && (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  Reference number <span className="font-medium text-foreground">{receipt.recordId}</span>
                </p>
                <button
                  type="button"
                  onClick={() => downloadBase64Pdf(receipt.base64, receipt.filename)}
                  className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 px-7 text-white transition hover:bg-emerald-800"
                >
                  ⬇ Download your copy (PDF)
                </button>
                <p className="mt-3 text-xs text-muted-foreground">
                  This is the same document sent to the pharmacy. Please save it for your records — it is
                  only available on this screen.
                </p>
              </>
            )}
            <div className="mt-8 border-t pt-6">
              <button
                type="button"
                onClick={() => {
                  setReceipt(null)
                  setStatus("idle")
                }}
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Submit another form
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
          <h1 className="mt-6 text-3xl font-semibold md:text-5xl">Vaccine Administration Consent Form</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Please complete every section. You will be able to download a PDF copy once you submit.
          </p>
        </div>
      </section>

      {/* Print-a-blank-form callout — a separate, high-contrast card (not just a
          link in the colorful hero above) so it's unmistakable for anyone who
          prefers paper, including patients who may not be comfortable filling
          out a long form on a screen. */}
      <section className="bg-[#faf7f3]">
        <div className="mx-auto max-w-5xl px-6 pt-10">
          <div className="flex flex-col items-start gap-5 rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-7">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Printer className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-semibold text-gray-900 md:text-xl">
                  Prefer to fill this out on paper?
                </p>
                <p className="mt-1 max-w-md text-sm text-gray-600 md:text-base">
                  Click the button to open a blank copy of this form. Print it, fill it in with a
                  pen, and bring it with you to your appointment.
                </p>
              </div>
            </div>
            <a
              href="/api/forms/vaccine-consent/blank"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-700 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:w-auto"
            >
              <Printer className="h-5 w-5" aria-hidden="true" />
              Print a Blank Form
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#faf7f3]">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* ---- Section A ---------------------------------------------- */}
            <Section title="Section A — Patient Information" subtitle="Please print clearly.">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="First name" name="firstName" register={register} error={errors.firstName?.message} autoComplete="given-name" />
                <InputField label="Last name" name="lastName" register={register} error={errors.lastName?.message} autoComplete="family-name" />
                <InputField label="Date of birth" type="date" name="dob" register={register} error={errors.dob?.message} />
                <InputField label="Age" name="age" register={register} error={errors.age?.message} />
                <SelectField label="Gender" name="gender" register={register} options={GENDER_OPTIONS} error={errors.gender?.message} />
                <SelectField label="Race" name="race" register={register} options={RACE_OPTIONS} error={errors.race?.message} />
                <SelectField label="Ethnicity" name="ethnicity" register={register} options={ETHNICITY_OPTIONS} error={errors.ethnicity?.message} />
                <InputField label="Phone number" name="phone" type="tel" register={register} error={errors.phone?.message} autoComplete="tel" />
                <div className="md:col-span-2">
                  <InputField label="Home address" name="address" register={register} error={errors.address?.message} autoComplete="street-address" />
                </div>
                <InputField label="City" name="city" register={register} error={errors.city?.message} autoComplete="address-level2" />
                <InputField label="State" name="state" register={register} error={errors.state?.message} autoComplete="address-level1" />
                <InputField label="ZIP Code" name="zip" register={register} error={errors.zip?.message} autoComplete="postal-code" />
                <InputField label="Email address" type="email" name="email" register={register} error={errors.email?.message} autoComplete="email" />
              </div>

              <div className="mt-6 grid gap-4 border-t pt-6 md:grid-cols-3">
                <InputField label="Primary care physician name" name="physicianName" register={register} error={errors.physicianName?.message} />
                <InputField label="Physician phone" name="physicianPhone" register={register} error={errors.physicianPhone?.message} />
                <InputField label="Physician fax" name="physicianFax" register={register} error={errors.physicianFax?.message} />
              </div>
            </Section>

            {/* ---- Vaccines requested ------------------------------------- */}
            <Section title="Vaccinations You Wish to Receive Today">
              <CheckboxGroup
                options={VACCINE_OPTIONS}
                selected={vaccinesSel}
                onToggle={toggleArray("vaccinesRequested")}
                columns={2}
              />
              <FieldError message={errors.vaccinesRequested?.message as string | undefined} />
              {vaccinesSel.includes("Other") && (
                <div className="mt-4 max-w-md">
                  <InputField
                    label="Other vaccine (please specify)"
                    name="otherVaccineText"
                    register={register}
                    error={errors.otherVaccineText?.message}
                  />
                </div>
              )}
            </Section>

            {/* ---- Section B --------------------------------------------- */}
            <Section
              title="Section B — General Vaccine Screening"
              subtitle="These questions help us determine your eligibility for vaccination today. Please answer all of them."
            >
              <div className="divide-y divide-black/5">
                {GENERAL_SCREENING.map((q) => (
                  <ScreeningRow key={q.key} q={q} register={register} answer={(values as any)[q.key]} errors={errors} />
                ))}
              </div>
            </Section>

            <Section
              title="Section B — Live Vaccine Screening"
              subtitle="These apply to live vaccines and specific products. Please answer all of them — if one does not apply to you, answer No."
            >
              <div className="divide-y divide-black/5">
                {LIVE_VACCINE_SCREENING.map((q) => (
                  <ScreeningRow key={q.key} q={q} register={register} answer={(values as any)[q.key]} errors={errors} />
                ))}
              </div>
            </Section>

            {/* ---- Section C --------------------------------------------- */}
            <Section title="Section C — COVID-19 Vaccine Screening">
              <div className="divide-y divide-black/5">
                {COVID_SCREENING.map((q) => (
                  <ScreeningRow key={q.key} q={q} register={register} answer={(values as any)[q.key]} errors={errors} />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{Q17_FOOTNOTE}</p>

              <div className="mt-6 border-t pt-5">
                <p className="mb-3 text-sm font-medium">18. Check all that apply to you:</p>
                <CheckboxGroup
                  options={Q18_CONDITIONS}
                  selected={q18Sel}
                  onToggle={toggleArray("q18Conditions")}
                  columns={2}
                />
              </div>
            </Section>

            {/* ---- Section D — consent ----------------------------------- */}
            <Section title="Section D — Consent and Release">
              <p className="text-sm text-muted-foreground">
                I understand the benefits and risks of the vaccination(s) as described in the Vaccine
                Information Statement (VIS), a copy of which was provided with this Consent and Release. I
                request the vaccine(s) be given to me or to the person named below, a minor for whom I
                represent that I am authorized to sign this Consent and Release.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InputField
                  label="Signature of person to receive vaccine (type full name)"
                  name="consentName"
                  register={register}
                  error={errors.consentName?.message}
                />
                <InputField label="Date" type="date" name="consentDate" register={register} error={errors.consentDate?.message} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Or parent/guardian, if the recipient is younger than 18 years.
              </p>
              <label className="mt-4 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" {...register("consentAgree")} />
                <span>I have read and agree to the consent statement above.</span>
              </label>
              <FieldError message={errors.consentAgree?.message as string | undefined} />
            </Section>

            {/* ---- Insurance --------------------------------------------- */}
            <Section title="Insurance Information and Authorization">
              <p className="mb-3 text-sm font-medium">Coverage type</p>
              <CheckboxGroup
                options={INSURANCE_TYPE_OPTIONS}
                selected={insuranceSel}
                onToggle={toggleArray("insuranceTypes")}
                columns={3}
              />

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <InputField label="Insurance plan name" name="insurancePlanName" register={register} error={errors.insurancePlanName?.message} />
                <InputField label="Member/recipient ID" name="memberId" register={register} error={errors.memberId?.message} />
                <InputField label="Group No." name="groupNo" register={register} error={errors.groupNo?.message} />
                <InputField label="RX BIN" name="rxBin" register={register} placeholder="NA" error={errors.rxBin?.message} />
                <InputField label="RX PCN" name="rxPcn" register={register} placeholder="NA" error={errors.rxPcn?.message} />
                <InputField
                  label="Medicare Card No. (red, white and blue card)"
                  name="medicareCardNo"
                  register={register}
                  error={errors.medicareCardNo?.message}
                />
                <InputField label="Medicare ID" name="medicareId" register={register} error={errors.medicareId?.message} />
                <InputField label="Social Security Number" name="ssn" register={register} error={errors.ssn?.message} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Only the last four digits of your SSN are stored. The full number appears solely on the
                consent PDF sent to the pharmacy.
              </p>

              <label className="mt-4 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" {...register("authorizeBilling")} />
                <span>
                  I hereby authorize the pharmacy to bill my insurance on my behalf for the immunizations and
                  receive payment.
                </span>
              </label>
            </Section>

            {/* ---- Clinic use -------------------------------------------- */}
            <Section
              title="Vaccine Administration (Pharmacy Use Only)"
              subtitle="Leave blank — the immunizer completes this at the time of your appointment."
            >
              <div className="space-y-4">
                {fields.map((f, idx) => (
                  <div key={f.id} className="rounded-lg border border-black/10 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {ADMIN_TABLE_COLUMNS.map((col) => (
                        <label key={col.key} className="block">
                          <span className="mb-1 block text-xs font-medium text-muted-foreground">{col.label}</span>
                          <input
                            type={col.key.toLowerCase().includes("date") ? "date" : "text"}
                            className="h-10 w-full rounded-md border border-black/10 px-2 text-sm"
                            {...register(`vaccineRows.${idx}.${col.key}` as any)}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Remove row
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap items-end gap-4">
                  <button
                    type="button"
                    onClick={() => append(emptyRow)}
                    className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-muted"
                  >
                    + Add administration row
                  </button>
                  <div className="min-w-[240px] flex-1">
                    <InputField
                      label="Immunizer name (print)"
                      name="immunizerName"
                      register={register}
                      error={errors.immunizerName?.message}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* ---- Submit ------------------------------------------------- */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex h-12 items-center justify-center rounded-full bg-orange-500 px-7 text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting..." : "Submit consent form"}
              </button>
              {status === "error" && serverMsg && <span className="text-sm text-red-700">{serverMsg}</span>}
              {Object.keys(errors).length > 0 && (
                <span className="text-sm text-red-700">Please correct the highlighted fields above.</span>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
