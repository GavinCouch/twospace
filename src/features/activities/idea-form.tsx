"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "@/components/space-provider";

const schema = z.object({
  title: z.string().trim().min(3, "Give your idea a short name.").max(100),
  description: z.string().trim().min(5, "Add a little detail about what you will do.").max(500),
  duration: z.number().int().min(5).max(240),
  mode: z.enum(["live", "anytime"]),
  category: z.enum(["Make", "Play", "Talk", "Discover", "Everyday"]),
  materials: z.string().trim().max(200),
  link: z.string().trim().refine(value => !value || /^https?:\/\//i.test(value) && URL.canParse(value), "Use a full http or https link."),
});
type Values = z.infer<typeof schema>;

export function IdeaForm({ onClose }: { onClose: () => void }) {
  const action = useAction();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", duration: 30, mode: "live", category: "Everyday", materials: "", link: "" },
  });
  async function save(values: Values) {
    try { await action.run("/api/ideas", values); onClose(); } catch { /* The form keeps its values and displays the request error. */ }
  }
  return <form className="panel activity-form" onSubmit={handleSubmit(save)}>
    <div className="activity-heading"><h2>Add your own idea</h2><button className="quiet" type="button" onClick={onClose}>Cancel</button></div>
    <label className="field">Name<input autoFocus {...register("title")} maxLength={100} aria-invalid={!!errors.title} placeholder="Try the same recipe" /></label>
    {errors.title && <p className="form-error" role="alert">{errors.title.message}</p>}
    <label className="field">What would you do?<textarea {...register("description")} maxLength={500} rows={3} aria-invalid={!!errors.description} /></label>
    {errors.description && <p className="form-error" role="alert">{errors.description.message}</p>}
    <div className="activity-form-columns">
      <label className="field">Time, in minutes<input type="number" min={5} max={240} step={5} {...register("duration", { valueAsNumber: true })} aria-invalid={!!errors.duration} /></label>
      <label className="field">When<select {...register("mode")}><option value="live">At the same time</option><option value="anytime">At your own pace</option></select></label>
      <label className="field">Category<select {...register("category")}>{["Make", "Play", "Talk", "Discover", "Everyday"].map(category => <option key={category}>{category}</option>)}</select></label>
    </div>
    {errors.duration && <p className="form-error" role="alert">Choose a duration from 5 to 240 minutes.</p>}
    <label className="field">Anything to bring? <span className="muted">Optional</span><input {...register("materials")} maxLength={200} placeholder="A snack and something to drink" /></label>
    <label className="field">Link <span className="muted">Optional</span><input type="url" {...register("link")} placeholder="https://" aria-invalid={!!errors.link} /></label>
    {errors.link && <p className="form-error" role="alert">{errors.link.message}</p>}
    {action.error && <p className="form-error" role="alert">{action.error}</p>}
    <button className="button" disabled={action.pending}>{action.pending ? "Adding…" : "Add idea"}</button>
  </form>;
}
