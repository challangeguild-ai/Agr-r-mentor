import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {BlockHelpButton} from "@/components/GuidedTour";
import {adminUpdateTaskStatus} from "../actions";
import styles from "./support.module.css";

const STATUS_LABELS: Record<string, string> = {
  open: "Nyitott",
  in_progress: "Folyamatban",
  submitted: "Ellenőrzésre vár",
  done: "Lezárt",
  cancelled: "Törölve",
};

function statusLabel(status: string | null | undefined) {
  return STATUS_LABELS[status ?? ""] ?? "Ismeretlen állapot";
}

export default async function SupportPage() {
  const supabase = createAdminClient();
  const [{data: tasks}, {data: farms}, {data: fields}, {data: profiles}] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_date,farm_id,field_id,assigned_to,created_at").order("created_at", {ascending: false}).limit(120),
    supabase.from("farms").select("id,name,owner_id"),
    supabase.from("fields").select("id,name,farm_id"),
    supabase.from("profiles").select("id,full_name,role,system_role"),
  ]);

  const farmMap = new Map((farms ?? []).map((farm) => [farm.id, farm]));
  const fieldMap = new Map((fields ?? []).map((field) => [field.id, field]));
  const personMap = new Map((profiles ?? []).map((person) => [person.id, person.full_name || person.role]));
  const open = (tasks ?? []).filter((task) => task.status !== "done").length;
  const unassigned = (tasks ?? []).filter((task) => !task.assigned_to).length;

  return (
    <main className={`admin-shell ${styles.page}`}>
      <header className="admin-header">
        <div>
          <span className="eyebrow">TÁMOGATÁSI KÖZPONT</span>
          <h1>Felhasználói munkafolyamatok javítása</h1>
          <p>Az admin itt vizsgálhat elakadt feladatot és indoklással korrigálhat állapotot. A beavatkozás auditnaplóba kerül.</p>
        </div>
      </header>

      <section className="admin-summary" data-help-block="system-support-summary" aria-labelledby="support-summary-heading">
        <header className={styles.summaryHeading}>
          <h2 id="support-summary-heading">Feladatok gyors áttekintése</h2>
          <BlockHelpButton
            label="A támogatási összesítő magyarázata"
            content={{
              title: "Támogatási munkafolyamatok áttekintése",
              body: "Az összesítő azt mutatja, hány feladat került be a támogatási nézetbe, ezek közül mennyi nincs lezárva, illetve hányhoz nincs végrehajtó rendelve. Ezek az adatok segítenek az elakadt vagy hibás munkafolyamatok gyors azonosításában.",
              important: "A számok támogatási jelzések, nem szakmai teljesítménymutatók. A rendszeradmin csak konkrét technikai vagy munkafolyamat-hiba esetén avatkozzon be.",
            }}
          />
        </header>
        <div><span>Betöltött feladatok</span><strong>{tasks?.length ?? 0}</strong></div>
        <div><span>Nem lezárt</span><strong>{open}</strong></div>
        <div><span>Végrehajtó nélkül</span><strong>{unassigned}</strong></div>
      </section>

      <section className="panel" data-help-block="system-support-tasks">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ADMIN TÁMOGATÁSI MÓD</span>
            <h2>Feladatállapotok vizsgálata és javítása</h2>
          </div>
          <BlockHelpButton
            label="A támogatási feladatjavítás magyarázata"
            content={{
              title: "Elakadt feladat javítása",
              body: "A listában a feladat címe, gazdasága, földtáblája, végrehajtója és jelenlegi állapota látható. Ha egy munkafolyamat technikai vagy adatállapot-hiba miatt elakadt, a rendszeradmin kiválaszthatja a helyes állapotot és kötelező indoklással korrigálhatja.",
              important: "Ez nem szaktanácsadói munkatér. Az adminisztrátori állapotmódosítás csak támogatási vagy hibajavítási célból használható, és auditnaplóba kerül. Szakmai döntést, feladatértékelést vagy gazdálkodói teljesítésigazolást ne helyettesíts vele.",
              steps: [
                "Azonosítsd a konkrét elakadt feladatot és az érintett gazdaságot/táblát.",
                "Ellenőrizd a jelenlegi állapotot és a végrehajtó hozzárendelését.",
                "Csak igazolt munkafolyamat-hiba esetén válassz javított állapotot.",
                "Adj legalább 8 karakteres, konkrét adminisztrátori indoklást.",
                "A módosítás után az auditnaplóban visszakövethető a beavatkozás.",
              ],
            }}
          />
        </div>
        <div className="notice" style={{marginBottom: 16}}>
          <strong>Admin támogatási mód.</strong> Ez nem szaktanácsadói munkatér: csak konkrét támogatási vagy hibajavítási okkal avatkozz be.
        </div>

        <div className={styles.taskList}>
          {(tasks ?? []).map((task) => {
            const field = task.field_id ? fieldMap.get(task.field_id) : null;
            const farm = farmMap.get(task.farm_id || field?.farm_id);

            return (
              <article key={task.id} className={styles.taskCard}>
                <div className={styles.taskHeading}>
                  <div className={styles.taskDetails}>
                    <strong>{task.title}</strong>
                    <small>{farm?.name || "Gazdaság"} · {field?.name || "Teljes gazdaság"} · {personMap.get(task.assigned_to) || "nincs végrehajtó"}</small>
                  </div>
                  <span className="user-pill">{statusLabel(task.status)}</span>
                </div>

                <form action={adminUpdateTaskStatus} className={styles.repairForm}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <label>
                    Javított állapot
                    <select name="status" defaultValue={task.status}>
                      <option value="open">Nyitott</option>
                      <option value="in_progress">Folyamatban</option>
                      <option value="submitted">Ellenőrzésre vár</option>
                      <option value="done">Lezárt</option>
                    </select>
                  </label>
                  <label>
                    Admin indoklás
                    <input name="reason" placeholder="Miért szükséges a javítás?" minLength={8} required />
                  </label>
                  <button className="btn btn-primary" type="submit">Állapot javítása</button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <div className={styles.backLink}>
        <Link className="ghost-btn" href="/system-admin">← Rendszeráttekintés</Link>
      </div>
    </main>
  );
}
