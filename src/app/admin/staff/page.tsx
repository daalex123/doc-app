import type { Metadata } from "next";
import { SearchIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, SubmitButton } from "@/components/form-bits";
import { PageHeader } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setUserRole } from "@/app/actions/admin";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Staff" };

type Row = Profile & { email: string | null };

const MESSAGES: Record<string, string> = {
  invalid: "Invalid request.",
  self: "You can't remove your own admin role. Ask another admin.",
  failed: "Could not change the role.",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; saved?: string }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .neq("role", "patient")
    .order("role")
    .order("full_name")
    .returns<Row[]>();

  let found: Row[] = [];
  if (q) {
    const term = q.replace(/[,()%*]/g, " ").trim();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
      .order("full_name")
      .limit(10)
      .returns<Row[]>();
    found = data ?? [];
  }

  const RoleForm = ({ row }: { row: Row }) => (
    <form action={setUserRole} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={row.id} />
      <NativeSelect name="role" defaultValue={row.role} aria-label={`Role for ${row.full_name ?? row.email}`} className="w-auto">
        <option value="patient">Patient</option>
        <option value="receptionist">Receptionist</option>
        <option value="doctor">Doctor</option>
        <option value="admin">Admin</option>
      </NativeSelect>
      <SubmitButton size="sm" variant="outline" pendingText="...">Save</SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader
        title="Staff"
        description="Give people access as receptionist, doctor or admin. They must sign up first."
      />

      {sp.saved ? (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <AlertDescription>Role updated. The user may need to sign in again.</AlertDescription>
        </Alert>
      ) : null}
      {sp.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{MESSAGES[sp.error] ?? MESSAGES.failed}</AlertDescription>
        </Alert>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current staff</h2>
        <Card>
          <CardContent className="px-0">
            <ul className="divide-y">
              {(staff ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {s.full_name ?? "Unnamed"}
                      {s.id === me.id ? <Badge variant="secondary">You</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <RoleForm row={s} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add staff</h2>
        <form method="get" className="mb-4 flex max-w-md gap-2">
          <Input name="q" defaultValue={q} placeholder="Search by email or name" aria-label="Search users" />
          <SubmitButton pendingText="Searching...">
            <SearchIcon /> Search
          </SubmitButton>
        </form>
        {q ? (
          found.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found. Ask them to sign up first.</p>
          ) : (
            <Card>
              <CardContent className="px-0">
                <ul className="divide-y">
                  {found.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{s.full_name ?? "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                      <RoleForm row={s} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        ) : null}
      </section>
    </>
  );
}
