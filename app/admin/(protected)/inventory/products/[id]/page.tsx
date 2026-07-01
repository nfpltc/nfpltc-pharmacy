import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import ProductDetailClient from "./ProductDetailClient"

export const dynamic = "force-dynamic"

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

  const [{ data: item }, { data: moves }] = await Promise.all([
    sb.from("inventory_items").select("*").eq("id", params.id).maybeSingle(),
    sb.from("inventory_movements").select("*").eq("item_id", params.id).order("created_at", { ascending: false }).limit(50),
  ])

  if (!item) notFound()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/inventory/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Products
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">{item.name}</span>
      </div>
      <ProductDetailClient item={item} movements={moves || []} />
    </div>
  )
}
