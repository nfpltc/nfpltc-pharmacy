import { NextRequest, NextResponse } from "next/server"
import { bufferGql } from "@/lib/social/buffer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/buffer/introspect          → dumps the types needed for createPost
// GET /api/admin/buffer/introspect?type=X   → introspects any single type/enum
//
// DIAGNOSTIC ONLY. Reads Buffer's live GraphQL schema (enum values + input field
// shapes) so our createPost payload can match Buffer exactly. Returns only
// type/field names — no account data, never the token. Remove once posting works.

// Flatten an introspected type ref into a readable string like "[AssetInput!]!".
function typeStr(t: any): string {
  if (!t) return "?"
  if (t.kind === "NON_NULL") return typeStr(t.ofType) + "!"
  if (t.kind === "LIST") return "[" + typeStr(t.ofType) + "]"
  return t.name || t.kind || "?"
}

function summarize(node: any): any {
  if (!node) return null
  return {
    name: node.name,
    kind: node.kind,
    enumValues: (node.enumValues || []).map((e: any) => e.name),
    inputFields: (node.inputFields || []).map((f: any) => ({
      name: f.name,
      type: typeStr(f.type),
      required: f.type?.kind === "NON_NULL",
    })),
  }
}

const ONE_TYPE = `query($name: String!) {
  __type(name: $name) {
    name kind
    enumValues { name }
    inputFields {
      name
      type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
    }
  }
}`

export async function GET(req: NextRequest) {
  const single = new URL(req.url).searchParams.get("type")

  if (single) {
    const { data, errors, status } = await bufferGql<any>(ONE_TYPE, { name: single })
    return NextResponse.json({ status, errors, type: summarize(data?.__type) })
  }

  // Default: everything needed to build a valid createPost input.
  const NAMES = ["CreatePostInput", "SchedulingType", "ShareMode", "AssetInput", "PostInputMetaData"]
  const out: Record<string, any> = {}
  for (const n of NAMES) {
    const { data } = await bufferGql<any>(ONE_TYPE, { name: n })
    out[n] = summarize(data?.__type)
  }
  return NextResponse.json(out)
}
