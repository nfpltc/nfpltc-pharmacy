"use client"

import { useMemo, useState, useEffect } from "react"
import pills from "@/lib/pills_600.json" assert { type: "json" }
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type Pill = { id: number; name: string; image: string }

/* ─── Built-in Drug Knowledge Base ─── */
const drugDB: Record<string, { use: string; directions: string; warnings: string; sideEffects: string; storage: string; category: string }> = {
  lisinopril: { category: "ACE Inhibitor", use: "Used to treat high blood pressure (hypertension) and heart failure. It helps prevent strokes, heart attacks, and kidney problems by relaxing blood vessels.", directions: "Take once daily with or without food. Take at the same time each day. Continue taking even if you feel well. Do not stop without consulting your doctor.", warnings: "Do not use if pregnant. Tell your doctor if you have kidney disease, liver disease, or diabetes. Avoid potassium supplements unless directed. May cause dizziness — rise slowly from sitting.", sideEffects: "Common: dry cough, dizziness, headache, fatigue. Serious: swelling of face/lips/tongue (seek emergency help), chest pain, fainting, high potassium.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from moisture and light. Keep in original container." },
  metformin: { category: "Antidiabetic", use: "Used to control high blood sugar in people with type 2 diabetes. It works by decreasing the amount of sugar your liver makes and helping your body respond better to insulin.", directions: "Take with meals to reduce stomach upset. Swallow whole — do not crush or chew extended-release tablets. Follow your doctor's dosing instructions carefully.", warnings: "Tell your doctor if you have kidney problems, liver disease, or are scheduled for surgery or imaging with contrast dye. Avoid excessive alcohol. Seek emergency help for signs of lactic acidosis (unusual tiredness, muscle pain, trouble breathing).", sideEffects: "Common: nausea, diarrhea, stomach upset, metallic taste. These usually improve over time. Serious: lactic acidosis (rare but serious), low blood sugar when combined with other diabetes drugs.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light and moisture." },
  amlodipine: { category: "Calcium Channel Blocker", use: "Used to treat high blood pressure and chest pain (angina). It works by relaxing blood vessels so blood can flow more easily and the heart doesn't have to work as hard.", directions: "Take once daily with or without food. Can be taken at any time of day, but take at the same time each day for best results.", warnings: "Tell your doctor if you have liver disease, heart failure, or aortic stenosis. Do not stop suddenly. May worsen chest pain temporarily when starting.", sideEffects: "Common: swelling of ankles/feet, dizziness, flushing, headache. Serious: rapid heartbeat, severe dizziness, fainting.", storage: "Store at room temperature 59-86°F (15-30°C). Protect from light and moisture." },
  atorvastatin: { category: "Statin (Cholesterol)", use: "Used to lower 'bad' cholesterol (LDL) and triglycerides, and raise 'good' cholesterol (HDL). Helps prevent heart attacks, strokes, and other heart complications.", directions: "Take once daily with or without food, usually in the evening. Follow a low-cholesterol, low-fat diet while taking this medication.", warnings: "Tell your doctor if you have liver disease or drink large amounts of alcohol. Report unexplained muscle pain, tenderness, or weakness immediately. Avoid grapefruit juice.", sideEffects: "Common: muscle/joint pain, diarrhea, nausea, headache. Serious: unexplained muscle pain/weakness (rhabdomyolysis), liver problems, allergic reactions.", storage: "Store at room temperature 68-77°F (20-25°C). Keep away from moisture." },
  amoxicillin: { category: "Antibiotic", use: "Used to treat many types of bacterial infections including ear infections, pneumonia, bronchitis, urinary tract infections, and skin infections.", directions: "Take every 8 or 12 hours as directed. Complete the full course even if you feel better. Can be taken with or without food. Shake liquid form well before measuring.", warnings: "Tell your doctor if you are allergic to penicillin or cephalosporin antibiotics. May reduce effectiveness of birth control pills. Finish entire prescription to prevent antibiotic resistance.", sideEffects: "Common: nausea, vomiting, diarrhea, rash. Serious: severe allergic reaction (rash, itching, swelling, trouble breathing), watery/bloody diarrhea, yellowing skin.", storage: "Store capsules/tablets at room temperature. Refrigerate liquid form and discard after 14 days." },
  gabapentin: { category: "Anticonvulsant / Nerve Pain", use: "Used to treat nerve pain (neuropathy), seizures, and restless legs syndrome. It works by calming overactive nerve signals in the brain.", directions: "Take as directed, usually 1-3 times daily with or without food. Do not stop suddenly — must be gradually reduced. Swallow whole or may be opened and mixed with applesauce.", warnings: "May cause drowsiness — avoid driving until you know how it affects you. Avoid alcohol. Tell your doctor if you have kidney disease. May increase risk of suicidal thoughts in some patients.", sideEffects: "Common: drowsiness, dizziness, fatigue, swelling in hands/feet. Serious: mood changes, depression, allergic reactions, difficulty breathing.", storage: "Store at room temperature 77°F (25°C). Protect from moisture." },
  omeprazole: { category: "Proton Pump Inhibitor", use: "Used to treat frequent heartburn, gastroesophageal reflux disease (GERD), stomach ulcers, and conditions where the stomach makes too much acid.", directions: "Take before eating, usually once daily in the morning. Swallow capsules whole — do not crush or chew. For best results, take 30-60 minutes before a meal.", warnings: "Not intended for immediate heartburn relief. Long-term use may increase risk of bone fractures and low magnesium. Tell your doctor if you have liver disease.", sideEffects: "Common: headache, stomach pain, nausea, diarrhea, gas. Serious: kidney problems, low magnesium, bone fractures with long-term use, vitamin B12 deficiency.", storage: "Store at room temperature 68-77°F (20-25°C). Keep in original packaging. Protect from light and moisture." },
  losartan: { category: "ARB (Blood Pressure)", use: "Used to treat high blood pressure, protect kidneys in diabetic patients, and reduce stroke risk. Works by blocking a substance that causes blood vessels to tighten.", directions: "Take once or twice daily with or without food. Take at the same time each day. Continue taking even if you feel well.", warnings: "Do not use if pregnant. Tell your doctor if you have kidney or liver disease. May cause high potassium — avoid potassium supplements unless directed. May cause dizziness.", sideEffects: "Common: dizziness, stuffy nose, back pain, fatigue. Serious: swelling of face/throat, difficulty breathing, dark urine, high potassium.", storage: "Store at room temperature 77°F (25°C). Protect from light." },
  levothyroxine: { category: "Thyroid Hormone", use: "Used to treat hypothyroidism (underactive thyroid). Replaces or provides thyroid hormone that is normally produced by the thyroid gland.", directions: "Take on an empty stomach, 30-60 minutes before breakfast. Take with a full glass of water. Do not take with calcium, iron, or antacids within 4 hours.", warnings: "Do not use for weight loss. Regular blood tests required to monitor thyroid levels. Many drugs interact with this medication — tell your doctor about all medications. Do not switch brands without consulting your doctor.", sideEffects: "Common (usually from incorrect dose): headache, insomnia, nervousness, increased appetite. Serious: chest pain, rapid heartbeat, excessive sweating, shortness of breath.", storage: "Store at room temperature 77°F (25°C). Protect from light and moisture. Keep in original container." },
  hydrochlorothiazide: { category: "Diuretic (Water Pill)", use: "Used to treat high blood pressure and fluid retention (edema). Works by helping your kidneys remove extra salt and water from your body.", directions: "Take once daily in the morning, with or without food. Taking in the morning helps avoid nighttime urination. Drink plenty of fluids unless directed otherwise.", warnings: "May cause sun sensitivity — use sunscreen. Tell your doctor if you have kidney disease, liver disease, gout, or diabetes. May affect electrolyte levels.", sideEffects: "Common: increased urination, dizziness, headache, muscle cramps. Serious: severe dehydration, electrolyte imbalance, gout flare, allergic reaction.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light and moisture." },
  simvastatin: { category: "Statin (Cholesterol)", use: "Used to lower cholesterol and triglycerides. Reduces the risk of heart attack, stroke, and other heart complications in people at risk.", directions: "Take once daily in the evening, with or without food. Follow a cholesterol-lowering diet. Do not take with grapefruit juice.", warnings: "Report unexplained muscle pain immediately. Tell your doctor if you have liver disease or drink alcohol heavily. Many drug interactions — inform your doctor of all medications.", sideEffects: "Common: headache, nausea, stomach pain, constipation. Serious: muscle breakdown (rhabdomyolysis), liver damage, memory problems.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from moisture." },
  metoprolol: { category: "Beta Blocker", use: "Used to treat high blood pressure, chest pain (angina), and heart failure. Also used to improve survival after a heart attack and treat certain irregular heartbeats.", directions: "Take with or immediately following a meal. Extended-release tablets should be swallowed whole. Do not stop suddenly — may cause chest pain or heart attack.", warnings: "Do not stop abruptly. Tell your doctor if you have asthma, diabetes, or thyroid problems. May mask signs of low blood sugar. May cause fatigue or cold hands/feet.", sideEffects: "Common: tiredness, dizziness, slow heartbeat, diarrhea, cold extremities. Serious: very slow heartbeat, worsening heart failure, difficulty breathing.", storage: "Store at room temperature 77°F (25°C). Protect from moisture." },
  prednisone: { category: "Corticosteroid", use: "Used to treat many conditions including allergies, arthritis, asthma, blood disorders, skin conditions, and inflammatory bowel disease by reducing inflammation.", directions: "Take with food or milk to prevent stomach upset. Follow dosing schedule exactly. Do not stop suddenly — dose must be gradually reduced. Take early in the day.", warnings: "Long-term use increases risk of infections, bone loss, and blood sugar changes. Tell your doctor if you have diabetes, infections, or eye problems. Avoid live vaccines while taking.", sideEffects: "Common: increased appetite, weight gain, mood changes, insomnia, stomach upset. Serious: vision changes, severe mood swings, signs of infection, bone fractures.", storage: "Store at room temperature 59-86°F (15-30°C). Keep in a tightly closed container." },
  sertraline: { category: "SSRI Antidepressant", use: "Used to treat depression, anxiety disorders, PTSD, OCD, and panic disorder. Works by increasing serotonin levels in the brain.", directions: "Take once daily, morning or evening, with or without food. May take 4-6 weeks to feel full benefit. Do not stop suddenly.", warnings: "May increase suicidal thoughts in young adults under 25 — monitor closely. Do not take with MAO inhibitors. Avoid alcohol. Tell your doctor if you are pregnant or planning pregnancy.", sideEffects: "Common: nausea, diarrhea, insomnia, drowsiness, dry mouth, dizziness. Serious: serotonin syndrome, unusual bleeding, mania, seizures.", storage: "Store at room temperature 68-77°F (20-25°C). Keep tightly closed." },
  furosemide: { category: "Loop Diuretic", use: "Used to treat fluid retention (edema) and high blood pressure. Helps your kidneys remove excess water and salt. Works faster and stronger than thiazide diuretics.", directions: "Take once or twice daily, preferably in the morning. Take with food to reduce stomach upset. Avoid taking late in the day to prevent nighttime urination.", warnings: "May cause dehydration and electrolyte imbalance. Tell your doctor if you have kidney disease, liver disease, or gout. Avoid excessive sun exposure.", sideEffects: "Common: frequent urination, dizziness, headache, muscle cramps, thirst. Serious: severe dehydration, hearing loss, electrolyte imbalance, kidney problems.", storage: "Store at room temperature 59-86°F (15-30°C). Protect from light. Do not freeze liquid form." },
  warfarin: { category: "Blood Thinner", use: "Used to prevent and treat blood clots in veins, arteries, and lungs. Helps prevent strokes in people with atrial fibrillation or artificial heart valves.", directions: "Take once daily at the same time each day, with or without food. Regular blood tests (INR) are required. Maintain consistent vitamin K intake (green leafy vegetables).", warnings: "Risk of serious bleeding. Avoid activities that may cause injury. Many drug and food interactions. Tell all healthcare providers you take this. Wear a medical alert bracelet.", sideEffects: "Common: easy bruising, minor bleeding. Serious: uncontrolled bleeding, blood in urine/stool, coughing blood, severe headache, unusual pain/swelling.", storage: "Store at room temperature 59-86°F (15-30°C). Protect from light." },
  acetaminophen: { category: "Pain Reliever / Fever Reducer", use: "Used to treat mild to moderate pain (headaches, muscle aches, toothaches) and reduce fever. Often found in combination products.", directions: "Take every 4-6 hours as needed. Do not exceed 3,000-4,000 mg per day (check with doctor). Can be taken with or without food.", warnings: "LIVER WARNING: Do not exceed maximum daily dose. Avoid alcohol (3+ drinks/day increases liver risk). Check all medications for acetaminophen to avoid doubling doses. Tell your doctor if you have liver disease.", sideEffects: "Common: generally well tolerated at recommended doses. Serious: liver damage (overdose), allergic reactions (rare), skin reactions (very rare).", storage: "Store at room temperature 68-77°F (20-25°C). Keep away from moisture and heat." },
  aspirin: { category: "NSAID / Blood Thinner", use: "Used to treat pain, reduce fever, and reduce inflammation. Low-dose aspirin is used to prevent heart attacks and strokes in at-risk patients.", directions: "Take with food or a full glass of water to reduce stomach irritation. For heart protection, take low dose daily as directed by your doctor.", warnings: "Do not give to children under 18 (risk of Reye's syndrome). Tell your doctor if you have stomach ulcers, bleeding disorders, or asthma. Stop before surgery as directed.", sideEffects: "Common: stomach upset, heartburn, nausea. Serious: stomach bleeding, allergic reactions, ringing in ears, unusual bruising/bleeding.", storage: "Store at room temperature 59-86°F (15-30°C). Keep away from moisture." },
  ibuprofen: { category: "NSAID", use: "Used to treat pain, reduce fever, and reduce inflammation from conditions like arthritis, headaches, dental pain, and menstrual cramps.", directions: "Take with food or milk to reduce stomach upset. Take the lowest effective dose for the shortest time needed. Do not exceed recommended daily dose.", warnings: "May increase risk of heart attack or stroke with long-term use. Do not use before or after heart bypass surgery. Tell your doctor about stomach/intestinal problems, kidney or heart disease.", sideEffects: "Common: stomach pain, nausea, dizziness, headache. Serious: stomach bleeding/ulcers, kidney problems, heart problems, allergic reactions.", storage: "Store at room temperature 68-77°F (20-25°C). Keep away from moisture and light." },
  citalopram: { category: "SSRI Antidepressant", use: "Used to treat depression and sometimes anxiety. Works by increasing serotonin activity in the brain to improve mood, sleep, appetite, and energy.", directions: "Take once daily, morning or evening, with or without food. May take several weeks to feel full effect. Do not stop suddenly.", warnings: "May increase suicidal thoughts in young adults. Do not exceed 40mg/day (risk of heart rhythm changes). Avoid alcohol and MAO inhibitors.", sideEffects: "Common: nausea, dry mouth, drowsiness, insomnia, increased sweating. Serious: QT prolongation, serotonin syndrome, unusual bleeding.", storage: "Store at room temperature 77°F (25°C). Protect from moisture." },
  fluoxetine: { category: "SSRI Antidepressant", use: "Used to treat depression, OCD, panic disorder, bulimia, and premenstrual dysphoric disorder. Works by increasing serotonin in the brain.", directions: "Take in the morning, with or without food. May take 4-6 weeks for full benefit. Capsules may be opened and mixed with food if needed.", warnings: "May increase suicidal thoughts in young adults. Do not take with MAO inhibitors. Long half-life — effects last weeks after stopping. Tell your doctor about all medications.", sideEffects: "Common: nausea, headache, nervousness, insomnia, drowsiness, anxiety. Serious: serotonin syndrome, mania, seizures, abnormal bleeding.", storage: "Store at room temperature 59-86°F (15-30°C). Protect from light." },
  venlafaxine: { category: "SNRI Antidepressant", use: "Used to treat depression, generalized anxiety disorder, social anxiety disorder, and panic disorder. Works by affecting both serotonin and norepinephrine.", directions: "Take with food, at the same time daily. Swallow extended-release capsules whole. Do not crush or chew. Must be tapered gradually to stop.", warnings: "May increase suicidal thoughts in young adults. Can raise blood pressure — regular monitoring needed. Do not combine with MAO inhibitors. May cause withdrawal if stopped abruptly.", sideEffects: "Common: nausea, headache, dizziness, drowsiness, insomnia, dry mouth, sweating. Serious: serotonin syndrome, increased blood pressure, seizures.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from moisture." },
  clonidine: { category: "Central Alpha Agonist", use: "Used to treat high blood pressure. Also used for ADHD, anxiety, and opioid withdrawal symptoms. Works by relaxing blood vessels and reducing heart rate.", directions: "Take 2-3 times daily as directed. Do not skip doses or stop suddenly — may cause dangerous spike in blood pressure. Patches should be changed weekly.", warnings: "Do not stop abruptly — may cause rebound hypertension. May cause drowsiness. Avoid alcohol. Tell your doctor if you have heart, kidney, or liver disease.", sideEffects: "Common: dry mouth, drowsiness, dizziness, constipation, fatigue. Serious: rebound hypertension, slow heartbeat, depression.", storage: "Store at room temperature 77°F (25°C). Protect patches from light." },
  propranolol: { category: "Beta Blocker", use: "Used to treat high blood pressure, angina, tremors, and certain heart rhythm disorders. Also used to prevent migraines and manage performance anxiety.", directions: "Take 2-4 times daily with food. Extended-release: take once daily. Do not stop suddenly. Swallow ER capsules whole.", warnings: "Do not stop abruptly. Tell your doctor if you have asthma, diabetes, or thyroid problems. May mask symptoms of low blood sugar. Avoid alcohol.", sideEffects: "Common: fatigue, cold hands/feet, slow heartbeat, dizziness, nausea. Serious: severe bradycardia, bronchospasm, worsening heart failure.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light and moisture." },
  carvedilol: { category: "Beta/Alpha Blocker", use: "Used to treat heart failure and high blood pressure. Also used after a heart attack to improve survival. Works by slowing heart rate and relaxing blood vessels.", directions: "Take twice daily with food to slow absorption and reduce dizziness. Do not crush or chew extended-release capsules. Do not stop suddenly.", warnings: "May cause dizziness when standing — rise slowly. Tell your doctor if you have liver disease, diabetes, or asthma. Do not stop abruptly.", sideEffects: "Common: dizziness, fatigue, low blood pressure, diarrhea, weight gain. Serious: worsening heart failure, very slow heartbeat, liver problems.", storage: "Store at room temperature 77°F (25°C). Protect from moisture. Keep in original container." },
  doxycycline: { category: "Antibiotic", use: "Used to treat many bacterial infections including respiratory infections, skin infections, acne, UTIs, and tick-borne diseases like Lyme disease.", directions: "Take with a full glass of water. May be taken with food if stomach upset occurs. Do not lie down for 30 minutes after taking. Complete the full course.", warnings: "Causes sun sensitivity — use sunscreen and protective clothing. Do not take with dairy, antacids, or iron within 2 hours. Not recommended for children under 8 or pregnant women.", sideEffects: "Common: nausea, vomiting, diarrhea, sun sensitivity, yeast infections. Serious: severe skin reactions, esophageal ulcers, liver problems.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light and moisture." },
  hydroxyzine: { category: "Antihistamine / Anxiolytic", use: "Used to treat anxiety, itching from allergies, and nausea. Also used as a sedative before/after anesthesia. Works by blocking histamine and affecting serotonin.", directions: "Take as directed, usually 3-4 times daily for itching or as needed for anxiety. Can be taken with or without food.", warnings: "Causes drowsiness — avoid driving and alcohol. Tell your doctor if you have glaucoma, prostate problems, or heart disease. Use caution in elderly patients.", sideEffects: "Common: drowsiness, dry mouth, dizziness, headache. Serious: irregular heartbeat (rare at high doses), seizures, tremors.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from moisture." },
  risperidone: { category: "Atypical Antipsychotic", use: "Used to treat schizophrenia, bipolar disorder, and irritability associated with autism. Works by balancing dopamine and serotonin in the brain.", directions: "Take once or twice daily with or without food. May take several weeks for full effect. Do not stop suddenly without consulting your doctor.", warnings: "Elderly with dementia: increased risk of death — not approved for this use. May cause weight gain and high blood sugar. Tell your doctor about all medical conditions.", sideEffects: "Common: drowsiness, weight gain, dizziness, nausea, increased appetite. Serious: tardive dyskinesia, neuroleptic malignant syndrome, high blood sugar.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light and moisture." },
  quetiapine: { category: "Atypical Antipsychotic", use: "Used to treat schizophrenia, bipolar disorder, and as add-on treatment for depression. Affects multiple brain chemicals including dopamine and serotonin.", directions: "Take 1-3 times daily as directed. Extended-release: take once daily, preferably in the evening. Swallow ER tablets whole.", warnings: "Not approved for elderly dementia patients. May cause weight gain, high blood sugar, and high cholesterol. Regular blood tests may be needed.", sideEffects: "Common: drowsiness, dizziness, dry mouth, constipation, weight gain. Serious: tardive dyskinesia, NMS, metabolic changes, suicidal thoughts.", storage: "Store at room temperature 77°F (25°C)." },
  lamotrigine: { category: "Anticonvulsant / Mood Stabilizer", use: "Used to treat seizures (epilepsy) and to stabilize mood in bipolar disorder. Works by reducing abnormal electrical activity in the brain.", directions: "Take once or twice daily with or without food. Must be started at a very low dose and increased slowly. Do not stop suddenly — may trigger seizures.", warnings: "SERIOUS RASH WARNING: Seek emergency help immediately if you develop a rash, especially in the first 2-8 weeks. Tell your doctor if you have kidney or liver disease.", sideEffects: "Common: dizziness, headache, blurred vision, nausea, insomnia. Serious: Stevens-Johnson Syndrome (severe rash), aseptic meningitis, blood disorders.", storage: "Store at room temperature 77°F (25°C). Protect from light." },
  topiramate: { category: "Anticonvulsant", use: "Used to prevent seizures and migraines. Also sometimes used for weight management. Works by calming overactive nerve signals in the brain.", directions: "Take twice daily with or without food. Drink plenty of water to prevent kidney stones. Swallow tablets whole or sprinkle capsule contents on soft food.", warnings: "May cause cognitive difficulties ('brain fog'). Increases risk of kidney stones — stay well hydrated. Tell your doctor if you have eye problems or metabolic acidosis.", sideEffects: "Common: tingling in hands/feet, taste changes, fatigue, difficulty concentrating, weight loss. Serious: kidney stones, vision problems, metabolic acidosis.", storage: "Store at room temperature 59-77°F (15-25°C). Protect from moisture." },
  potassium: { category: "Electrolyte Supplement", use: "Used to treat or prevent low potassium levels (hypokalemia), often caused by diuretics. Potassium is essential for heart, muscle, and nerve function.", directions: "Take with food and a full glass of water. Swallow tablets whole — do not crush or chew extended-release forms. Take doses evenly spaced throughout the day.", warnings: "Do not take if you have high potassium. Tell your doctor if you have kidney disease or are taking ACE inhibitors, ARBs, or potassium-sparing diuretics.", sideEffects: "Common: nausea, vomiting, diarrhea, gas. Serious: high potassium (irregular heartbeat, weakness, numbness), GI ulceration from tablets.", storage: "Store at room temperature 68-77°F (20-25°C). Keep in original container." },
  naproxen: { category: "NSAID", use: "Used to relieve pain from arthritis, menstrual cramps, tendinitis, gout, and other conditions. Also reduces fever and inflammation.", directions: "Take with food, milk, or an antacid to prevent stomach upset. Take with a full glass of water. Use the lowest effective dose for the shortest duration.", warnings: "May increase risk of heart attack or stroke with long-term use. Risk of stomach bleeding — especially in elderly. Tell your doctor about kidney, heart, or liver disease.", sideEffects: "Common: stomach upset, nausea, headache, dizziness, drowsiness. Serious: stomach bleeding/ulcers, kidney problems, cardiovascular events.", storage: "Store at room temperature 59-77°F (15-25°C). Protect from moisture and light." },
  ondansetron: { category: "Anti-nausea", use: "Used to prevent nausea and vomiting caused by chemotherapy, radiation, surgery, or other medical conditions. Works by blocking serotonin in the gut and brain.", directions: "Take as directed — usually 30 minutes before chemotherapy or 1 hour before surgery. Dissolving tablets: place on tongue and swallow with saliva.", warnings: "May cause heart rhythm changes (QT prolongation). Tell your doctor if you have heart disease, liver problems, or electrolyte imbalances.", sideEffects: "Common: headache, constipation, dizziness, fatigue. Serious: irregular heartbeat, serotonin syndrome, allergic reactions.", storage: "Store at room temperature 36-86°F (2-30°C). Protect from light. Keep dissolving tablets in blister pack until use." },
  buspirone: { category: "Anxiolytic", use: "Used to treat generalized anxiety disorder (GAD). Unlike benzodiazepines, it is not habit-forming and does not cause significant sedation.", directions: "Take 2-3 times daily with or without food (but be consistent). Takes 1-2 weeks to start working and up to 4 weeks for full effect.", warnings: "Do not take with MAO inhibitors. Avoid large amounts of grapefruit juice. Tell your doctor if you have kidney or liver disease. Not effective for immediate anxiety relief.", sideEffects: "Common: dizziness, nausea, headache, nervousness, lightheadedness, excitement. Serious: chest pain, serotonin syndrome (with other serotonergic drugs).", storage: "Store at room temperature 77°F (25°C). Protect from light." },
  mirtazapine: { category: "Antidepressant", use: "Used to treat major depressive disorder. Works differently from SSRIs by increasing both norepinephrine and serotonin. Often helps with sleep and appetite.", directions: "Take once daily at bedtime. Can be taken with or without food. Dissolving tablets: place on tongue — do not swallow whole or chew.", warnings: "May increase suicidal thoughts in young adults. Causes significant drowsiness — take at bedtime. May cause weight gain. Do not combine with MAO inhibitors.", sideEffects: "Common: drowsiness, increased appetite, weight gain, dry mouth, dizziness. Serious: serotonin syndrome, agranulocytosis (rare), seizures.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light and moisture." },
  pravastatin: { category: "Statin (Cholesterol)", use: "Used to lower cholesterol and reduce the risk of heart disease and stroke. Less likely to cause drug interactions than some other statins.", directions: "Take once daily, with or without food, at any time of day. Follow a healthy diet and exercise program as directed by your doctor.", warnings: "Report unexplained muscle pain immediately. Tell your doctor about liver disease. Avoid excessive alcohol. Regular liver function tests may be needed.", sideEffects: "Common: headache, nausea, muscle pain, diarrhea. Serious: rhabdomyolysis, liver damage, allergic reactions.", storage: "Store at room temperature 77°F (25°C). Protect from moisture and light." },
  glipizide: { category: "Sulfonylurea (Diabetes)", use: "Used to control blood sugar in type 2 diabetes. Works by stimulating the pancreas to produce more insulin.", directions: "Take 30 minutes before a meal, usually breakfast. Extended-release: take with breakfast. Do not crush or chew ER tablets.", warnings: "Can cause low blood sugar (hypoglycemia). Eat regular meals. Carry glucose tablets or candy. Tell your doctor about kidney or liver disease.", sideEffects: "Common: nausea, diarrhea, dizziness, headache. Serious: severe low blood sugar, liver problems, blood disorders.", storage: "Store at room temperature 59-86°F (15-30°C)." },
  diclofenac: { category: "NSAID", use: "Used to relieve pain and inflammation from arthritis, menstrual cramps, and other conditions. Available in oral, topical, and injectable forms.", directions: "Take with food or milk. Take with a full glass of water. For topical gel: apply to affected area and avoid sun exposure on treated skin.", warnings: "Cardiovascular risk with long-term use. Risk of GI bleeding — especially elderly. Avoid in severe heart failure. Tell your doctor about all medical conditions.", sideEffects: "Common: stomach pain, nausea, headache, dizziness, rash. Serious: GI bleeding, cardiovascular events, liver/kidney problems.", storage: "Store at room temperature 68-77°F (20-25°C). Protect topical forms from heat." },
  aripiprazole: { category: "Atypical Antipsychotic", use: "Used to treat schizophrenia, bipolar disorder, depression (as add-on), Tourette's, and irritability in autism. Works as a partial dopamine agonist.", directions: "Take once daily with or without food. Available as tablets, dissolving tablets, liquid, and injection.", warnings: "Not approved for elderly dementia patients. May cause compulsive behaviors (gambling, eating). Monitor for metabolic changes. May increase suicidal thoughts in young adults.", sideEffects: "Common: nausea, vomiting, constipation, headache, dizziness, insomnia, restlessness. Serious: tardive dyskinesia, NMS, compulsive behaviors.", storage: "Store at room temperature 77°F (25°C). Protect from moisture." },
  levetiracetam: { category: "Anticonvulsant", use: "Used to treat seizures (epilepsy) in adults and children. Works by reducing abnormal electrical activity in the brain.", directions: "Take twice daily, with or without food. Swallow tablets whole. Measure liquid doses carefully. Do not stop suddenly.", warnings: "May cause mood/behavioral changes — monitor for depression, aggression, or irritability. Tell your doctor about kidney disease. Must be tapered to discontinue.", sideEffects: "Common: drowsiness, weakness, dizziness, mood changes, runny nose. Serious: severe mood changes, suicidal thoughts, allergic reactions.", storage: "Store at room temperature 77°F (25°C)." },
  olanzapine: { category: "Atypical Antipsychotic", use: "Used to treat schizophrenia and bipolar disorder. Works by balancing dopamine and serotonin to help with thinking, mood, and behavior.", directions: "Take once daily with or without food. Dissolving tablets: place on tongue — dissolves in seconds.", warnings: "Significant weight gain and metabolic effects common. Monitor blood sugar and cholesterol regularly. Not approved for elderly with dementia. Causes drowsiness.", sideEffects: "Common: weight gain, increased appetite, drowsiness, dizziness, dry mouth. Serious: diabetes, high cholesterol, tardive dyskinesia, NMS.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light and moisture." },
  benazepril: { category: "ACE Inhibitor", use: "Used to treat high blood pressure and heart failure. Helps protect the kidneys in diabetic patients.", directions: "Take once or twice daily with or without food. Continue even if you feel well.", warnings: "Do not use if pregnant. May cause dry cough. Tell your doctor about kidney disease. Avoid potassium supplements unless directed.", sideEffects: "Common: cough, dizziness, headache, fatigue. Serious: angioedema (swelling), high potassium, kidney problems.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from moisture." },
  valsartan: { category: "ARB (Blood Pressure)", use: "Used to treat high blood pressure and heart failure. Also used after a heart attack to improve survival.", directions: "Take once or twice daily with or without food. Take at the same time each day.", warnings: "Do not use if pregnant. May cause high potassium. Tell your doctor about kidney or liver disease.", sideEffects: "Common: dizziness, diarrhea, back pain, fatigue. Serious: kidney problems, high potassium, low blood pressure.", storage: "Store at room temperature 59-86°F (15-30°C). Protect from moisture." },
  paroxetine: { category: "SSRI Antidepressant", use: "Used to treat depression, anxiety disorders, OCD, PTSD, and premenstrual dysphoric disorder.", directions: "Take once daily, usually in the morning, with or without food. Do not stop suddenly — must be tapered gradually.", warnings: "May increase suicidal thoughts in young adults. Known for withdrawal symptoms — do not stop abruptly. Not recommended during pregnancy. Avoid MAO inhibitors.", sideEffects: "Common: nausea, drowsiness, dizziness, insomnia, dry mouth, weight gain. Serious: serotonin syndrome, abnormal bleeding, withdrawal symptoms.", storage: "Store at room temperature 59-86°F (15-30°C)." },
  amitriptyline: { category: "Tricyclic Antidepressant", use: "Used to treat depression and chronic pain conditions including migraines, fibromyalgia, and nerve pain.", directions: "Usually taken at bedtime due to sedating effects. Start at low dose and increase gradually. Do not stop suddenly.", warnings: "Overdose can be fatal — store safely. May cause drowsiness, dry mouth, and constipation. Tell your doctor about heart disease, glaucoma, or urinary problems.", sideEffects: "Common: drowsiness, dry mouth, constipation, blurred vision, weight gain, dizziness. Serious: heart rhythm changes, seizures, serotonin syndrome.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light." },
  pramipexole: { category: "Dopamine Agonist", use: "Used to treat Parkinson's disease symptoms and restless legs syndrome (RLS). Works by mimicking dopamine in the brain.", directions: "Take 3 times daily for Parkinson's. For RLS, take once daily 2-3 hours before bedtime. Take with or without food.", warnings: "May cause sleep attacks — avoid driving if drowsy. May cause compulsive behaviors (gambling, shopping). Tell your doctor about kidney problems.", sideEffects: "Common: nausea, dizziness, drowsiness, insomnia, constipation. Serious: sudden sleep episodes, hallucinations, compulsive behaviors, orthostatic hypotension.", storage: "Store at room temperature 77°F (25°C). Protect from light." },
  nortriptyline: { category: "Tricyclic Antidepressant", use: "Used to treat depression and nerve pain. Sometimes used for migraines and ADHD. Works by increasing norepinephrine and serotonin.", directions: "Usually taken 1-4 times daily. May be taken at bedtime if drowsiness is an issue.", warnings: "Overdose can be dangerous. May cause heart rhythm changes. Tell your doctor about heart disease, glaucoma, or seizure history.", sideEffects: "Common: drowsiness, dry mouth, constipation, blurred vision, weight gain. Serious: heart arrhythmias, seizures, suicidal thoughts in young adults.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light." },
  minocycline: { category: "Antibiotic", use: "Used to treat acne, respiratory infections, urinary tract infections, and other bacterial infections. A type of tetracycline antibiotic.", directions: "Take with a full glass of water. Can be taken with or without food. Complete the full course of treatment.", warnings: "Causes sun sensitivity. May cause permanent tooth discoloration in children. Not for pregnant women. May cause dizziness or vertigo.", sideEffects: "Common: nausea, dizziness, diarrhea, skin discoloration, sun sensitivity. Serious: liver damage, lupus-like syndrome, intracranial hypertension.", storage: "Store at room temperature 68-77°F (20-25°C). Protect from light, moisture, and heat." },
  loperamide: { category: "Antidiarrheal", use: "Used to treat diarrhea by slowing gut movement and reducing the number of bowel movements. Available over-the-counter.", directions: "Take after each loose stool as directed. Do not exceed recommended dose. Drink plenty of clear fluids to prevent dehydration.", warnings: "Do not use if you have bloody diarrhea or fever. Do not exceed recommended dose — high doses can cause serious heart problems. Stop if diarrhea lasts more than 2 days.", sideEffects: "Common: constipation, dizziness, nausea, stomach cramps. Serious: severe constipation, heart rhythm problems (overdose), allergic reactions.", storage: "Store at room temperature 59-86°F (15-30°C)." },
}

/* ─── Parse pill name ─── */
function parsePillName(name: string) {
  const forms = ["Tablet", "Capsule", "Solution", "Suspension", "Injection", "Cream", "Ointment", "Gel", "Patch", "Inhaler", "Drops", "Spray", "Powder", "Lozenge", "Suppository", "Film", "Granules", "Syrup"]
  const routes = ["Oral", "Topical", "Ophthalmic", "Nasal", "Rectal", "Sublingual", "Transdermal", "Inhalation", "Injectable"]
  const strengthMatch = name.match(/(\d+\.?\d*)\s*(MG|MCG|ML|MG\/ML|%|UNITS?|MEQ)/i)
  const formMatch = forms.find(f => name.toLowerCase().includes(f.toLowerCase()))
  const routeMatch = routes.find(r => name.toLowerCase().includes(r.toLowerCase()))
  const drugName = name.split(/\d/)[0].trim().replace(/\s+(hydrochloride|besylate|mesylate|succinate|tartrate|maleate|fumarate|sodium|potassium|calcium|extended|delayed|release)/gi, "").trim()
  return { drugName, strength: strengthMatch ? `${strengthMatch[1]} ${strengthMatch[2].toUpperCase()}` : null, form: formMatch || null, route: routeMatch || null }
}

function lookupDrug(name: string) {
  const lower = name.toLowerCase()
  for (const [key, info] of Object.entries(drugDB)) {
    if (lower.includes(key)) return info
  }
  return null
}

/* ─── Component ─── */
export default function PillFinderPage() {
  const [q, setQ] = useState("")
  const [showDisclaimer, setShowDisclaimer] = useState(true)
  const [selected, setSelected] = useState<(typeof pills)[0] | null>(null)
  const [tab, setTab] = useState("overview")

  useEffect(() => { setShowDisclaimer(true) }, [])

  const filteredPills = useMemo(() => q.trim().length === 0 ? [] : pills.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [q])

  const parsed = selected ? parsePillName(selected.name) : null
  const info = selected ? lookupDrug(selected.name) : null

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "directions", label: "Directions" },
    { id: "warnings", label: "Warnings" },
    { id: "sideEffects", label: "Side Effects" },
    { id: "storage", label: "Storage" },
  ]

  return (
    <>
      {/* Disclaimer */}
      <Dialog open={showDisclaimer}>
        <DialogContent className="max-w-xl rounded-2xl border-0 bg-white shadow-2xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            </div>
            <DialogTitle className="text-center text-xl font-semibold">Medical Disclaimer</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-600">
            <p>This Pill Finder is provided for <strong>educational purposes only</strong>. It is not intended to replace consultation with a qualified healthcare professional.</p>
            <p>Always seek the advice of your physician or pharmacist regarding a medical condition. Never disregard medical advice or delay seeking care because of something you read here.</p>
            <p className="font-medium text-gray-800">If you are experiencing a medical emergency, please call <span className="text-red-600 font-bold">911</span>.</p>
          </div>
          <DialogFooter className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => (window.location.href = "/")}>Back to Home</Button>
            <Button onClick={() => setShowDisclaimer(false)} className="bg-emerald-600 text-white hover:bg-emerald-700 px-6">I Understand — Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page */}
      <div className="min-h-screen bg-[#F7F5EF]">
        {/* Hero */}
        <section className="relative isolate overflow-hidden" style={{ background: "linear-gradient(135deg, #0EA171 0%, #0B8F79 50%, #0B7C79 100%)" }}>
          <div className="mx-auto max-w-5xl px-6 py-16 text-center md:py-20">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            </div>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">Pill Identifier & Drug Info</h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-white/85">Search {pills.length.toLocaleString()}+ medications — click any pill for drug facts, directions, warnings, and side effects.</p>
            <div className="mx-auto mt-8 max-w-xl">
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by medication name (e.g. Lisinopril, Metformin...)" disabled={showDisclaimer} className="h-14 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50" />
              </div>
              {q.trim() && !showDisclaimer && <p className="mt-3 text-sm text-white/80">Found <strong className="text-white">{filteredPills.length}</strong> result{filteredPills.length !== 1 ? "s" : ""}</p>}
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="mx-auto max-w-6xl px-6 py-10">
          {q.trim() && !showDisclaimer ? (
            filteredPills.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredPills.map(pill => (
                  <button key={pill.id} onClick={() => { setSelected(pill); setTab("overview") }} className="group overflow-hidden rounded-xl border border-emerald-900/10 bg-white text-left shadow-sm transition hover:shadow-lg hover:border-emerald-300">
                    <div className="flex h-36 items-center justify-center border-b bg-white p-3">
                      <img src={pill.image.startsWith("/") ? pill.image : `/images/pills/600/${pill.image}`} alt={pill.name} className="max-h-full max-w-full object-contain transition group-hover:scale-105" onError={e => ((e.target as HTMLImageElement).src = "/placeholder-pill.png")} />
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-medium leading-snug text-gray-800 line-clamp-3">{pill.name}</h3>
                      <p className="mt-1 text-[10px] text-emerald-600 font-medium">Click for drug info →</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-white py-16 text-center">
                <h3 className="text-lg font-medium">No pills found for &quot;{q}&quot;</h3>
                <p className="mt-2 text-sm text-gray-500">Try a different spelling or generic name</p>
              </div>
            )
          ) : !showDisclaimer ? (
            <div className="space-y-10">
              <div>
                <h2 className="mb-5 text-center text-xl font-semibold text-gray-900">Popular Searches</h2>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Lisinopril", "Metformin", "Amoxicillin", "Omeprazole", "Atorvastatin", "Amlodipine", "Gabapentin", "Losartan", "Levothyroxine", "Ibuprofen", "Sertraline", "Prednisone"].map(n => (
                    <button key={n} onClick={() => setQ(n)} className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm hover:border-emerald-400 hover:bg-emerald-50">{n}</button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-700 p-8 text-center text-white shadow-lg">
                <h3 className="mb-2 text-xl font-semibold">Need Help Identifying a Medication?</h3>
                <p className="mx-auto mb-5 max-w-lg text-sm text-emerald-100">Click on any pill in the search results to see detailed drug facts, directions, warnings, and side effects.</p>
                <a href="tel:5085644459" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow hover:bg-emerald-50">📞 (508) 564-4459</a>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* Drug Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="border-b bg-gradient-to-r from-emerald-600 to-emerald-700 p-5 text-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">{parsed?.drugName || selected.name}</h2>
                  <p className="mt-1 text-sm text-emerald-100">{selected.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parsed?.strength && <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium">{parsed.strength}</span>}
                    {parsed?.form && <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium">{parsed.form}</span>}
                    {parsed?.route && <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium">{parsed.route}</span>}
                    {info?.category && <span className="rounded-full bg-white/30 px-3 py-0.5 text-xs font-semibold">{info.category}</span>}
                  </div>
                </div>
                <div className="ml-4 h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white/30 bg-white p-1">
                  <img src={selected.image.startsWith("/") ? selected.image : `/images/pills/600/${selected.image}`} alt={selected.name} className="h-full w-full object-contain" onError={e => ((e.target as HTMLImageElement).src = "/placeholder-pill.png")} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 overflow-x-auto border-b bg-gray-50">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap px-5 py-3 text-sm font-medium transition ${tab === t.id ? "border-b-2 border-emerald-600 bg-white text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-[50vh] overflow-y-auto p-5">
              {info ? (
                <>
                  {tab === "overview" && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">💊</span> What is this drug used for?</h3>
                        <p className="text-sm leading-relaxed text-gray-600">{info.use}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {parsed?.strength && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Strength</p><p className="font-semibold text-gray-900">{parsed.strength}</p></div>}
                        {parsed?.form && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Form</p><p className="font-semibold text-gray-900">{parsed.form}</p></div>}
                        {parsed?.route && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Route</p><p className="font-semibold text-gray-900">{parsed.route}</p></div>}
                        {info.category && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Category</p><p className="font-semibold text-gray-900">{info.category}</p></div>}
                      </div>
                    </div>
                  )}
                  {tab === "directions" && <div><h3 className="mb-3 font-semibold text-gray-900">Directions</h3><p className="text-sm leading-relaxed text-gray-600">{info.directions}</p></div>}
                  {tab === "warnings" && <div><h3 className="mb-3 font-semibold text-red-700">⚠️ Warnings</h3><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">{info.warnings}</div></div>}
                  {tab === "sideEffects" && <div><h3 className="mb-3 font-semibold text-gray-900">Side Effects</h3><p className="text-sm leading-relaxed text-gray-600">{info.sideEffects}</p></div>}
                  {tab === "storage" && <div><h3 className="mb-3 font-semibold text-gray-900">Storage</h3><p className="text-sm leading-relaxed text-gray-600">{info.storage}</p></div>}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="mb-2 font-semibold text-amber-800">Drug Information</h3>
                    <p className="text-sm text-amber-700">Detailed drug facts for this specific medication are not yet in our database. Please consult your pharmacist at <strong>(508) 564-4459</strong> for complete information.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {parsed?.strength && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Strength</p><p className="font-semibold">{parsed.strength}</p></div>}
                    {parsed?.form && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Form</p><p className="font-semibold">{parsed.form}</p></div>}
                    {parsed?.route && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Route</p><p className="font-semibold">{parsed.route}</p></div>}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h4 className="mb-2 text-sm font-semibold">General Medication Safety</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• Always take medications as prescribed by your doctor</li>
                      <li>• Do not share your medication with others</li>
                      <li>• Store at room temperature unless directed otherwise</li>
                      <li>• Keep out of reach of children</li>
                      <li>• Check expiration date before taking</li>
                      <li>• Report any unusual side effects to your doctor</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Always show disclaimer at bottom */}
              <div className="mt-5 rounded-lg bg-gray-100 p-3 text-xs text-gray-500">
                <strong>Disclaimer:</strong> This information is for educational purposes only. Always consult your doctor or pharmacist for medical advice specific to your condition.
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t bg-gray-50 px-5 py-3">
              <a href="tel:5085644459" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">📞 Call Pharmacist</a>
              <button onClick={() => setSelected(null)} className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
