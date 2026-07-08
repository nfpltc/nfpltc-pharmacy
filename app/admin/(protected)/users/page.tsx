import { redirect } from "next/navigation"

// User management moved under Settings → User management.
export default function AdminUsersRedirect() {
  redirect("/admin/settings")
}
