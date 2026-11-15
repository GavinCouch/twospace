"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { useAction } from "@/components/space-provider";

const schema = z.object({ name: z.string().trim().min(1, "Enter a name for your space.").max(160, "Use no more than 160 characters.") });
type Values = z.infer<typeof schema>;

export function SpaceSettings({ name }: { name: string }) {
  const action = useAction();
  const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name } });
  const { isDirty, errors } = form.formState;
  const previousServerName = useRef(name);
  useEffect(() => {
    if (previousServerName.current === name) return;
    previousServerName.current = name;
    if (!isDirty) form.reset({ name });
  }, [name, isDirty, form]);
  async function submit(values: Values) {
    setSaved(false);
    try { await action.run("/api/space", values, "PATCH"); form.reset(values); setSaved(true); }
    catch { /* Keep the entered name available to retry. */ }
  }
  return <section className="settings-section" aria-labelledby="space-settings-title"><div className="settings-section-heading"><h2 id="space-settings-title">Shared space</h2></div><form className="settings-form" noValidate onSubmit={form.handleSubmit(submit)} onChange={() => setSaved(false)}><label className="field" htmlFor="settings-space-name">Space name<input id="settings-space-name" {...form.register("name")} maxLength={160} disabled={action.pending} aria-invalid={!!errors.name} aria-describedby={errors.name ? "settings-space-name-error" : undefined} /></label>{errors.name && <p id="settings-space-name-error" className="settings-field-error" role="alert">{errors.name.message}</p>}{action.error && <p className="form-error" role="alert">{action.error}</p>}<div className="settings-save-row"><button className="button" disabled={action.pending || !isDirty}>{action.pending ? "Saving…" : "Save space name"}</button>{saved && <span className="settings-saved" role="status"><Check size={16} aria-hidden="true" />Space name saved</span>}</div></form></section>;
}
