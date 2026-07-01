import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { Package, ArrowRight, AlertTriangle, Plus } from "lucide-react"
import ProductsClient from "./ProductsClient"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: items } = await sb.from("inventory_items").select("*").eq("active", true).order("name").limit(500)
  return <ProductsClient items={items || []} />
}
