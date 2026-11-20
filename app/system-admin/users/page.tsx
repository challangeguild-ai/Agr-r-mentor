import {createAdminClient} from "@/lib/supabase/admin";
import {BlockHelpButton} from "@/components/GuidedTour";
import {inviteAdvisor} from "../actions";
import styles from "./users.module.css";

type Props={searchParams:Promise<{invite?:string;email?:string}>};

export default async function UsersPage({searchParams}:Props){
 const supabase=createAdminClient();
 const{data:profiles}=await supabase.from("profiles").select("id,full_name,role,system_role,phone,created_at").order("created_at",{ascending:false});
 const params=await searchParams;
 const sent=params.invite==="sent"&&params.email;
 const users=profiles??[];
 const farmers=users.filter(user=>user.role==="farmer").length;
 const advisors=users.filter(user=>user.role==="advisor").length;
 const admins=users.filter(user=>user.system_role==="admin").length;

 return <main className={`admin-shell ${styles.page}`}>
  <header className="admin-header"><div><span className="eyebrow">FELHASZNÁLÓK</span><h1>Szerepkörök és rendszerjogok</h1><p>A szakmai szerepkör és a rendszeradminisztrátori jogosultság elkülönül. A rendszeradmin nem használja a szaktanácsadói munkateret.</p></div></header>

  <section className={styles.summary} aria-label="Felhasználói összesítés">
   <article className={styles.summaryCard}><span className={styles.summaryIcon} aria-hidden="true">♙</span><div><small>Összes felhasználó</small><strong>{users.length}</strong></div></article>
   <article className={styles.summaryCard}><span className={styles.summaryIcon} aria-hidden="true">▥</span><div><small>Gazdálkodók</small><strong>{farmers}</strong></div></article>
   <article className={styles.summaryCard}><span className={styles.summaryIcon} aria-hidden="true">✣</span><div><small>Szaktanácsadók</small><strong>{advisors}</strong></div></article>
   <article className={styles.summaryCard}><span className={styles.summaryIcon} aria-hidden="true">⚑</span><div><small>Rendszeradminok</small><strong>{admins}</strong></div></article>
  </section>

  <section className={`panel ${styles.section}`} data-help-block="system-user-invite">
   <div className={`panel-heading ${styles.sectionHeading}`}><div><span className="eyebrow">FIÓK LÉTREHOZÁSA</span><h2>Szaktanácsadó meghívása</h2><p>A meghívás csak friss kétfaktoros hitelesítéssel és rendszeradminisztrátori jogosultsággal hajtható végre.</p></div><BlockHelpButton label="A szaktanácsadó-meghívás magyarázata" content={{title:"Szaktanácsadó meghívása",body:"Ebben a blokkban új szaktanácsadói felhasználót hívhatsz meg név és e-mail cím megadásával. A meghívás rendszeradminisztrátori művelet, és nem azonos gazdálkodó vagy gazdaság létrehozásával.",important:"A meghívás csak megfelelő rendszeradmin jogosultsággal és friss kétfaktoros hitelesítéssel hajtható végre. Rendszeradmin jogot ezen az űrlapon nem osztunk ki."}}/></div>
   {sent?<div className={`notice ${styles.success}`} role="status"><strong>Meghívó elküldve:</strong> {params.email}</div>:null}
   <form action={inviteAdvisor} className={styles.inviteForm}>
    <label htmlFor="advisor-name">Név<input id="advisor-name" name="full_name" autoComplete="name" placeholder="Szaktanácsadó neve" /></label>
    <label htmlFor="advisor-email">E-mail<input id="advisor-email" name="email" type="email" autoComplete="email" required placeholder="nev@pelda.hu" /></label>
    <button className="btn btn-primary" type="submit">Szaktanácsadó meghívása →</button>
   </form>
  </section>

  <section className={`panel ${styles.section}`} data-help-block="system-user-register">
   <div className={`panel-heading ${styles.sectionHeading}`}><div><span className="eyebrow">FELHASZNÁLÓI NYILVÁNTARTÁS</span><h2>Felhasználók és jogosultságok</h2><p>Az egyes fiókok szakmai szerepköre és rendszerjoga külön látható.</p></div><BlockHelpButton label="A felhasználói nyilvántartás magyarázata" content={{title:"Felhasználók és rendszerjogok",body:"A táblázat a rendszerben lévő felhasználókat, szakmai szerepüket, rendszerjogukat, telefonszámukat és létrehozási idejüket mutatja. A szakmai szerep azt jelzi, hogy gazdálkodó vagy szaktanácsadó; a rendszerjog ettől külön kezeli a rendszeradminisztrátori hozzáférést.",important:"A rendszeradmin jogosultság kritikus hozzáférés, ezért nem módosítható egyszerű kapcsolóval ebből a listából. A szakmai szerepkör és a rendszeradmin jogosultság két külön jogosultsági réteg."}}/></div>
   <div className={styles.tableRegion} role="region" aria-label="Felhasználói nyilvántartás" tabIndex={0}>
    <table className={styles.table}>
     <thead><tr><th scope="col">Név</th><th scope="col">Szakmai szerep</th><th scope="col">Rendszerjog</th><th scope="col">Telefon</th><th scope="col">Létrehozva</th></tr></thead>
     <tbody>{users.length?users.map(user=><tr key={user.id}>
      <td data-label="Név"><div className={styles.person}><span className={styles.avatar} aria-hidden="true">{(user.full_name||"F").trim().slice(0,1).toLocaleUpperCase("hu-HU")}</span><div className={styles.personText}><strong>{user.full_name||"Névtelen felhasználó"}</strong><small>{user.id}</small></div></div></td>
      <td data-label="Szakmai szerep"><span className={styles.roleBadge}>{user.role==="advisor"?"Szaktanácsadó":"Gazdálkodó"}</span></td>
      <td data-label="Rendszerjog"><span className={`${styles.roleBadge} ${user.system_role==="admin"?styles.adminBadge:styles.normalBadge}`}>{user.system_role==="admin"?"Rendszeradmin":"Normál"}</span></td>
      <td data-label="Telefon"><span className={styles.cellText}>{user.phone||"—"}</span></td>
      <td data-label="Létrehozva"><time className={styles.cellText} dateTime={user.created_at||undefined}>{user.created_at?new Date(user.created_at).toLocaleDateString("hu-HU"):"—"}</time></td>
     </tr>):<tr><td colSpan={5} className={styles.empty}>Még nincs felhasználó a nyilvántartásban.</td></tr>}</tbody>
    </table>
   </div>
   <div className={`notice ${styles.securityNotice}`}>Az adminjog kiosztása szándékosan nem egyszerű kapcsoló. A jogosultság-emelés kritikus, friss MFA-val védett művelet.</div>
  </section>
 </main>;
}
