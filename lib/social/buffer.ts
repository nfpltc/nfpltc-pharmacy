/**
 * Buffer GraphQL client for posting to LinkedIn, X (Twitter) and Instagram.
 *
 * CRITICAL Buffer gotchas (baked in below):
 *  - Buffer uses `organizations` (plural array), NOT `currentOrganization`.
 *    Unknown fields return null silently, which is how most integrations break.
 *  - Service values are "linkedin" | "instagram" | "twitter" (never "x").
 *  - createPost returns a union — you must inspect __typename for errors.
 *
 * The bearer token lives in a Supabase `connectors` row: { id:"buffer",
 * bearer_token:"..." }. Falls back to a BUFFER_ACCESS_TOKEN env var.
 */
import { supabaseAdmin } from "./db"

const BUFFER_GQL = "https://api.buffer.com/graphql"

export async function getBufferToken(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("connectors")
      .select("bearer_token")
      .eq("id", "buffer")
      .maybeSingle()
    if (data?.bearer_token) return data.bearer_token as string
  } catch {
    /* connectors table not migrated — fall back to env */
  }
  return process.env.BUFFER_ACCESS_TOKEN || null
}

export async function bufferGql<T = any>(
  query: string,
  variables: any,
  token?: string,
): Promise<{ data: T | null; errors: any; status: number }> {
  const t = token || (await getBufferToken())
  if (!t) return { data: null, errors: [{ message: "No Buffer token configured" }], status: 0 }
  try {
    const r = await fetch(BUFFER_GQL, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    })
    const json = await r.json().catch(() => null)
    return { data: json?.data ?? null, errors: json?.errors ?? null, status: r.status }
  } catch (e) {
    return { data: null, errors: [{ message: (e as Error).message }], status: 0 }
  }
}

export type Platform = "linkedin" | "x" | "instagram" | "other"

// Buffer returns "linkedin" | "instagram" | "twitter"; normalize with startsWith.
export function normalizeService(s: string): Platform {
  const x = (s || "").toLowerCase()
  if (x.startsWith("linkedin")) return "linkedin"
  if (x.startsWith("twitter") || x === "x") return "x"
  if (x.startsWith("instagram")) return "instagram"
  return "other"
}

export async function getOrgId(token?: string): Promise<string | null> {
  const { data } = await bufferGql(
    `query { account { id name email organizations { id name } } }`,
    {},
    token,
  )
  return (data as any)?.account?.organizations?.[0]?.id ?? null
}

export interface BufferChannel {
  id: string
  name: string
  service: string
  platform: Platform
  displayName?: string
  avatar?: string
}

export async function getChannels(token?: string): Promise<{ channels: BufferChannel[]; error?: string }> {
  const t = token || (await getBufferToken())
  if (!t) return { channels: [], error: "No Buffer token. Add a connectors row { id:'buffer', bearer_token }." }
  const orgId = await getOrgId(t)
  if (!orgId) return { channels: [], error: "Could not read your Buffer organization — check the token." }
  const { data, errors } = await bufferGql(
    `query($id: OrganizationId!) {
      channels(input: { organizationId: $id }) {
        id name service serviceId displayName avatar isDisconnected
      }
    }`,
    { id: orgId },
    t,
  )
  const raw = (data as any)?.channels
  if (!raw) return { channels: [], error: errors ? JSON.stringify(errors) : "No channels returned by Buffer." }
  const channels: BufferChannel[] = raw
    .filter((c: any) => !c.isDisconnected)
    .map((c: any) => ({
      id: c.id,
      name: c.displayName || c.name,
      service: c.service,
      platform: normalizeService(c.service),
      displayName: c.displayName,
      avatar: c.avatar,
    }))
  return { channels }
}

export type BufferMode = "shareNow" | "addToQueue" | "shareNext" | "customScheduled"

export async function createPost(opts: {
  channelId: string
  text: string
  mode: BufferMode
  imageUrl?: string
  dueAt?: string
  token?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const input: any = { channelId: opts.channelId, text: opts.text, mode: opts.mode }
  if (opts.imageUrl) input.assets = [{ image: { url: opts.imageUrl } }]
  if (opts.mode === "customScheduled" && opts.dueAt) input.dueAt = opts.dueAt

  const query = `mutation($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id status text dueAt } }
      ... on NotFoundError { message }
      ... on UnauthorizedError { message }
      ... on UnexpectedError { message }
      ... on InvalidInputError { message }
      ... on LimitReachedError { message }
      ... on RestProxyError { message link code }
    }
  }`
  const { data, errors, status } = await bufferGql(query, { input }, opts.token)
  if (status !== 200 || errors) {
    return { ok: false, error: errors ? JSON.stringify(errors) : `Buffer HTTP ${status}` }
  }
  const res = (data as any)?.createPost
  if (res?.__typename === "PostActionSuccess") return { ok: true, id: res.post?.id }
  return { ok: false, error: res?.message || res?.__typename || "Buffer rejected the post" }
}
