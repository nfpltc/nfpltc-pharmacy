export type Feature = {
  title: string;
  body: string;
  style: "solid" | "outline"; // “solid” = emerald gradient, “outline” = bordered
};

export type Service = {
  slug: string;
  title: string;
  description: string;
  thumb: string;
  hero: string;
  hero2?: string;
  intro: string;
  features: Feature[];
  bullets: string[];
};

export const services: Service[] = [
  // 1️⃣ LTC PHARMACY
  {
    slug: "ltc",
    title: "An Exclusive Long-Term Care Pharmacy",
    description:
      "specialized pharmacy that exclusively serves long-term care facilities like nursing homes, assisted living, and hospice, unlike retail pharmacies that serve the general public. These pharmacies are often called closed-door pharmacies because they don't have a retail storefront, and they provide specialized services like unit-dose packaging, medication delivery, and consulting pharmacists to support facility staff and residents. ",
    thumb: "/ltc1.jpg",
    hero: "/ltc1.jpg",
    hero2: "/ltc2.png",
    intro:
      "For over 30 years, our Cape Cod pharmacy has empowered assisted living communities, group homes, rest homes, and specialty schools by delivering safe, timely medication management with a personal touch",
    features: [
      {
        title: "Advanced Medication Packaging",
        body: "Blister and unit-dose solutions with clear labels and schedules—making administration simple for staff and adherence easier for residents.",
        style: "solid",
      },
      {
        title: "24/7 Pharmacist Access",
        body: "True 24/7 pharmacist availability—for staff and residents.",
        style: "outline",
      },
      {
        title: "Seamless Facility Partnerships",
        body: "On-boarding, training, workflow audits, and regular reporting—all tailored to fit your community’s routines for effortless integration.",
        style: "outline",
      },
      {
        title: "Reliable Free Local Delivery",
        body: "Scheduled deliveries and rapid same-day service ensure residents never miss medications—even during emergencies.",
        style: "solid",
      },
    ],
    bullets: [
      "Flexible packaging and labeling for safety and compliance",
      "True 24/7 pharmacist availability—for staff and residents",
      "Customized support and workflows for every care community",
      "Free delivery across Cape Cod, with options for both scheduled and emergency needs",
      "Decades of proven service trusted by families and care teams",
    ],
  },

  // 2️⃣ eMAR INTEGRATION
  {
    slug: "emar",
    title: "eMAR Integration",
    description:
      "Digital MAR solutions that simplify documentation and ensure accuracy in every med pass.",
    thumb: "/emar1.jpg",
    hero: "/emar1.jpg",
    hero2: "/emar2.png",
    intro:
      "We seamlessly connect with your facility’s eMAR system to eliminate manual transcription errors and simplify reporting. From initial setup to staff training and ongoing support, our team ensures an effortless integration—freeing up your staff to focus more on resident care, not paperwork.",
    features: [
      {
        title: "Real-Time Medication Updates",
        body: "Automatic data sync between pharmacy and eMAR system for accurate med passes.",
        style: "solid",
      },
      {
        title: "Error Reduction",
        body: "Minimize missed doses and transcription errors with direct digital integration.",
        style: "outline",
      },
      {
        title: "HIPAA-Compliant Data Exchange",
        body: "All patient data is transmitted securely and encrypted, meeting the highest standards for HIPAA compliance and resident privacy.",
        style: "outline",
      },
      {
        title: "Training & Support",
        body: "Our implementation team provides ongoing guidance for staff and administrators.",
        style: "solid",
      },
    ],
    bullets: [
      "Compatible with all major eMAR systems used across Massachusetts, can be synchronized with any software",
      "Improved documentation accuracy and audit readiness, helping your facility stay survey-ready at all times​",
      "Simple, streamlined training process for caregivers and administrators—backed by ongoing support from our pharmacy team",
    ],
  },

  // 3️⃣ BLISTER PACKAGING
  {
    slug: "blister-packaging",
    title: "Blister & Compliance Packaging",
    description:
      "Blister & Compliance Packaging Our compliance packaging empowers residents, caregivers, and nurses to administer medications confidently and accurately. Each blister card is clearly labeled with the date, time, and dosage, making medication adherence effortless and safe",
    thumb: "/bl.webp",
    hero: "/bl.webp",
    hero2: "/bl2.png",
    intro:
      "Our compliance packaging helps residents, caregivers, and nurses administer medications confidently. Each blister card is clearly labeled with the date, time, and dosage — making adherence effortless and safe.",
    features: [
      {
        title: "Weekly & Monthly Blisters",
        body: "Flexible card cycles adapt to your medication administration schedule, whether weekly or monthly, supporting smooth facility workflows.",
        style: "solid",
      },
      {
        title: "Color-Coded Design",
        body: "Visual cues for morning, noon, evening, and bedtime med passes simplify and speed up medication rounds.",
        style: "outline",
      },
      {
        title: "Change-Friendly Workflow",
        body: "We quickly update blister packs whenever prescriptions change or new residents join, ensuring timely and accurate medication management.",
        style: "outline",
      },
      {
        title: "Audit & MAR Compatibility",
        body: "Each pack aligns seamlessly with electronic and manual medication administration records, streamlining audits and improving documentation accuracy.",
        style: "solid",
      },
    ],
    bullets: [
      "Enhances adherence and reduces missed or double doses through clear, organized packaging.​",
      "Ideal for long-term care, group homes, and home care patients requiring consistent, reliable medication management.​",
      "Tamper-evident packaging with precise labeling safeguards medication integrity and patient safety.​",
    ],
  },

  // 4️⃣ ASSISTED LIVING
  {
    slug: "assisted-living",
    title: "Assisted Living & Memory Care",
    description:
      "Pharmacy care designed for assisted living and memory care communities.",
    thumb: "/as1.jpg",
    hero: "/as1.jpg",
    hero2: "/as.png",
    intro:
      "Partnering for Compassionate, Consistent Care. We specialize in pharmacy programs designed specifically for assisted living and memory care facilities. Our mission is to simplify medication management, improve safety, and deliver compassionate support for residents and staff alike.",
    features: [
      {
        title: "Resident-Centered Care",
        body: "We develop custom medication plans in close collaboration with caregivers and families to meet the unique needs of each resident, ensuring personalized and effective therapy.",
        style: "solid",
      },
      {
        title: "Routine Pharmacist Reviews",
        body: "Our pharmacists provide ongoing clinical oversight to prevent drug interactions, optimize medication regimens, and ensure therapy is properly maintained.",
        style: "outline",
      },
      {
        title: "Family Communication",
        body: "Staff education is a cornerstone of our service. We offer comprehensive training on medication handling, safety protocols, and adherence best practices tailored to each facility's workflow.",
        style: "outline",
      },
      {
        title: "Facility Training & Support",
        body: "We work directly with family members to coordinate timely refills, medication changes, and updates, keeping everyone informed and involved.",
        style: "solid",
      },
    ],
    bullets: [
      "Simplified refill management and continuous medication monitoring",
      "Year-round availability of pharmacist consultations and staff training",
      "Specialized support for residents with cognitive or mobility challenges",
      "Proven partnership with long-term care communities to enhance resident well-being",
    ],
  },

  // 5️⃣ GROUP HOME
  {
    slug: "group-home",
    title: "Group Home & Rest Home Services",
    description:
      "Dependable, facility-focused pharmacy care for group and rest home communities.",
    thumb: "/gh1.jpg",
    hero: "/gh1.jpg",
    hero2: "/gh.png",
    intro:
      "Reliable Medication Management for Every Resident. We provide tailored medication services designed specifically for group homes and rest homes, ensuring each resident receives the right medication at the right time. Our delivery and reporting systems prioritize speed, compliance, and transparency to support smooth operations and resident well-being.",
    features: [
      {
        title: "Daily Delivery Routes",
        body: "Consistent, on-time deliveries guarantee medication availability, reducing delays and ensuring residents never miss a dose.",
        style: "solid",
      },
      {
        title: "Compliance Documentation",
        body: "We prepare detailed MAR logs, refill sheets, and audit records to support your facility’s inspections and regulatory compliance.",
        style: "outline",
      },
      {
        title: "24/7 Pharmacist On-Call",
        body: "Access our pharmacists anytime for urgent requests, new prescription orders, or clinical consultations, ensuring continuous care.",
        style: "outline",
      },
      {
        title: "Personalized Facility Liaison",
        body: "Each facility is assigned a dedicated pharmacy contact to provide customized support, answer questions, and streamline communication.",
        style: "solid",
      },
    ],
    bullets: [
      "Reliable daily and emergency medication deliveries",
      "Proactive communication and collaboration with facility staff",
      "Comprehensive audit support and compliant documentation",
      "Experienced team focused on improving medication safety and facility workflow",
    ],
  },

  // 6️⃣ IMMUNIZATIONS
  {
    slug: "immunizations",
    title: "Immunizations & Clinical Services",
    description:
      "Preventive vaccines and clinical consultations administered by licensed pharmacists.",
    thumb: "/vc1.jpg",
    hero: "/vc1.jpg",
    hero2: "/im.png",
    intro:
      "We offer comprehensive immunization programs for individuals and long-term care facilities. Whether in-pharmacy or on-site, our pharmacists deliver safe, convenient vaccination services to keep your community healthy year-round.",
    features: [
      {
        title: "On-Site Clinics",
        body: "We organize and manage all CDC approved vaccination events tailored to your facility’s schedule to minimize disruptions.",
        style: "solid",
      },
      {
        title: "Certified Pharmacists",
        body: "All vaccines are administered by our trained, licensed pharmacists/certified immunizer who ensure safe and effective delivery.",
        style: "outline",
      },
      {
        title: "VIS & Documentation Support",
        body: "We provide full Vaccine Information Sheets (VIS) and thorough documentation to maintain accurate records and support compliance.",
        style: "outline",
      },
      {
        title: "Flexible Scheduling",
        body: "Our vaccination programs adapt to your facility’s timing and patient flow, ensuring convenience for residents and staff.",
        style: "solid",
      },
    ],
    bullets: [
      "Wide range of vaccines CDC approved vaccines.",
      "Options for in-pharmacy or on-site vaccination clinics",
      "Complete VIS documentation and reporting to meet regulatory requirements",
      "Experienced clinical teams dedicated to resident safety and care quality",
    ],
  },

  // 8️⃣ SPECIALTY SCHOOLS
  {
    slug: "specialty-schools-medication-support",
    title: "Specialty Schools Medication Support",
    description:
      "Nurse-ready medication packaging, MAR sheets, and staff training for special education and therapeutic schools.",
    thumb: "/sch.jpg",
    hero: "/sch.jpg",
    hero2: "/sch.png",
    intro:
      "We collaborate with school nurses and administrators to ensure safe, compliant medication administration for students who need additional support. From labeled unit-dose packs to MAR documentation and on-site training, we tailor pharmacy workflows to the school day.",
    features: [
      {
        title: "Nurse-Ready Unit Dose",
        body: "Individually labeled doses with student name, drug, strength, and time-of-day simplify passes.",
        style: "solid",
      },
      {
        title: "MAR & Documentation",
        body: "Clear medication administration records, refill logs, and parent communication templates.",
        style: "outline",
      },
      {
        title: "Staff Training",
        body: "Medication handling, storage, and emergency protocol refreshers for nurses and designated staff.",
        style: "outline",
      },
      {
        title: "Field Trip & After-School Packs",
        body: "Securely packaged take-along doses with instructions for off-site activities and programs.",
        style: "solid",
      },
    ],
    bullets: [
      "Custom packaging aligned to bell schedules and nurse workflows",
      "Audit-ready documentation for school compliance",
      "Training that builds confidence across the care team",
    ],
  },

  // 9️⃣ FREE PRESCRIPTION DELIVERY
  {
    slug: "free-prescription-delivery",
    title: "Reliable Prescription Delivery",
    description:
      "Reliable delivery routes across Cape Cod with options for urgent same-day needs.",
    thumb: "/del1.jpg",
    hero: "/del1.jpg",
    hero2: "/pd.png",
    intro:
      "We keep therapy on track by bringing medications directly to facilities, homes, and workplaces. Our scheduled routes, delivery confirmations, and emergency options reduce missed doses and save time for patients and care teams.",
    features: [
      {
        title: "Scheduled Routes",
        body: "Predictable delivery windows coordinated with refill synchronization and facility med passes.",
        style: "solid",
      },
      {
        title: "Proof of Delivery",
        body: "Driver confirmations and optional photo/time stamps improve chain-of-custody confidence.",
        style: "outline",
      },
      {
        title: "Cold-Chain Handling",
        body: "Insulated packaging and temperature control procedures for sensitive medications.",
        style: "outline",
      },
      {
        title: "Emergency Drop-Offs",
        body: "Rapid dispatch for urgent starts, therapy changes, or missing doses when timing matters.",
        style: "solid",
      },
    ],
    bullets: [
      "Reliable delivery with clear ETAs and confirmations",
      "Aligned with refill sync to reduce interruptions",
      "Rapid options for urgent clinical situations",
    ],
  },

  // 🔟 MAP CONSULTING
  {
    slug: "map-consulting",
    title: "MAP Consulting",
    description:
      "Guidance and training for Medication Administration Program (MAP) compliance and readiness.",
    thumb: "/map1.jpg",
    hero: "/map1.jpg",
    hero2: "/map.png",
    intro:
      "Our consultants help facilities interpret and operationalize MAP requirements. We align packaging, documentation, storage, and staff procedures to state guidance, and provide mock audits and corrective action plans to keep teams inspection-ready.",
    features: [
      {
        title: "Policy & Workflow Review",
        body: "Gap analysis of storage, labeling, logs, disposal, and documentation against MAP standards.",
        style: "solid",
      },
      {
        title: "Mock Audits",
        body: "Survey-style walkthroughs that surface findings early and prioritize remediation steps.",
        style: "outline",
      },
      {
        title: "Staff Training & Refreshers",
        body: "Role-based sessions for medication handling, documentation, and incident reporting.",
        style: "outline",
      },
      {
        title: "Corrective Action Plans",
        body: "Clear, time-bound recommendations to close gaps and standardize performance.",
        style: "solid",
      },
    ],
    bullets: [
      "Confidence for inspections and surveys",
      "Documentation templates and checklists provided",
      "Training that sticks through practical drills",
    ],
  },

  // 1️⃣1️⃣ MPCHS STUDENT TRAINING
  {
    slug: "mpchs-student-training",
    title: "MPCHS Student Training",
    description:
      "Hands-on learning for pharmacy and healthcare students focused on safe dispensing and communication.",
    thumb: "/tr1.jpg",
    hero: "/tr1.jpg",
    hero2: "/spc.png",
    intro:
      "We mentor students through real-world pharmacy operations—covering accuracy, packaging, eMAR alignment, vaccine workflows, and patient counseling. The experience integrates clinical judgment with operational excellence and community impact.",
    features: [
      {
        title: "Dispensing & Accuracy Labs",
        body: "NDC verification, DUR checks, label accuracy, and unit-dose workflows under supervision.",
        style: "solid",
      },
      {
        title: "Packaging & eMAR Alignment",
        body: "Blister design principles, change management, and mapping to eMAR/MAR records.",
        style: "outline",
      },
      {
        title: "Vaccination Support",
        body: "Clinic setup, VIS documentation, storage, and patient flow techniques.",
        style: "outline",
      },
      {
        title: "Communication & Counseling",
        body: "Plain-language counseling, caregiver coordination, and professionalism with teams and patients.",
        style: "solid",
      },
    ],
    bullets: [
      "Practical skills that translate to safer patient care",
      "Structured rotations with measurable outcomes",
      "Mentorship from pharmacists in active practice",
    ],
  },
];
