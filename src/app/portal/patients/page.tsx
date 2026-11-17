import type { Metadata } from "next";
import { PencilIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { requirePatientUser } from "@/lib/auth";
import { formatAge, formatDate } from "@/lib/dates";
import { displayPhone } from "@/lib/format";
import { PatientAvatar } from "@/components/patient-avatar";
import { signAvatarUrls } from "@/lib/avatars";
import { getMyPatients } from "@/lib/queries";

export const metadata: Metadata = { title: "My profiles" };

export default async function PortalPatientsPage() {
  const user = await requirePatientUser();
  const patients = await getMyPatients(user.id);
  const avatarUrls = await signAvatarUrls(patients.map((p) => p.avatar_path));
  const hasSelf = patients.some((p) => p.is_self);

  return (
    <>
      <PageHeader
        title="My profiles"
        description="You and the family members you book for."
        actions={
          <LinkButton href={hasSelf ? "/portal/patients/new" : "/portal/patients/new?self=1"}>
            <PlusIcon /> {hasSelf ? "Add family member" : "Add my details"}
          </LinkButton>
        }
      />
      {patients.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No profiles yet. Add your details to start booking.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {patients.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-start justify-between gap-3">
                <PatientAvatar name={p.full_name} src={p.avatar_path ? avatarUrls[p.avatar_path] : null} size="md" />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="flex items-center gap-2 font-medium">
                    {p.full_name}
                    {p.is_self ? <Badge variant="secondary">Me</Badge> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatAge(p.dob)} · <span className="capitalize">{p.gender}</span> · {formatDate(p.dob)}
                  </p>
                  <p className="text-sm text-muted-foreground">{displayPhone(p.phone)}</p>
                </div>
                <LinkButton href={`/portal/patients/${p.id}/edit`} variant="outline" size="sm">
                  <PencilIcon /> Edit
                </LinkButton>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
