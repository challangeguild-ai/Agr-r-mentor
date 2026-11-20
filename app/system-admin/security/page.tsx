import {createAdminClient} from "@/lib/supabase/admin";
import {BlockHelpButton} from "@/components/GuidedTour";
import styles from "./security.module.css";

const EVENT_LABELS: Record<string, string> = {
  mfa_step_up_failed: "Sikertelen MFA-megerősítés",
  mfa_step_up_success: "Sikeres MFA-megerősítés",
  backup_export_without_fresh_mfa: "Mentés blokkolva: nincs friss MFA",
  backup_export_failed: "Sikertelen biztonsági mentés",
  backup_export_success: "Sikeres biztonsági mentés",
};

function severityLabel(value: string | null | undefined) {
  return value === "critical" ? "Kritikus" : value === "high" ? "Magas" : value === "medium" ? "Közepes" : value === "low" ? "Alacsony" : "Információ";
}

export default async function SecurityPage() {
  const supabase = createAdminClient();
  const {data: events} = await supabase.from("security_events")
    .select("id,created_at,actor_user_id,event_type,severity,risk_score,ip_address,country_code,region,city,user_agent,request_path,method,subject_type,subject_id,detail")
    .order("created_at", {ascending: false}).limit(250);
  const rows = events ?? [];
  const high = rows.filter((event) => Number(event.risk_score) >= 70).length;
  const critical = rows.filter((event) => event.severity === "critical").length;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="eyebrow">BIZTONSÁGI KÖZPONT</span>
          <h1>Biztonsági események</h1>
          <p>Hitelesítési, export- és jogosultsági események incidensvizsgálathoz.</p>
        </div>
      </header>

      <section className="admin-summary" data-help-block="system-security-summary" aria-labelledby="security-summary-heading">
        <header className={styles.summaryHeading}>
          <h2 id="security-summary-heading">Biztonsági helyzetkép</h2>
          <BlockHelpButton label="A biztonsági összesítő magyarázata" content={{
            title: "Biztonsági események összesítése",
            body: "Az összesítő a betöltött biztonsági események számát, a 70 vagy magasabb kockázati pontszámú tételeket és a kritikus súlyosságú eseményeket külön emeli ki. Ez gyors incidens-triázsra szolgál.",
            important: "A kockázati pontszám és a súlyosság vizsgálati prioritást jelez, nem automatikus bizonyítékot támadásra vagy jogosulatlan hozzáférésre.",
          }}/>
        </header>
        <div><span>Betöltött események</span><strong>{rows.length}</strong></div>
        <div><span>Magas kockázat</span><strong>{high}</strong></div>
        <div><span>Kritikus</span><strong>{critical}</strong></div>
      </section>

      <section className="panel" data-help-block="system-security-events">
        <div className="panel-heading">
          <div><span className="eyebrow">INCIDENSVIZSGÁLAT</span><h2>Eseménynapló</h2></div>
          <BlockHelpButton label="A biztonsági eseménynapló magyarázata" content={{
            title: "Biztonsági eseménynapló",
            body: "A lista eseményenként megmutatja a típust, időpontot, érintett útvonalat és HTTP műveletet, súlyosságot, kockázati pontszámot, IP-címet, közelítő helyet, felhasználót és érintett rendszerobjektumot. Ezekből lehet egy incidens körülményeit visszakövetni.",
            important: "Az IP-alapú hely csak közelítő adat. VPN, mobilhálózat vagy szolgáltatói útvonalválasztás miatt eltérhet a tényleges helytől, ezért önmagában nem alkalmas személy vagy helyzet biztos azonosítására.",
          }}/>
        </div>
        <div className="notice" style={{marginBottom: 16}}>
          Az IP-alapú hely csak közelítő adat. VPN, mobilhálózat vagy szolgáltatói routing miatt eltérhet a tényleges tartózkodási helytől.
        </div>
        <div className={styles.eventList}>
          {rows.length === 0 && <p className="empty-state" role="status">Még nincs naplózott biztonsági esemény.</p>}
          {rows.map((event) => (
            <article className={`${styles.eventCard} ${Number(event.risk_score) >= 70 ? styles.highRisk : ""}`} key={event.id}>
              <div className={styles.eventHeading}>
                <div className={styles.eventTitle}>
                  <strong>{EVENT_LABELS[event.event_type] ?? event.event_type}</strong>
                  <small>{new Date(event.created_at).toLocaleString("hu-HU")} · {event.request_path || "—"} · {event.method || "—"}</small>
                </div>
                <span className="user-pill">{severityLabel(event.severity)} · {event.risk_score}/100</span>
              </div>
              <div className={styles.eventDetails}>
                <span><b>IP:</b> {event.ip_address || "nem ismert"}</span>
                <span><b>Hely:</b> {[event.city, event.region, event.country_code].filter(Boolean).join(", ") || "nem ismert"}</span>
                <span><b>Felhasználó:</b> {event.actor_user_id || "ismeretlen"}</span>
                <span><b>Cél:</b> {event.subject_type || "—"} {event.subject_id || ""}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
