import {NotificationBell} from "@/components/NotificationBell";
import styles from "./FarmerTopbar.module.css";

export function FarmerTopbar({
 userName="Gazdálkodó",
 placeholder="Keresés táblák, feladatok és események között…",
 defaultQuery=""
}:{userName?:string;placeholder?:string;defaultQuery?:string}){
 const initial=userName.trim().slice(0,1).toUpperCase()||"G";
 return <header className={styles.bar}>
  <form className={styles.search} action="/dashboard" method="get">
   <span aria-hidden="true">⌕</span>
   <input name="q" defaultValue={defaultQuery} placeholder="Keresés…" aria-label={placeholder} title={placeholder}/>
   <button type="submit">Keresés</button>
  </form>
  <div className={styles.actions}>
   <NotificationBell/>
   <div className={styles.profile} title={userName}>
    <span className={styles.avatar}>{initial}</span>
    <span className={styles.profileText}><strong>{userName}</strong><small>Gazdálkodó</small></span>
   </div>
  </div>
 </header>;
}
