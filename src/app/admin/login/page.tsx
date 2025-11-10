import { redirect } from "next/navigation";

/**
 * /admin/login is a common typo for /admin-login.
 * This page redirects to the correct admin login URL.
 */
export default function AdminLoginRedirectPage() {
  redirect("/admin-login");
}
