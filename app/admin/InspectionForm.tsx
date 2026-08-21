"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createInspection } from "./actions";

type FieldOption = { id: string; name: string; farmName: string };

export function InspectionForm({ fields }: { fields: FieldOption[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createTask, setCreateTask] = useState(false);
  const supabase = createClient();

  async function submit(formData: FormData) {
    setBusy(true); setError("");
    try {
      const files = formData.getAll("media").filter((v): v is File => v instanceof File && v.size > 0);
      formData.delete("media");
      const inspectionId = await createInspection(formData);
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}: maximum 50 MB lehet.`);
        const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
        if (!kind) throw new Error(`${file.name}: csak kép vagy videó tölthető fel.`);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${inspectionId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("inspection-media").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data: { user } } = await supabase.auth.getUser();
        const { error: rowError } = await supabase.from("inspection_media").insert({ inspection_id: inspectionId, storage_path: path, file_name: file.name, media_type: kind, mime_type: file.type, size_bytes: file.size, uploaded_by: user?.id });
        if (rowError) throw rowError;
      }
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "A szemle mentése sikertelen."); setBusy(false); }
  }

  return <form action={submit} className="admin-form inspection-create-grid">
    <label>Földtábla<select name="field_id" required><option value="">Válassz táblát</option>{fields.map(f => <option key={f.id} value={f.id}>{f.name} – {f.farmName}</option>)}</select></label>
    <label>Szemle dátuma<input name="inspected_at" type="date" defaultValue={new Date().toISOString().slice(0,10)} /></label>
    <label>Állapot / minősítés<select name="condition" defaultValue="good" required><option value="good">Jó állapot</option><option value="attention">Figyelmet igényel</option><option value="critical">Kritikus</option></select></label>
    <label className="inspection-wide">Megfigyelés<textarea name="notes" rows={3} placeholder="Mit tapasztaltál a helyszínen?" /></label>
    <label className="inspection-wide">Szaktanácsadói javaslat<textarea name="recommendation" rows={3} placeholder="Javasolt kezelés, következő lépés..." /></label>

    <div className="inspection-wide task-from-inspection">
      <label className="checkbox-row"><input type="checkbox" name="create_task" value="yes" checked={createTask} onChange={e=>setCreateTask(e.target.checked)} /> Teendő létrehozása ebből a szemléből</label>
      {createTask && <div className="inspection-task-grid">
        <label>Teendő neve<input name="task_title" placeholder="pl. Gyomirtás" required /></label>
        <label>Határidő<input name="task_due_date" type="date" /></label>
        <label>Prioritás<select name="task_priority" defaultValue="normal"><option value="normal">Normál</option><option value="high">Fontos</option><option value="urgent">Sürgős</option></select></label>
      </div>}
    </div>

    <label className="inspection-wide">Képek és videók<input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple /><small>Egyszerre több fájl is választható. Maximum 50 MB / fájl.</small></label>
    {error && <div className="error-box inspection-wide">{error}</div>}
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Mentés és feltöltés…" : "Szemle mentése"}</button>
  </form>;
}
