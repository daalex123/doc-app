"use client";

import { useMemo, useState, useTransition } from "react";
import { HistoryIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/form-bits";
import { MedicineCombobox } from "@/components/medicine-combobox";
import { saveTemplateFromRows } from "@/app/actions/templates";
import { formatInstantDate } from "@/lib/dates";
import { RX_ROWS, type PrescribingData, type RxRow, type RxTemplate } from "@/lib/types";

const FREQUENCY_CHIPS = ["OD", "BD", "TDS", "QDS", "SOS", "PRN", "nocte", "mane"];
const DURATION_CHIPS = ["3 days", "5 days", "1 week", "2 weeks", "1 month", "ongoing"];

type Field = keyof RxRow;
const isEmpty = (r: RxRow) => !r.medicine.trim() && !r.dose.trim() && !r.frequency.trim() && !r.duration.trim() && !r.notes.trim();

/** Puts `incoming` into the fully empty rows, in order. */
function fillEmptyRows(rows: RxRow[], incoming: RxRow[]) {
  const next = [...rows];
  let placed = 0;
  for (const item of incoming) {
    const slot = next.findIndex(isEmpty);
    if (slot === -1) break;
    next[slot] = { ...item };
    placed++;
  }
  return { rows: next, placed, skipped: incoming.length - placed };
}

function Chips({
  options,
  label,
  onPick,
}: {
  options: string[];
  label: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          tabIndex={-1}
          onClick={() => onPick(o)}
          className="rounded-full border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * Prescription rows. Inputs stay plain named fields (rx_<field>_<i>) so the visit
 * form posts them as before; the state here only drives shortcuts.
 */
export function PrescriptionEditor({
  initial,
  errors,
  data,
}: {
  initial: RxRow[];
  errors?: Record<string, string[] | undefined>;
  data: PrescribingData;
}) {
  const suggestions = useMemo(
    () => [...data.catalog.map((c) => c.label), ...data.recent],
    [data.catalog, data.recent],
  );
  const [rows, setRows] = useState<RxRow[]>(initial);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const [templates, setTemplates] = useState<RxTemplate[]>(data.templates);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, startSaving] = useTransition();

  const setField = (i: number, field: Field, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const onMedicine = (i: number, value: string) => {
    const hit = data.catalog.find((c) => c.label.toLowerCase() === value.trim().toLowerCase());
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        if (!hit) return { ...r, medicine: value };
        return {
          medicine: value,
          dose: r.dose.trim() ? r.dose : hit.dose,
          frequency: r.frequency.trim() ? r.frequency : hit.frequency,
          duration: r.duration.trim() ? r.duration : hit.duration,
          notes: r.notes,
        };
      }),
    );
  };

  /** Removes a row; rows below move up and an empty row is added at the end. */
  const removeRow = (i: number) => {
    setRows((rs) => [...rs.slice(0, i), ...rs.slice(i + 1), { medicine: "", dose: "", frequency: "", duration: "", notes: "" }]);
    setMessage(null);
  };

  const addRows = (incoming: RxRow[], what: string) => {
    const res = fillEmptyRows(rows, incoming);
    setRows(res.rows);
    setMessage({
      text:
        res.skipped > 0
          ? `Added ${res.placed} of ${incoming.length} from ${what}; ${res.skipped} did not fit in the empty rows.`
          : `Added ${res.placed} medicine${res.placed === 1 ? "" : "s"} from ${what}.`,
      error: res.skipped > 0,
    });
  };

  const saveTemplate = () => {
    const filled = rows.filter((r) => r.medicine.trim());
    if (filled.length === 0) return setMessage({ text: "Add at least one medicine first.", error: true });
    startSaving(async () => {
      const res = await saveTemplateFromRows(templateName, filled);
      if (!res.ok) return setMessage({ text: res.error, error: true });
      setTemplates((ts) => [...ts, res.template].sort((a, b) => a.name.localeCompare(b.name)));
      setTemplateName("");
      setMessage({ text: `Saved template "${res.template.name}".` });
    });
  };

  const cell = (i: number, field: Field, label: string, placeholder: string) => (
    <Input
      name={`rx_${field}_${i}`}
      value={rows[i][field]}
      onChange={(e) => (field === "medicine" ? onMedicine(i, e.target.value) : setField(i, field, e.target.value))}
      placeholder={i === 0 ? placeholder : ""}
      aria-label={`${label} ${i + 1}`}
    />
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-lg bg-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={data.lastRx.length === 0}
            onClick={() =>
              addRows(data.lastRx, data.lastRxDate ? `the visit on ${formatInstantDate(data.lastRxDate)}` : "the last visit")
            }
          >
            <HistoryIcon /> Repeat last prescription
          </Button>
          {data.lastRx.length === 0 ? (
            <span className="text-xs text-muted-foreground">No earlier prescription for this patient.</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={templateId}
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) addRows(t.items, `"${t.name}"`);
              setTemplateId(""); // reset so the same template can be applied again
            }}
            aria-label="Prescription template"
            className="w-auto min-w-44"
          >
            <option value="">{templates.length ? "Choose a template" : "No templates yet"}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.items.length})
              </option>
            ))}
          </NativeSelect>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveTemplate();
              }
            }}
            placeholder="Template name"
            aria-label="New template name"
            className="w-44"
            maxLength={80}
          />
          <Button type="button" variant="outline" size="sm" onClick={saveTemplate} disabled={saving}>
            <SaveIcon /> {saving ? "Saving..." : "Save rows as template"}
          </Button>
        </div>
        <p role="status" className={message?.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {message?.text ?? ""}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="hidden grid-cols-12 gap-2 px-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid"
      >
        <span className="col-span-4">Medicine</span>
        <span className="col-span-2">Dose</span>
        <span className="col-span-2">Frequency</span>
        <span className="col-span-2">Duration</span>
        <span className="col-span-2">Notes</span>
      </div>
      {Array.from({ length: RX_ROWS }, (_, i) => {
        const err = errors?.[`rx_medicine_${i}`];
        const active = focusRow === i;
        return (
          <div
            key={i}
            onFocus={() => setFocusRow(i)}
            className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-12 sm:border-0 sm:p-0"
          >
            <div className="col-span-2 sm:col-span-4">
              <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">Medicine</span>
              <MedicineCombobox
                name={`rx_medicine_${i}`}
                value={rows[i].medicine}
                onValueChange={(v) => onMedicine(i, v)}
                options={suggestions}
                placeholder={i === 0 ? "e.g. Paracetamol" : ""}
                ariaLabel={`Medicine ${i + 1}`}
                invalid={!!err}
              />
              {err ? <p role="alert" className="mt-1 text-xs text-destructive">{err[0]}</p> : null}
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">Dose</span>
              {cell(i, "dose", "Dose", "e.g. 500mg")}
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">Frequency</span>
              {cell(i, "frequency", "Frequency", "e.g. TDS")}
              {active ? (
                <Chips
                  options={FREQUENCY_CHIPS}
                  label={`Frequency shortcuts for row ${i + 1}`}
                  onPick={(v) => setField(i, "frequency", v)}
                />
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">Duration</span>
              {cell(i, "duration", "Duration", "e.g. 5 days")}
              {active ? (
                <Chips
                  options={DURATION_CHIPS}
                  label={`Duration shortcuts for row ${i + 1}`}
                  onPick={(v) => setField(i, "duration", v)}
                />
              ) : null}
            </div>
            <div className="col-span-2 sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">Notes</span>
              <div className="flex items-center gap-1">
                {cell(i, "notes", "Notes", "e.g. after meals")}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(i)}
                  disabled={isEmpty(rows[i])}
                  aria-label={`Remove row ${i + 1}`}
                  title="Remove row"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
