"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { HippaDisclaimerModal } from "@/components/HippaDisclaimerModal"
import FormSuccess from "@/components/FormSuccess"

// ---------- Schemas
const vaccineRowSchema = z.object({
  vaccine: z.string().optional(),
  manufacturer: z.string().optional(),
  adminDate: z.string().optional(),
  lotNo: z.string().optional(),
  expDate: z.string().optional(),
  dosage: z.string().optional(),
})

const schema = z.object({
  // Patient (prefilled with selects/radios where possible)
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  dob: z.string().min(1, "Required"),
  age: z.string().min(1, "Required"),
  sexAtBirth: z.enum(["Female", "Male", "Intersex", "Prefer not to say"]).optional(),
  genderIdentity: z.enum(["Female", "Male", "Non-binary", "Other", "Prefer not to say"]).optional(),
  phone: z.string().min(1, "Required"),
  email: z.string().email("Invalid email").optional(),
  address: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().min(1, "Required"),

  // Race/Ethnicity (dropdowns / multi)
  race: z.enum([
    "American Indian/Alaska Native",
    "Asian",
    "Black/African American",
    "Native Hawaiian/Other Pacific Islander",
    "White",
    "Other",
    "Prefer not to say",
  ]).optional(),
  ethnicity: z.enum(["Hispanic or Latino", "Not Hispanic or Latino", "Prefer not to say"]).optional(),

  // Physician (optional)
  physicianName: z.string().optional(),
  physicianPhone: z.string().optional(),
  physicianFax: z.string().optional(),

  // Vaccine requested (mirror typical consent)
  vaccinesRequested: z.array(z.string()).optional(),
  otherVaccineText: z.string().optional(),
  doseNumber: z.enum(["First dose", "Second dose", "Booster", "Unknown"]).optional(),
  lastDoseDate: z.string().optional(),
  anyPastReaction: z.enum(["Yes", "No"]).optional(),
  pastReactionDetails: z.string().optional(),

  // Allergies / conditions (mostly radios)
  allergiesLatex: z.enum(["Yes", "No"]).optional(),
  allergiesMedicationFoodVaccine: z.enum(["Yes", "No"]).optional(),
  historySevereAllergicReaction: z.enum(["Yes", "No"]).optional(),
  neurologicalDisorderGBS: z.enum(["Yes", "No"]).optional(),
  bleedingDisorderAnticoagulant: z.enum(["Yes", "No"]).optional(),
  immunocompromised: z.enum(["Yes", "No"]).optional(),
  pregnantOrBreastfeeding: z.enum(["Yes", "No", "N/A"]).optional(),
  currentlyIll: z.enum(["Yes", "No"]).optional(),

  // COVID-specific (common in consent)
  covidReceivedDose: z.enum(["Yes", "No"]).optional(),
  covidAllergyPEGP80: z.enum(["Yes", "No"]).optional(),
  covidOtherApplies: z.enum(["Yes", "No"]).optional(),
  covidOtherDetails: z.string().optional(),

  // Insurance (min typing)
  insurancePlanType: z.enum(["Medical", "Pharmacy", "Medicare", "Medicaid", "Self-pay", "Unknown"]).optional(),
  insuranceMemberId: z.string().optional(),
  insuranceGroup: z.string().optional(),
  insuranceBIN: z.string().optional(),
  insurancePCN: z.string().optional(),
  medicareNumber: z.string().optional(),
  authorizeBilling: z.boolean().optional(),

  // Vaccine admin table (for in-clinic use if needed)
  vaccineRows: z.array(vaccineRowSchema).default([]),

  // Consent
  consentName: z.string().min(1, "Type your full name to sign"),
  consentDate: z.string().min(1, "Required"),
  consentAgree: z.boolean().refine(v => v === true, { message: "You must agree to the consent statement" }),
})

type FormData = z.infer<typeof schema>

// ---------- UI helpers
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-4">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

function RadioRow({
  label,
  name,
  register,
  options,
  error,
}: {
  label: string
  name: keyof FormData
  register: ReturnType<typeof useForm<FormData>>["register"]
  options: string[]
  error?: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-4">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input type="radio" value={opt} {...register(name)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </div>
  )
}

function SelectField({
  label,
  name,
  register,
  options,
  error,
  placeholder = "Select",
  required = false,
}: {
  label: string
  name: keyof FormData
  register: ReturnType<typeof useForm<FormData>>["register"]
  options: string[]
  error?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <select
        className="h-12 w-full rounded-md border border-black/10 bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-emerald-500"
        {...register(name, { required })}
        defaultValue=""
      >
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

function InputField({
  label,
  name,
  register,
  error,
  type = "text",
  placeholder,
}: {
  label: string
  name: keyof FormData
  register: ReturnType<typeof useForm<FormData>>["register"]
  error?: string
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="h-12 w-full rounded-md border border-black/10 bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-emerald-500"
        {...register(name)}
      />
      <FieldError message={error} />
    </label>
  )
}

function TextAreaField({
  label,
  name,
  register,
  error,
  rows = 3,
  placeholder,
}: {
  label: string
  name: keyof FormData
  register: ReturnType<typeof useForm<FormData>>["register"]
  error?: string
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <textarea
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-md border border-black/10 bg-background px-3 py-2 outline-none ring-offset-background focus:ring-2 focus:ring-emerald-500"
        {...register(name)}
      />
      <FieldError message={error} />
    </label>
  )
}

// ---------- Page
export default function VaccineConsentPage() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [serverMsg, setServerMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vaccinesRequested: [],
      doseNumber: "First dose",
      anyPastReaction: "No",
      allergiesLatex: "No",
      allergiesMedicationFoodVaccine: "No",
      historySevereAllergicReaction: "No",
      neurologicalDisorderGBS: "No",
      bleedingDisorderAnticoagulant: "No",
      immunocompromised: "No",
      pregnantOrBreastfeeding: "N/A",
      currentlyIll: "No",
      covidReceivedDose: "No",
      covidAllergyPEGP80: "No",
      covidOtherApplies: "No",
      consentAgree: false,
      vaccineRows: [{ vaccine: "", manufacturer: "", adminDate: "", lotNo: "", expDate: "", dosage: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "vaccineRows" })

  const vaccineOptions = [
    "COVID-19",
    "Influenza (Flu)",
    "Pneumococcal",
    "Tdap",
    "Shingles (Zoster)",
    "Hepatitis A",
    "Hepatitis B",
    "HPV",
    "MMR",
    "Varicella",
    "Meningococcal",
    "Other",
  ]

  // Checkbox handler for vaccinesRequested
  const vaccinesSel = watch("vaccinesRequested") || []

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
      if (!res.ok) throw new Error(json?.error || "Submission failed")
      setStatus("success")
      setServerMsg("Submitted successfully. Thank you!")
      reset()
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
        title="Consent form submitted!"
        message={serverMsg || "Thank you — we've received your vaccine consent form. Our team will be in touch shortly."}
        onReset={() => { setStatus("idle"); setServerMsg(null) }}
        resetLabel="Submit another form"
      />
    )
  }

  return (
    <main className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <h1 className="mt-6 text-3xl font-semibold md:text-5xl">Vaccine Administration Consent</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Please complete the information below. Use dropdowns and quick choices to save time.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="bg-[#faf7f3]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* A. Patient Information */}
            <Section title="A — Patient Information">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="First name" name="firstName" register={register} error={errors.firstName?.message} />
                <InputField label="Last name" name="lastName" register={register} error={errors.lastName?.message} />
                <InputField label="Date of birth" type="date" name="dob" register={register} error={errors.dob?.message} />
                <InputField label="Age" name="age" register={register} error={errors.age?.message} />
                <SelectField
                  label="Sex at birth"
                  name="sexAtBirth"
                  register={register}
                  options={["Female", "Male", "Intersex", "Prefer not to say"]}
                  error={errors.sexAtBirth?.message}
                />
                <SelectField
                  label="Gender identity"
                  name="genderIdentity"
                  register={register}
                  options={["Female", "Male", "Non-binary", "Other", "Prefer not to say"]}
                  error={errors.genderIdentity?.message}
                />
                <InputField label="Phone" name="phone" register={register} error={errors.phone?.message} />
                <InputField label="Email" type="email" name="email" register={register} error={errors.email?.message} />
                <div className="md:col-span-2">
                  <InputField label="Home address" name="address" register={register} error={errors.address?.message} />
                </div>
                <InputField label="City" name="city" register={register} error={errors.city?.message} />
                <InputField label="State" name="state" register={register} error={errors.state?.message} />
                <InputField label="ZIP" name="zip" register={register} error={errors.zip?.message} />

                <SelectField
                  label="Race"
                  name="race"
                  register={register}
                  options={[
                    "American Indian/Alaska Native",
                    "Asian",
                    "Black/African American",
                    "Native Hawaiian/Other Pacific Islander",
                    "White",
                    "Other",
                    "Prefer not to say",
                  ]}
                  error={errors.race?.message}
                />
                <SelectField
                  label="Ethnicity"
                  name="ethnicity"
                  register={register}
                  options={["Hispanic or Latino", "Not Hispanic or Latino", "Prefer not to say"]}
                  error={errors.ethnicity?.message}
                />
              </div>
            </Section>

            {/* B. Physician (optional) */}
            <Section title="B — Primary Care Provider (Optional)">
              <div className="grid gap-4 md:grid-cols-3">
                <InputField label="Physician name" name="physicianName" register={register} error={errors.physicianName?.message} />
                <InputField label="Physician phone" name="physicianPhone" register={register} error={errors.physicianPhone?.message} />
                <InputField label="Physician fax" name="physicianFax" register={register} error={errors.physicianFax?.message} />
              </div>
            </Section>

            {/* C. Vaccination Requested */}
            <Section title="C — Vaccination Requested">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-medium">Select vaccine(s):</div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {vaccineOptions.map((v) => (
                      <label key={v} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          value={v}
                          checked={vaccinesSel.includes(v)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            const current = new Set(vaccinesSel)
                            if (checked) current.add(v)
                            else current.delete(v)
                            setValue("vaccinesRequested", Array.from(current), { shouldValidate: true })
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {vaccinesSel.includes("Other") && (
                  <InputField
                    label="If 'Other', please specify"
                    name="otherVaccineText"
                    register={register}
                    error={errors.otherVaccineText?.message}
                  />
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField
                    label="Dose number"
                    name="doseNumber"
                    register={register}
                    options={["First dose", "Second dose", "Booster", "Unknown"]}
                    error={errors.doseNumber?.message}
                  />
                  <InputField
                    label="Last dose date (if applicable)"
                    type="date"
                    name="lastDoseDate"
                    register={register}
                    error={errors.lastDoseDate?.message}
                  />
                  <SelectField
                    label="Any past reaction to vaccines?"
                    name="anyPastReaction"
                    register={register}
                    options={["Yes", "No"]}
                    error={errors.anyPastReaction?.message}
                  />
                </div>

                {watch("anyPastReaction") === "Yes" && (
                  <TextAreaField
                    label="Briefly describe the reaction"
                    name="pastReactionDetails"
                    register={register}
                    error={errors.pastReactionDetails?.message}
                  />
                )}
              </div>
            </Section>

            {/* D. Health Screening */}
            <Section title="D — Health Screening">
              <div className="grid gap-5">
                <RadioRow
                  label="1. Do you feel sick today?"
                  name="currentlyIll"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.currentlyIll?.message}
                />
                <RadioRow
                  label="2. Any allergies to latex?"
                  name="allergiesLatex"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.allergiesLatex?.message}
                />
                <RadioRow
                  label="3. Allergies to medications, food, or vaccines?"
                  name="allergiesMedicationFoodVaccine"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.allergiesMedicationFoodVaccine?.message}
                />
                <RadioRow
                  label="4. History of severe allergic reaction (e.g., anaphylaxis)?"
                  name="historySevereAllergicReaction"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.historySevereAllergicReaction?.message}
                />
                <RadioRow
                  label="5. Seizure disorder, GBS, or other neurological problem?"
                  name="neurologicalDisorderGBS"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.neurologicalDisorderGBS?.message}
                />
                <RadioRow
                  label="6. Bleeding disorder or taking blood thinners?"
                  name="bleedingDisorderAnticoagulant"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.bleedingDisorderAnticoagulant?.message}
                />
                <RadioRow
                  label="7. Condition that weakens the immune system?"
                  name="immunocompromised"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.immunocompromised?.message}
                />
                <RadioRow
                  label="8. For women: Pregnant or breastfeeding?"
                  name="pregnantOrBreastfeeding"
                  register={register}
                  options={["Yes", "No", "N/A"]}
                  error={errors.pregnantOrBreastfeeding?.message}
                />
              </div>
            </Section>

            {/* E. COVID-19 Specific */}
            <Section title="E — COVID-19 Specific">
              <div className="grid gap-4 md:grid-cols-3">
                <SelectField
                  label="Have you ever received a dose of COVID-19 vaccine?"
                  name="covidReceivedDose"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.covidReceivedDose?.message}
                />
                <SelectField
                  label="Allergy to a component (e.g., PEG or Polysorbate)?"
                  name="covidAllergyPEGP80"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.covidAllergyPEGP80?.message}
                />
                <SelectField
                  label="Other COVID-19 considerations apply?"
                  name="covidOtherApplies"
                  register={register}
                  options={["Yes", "No"]}
                  error={errors.covidOtherApplies?.message}
                />
              </div>
              {watch("covidOtherApplies") === "Yes" && (
                <TextAreaField
                  label="Describe any applicable conditions (pregnancy, immunocompromise, monoclonal antibodies, etc.)"
                  name="covidOtherDetails"
                  register={register}
                  error={errors.covidOtherDetails?.message}
                />
              )}
            </Section>

            {/* F. Insurance */}
            <Section title="F — Insurance & Billing">
              <div className="grid gap-4 md:grid-cols-3">
                <SelectField
                  label="Plan type"
                  name="insurancePlanType"
                  register={register}
                  options={["Medical", "Pharmacy", "Medicare", "Medicaid", "Self-pay", "Unknown"]}
                  error={errors.insurancePlanType?.message}
                />
                <InputField label="Member ID" name="insuranceMemberId" register={register} error={errors.insuranceMemberId?.message} />
                <InputField label="Group (GRP)" name="insuranceGroup" register={register} error={errors.insuranceGroup?.message} />
                <InputField label="BIN" name="insuranceBIN" register={register} error={errors.insuranceBIN?.message} />
                <InputField label="PCN" name="insurancePCN" register={register} error={errors.insurancePCN?.message} />
                <InputField label="Medicare Number" name="medicareNumber" register={register} error={errors.medicareNumber?.message} />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("authorizeBilling")} />
                <span>I authorize the pharmacy to bill my insurance and receive payment.</span>
              </label>
              <FieldError message={errors.authorizeBilling?.message as string | undefined} />
            </Section>

            {/* G. Vaccine Administration (Clinic Use) */}
            <Section title="G — Vaccine Administration (Clinic Use)">
              <div className="space-y-3">
                {fields.map((f, idx) => (
                  <div key={f.id} className="grid gap-3 md:grid-cols-6">
                    <input
                      className="h-10 rounded-md border border-black/10 px-2"
                      placeholder="Vaccine"
                      {...register(`vaccineRows.${idx}.vaccine`)}
                    />
                    <input
                      className="h-10 rounded-md border border-black/10 px-2"
                      placeholder="Manufacturer"
                      {...register(`vaccineRows.${idx}.manufacturer`)}
                    />
                    <input
                      type="date"
                      className="h-10 rounded-md border border-black/10 px-2"
                      placeholder="Admin date"
                      {...register(`vaccineRows.${idx}.adminDate`)}
                    />
                    <input
                      className="h-10 rounded-md border border-black/10 px-2"
                      placeholder="Lot no."
                      {...register(`vaccineRows.${idx}.lotNo`)}
                    />
                    <input
                      type="date"
                      className="h-10 rounded-md border border-black/10 px-2"
                      placeholder="Exp. date"
                      {...register(`vaccineRows.${idx}.expDate`)}
                    />
                    <div className="flex gap-2">
                      <input
                        className="h-10 w-full rounded-md border border-black/10 px-2"
                        placeholder="Dosage"
                        {...register(`vaccineRows.${idx}.dosage`)}
                      />
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="inline-flex items-center justify-center rounded-md border px-3 text-sm hover:bg-muted"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => append({ vaccine: "", manufacturer: "", adminDate: "", lotNo: "", expDate: "", dosage: "" })}
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  + Add row
                </button>
              </div>
            </Section>

            {/* H. Consent & Signature */}
            <Section title="H — Informed Consent & Signature">
              <p className="mb-3 text-sm text-muted-foreground">
                I have read (or had explained to me) the Vaccine Information Statements and understand the benefits and risks of the
                vaccination(s). I authorize the administration and consent to the disclosure of my health information to my healthcare
                providers, health plans, and public health authorities as required for care, billing, and reporting purposes.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Typed signature (full name)" name="consentName" register={register} error={errors.consentName?.message} />
                <InputField label="Date" type="date" name="consentDate" register={register} error={errors.consentDate?.message} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("consentAgree")} />
                <span>I have read and agree to the consent statement.</span>
              </label>
              <FieldError message={errors.consentAgree?.message as string | undefined} />
            </Section>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex h-12 items-center justify-center rounded-full bg-orange-500 px-7 text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting..." : "Submit"}
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
