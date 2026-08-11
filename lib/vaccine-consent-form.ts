// lib/vaccine-consent-form.ts
//
// Single source of truth for the Vaccine Administration Consent Form.
//
// The web form (app/forms/vaccine-consent/page.tsx), the PDF generator
// (lib/vaccine-consent-pdf.ts) and the Supabase mapping (app/api/forms/
// vaccine-consent/route.ts) all read their fields from here. Previously each
// of the three wrote its own field list, which silently drifted apart — the
// PDF printed "-" for every screening answer because it read `q1_feelSick`
// while the form sent `currentlyIll`.
//
// Question numbering (q1..q18) matches the printed NFPLTC form exactly, so a
// pharmacist comparing paper to screen sees the same numbers.

export type YesNo = "Yes" | "No"

export type ScreeningQuestion = {
  /** Payload key. Matches the printed form's question number. */
  key: string
  /** Question number as printed on the paper form. */
  number: number
  /** Full question text, verbatim from the printed form. */
  text: string
  /** Short label used in the admin table / PDF where space is tight. */
  short: string
  /** If set, a free-text follow-up is shown when the answer is "Yes". */
  detail?: { key: string; label: string }
  /** If set, a date follow-up is shown when the answer is "Yes". */
  detailDate?: { key: string; label: string }
  /** Parenthetical scope note printed on the form, e.g. "(MMR only)". */
  note?: string
}

// ---------------------------------------------------------------------------
// Section B — General vaccine screening (questions 1-7)
// ---------------------------------------------------------------------------
export const GENERAL_SCREENING: ScreeningQuestion[] = [
  {
    key: "q1",
    number: 1,
    text: "Do you feel sick today?",
    short: "Feels sick today",
  },
  {
    key: "q2",
    number: 2,
    text: "Do you have any health conditions such as heart disease, diabetes or asthma?",
    short: "Health conditions",
    detail: { key: "q2_detail", label: "If yes, please list your health conditions" },
  },
  {
    key: "q3",
    number: 3,
    text:
      "Do you have allergies to latex, medications, food or vaccines (e.g., eggs, bovine protein, " +
      "gelatin, gentamicin, polymyxin, neomycin, phenol, yeast or thimerosal)?",
    short: "Allergies",
    detail: { key: "q3_detail", label: "If yes, please list your allergies" },
  },
  {
    key: "q4",
    number: 4,
    text:
      "Have you ever had a reaction (allergic or otherwise) after receiving an immunization, " +
      "including fainting or feeling dizzy?",
    short: "Prior immunization reaction",
  },
  {
    key: "q5",
    number: 5,
    text:
      "Have you ever had a seizure disorder for which you are on seizure medication(s), a brain " +
      "disorder, Guillain-Barré Syndrome (a condition that causes paralysis) or other nervous system problem?",
    short: "Neurological / GBS",
  },
  {
    key: "q6",
    number: 6,
    text:
      "Do you have a condition that may weaken your immune system (e.g., cancer, leukemia, " +
      "lymphoma, HIV/AIDS or transplant)?",
    short: "Immunocompromised",
  },
  {
    key: "q7",
    number: 7,
    text: "For women: Are you pregnant or considering becoming pregnant in the next month?",
    short: "Pregnant / planning",
  },
]

// ---------------------------------------------------------------------------
// Section B — Live vaccine screening (questions 8-15)
// ---------------------------------------------------------------------------
export const LIVE_VACCINE_SCREENING: ScreeningQuestion[] = [
  {
    key: "q8",
    number: 8,
    text: "Have you received any vaccinations or skin tests in the past four weeks?",
    short: "Vaccines/skin tests past 4 wks",
    detail: { key: "q8_detail", label: "If yes, please list them" },
  },
  {
    key: "q9",
    number: 9,
    text:
      "Are you currently on home infusions, weekly injections such as Humira™ (adalimumab), " +
      "Remicade™ (infliximab) or Enbrel™ (etanercept), high-dose methotrexate, azathioprine or " +
      "6-mercaptopurine, antivirals, anticancer drugs or radiation treatments?",
    short: "Infusions / immunosuppressants",
  },
  {
    key: "q10",
    number: 10,
    text:
      "Are you currently taking high-dose steroid therapy (prednisone > 20 mg/day or equivalent) " +
      "for longer than two weeks?",
    short: "High-dose steroids",
  },
  {
    key: "q11",
    number: 11,
    text:
      "Have you received a transfusion of blood, blood products or been given a medication called " +
      "immune (gamma) globulin in the past year?",
    short: "Transfusion / immune globulin",
  },
  {
    key: "q12",
    number: 12,
    text: "Are you currently taking any antibiotics, antiviral or antimalarial medications?",
    short: "Antibiotics / antivirals",
    note: "Typhoid only",
  },
  {
    key: "q13",
    number: 13,
    text: "Do you have a history of thrombocytopenia or thrombocytopenic purpura?",
    short: "Thrombocytopenia",
    note: "MMR only",
  },
  {
    key: "q14",
    number: 14,
    text: "Are you receiving aspirin therapy or aspirin-containing therapy?",
    short: "Aspirin therapy",
    note: "18 years of age and younger only",
  },
  {
    key: "q15",
    number: 15,
    text:
      "Do you have a nasal condition serious enough to make breathing difficult (e.g., very stuffy nose)?",
    short: "Nasal congestion",
  },
]

// ---------------------------------------------------------------------------
// Section C — COVID-19 vaccine screening (questions 16-17)
// ---------------------------------------------------------------------------
export const COVID_SCREENING: ScreeningQuestion[] = [
  {
    key: "q16",
    number: 16,
    text: "Have you ever received a dose of COVID-19 vaccine?",
    short: "Prior COVID-19 dose",
    detailDate: { key: "q16_lastDoseDate", label: "If yes, date of last dose" },
  },
  {
    key: "q17",
    number: 17,
    text:
      "Have you ever had an allergic reaction to a component of a COVID-19 vaccine, including " +
      "polyethylene glycol (PEG), polysorbate, or a previous dose of COVID-19 vaccine?",
    short: "COVID-19 component allergy",
  },
]

/** Explanatory text printed beneath question 17 on the paper form. */
export const Q17_FOOTNOTE =
  "This includes a severe allergic reaction, such as anaphylaxis, that required treatment with " +
  "epinephrine or EpiPen™, or that caused you to go to the hospital. It also includes an allergic " +
  "reaction that caused hives, swelling or respiratory distress, including wheezing."

/** All Yes/No screening questions in printed order. */
export const ALL_SCREENING: ScreeningQuestion[] = [
  ...GENERAL_SCREENING,
  ...LIVE_VACCINE_SCREENING,
  ...COVID_SCREENING,
]

// ---------------------------------------------------------------------------
// Section C, question 18 — "Check all that apply to you"
// ---------------------------------------------------------------------------
export const Q18_CONDITIONS = [
  "Have a history of myocarditis or pericarditis",
  "Had a severe allergic reaction to something other than a vaccine or injectable therapy such as food, pet, venom, environmental or oral medication allergies",
  "Had COVID-19 and was treated with monoclonal antibodies or convalescent serum",
  "Diagnosed with multisystem inflammatory syndrome (MIS-C or MIS-A) after a COVID-19 infection",
  "Have a weakened immune system (e.g., HIV, cancer) or take immunosuppressive drugs or therapies",
  "Have a bleeding disorder",
  "Take a blood thinner",
  "Have a history of heparin-induced thrombocytopenia (HIT)",
  "Am currently pregnant or breastfeeding",
  "Have received dermal fillers",
  "History of Guillain-Barré Syndrome (GBS)",
] as const

// ---------------------------------------------------------------------------
// Vaccines offered
// ---------------------------------------------------------------------------
export const VACCINE_OPTIONS = ["Seasonal Influenza", "COVID-19", "RSV", "Other"] as const

// ---------------------------------------------------------------------------
// Section A — demographics
// ---------------------------------------------------------------------------
export const GENDER_OPTIONS = ["Female", "Male", "Non-binary"] as const

export const RACE_OPTIONS = [
  "African American",
  "American Indian",
  "Asian",
  "Caucasian",
  "Hawaiian/Pacific Islander",
] as const

export const ETHNICITY_OPTIONS = ["Hispanic", "non-Hispanic"] as const

// ---------------------------------------------------------------------------
// Section D — insurance
// ---------------------------------------------------------------------------
export const INSURANCE_TYPE_OPTIONS = ["Insurance", "Pharmacy", "Medical"] as const

/** Columns of the clinic-use administration table on page 2. */
export const ADMIN_TABLE_COLUMNS = [
  { key: "vaccine", label: "Vaccine" },
  { key: "mfr", label: "MFR" },
  { key: "dateAdmin", label: "Date admin." },
  { key: "lotNo", label: "Lot No." },
  { key: "expDate", label: "Exp. date" },
  { key: "dosage", label: "Dosage" },
  { key: "injectionSite", label: "Injection site" },
  { key: "visEuaDate", label: "VIS/EUA date" },
  { key: "doseInSeries", label: "Dose in series" },
] as const

/** Pre-printed rows of the administration table. */
export const ADMIN_TABLE_ROWS = ["COVID-19", "Influenza", "Other"] as const

// ---------------------------------------------------------------------------
// Payload shape shared by the form, the PDF and the API route.
// ---------------------------------------------------------------------------
export type VaccineAdminRow = {
  vaccine?: string
  mfr?: string
  dateAdmin?: string
  lotNo?: string
  expDate?: string
  dosage?: string
  injectionSite?: string
  visEuaDate?: string
  doseInSeries?: string
}

export type VaccineConsentPayload = {
  // Section A
  firstName: string
  lastName: string
  age: string
  dob: string
  gender?: (typeof GENDER_OPTIONS)[number]
  race?: (typeof RACE_OPTIONS)[number]
  ethnicity?: (typeof ETHNICITY_OPTIONS)[number]
  address: string
  city: string
  state: string
  zip: string
  email?: string
  phone: string
  physicianName?: string
  physicianPhone?: string
  physicianFax?: string

  // Section B + C answers, keyed q1..q17 plus their detail fields
  [screeningKey: string]: any

  // Vaccines requested
  vaccinesRequested?: string[]
  otherVaccineText?: string

  // Section C question 18
  q18Conditions?: string[]

  // Section D — consent
  consentName: string
  consentDate: string
  consentAgree: boolean

  // Section D — insurance
  insuranceTypes?: string[]
  insurancePlanName?: string
  memberId?: string
  rxBin?: string
  rxPcn?: string
  groupNo?: string
  medicareCardNo?: string
  medicareId?: string
  ssn?: string
  authorizeBilling?: boolean

  // Clinic use
  vaccineRows?: VaccineAdminRow[]
  immunizerName?: string
}

/**
 * Pull every screening answer (and its follow-up detail) out of a raw payload
 * into one object, ready to store in the `screening_responses` jsonb column.
 * Keys absent from the payload are skipped so partial submissions stay compact.
 */
export function collectScreeningResponses(form: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const q of ALL_SCREENING) {
    if (form[q.key] !== undefined) out[q.key] = form[q.key]
    if (q.detail && form[q.detail.key]) out[q.detail.key] = form[q.detail.key]
    if (q.detailDate && form[q.detailDate.key]) out[q.detailDate.key] = form[q.detailDate.key]
  }
  if (Array.isArray(form.q18Conditions) && form.q18Conditions.length) {
    out.q18Conditions = form.q18Conditions
  }
  return out
}
