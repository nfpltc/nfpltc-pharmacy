import { NextResponse } from "next/server"
import { bufferGql } from "@/lib/social/buffer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/buffer/introspect
// DIAGNOSTIC ONLY. Asks Buffer's live GraphQL schema for the real shape of the
// createPost mutation and its CreatePostInput type, so we can match our post
// payload to exactly what Buffer expects. Returns only type/field *names* — no
// account data and never the token. Safe to remove once posting works.
//
// Why: posting was failing with
//   'Argument "input" of non-null type "CreatePostInput!" must not be null'
// which means Buffer's gateway didn't accept the shape of the input we sent.

// Flatten an introspected type ref into a readable string like "[ID!]!".
function typeStr(t: any): string {
  if (!t) return "?"
  if (t.kind === "NON_NULL") return typeStr(t.ofType) + "!"
  if (t.kind === "LIST") return "[" + typeStr(t.ofType) + "]"
  return t.name || t.kind || "?"
}

// Pull the { name, type, required } list out of an introspected input type.
function inputFields(typeNode: any): any {
  if (!typeNode) return null
  return {
    name: typeNode.name,
    kind: typeNode.kind,
    fields: (typeNode.inputFields || []).map((f: any) => ({
      name: f.name,
      type: typeStr(f.type),
      required: f.type?.kind === "NON_NULL",
    })),
  }
}

export async function GET() {
  const query = `query {
    createPostInput: __type(name: "CreatePostInput") { ...T }
    postInput:       __type(name: "PostInput") { ...T }
    publishingInput: __type(name: "PublishingPostInput") { ...T }
    mutationType: __type(name: "Mutation") {
      fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } }
    }
  }
  fragment T on __Type {
    name kind
    inputFields {
      name
      type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
    }
  }`

  const { data, errors, status } = await bufferGql<any>(query, {})

  // Find the createPost mutation's declared argument(s), if the schema exposes them.
  const mFields = data?.mutationType?.fields || []
  const createPost = mFields.find((f: any) => f.name === "createPost")
  const createPostArgs = createPost
    ? createPost.args.map((a: any) => ({ name: a.name, type: typeStr(a.type) }))
    : null

  return NextResponse.json({
    status,
    errors,
    createPost_args: createPostArgs, // e.g. [{ name: "input", type: "CreatePostInput!" }]
    CreatePostInput: inputFields(data?.createPostInput),
    PostInput: inputFields(data?.postInput),
    PublishingPostInput: inputFields(data?.publishingInput),
  })
}
