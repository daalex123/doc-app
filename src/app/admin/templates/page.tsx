import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmButton, SubmitButton } from "@/components/form-bits";
import { PageHeader } from "@/components/app-shell";
import { requireClinical } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteTemplate, renameTemplate } from "@/app/actions/templates";

export const metadata: Metadata = { title: "Prescription templates" };

const SAVED: Record<string, string> = { renamed: "Template renamed.", deleted: "Template deleted." };
const ERRORS: Record<string, string> = {
  name: "Enter a template name (80 characters or fewer).",
  denied: "Only the template's owner or an admin can change it.",
};

interface Row {
  id: string;
  name: string;
  created_by: string | null;
  profiles: { full_name: string | null } | null;
  prescription_template_items: { medicine: string; dose: string | null; frequency: string | null; duration: string | null; position: number }[];
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireClinical();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("prescription_templates")
    .select("id, name, created_by, profiles(full_name), prescription_template_items(medicine, dose, frequency, duration, position)")
    .order("name")
    .returns<Row[]>();
  const rows = data ?? [];
  const isAdmin = user.profile.role === "admin";

  return (
    <>
      <PageHeader
        title="Prescription templates"
        description="Shared with all doctors. Create one from the visit form with “Save rows as template”."
      />

      {sp.saved && SAVED[sp.saved] ? (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <AlertDescription>{SAVED[sp.saved]}</AlertDescription>
        </Alert>
      ) : null}
      {sp.error && ERRORS[sp.error] ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{ERRORS[sp.error]}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No templates yet. Fill in the prescription on a visit and choose “Save rows as template”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((t) => {
            const canEdit = isAdmin || t.created_by === user.id;
            const items = [...t.prescription_template_items].sort((a, b) => a.position - b.position);
            return (
              <Card key={t.id} size="sm">
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {items.length} {items.length === 1 ? "medicine" : "medicines"} · by {t.profiles?.full_name ?? "unknown"}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={renameTemplate} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={t.id} />
                          <Input name="name" defaultValue={t.name} maxLength={80} required aria-label={`Rename ${t.name}`} className="w-48" />
                          <SubmitButton size="sm" variant="outline" pendingText="...">Rename</SubmitButton>
                        </form>
                        <form action={deleteTemplate}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmButton size="sm" variant="destructive" message={`Delete the template "${t.name}"?`}>
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Read only</p>
                    )}
                  </div>
                  <ul className="grid gap-0.5 text-sm text-muted-foreground">
                    {items.map((i, idx) => (
                      <li key={idx}>
                        <span className="text-foreground">{i.medicine}</span>
                        {[i.dose, i.frequency, i.duration].filter(Boolean).length
                          ? ` · ${[i.dose, i.frequency, i.duration].filter(Boolean).join(" · ")}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
