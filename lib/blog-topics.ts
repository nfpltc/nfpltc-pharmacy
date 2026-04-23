// Blog topic bank for automated generation.
// The cron picks the least-recently-used topic each run.
// Each topic has: id, category, title_seed (rough title), angle (what the post
// should focus on), image_query (for Unsplash), and tags.

export interface BlogTopic {
  id: string
  category: string
  title_seed: string
  angle: string
  image_query: string
  tags: string[]
}

export const BLOG_TOPICS: BlogTopic[] = [
  // ─── Services (from the website cards) ───
  { id: "svc-ltc", category: "Services", title_seed: "What Long-Term Care Pharmacy Services Actually Look Like",
    angle: "Explain what a long-term care pharmacy does that a retail pharmacy doesn't — blister packaging, eMAR, facility coordination, 24/7 pharmacist access. Concrete examples.",
    image_query: "pharmacist elderly care", tags: ["long-term care","pharmacy-services","cape-cod"] },
  { id: "svc-map", category: "Services", title_seed: "Medication Administration Plan (MAP) Consulting for Cape Cod Facilities",
    angle: "What MAP consulting is, why facilities need it in Massachusetts, and how a consulting pharmacy supports staff training and regulatory compliance.",
    image_query: "medication review consultation", tags: ["map-consulting","massachusetts","compliance"] },
  { id: "svc-mcphs", category: "Services", title_seed: "How Student Pharmacist Training Benefits Patients",
    angle: "Explain how our partnership with MCPHS (Massachusetts College of Pharmacy) enriches patient care through supervised student involvement, fresh clinical perspectives, and extended support capacity.",
    image_query: "pharmacy student training", tags: ["mcphs","training","pharmacy-students"] },
  { id: "svc-specialty", category: "Services", title_seed: "Medication Support for Specialty Schools and Programs",
    angle: "How pharmacies partner with residential schools and specialty programs to manage medications for students with complex needs — safety checks, packaging, staff training.",
    image_query: "school nurse medication", tags: ["specialty-schools","youth-care"] },
  { id: "svc-delivery", category: "Services", title_seed: "What 'Reliable Prescription Delivery' Really Means",
    angle: "Beyond just dropping off a bag: how a good local pharmacy handles cold-chain meds, controlled-substance documentation, delivery windows, and emergency same-day delivery. Cape Cod-specific logistics.",
    image_query: "medication delivery home", tags: ["delivery","prescriptions","cape-cod"] },
  { id: "svc-blister", category: "Services", title_seed: "Blister Packaging Explained: Who It Helps and How",
    angle: "What blister/compliance packaging is, how it's organized (AM/Noon/PM/Bedtime), who benefits most (seniors, caregivers, group homes), and how it reduces medication errors.",
    image_query: "blister pack pills", tags: ["blister-packaging","adherence","medication-safety"] },
  { id: "svc-assisted", category: "Services", title_seed: "Pharmacy Partnership for Assisted Living and Memory Care",
    angle: "How dedicated LTC pharmacies support assisted living facilities — regular med reviews, eMAR, emergency fills, cycle fills — and what families should look for when choosing a facility.",
    image_query: "assisted living care", tags: ["assisted-living","memory-care","caregivers"] },
  { id: "svc-group-home", category: "Services", title_seed: "Medication Management for Group Homes and Rest Homes",
    angle: "The unique needs of group home medication management — DMH/DDS regulations, staff-administered meds, documentation — and how a pharmacy partner helps.",
    image_query: "group home residents", tags: ["group-homes","rest-homes","massachusetts-regulations"] },
  { id: "svc-immunization", category: "Services", title_seed: "Vaccines and Clinical Services at Your Local Pharmacy",
    angle: "What vaccines a pharmacy can administer in Massachusetts, why getting them at the pharmacy is convenient, and what clinical services (BP checks, consultations) are available.",
    image_query: "vaccine immunization pharmacy", tags: ["vaccines","immunization","clinical-services"] },
  { id: "svc-emar", category: "Services", title_seed: "eMAR Integration: How Digital Medication Records Improve Safety",
    angle: "What electronic MAR (medication administration records) are, how integration with pharmacy reduces errors, and why facilities increasingly require it.",
    image_query: "electronic medical records", tags: ["emar","technology","facilities"] },

  // ─── Medication education (general) ───
  { id: "edu-adherence", category: "Education", title_seed: "Why Missing Doses Matters More Than You Think",
    angle: "Plain-English explanation of medication adherence, common reasons people skip doses, and practical tips to stay on track. No specific drug names.",
    image_query: "pill organizer weekly", tags: ["adherence","medication-safety","health-tips"] },
  { id: "edu-generic", category: "Education", title_seed: "Generic vs. Brand-Name Medications: What's the Real Difference",
    angle: "FDA standards for generic equivalence, why they cost less, common misconceptions. Do not make specific drug recommendations.",
    image_query: "prescription bottles pharmacy", tags: ["generics","pharmacy-costs","education"] },
  { id: "edu-interactions", category: "Education", title_seed: "When to Ask Your Pharmacist About Drug Interactions",
    angle: "Categories of interactions (food, alcohol, OTC, other Rx), and scenarios where calling the pharmacy is smart. Encourage calling, not self-diagnosing.",
    image_query: "pharmacist consultation", tags: ["drug-interactions","pharmacy-safety"] },
  { id: "edu-otc", category: "Education", title_seed: "How to Read an Over-the-Counter Medication Label",
    angle: "Walk through the FDA 'Drug Facts' box — active ingredients, warnings, directions. Tips for seniors and caregivers.",
    image_query: "medicine cabinet", tags: ["otc","medication-safety","education"] },
  { id: "edu-storage", category: "Education", title_seed: "How to Store Medications Safely at Home",
    angle: "Temperature, humidity, childproofing, expired-med disposal (including MA take-back programs). Specific for Cape Cod summer heat.",
    image_query: "medicine storage home", tags: ["medication-storage","safety","home-tips"] },
  { id: "edu-disposal", category: "Education", title_seed: "The Right Way to Dispose of Expired Medications",
    angle: "Why flushing is bad, what MA drug take-back programs exist, DEA Take-Back Day. Direct readers to local resources.",
    image_query: "expired medication", tags: ["disposal","environment","safety"] },
  { id: "edu-polypharmacy", category: "Education", title_seed: "Taking Multiple Medications? Here's How to Stay Organized",
    angle: "Polypharmacy in seniors, tools to manage (pill organizers, blister packs, apps), when to request a pharmacy med review.",
    image_query: "senior medication organizer", tags: ["polypharmacy","seniors","adherence"] },
  { id: "edu-rx-refills", category: "Education", title_seed: "Refill Sync: The Simple Idea That Saves Pharmacy Visits",
    angle: "How refill synchronization works, benefits for people taking multiple meds, how to ask your pharmacy to set it up.",
    image_query: "pharmacy refill", tags: ["refill-sync","pharmacy-tips","convenience"] },
  { id: "edu-pharmacist-role", category: "Education", title_seed: "Your Pharmacist Does More Than Fill Prescriptions — Here's What Else",
    angle: "Clinical services pharmacists provide: med reviews, vaccines, counseling, chronic-condition check-ins. Invite readers to ask.",
    image_query: "community pharmacist", tags: ["pharmacist","clinical-services","education"] },
  { id: "edu-questions", category: "Education", title_seed: "5 Questions Worth Asking Every Time You Pick Up a Prescription",
    angle: "Classic pharmacist-recommended questions: what is it for, how to take it, side effects, interactions, missed dose. Patient-empowerment angle.",
    image_query: "pharmacy counter customer", tags: ["patient-education","questions","prescriptions"] },

  // ─── Caregiver / family ───
  { id: "care-parents", category: "Caregivers", title_seed: "Helping Aging Parents Manage Their Medications",
    angle: "Signs a parent is struggling with meds, conversations to have, tools that help (blister packs, reminders), when to involve their doctor/pharmacy.",
    image_query: "adult child helping parent", tags: ["caregivers","seniors","family"] },
  { id: "care-dementia", category: "Caregivers", title_seed: "Medication Routines for Dementia and Memory Loss",
    angle: "Strategies to support med-taking when memory is impacted — routine, visual cues, pre-packaged doses, caregiver involvement. Gentle tone.",
    image_query: "memory care caregiver", tags: ["dementia","memory-care","caregivers"] },
  { id: "care-hospital-discharge", category: "Caregivers", title_seed: "Bringing a Loved One Home from the Hospital: A Medication Checklist",
    angle: "Med reconciliation after discharge, what to check for, how to bring all bottles to the pharmacist, red flags to watch for.",
    image_query: "hospital discharge home", tags: ["transitions-of-care","caregivers","safety"] },
  { id: "care-travel", category: "Caregivers", title_seed: "Traveling with a Loved One's Medications: Smart Packing Tips",
    angle: "Carry-on vs checked, documentation, temperature-sensitive meds, having extras, knowing the local pharmacy at the destination.",
    image_query: "travel medication packing", tags: ["travel","caregivers","planning"] },
  { id: "care-advocate", category: "Caregivers", title_seed: "How to Be an Effective Advocate at Your Loved One's Pharmacy Visits",
    angle: "Walking into an appointment prepared, what to ask, how to flag concerns without stepping on the patient's autonomy.",
    image_query: "family pharmacy visit", tags: ["caregivers","advocacy","family"] },

  // ─── Seasonal / local Cape Cod ───
  { id: "sea-flu", category: "Seasonal", title_seed: "Flu Season on Cape Cod: When and Where to Get Vaccinated",
    angle: "Timing, high-dose options for 65+, who should get which vaccine, what the pharmacy offers. Local angle.",
    image_query: "flu shot pharmacy", tags: ["flu-season","vaccines","cape-cod"] },
  { id: "sea-summer-heat", category: "Seasonal", title_seed: "Summer Heat and Your Medications: What Cape Cod Residents Should Know",
    angle: "Which meds are heat-sensitive, hot-car storage warnings, beach-bag tips, hydration interactions with common meds. No specific drug names.",
    image_query: "summer cape cod beach", tags: ["summer","cape-cod","medication-storage"] },
  { id: "sea-allergy", category: "Seasonal", title_seed: "Managing Spring Allergies: What Your Pharmacist Wants You to Know",
    angle: "OTC antihistamine categories, when to see a doctor, interactions with other medications, local pollen realities.",
    image_query: "spring pollen allergies", tags: ["allergies","spring","otc"] },
  { id: "sea-winter", category: "Seasonal", title_seed: "Staying Healthy Through a Cape Cod Winter",
    angle: "Cold/flu season, indoor air quality, vitamin D, med adherence when weather disrupts routines. Light seasonal touch.",
    image_query: "winter cape cod", tags: ["winter","seasonal-health","cape-cod"] },
  { id: "sea-thanksgiving", category: "Seasonal", title_seed: "Talking to Family About Medications Over the Holidays",
    angle: "Thanksgiving/Christmas visits are when many families first notice elder-care concerns. How to start the conversation, what to observe.",
    image_query: "family holiday dinner", tags: ["holidays","family","caregivers"] },
  { id: "sea-back-school", category: "Seasonal", title_seed: "Back-to-School Pharmacy Checklist for Families",
    angle: "Forms that need pharmacy signoff, ADHD med logistics for the school year, immunization requirements in MA.",
    image_query: "back to school", tags: ["back-to-school","families","vaccines"] },

  // ─── Community / local business ───
  { id: "com-local", category: "Community", title_seed: "Why a Local Pharmacy Is More Than Just a Store",
    angle: "The 'you know your pharmacist' effect, continuity of care, community investment, Cape Cod-specific. Stay humble, don't trash competitors.",
    image_query: "local pharmacy storefront", tags: ["local-pharmacy","community","cape-cod"] },
  { id: "com-team", category: "Community", title_seed: "A Day in the Life of a Long-Term Care Pharmacy",
    angle: "What happens behind the scenes at an LTC pharmacy — morning cycle fills, facility rounds, emergency deliveries, pharmacist consultations.",
    image_query: "pharmacy team behind scenes", tags: ["behind-the-scenes","team","ltc"] },
  { id: "com-history", category: "Community", title_seed: "Serving Cape Cod Families Since 2013",
    angle: "NFPLTC history, growth, community involvement, what's changed and what hasn't. Warm tone.",
    image_query: "cape cod community", tags: ["history","community","cape-cod"] },
]
