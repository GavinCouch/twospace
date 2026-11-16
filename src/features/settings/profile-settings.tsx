"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { useAction } from "@/components/space-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { useMinuteClock } from "@/components/use-minute-clock";
import { ProfilePhotoEditor } from "./profile-photo-editor";
import type { Person } from "@/shared/types";

const validTimeZone = (value: string) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
};
const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(160, "Use no more than 160 characters."),
  timeZone: z.string().trim().min(1, "Choose a time zone.").max(100).refine(validTimeZone, "Choose a valid city time zone."),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Choose an avatar accent."),
  availableFrom: z.number().int().min(0).max(23),
  availableTo: z.number().int().min(0).max(23),
});
type Values = z.infer<typeof schema>;
const palette = [
  { value: "#74797d", name: "Gray" },
  { value: "#293b80", name: "Blue" }, { value: "#df714b", name: "Orange" },
  { value: "#386b5c", name: "Green" }, { value: "#8c526b", name: "Berry" }, { value: "#7a613d", name: "Brown" },
];
const valuesFor = (person: Person): Values => ({ name: person.name, timeZone: person.timeZone, color: person.color, availableFrom: person.availableFrom, availableTo: person.availableTo });
const hourLabel = (hour: number) => `${hour % 12 || 12}:00 ${hour < 12 ? "am" : "pm"}`;

export function ProfileSettings({ person }: { person: Person }) {
  const action = useAction();
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: valuesFor(person) });
  const { errors, isDirty } = form.formState;
  const serverValues = JSON.stringify(valuesFor(person));
  const previousServerValues = useRef(serverValues);
  const [name, color, timeZone, from, to] = form.watch([
    "name",
    "color",
    "timeZone",
    "availableFrom",
    "availableTo",
  ]);
  const now = useMinuteClock();
  const liveZoneTime = useMemo(() => {
    if (!now || !timeZone || !validTimeZone(timeZone)) return null;
    try {
      return new Intl.DateTimeFormat("en", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
        timeZoneName: "short",
      }).format(now);
    } catch {
      return null;
    }
  }, [timeZone, now]);
  const zones = useMemo(() => {
    try { return Intl.supportedValuesOf("timeZone"); } catch { return ["America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney", "UTC"]; }
  }, []);
  const colors = palette.some(option => option.value.toLowerCase() === person.color.toLowerCase()) ? palette : [{ value: person.color, name: "Current color" }, ...palette];
  useEffect(() => {
    if (previousServerValues.current === serverValues) return;
    previousServerValues.current = serverValues;
    if (!isDirty) form.reset(valuesFor(person));
  }, [person, serverValues, isDirty, form]);
  async function submit(values: Values) {
    setSaved(false);
    try {
      await action.run("/api/profile", values, "PATCH");
      await client.invalidateQueries({ queryKey: ["account"] });
      form.reset(values); setSaved(true);
    } catch { /* Keep unsaved changes available to retry. */ }
  }
  function useDeviceZone() {
    setDeviceError(""); setSaved(false);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zone || !validTimeZone(zone)) throw new Error();
      form.setValue("timeZone", zone, { shouldDirty: true, shouldValidate: true });
    } catch { setDeviceError("Could not read this device’s time zone. Choose one below."); }
  }
  return <section className="settings-section" aria-labelledby="profile-settings-title">
    <div className="settings-section-heading"><h2 id="profile-settings-title">Your profile</h2></div>
    <form className="settings-form" noValidate onSubmit={form.handleSubmit(submit)} onChange={() => setSaved(false)}>
      <fieldset disabled={action.pending} className="settings-fieldset">
        <div className="settings-profile-top"><PersonAvatar person={{ ...person, name, color }} size={62} className="settings-avatar" /><div className="settings-name-field"><label className="field" htmlFor="settings-name">Name<input id="settings-name" autoComplete="given-name" {...form.register("name")} maxLength={160} aria-invalid={!!errors.name} aria-describedby={errors.name ? "settings-name-error" : undefined} /></label>{errors.name && <p id="settings-name-error" className="settings-field-error" role="alert">{errors.name.message}</p>}</div></div>
        <ProfilePhotoEditor person={person} disabled={action.pending} />
        <div><fieldset className="settings-colors" aria-describedby="avatar-accent-hint"><legend>Avatar accent</legend>{colors.map(option => <label key={option.value} className="settings-color-option"><input type="radio" {...form.register("color")} value={option.value} /><span className="settings-color-swatch" style={{ backgroundColor: option.value }} /><span>{option.name}</span></label>)}</fieldset><p id="avatar-accent-hint" className="settings-hint">Colors your default avatar or the border around your photo. Save your profile to keep it.</p></div>
        <div className="settings-time-zone"><div className="settings-label-row"><label htmlFor="settings-time-zone">Time zone</label><button type="button" className="settings-text-button" onClick={useDeviceZone}>Use device time zone</button></div><input id="settings-time-zone" list="settings-time-zones" {...form.register("timeZone")} autoComplete="off" spellCheck={false} aria-invalid={!!errors.timeZone} aria-describedby={errors.timeZone ? "settings-time-zone-error" : "settings-time-zone-hint"} /><datalist id="settings-time-zones">{zones.map(zone => <option key={zone} value={zone} />)}</datalist><p id="settings-time-zone-hint" className="settings-hint">Used for your shared clock and plans. For example, America/Chicago.{liveZoneTime ? <> Currently <strong>{liveZoneTime}</strong>.</> : null}</p>{errors.timeZone && <p id="settings-time-zone-error" className="settings-field-error" role="alert">{errors.timeZone.message}</p>}{deviceError && <p className="settings-field-error" role="alert">{deviceError}</p>}</div>
        <fieldset className="settings-availability"><legend>Usual free hours</legend><div className="settings-hours"><label className="field" htmlFor="available-from">From<select id="available-from" {...form.register("availableFrom", { valueAsNumber: true })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label><label className="field" htmlFor="available-to">Until<select id="available-to" {...form.register("availableTo", { valueAsNumber: true })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label></div><p className="settings-hint" aria-live="polite">{from === to ? "Matching times means no usual free hours are highlighted." : to < from ? "Ends the following day. These hours use your selected time zone." : "These hours use your selected time zone."}</p></fieldset>
      </fieldset>
      {action.error && <p className="form-error" role="alert">{action.error}</p>}
      <div className="settings-save-row"><button className="button" disabled={action.pending || !isDirty}>{action.pending ? "Saving…" : "Save profile"}</button>{saved && <span className="settings-saved" role="status"><Check size={16} aria-hidden="true" />Profile saved</span>}</div>
    </form>
  </section>;
}
