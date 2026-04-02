import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { account_number, dob, email, password, full_name, role } = body

    if (!account_number || !dob || !email || !password || !full_name) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // 1) Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name, role: role || "user" },
      })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    const userId = authData.user?.id
    if (!userId) {
      return NextResponse.json(
        { error: "User created but no ID returned." },
        { status: 500 }
      )
    }

    // 2) Insert profile row
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        account_number: account_number.trim(),
        dob,
        email: email.toLowerCase().trim(),
        full_name: full_name.trim(),
        role: role || "user",
      })

    if (profileError) {
      // Clean up: remove auth user if profile insert fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: `Profile creation failed: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    )
  }
}
