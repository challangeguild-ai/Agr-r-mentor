import type {DailyWorkPriority} from "@/lib/dailyWorkPriority";
import {BlockHelpButton} from "@/components/GuidedTour";

export function DailyWorkSummary({items}:{items:DailyWorkPriority[]}){
 const critical=items.filter(i=>i.severity==="critical").length,high=items.filter(i=>i.severity==="high").length,overdue=items.filter(i=>i.overdue).length,today=items.filter(i=>i.dueToday).length;
 return <section className="daily-work-summary" data-help-block="daily-work-summary">
  <div className="daily-work-summary-help"><BlockHelpButton content={{title:"Napi munkák összesítése",body:"Ez a négy számláló a mai munkaközpont gyors állapotképe. Az Azonnali a kritikus prioritású tételeket, a Magas a kiemelt ügyeket, a Lejárt a határidőn túli munkákat, a Ma esedékes pedig a mai határidejű feladatokat mutatja.",important:"A kategóriák ugyanabból a prioritási számításból készülnek, amely a lentebbi napi munkasort rendezi; itt még nem történik automatikus végrehajtás vagy lezárás."}}/></div>
  <div className="daily-work-summary-grid">
   <article className="daily-work-summary-card"><span>Azonnali</span><strong>{critical}</strong><small>kritikus prioritás</small></article>
   <article className="daily-work-summary-card"><span>Magas</span><strong>{high}</strong><small>kiemelt tétel</small></article>
   <article className="daily-work-summary-card"><span>Lejárt</span><strong>{overdue}</strong><small>határidőn túli</small></article>
   <article className="daily-work-summary-card"><span>Ma esedékes</span><strong>{today}</strong><small>mai munkatétel</small></article>
  </div>
 </section>;
}
