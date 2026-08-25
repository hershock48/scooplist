import { notFound, redirect } from "next/navigation";
import { currentOrg, orgMode, validOrgSlug } from "@/lib/org";
import LoginForm from "../login-form";

export const metadata = { title: "Sign in" };

/**
 * The per-org sign-in link, the one Kevin hands a bar's owner:
 * /login/copperac. Renders for ANY syntactically valid slug without
 * checking the org exists (checking would make this page an enumeration
 * oracle; a wrong slug just fails the PIN check like a wrong PIN does).
 * Legacy installs have no orgs, so the whole path 404s there.
 */
export default async function OrgLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ bad?: string; locked?: string }>;
}) {
  if (!orgMode()) notFound();
  const { org } = await params;
  if (!validOrgSlug(org)) notFound();
  if (await currentOrg()) redirect("/case");
  const { bad, locked } = await searchParams;
  return <LoginForm org={org} bad={bad} locked={locked} />;
}
