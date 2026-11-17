"use client";

import { useActionState, useState, startTransition } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LinkButton } from "@/components/link-button";
import { importPatients, type ImportState } from "@/app/actions/patient-import";

export function PatientImport() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importPatients, {});
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [intent, setIntent] = useState<"preview" | "commit">("preview");

  const submit = (intent: "preview" | "commit") => {
    setClientError(null);
    if (!file) return setClientError("Choose a .csv or .xlsx file.");
    if (file.size > 2 * 1024 * 1024) return setClientError("The file is larger than 2 MB.");
    setIntent(intent);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("intent", intent);
    if (consent) fd.set("consent", "on");
    startTransition(() => action(fd));
  };

  const downloadReport = () => {
    if (!state.errorReport) return;
    const url = URL.createObjectURL(new Blob([state.errorReport], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "patients-import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const done = state.stage === "done";
  const error = clientError ?? state.error;

  return (
    <div className="grid max-w-4xl gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>1. Upload file</CardTitle>
          <CardDescription>
            CSV or .xlsx, up to 2 MB and 2000 rows. Dates as DD/MM/YYYY; gender male/female/other (or M/F).
            Use &quot;none&quot; in an allergies column when the patient has no known allergies.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="file" className="text-sm font-medium">File</label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setClientError(null);
              }}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>I confirm these patients have consented to storing their data.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => submit("preview")}>
              {pending && intent === "preview" ? (
                <><Loader2Icon className="animate-spin" /> Checking...</>
              ) : (
                "Upload and preview"
              )}
            </Button>
            <LinkButton href="/admin/patients/import/template" variant="outline" prefetch={false}>
              <DownloadIcon /> Download template
            </LinkButton>
            <LinkButton href="/admin/patients" variant="ghost">Cancel</LinkButton>
          </div>
        </CardContent>
      </Card>

      {state.stage === "preview" ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Review</CardTitle>
            <CardDescription>
              {state.fileName}: {state.total} rows. Invalid rows and duplicates are skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge>{state.valid} valid</Badge>
              <Badge variant="destructive">{state.invalid} invalid</Badge>
              <Badge variant="secondary">{state.duplicates} duplicate</Badge>
            </div>
            <div className="max-h-96 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.items?.map((i) => (
                    <TableRow key={i.row}>
                      <TableCell>{i.row}</TableCell>
                      <TableCell>{i.name || "-"}</TableCell>
                      <TableCell className="capitalize">{i.status}</TableCell>
                      <TableCell className="whitespace-normal text-xs text-muted-foreground">
                        {i.messages.length ? i.messages.map((m) => <div key={m}>{m}</div>) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {state.itemsTruncated ? (
              <p className="text-xs text-muted-foreground">Showing the first rows only; problem rows are listed first.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || !state.valid} onClick={() => submit("commit")}>
                {pending && intent === "commit" ? (
                  <><Loader2Icon className="animate-spin" /> Importing...</>
                ) : (
                  `Import ${state.valid} valid rows`
                )}
              </Button>
              {state.errorReport ? (
                <Button type="button" variant="outline" onClick={downloadReport}>
                  <DownloadIcon /> Error report (CSV)
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {done ? (
        <Card>
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
            <CardDescription>{state.fileName}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3"><dd className="text-2xl font-semibold">{state.imported}</dd><dt className="text-xs text-muted-foreground">Imported</dt></div>
              <div className="rounded-lg border p-3"><dd className="text-2xl font-semibold">{state.skipped}</dd><dt className="text-xs text-muted-foreground">Skipped</dt></div>
              <div className="rounded-lg border p-3"><dd className="text-2xl font-semibold">{state.failed}</dd><dt className="text-xs text-muted-foreground">Failed</dt></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/admin/patients">View patients</LinkButton>
              {state.errorReport ? (
                <Button type="button" variant="outline" onClick={downloadReport}>
                  <DownloadIcon /> Error report (CSV)
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
