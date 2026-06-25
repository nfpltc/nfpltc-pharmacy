import { createClient } from "@supabase/supabase-js"

// ============================================================================
// Admin AI tools — read-only database functions the assistant is allowed to
// call. This is the SAFE layer: the AI can only invoke these predefined
// functions; it can never write raw SQL, delete, or modify anything.
//
// Option B (PHI stays out of Groq): each tool returns TWO things:
//   - ai_summary: a NON-PHI string safe to send back to Groq (counts,
//     "found 1 customer", success/failure). This is what the AI "sees".
//   - display:    the actual data (may contain PHI) rendered as a card in
//     the admin chat UI. This NEVER goes to Groq.
// ============================================================================

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Paginate past the 1000-row PostgREST cap
async function fetchAll(client: any, table: string, columns: string, applyFilters?: (q: any) => any): Promise<any[]> {
  const out: any[] = []
  const PAGE = 1000
  let from = 0
  while (from < 200_000) {
    let q = client.from(table).select(columns).range(from, from + PAGE - 1)
    if (applyFilters) q = applyFilters(q)
    const { data } = await q
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

export interface ToolResult {
  ai_summary: string                       // safe to send to Groq (no PHI)
  display?: { type: string; data: any }    // rendered in UI, NEVER sent to Groq
}

// ── Tool schemas exposed to Groq (OpenAI function-calling format) ──────────
export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "search_customer",
      description: "Find a customer by name or account number. Returns their contact details and a summary of statements/emails on file. Use when the admin asks about a specific person.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Customer name (first, last, or both) or account number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_customers",
      description: "Count customers, optionally filtered. Filters: 'all', 'no_email' (no email on file), 'with_email', 'opted_out' (unsubscribed). Use for questions like 'how many customers have no email'.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["all", "no_email", "with_email", "opted_out"], description: "Which subset to count" },
        },
        required: ["filter"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_statements",
      description: "List the statements on file for a specific customer account number. Returns billing periods and view links.",
      parameters: {
        type: "object",
        properties: {
          account_number: { type: "string", description: "The customer's account number" },
        },
        required: ["account_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_form_submissions",
      description: "Count form submissions by type, optionally for a specific month. Types: 'enrollment', 'vaccine', 'credit_card', 'contact'. Use for 'how many enrollment forms this month'.",
      parameters: {
        type: "object",
        properties: {
          form_type: { type: "string", enum: ["enrollment", "vaccine", "credit_card", "contact"] },
          month: { type: "string", description: "Optional month as YYYY-MM, e.g. 2026-04. Omit for all-time count." },
        },
        required: ["form_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent_submissions",
      description: "List the most recent form submissions of a given type (default 10). Types: 'enrollment', 'vaccine', 'credit_card', 'contact'.",
      parameters: {
        type: "object",
        properties: {
          form_type: { type: "string", enum: ["enrollment", "vaccine", "credit_card", "contact"] },
          limit: { type: "number", description: "How many to return (max 25, default 10)" },
        },
        required: ["form_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_statements_by_period",
      description: "Show how many statements exist for each billing period. Use for 'how many statements do we have per month'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_email_history",
      description: "List the emails sent to a specific customer account (statement emails, blogs, custom emails). Use for 'what emails did we send to account X'.",
      parameters: {
        type: "object",
        properties: {
          account_number: { type: "string", description: "The customer's account number" },
        },
        required: ["account_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_submission_by_name",
      description: "Find form submissions (enrollment, vaccine, credit card, contact) from a person by their name. Searches across all form types. Use for 'did John Smith submit any forms'.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "First name, last name, or both" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_submissions_by_status",
      description: "Count form submissions of a type broken down by status (e.g. pending, processing, completed). Use for 'how many pending enrollments'.",
      parameters: {
        type: "object",
        properties: {
          form_type: { type: "string", enum: ["enrollment", "vaccine", "credit_card", "contact"] },
        },
        required: ["form_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_statement_search_activity",
      description: "Show recent statement-search activity from the public statements page — who searched and whether they found a statement. Use for 'who has been looking up statements'.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "How many recent searches to show (max 25, default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_blog_stats",
      description: "Get blog statistics — total published posts and the most recent one. Use for 'how many blogs do we have' or 'what's the latest blog'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
]

// ── Tool executors ─────────────────────────────────────────────────────────
const FORM_TABLES: Record<string, string> = {
  enrollment: "enrollment_submissions",
  vaccine: "vaccine_submissions",
  credit_card: "credit_card_submissions",
  contact: "contact_submissions",
}

export async function executeTool(name: string, args: any): Promise<ToolResult> {
  const client = sb()

  switch (name) {
    // ── Customer lookup (PHI → card only) ────────────────────────────────
    case "search_customer": {
      const query = String(args.query || "").trim()
      if (!query) return { ai_summary: "No search query provided." }

      // Try account number exact match first, then name
      let { data: byAcct } = await client
        .from("customers")
        .select("*")
        .eq("account_number", query)
        .maybeSingle()

      let matches: any[] = byAcct ? [byAcct] : []
      if (matches.length === 0) {
        const { data: byName } = await client
          .from("customers")
          .select("*")
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
          .limit(10)
        matches = byName || []
      }

      if (matches.length === 0) {
        return { ai_summary: `No customer found matching "${query}".` }
      }

      // Enrich each match with statement + email counts
      const enriched = await Promise.all(matches.map(async (c: any) => {
        const { count: stmtCount } = await client
          .from("customer_statements")
          .select("id", { count: "exact", head: true })
          .eq("account_number", c.account_number)
        return { ...c, statement_count: stmtCount ?? 0 }
      }))

      // ai_summary contains NO PHI — just counts and existence
      const summary = matches.length === 1
        ? `Found 1 customer matching "${query}". Their full details are shown to the admin in a card. Has email: ${matches[0].email ? "yes" : "no"}. Statements on file: ${enriched[0].statement_count}.`
        : `Found ${matches.length} customers matching "${query}". They are listed for the admin.`

      return {
        ai_summary: summary,
        display: { type: "customer_list", data: enriched },
      }
    }

    // ── Counts (safe — numbers only, no PHI) ─────────────────────────────
    case "count_customers": {
      const filter = String(args.filter || "all")
      let applyFilters: ((q: any) => any) | undefined
      if (filter === "no_email") applyFilters = (q) => q.or("email.is.null,email.eq.")
      else if (filter === "with_email") applyFilters = (q) => q.not("email", "is", null).neq("email", "")
      else if (filter === "opted_out") applyFilters = (q) => q.eq("email_opt_in", false)

      const rows = await fetchAll(client, "customers", "account_number", applyFilters)
      const label = { all: "total", no_email: "with no email", with_email: "with an email", opted_out: "opted out" }[filter] || filter
      return { ai_summary: `There are ${rows.length} customers ${label}.` }
    }

    // ── Statements for an account (semi-PHI → card) ──────────────────────
    case "get_customer_statements": {
      const account = String(args.account_number || "").trim()
      if (!account) return { ai_summary: "No account number provided." }

      const { data: statements } = await client
        .from("customer_statements")
        .select("id, first_name, last_name, account_number, billing_period, bill_date")
        .eq("account_number", account)
        .order("billing_period", { ascending: false })

      if (!statements || statements.length === 0) {
        return { ai_summary: `No statements found for account ${account}.` }
      }
      return {
        ai_summary: `Account ${account} has ${statements.length} statements on file. They are displayed to the admin with view links.`,
        display: { type: "statement_list", data: statements },
      }
    }

    // ── Form counts (safe — numbers only) ────────────────────────────────
    case "count_form_submissions": {
      const formType = String(args.form_type || "")
      const table = FORM_TABLES[formType]
      if (!table) return { ai_summary: `Unknown form type "${formType}".` }

      const month = args.month ? String(args.month) : null
      let q = client.from(table).select("id", { count: "exact", head: true })
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const start = `${month}-01`
        const [y, m] = month.split("-").map(Number)
        const endDate = new Date(y, m, 1).toISOString().slice(0, 10)  // first of next month
        q = q.gte("created_at", start).lt("created_at", endDate)
      }
      const { count } = await q
      const when = month ? `in ${month}` : "in total"
      return { ai_summary: `There are ${count ?? 0} ${formType} submissions ${when}.` }
    }

    // ── Recent submissions (PHI → card) ──────────────────────────────────
    case "list_recent_submissions": {
      const formType = String(args.form_type || "")
      const table = FORM_TABLES[formType]
      if (!table) return { ai_summary: `Unknown form type "${formType}".` }

      const limit = Math.min(25, Math.max(1, parseInt(args.limit) || 10))
      const { data } = await client
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

      if (!data || data.length === 0) {
        return { ai_summary: `No ${formType} submissions found.` }
      }
      return {
        ai_summary: `Showing the ${data.length} most recent ${formType} submissions to the admin in a list.`,
        display: { type: "submission_list", data: { form_type: formType, rows: data } },
      }
    }

    // ── Statements per period (safe — aggregate counts) ──────────────────
    case "count_statements_by_period": {
      const rows = await fetchAll(client, "customer_statements", "billing_period")
      const counts: Record<string, number> = {}
      for (const r of rows) {
        if (r.billing_period) counts[r.billing_period] = (counts[r.billing_period] || 0) + 1
      }
      const sorted = Object.entries(counts).sort((a, b) => b[0].localeCompare(a[0]))
      const summary = sorted.map(([p, n]) => `${p}: ${n}`).join(", ")
      return {
        ai_summary: `Statements per billing period — ${summary || "none"}.`,
        display: { type: "period_counts", data: sorted.map(([period, count]) => ({ period, count })) },
      }
    }

    // ── Customer email history (semi-PHI → card) ─────────────────────────
    case "get_customer_email_history": {
      const account = String(args.account_number || "").trim()
      if (!account) return { ai_summary: "No account number provided." }

      // Pull from both statement_email_log and customer_email_log
      const [stmtEmails, custEmails] = await Promise.all([
        client.from("statement_email_log")
          .select("billing_period, email_to, status, sent_at")
          .eq("account_number", account)
          .order("sent_at", { ascending: false })
          .limit(50),
        client.from("customer_email_log")
          .select("email_type, subject, status, sent_at")
          .eq("account_number", account)
          .order("sent_at", { ascending: false })
          .limit(50)
          .then((r: any) => r, () => ({ data: [] })),
      ])

      const combined = [
        ...(stmtEmails.data || []).map((e: any) => ({
          type: "statement", subject: `Statement ${e.billing_period || ""}`, status: e.status, sent_at: e.sent_at,
        })),
        ...((custEmails as any).data || []).map((e: any) => ({
          type: e.email_type || "custom", subject: e.subject || "", status: e.status, sent_at: e.sent_at,
        })),
      ].sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""))

      if (combined.length === 0) {
        return { ai_summary: `No emails have been sent to account ${account}.` }
      }
      return {
        ai_summary: `${combined.length} emails have been sent to account ${account}. They are listed for the admin.`,
        display: { type: "email_history", data: combined },
      }
    }

    // ── Search submissions by name (PHI → card) ──────────────────────────
    case "search_submission_by_name": {
      const name = String(args.name || "").trim()
      if (!name) return { ai_summary: "No name provided." }

      const found: any[] = []
      for (const [type, table] of Object.entries(FORM_TABLES)) {
        const { data } = await client
          .from(table)
          .select("*")
          .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
          .order("created_at", { ascending: false })
          .limit(10)
        for (const row of (data || [])) found.push({ form_type: type, ...row })
      }

      if (found.length === 0) {
        return { ai_summary: `No form submissions found for "${name}".` }
      }
      // Sort newest first across all types
      found.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      return {
        ai_summary: `Found ${found.length} form submissions matching "${name}" across all form types. Listed for the admin.`,
        display: { type: "submission_list", data: { form_type: "matching", rows: found } },
      }
    }

    // ── Submission counts by status (safe — numbers) ─────────────────────
    case "count_submissions_by_status": {
      const formType = String(args.form_type || "")
      const table = FORM_TABLES[formType]
      if (!table) return { ai_summary: `Unknown form type "${formType}".` }

      const rows = await fetchAll(client, table, "status")
      const byStatus: Record<string, number> = {}
      for (const r of rows) {
        const s = r.status || "unknown"
        byStatus[s] = (byStatus[s] || 0) + 1
      }
      const summary = Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(", ")
      return { ai_summary: `${formType} submissions by status: ${summary || "none"}.` }
    }

    // ── Statement search activity (PHI → card) ───────────────────────────
    case "get_statement_search_activity": {
      const limit = Math.min(25, Math.max(1, parseInt(args.limit) || 10))
      const { data } = await client
        .from("statement_viewer_log")
        .select("name, account_number_attempted, statement_viewed, searched_at, ip_address")
        .order("searched_at", { ascending: false })
        .limit(limit)

      if (!data || data.length === 0) {
        return { ai_summary: "No statement search activity recorded yet." }
      }
      const foundCount = data.filter((d: any) => d.statement_viewed).length
      return {
        ai_summary: `Showing the ${data.length} most recent statement searches (${foundCount} found a match). Listed for the admin.`,
        display: { type: "search_activity", data },
      }
    }

    // ── Blog stats (safe — counts + latest title) ────────────────────────
    case "get_blog_stats": {
      const { count } = await client
        .from("blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
      const { data: latest } = await client
        .from("blog_posts")
        .select("title, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
      const latestTitle = latest?.[0]?.title
      return {
        ai_summary: latestTitle
          ? `There are ${count ?? 0} published blog posts. The most recent is "${latestTitle}".`
          : `There are ${count ?? 0} published blog posts.`,
      }
    }

    default:
      return { ai_summary: `Unknown tool "${name}".` }
  }
}
