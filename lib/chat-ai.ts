// Chat AI: generates responses for the public website chatbot.
// Only knows general pharmacy info — NO patient data, NO PHI.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

const SYSTEM_PROMPT = `You are a friendly, professional AI assistant for North Falmouth Pharmacy, a long-term care pharmacy on Cape Cod, Massachusetts.

PHARMACY INFO:
- Address: 111 County Rd, North Falmouth, MA 02556
- Phone: (508) 564-4459
- Fax: (508) 564-6172
- Email: wecare@nfpltc.com
- Hours: Monday–Friday 8:30 AM to 4:30 PM EST. Closed weekends and holidays.
- Website: www.nfpltc.com

SERVICES:
- Long-term care pharmacy services for nursing homes, group homes, and assisted living
- Prescription medication management and delivery
- Blister packaging / compliance packaging
- Medication synchronization
- Vaccinations (flu, COVID, shingles, pneumonia)
- Prescription transfers from other pharmacies
- Monthly billing statements for facilities and individuals
- Over-the-counter medications and health supplies

HOW TO REFILL / TRANSFER:
- Call (508) 564-4459 during business hours
- Email wecare@nfpltc.com
- Use the forms on www.nfpltc.com

RULES:
- Be warm, concise, and helpful. Keep responses short (2-3 sentences usually).
- NEVER give medical advice, dosage info, or drug interaction info. Say "Please speak with your pharmacist about that."
- NEVER access or discuss specific patient accounts, balances, medications, or any personal data.
- If asked about a specific account/balance/prescription status, say you can't access patient records and suggest calling (508) 564-4459.
- If the customer seems frustrated, needs complex help, or asks to talk to a person, suggest they connect with the team using the "Talk to a Person" button.
- You are an AI assistant, not a pharmacist. Be transparent about this.
- Keep the conversation focused on pharmacy services and general health info.`

export interface ChatMessage {
  role: "user" | "assistant" | "admin"
  content: string
}

export async function generateChatResponse(
  messages: ChatMessage[]
): Promise<{ response: string; shouldEscalate: boolean }> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return { response: "I'm sorry, I'm not available right now. Please call us at (508) 564-4459.", shouldEscalate: false }
  }

  // Keep only last 8 messages to stay under token limits
  const recent = messages.slice(-8)

  try {
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...recent.map(m => ({
            role: m.role === "admin" ? "assistant" : m.role,
            content: m.content,
          })),
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
    })

    if (resp.status === 429) {
      return { response: "I'm a bit busy right now. Please try again in a moment, or call us at (508) 564-4459.", shouldEscalate: false }
    }

    if (!resp.ok) {
      return { response: "I'm having trouble right now. Please call us at (508) 564-4459 for immediate help.", shouldEscalate: false }
    }

    const data = await resp.json()
    const text = data?.choices?.[0]?.message?.content || ""

    // Check if the AI itself suggested escalation
    const shouldEscalate = /speak with|talk to (a |our |the )?(person|team|pharmacist|staff|someone)|call us|contact us directly/i.test(text)

    return { response: text, shouldEscalate }
  } catch {
    return { response: "I'm having trouble connecting. Please call us at (508) 564-4459.", shouldEscalate: false }
  }
}

// Generate an AI-suggested reply for the admin when a chat is escalated
export async function generateAdminSuggestion(
  messages: ChatMessage[]
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return ""

  const recent = messages.slice(-6)
  try {
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: `You are drafting a reply for a pharmacy staff member to send to a customer. The customer chatted on the North Falmouth Pharmacy website and asked to speak with a person. Write a helpful, warm, professional reply based on the conversation. Keep it concise (2-4 sentences). Do NOT include greetings like "Hi" — the system adds the customer's name automatically.` },
          { role: "user", content: `Here's the conversation:\n${recent.map(m => `${m.role}: ${m.content}`).join("\n")}\n\nDraft a reply for the pharmacy staff member to send:` },
        ],
        temperature: 0.6,
        max_tokens: 200,
      }),
    })
    if (!resp.ok) return ""
    const data = await resp.json()
    return data?.choices?.[0]?.message?.content?.trim() || ""
  } catch {
    return ""
  }
}
