import Link from "next/link";
import type {FollowUpSuggestion} from "@/lib/dailyWorkFollowUpView";

export function FollowUpSuggestionBoard({items,title="Javasolt utánkövetések",scope}:{items:FollowUpSuggestion[];title?:string;scope:"farmer"|"advisor"}){
 if(!items.length)return null;
 return <section className="panel" data-help-block="daily-follow-up"><div className="panel-heading"><div><span className="eyebrow">UTÁNKÖVETÉS</span><h2>{title}</h2><p>A lezárt szakmai eseményekből számított ellenőrzési javaslatok. A rendszer ezeket nem hozza létre automatikusan teendőként.</p></div></div><div className="task-list">
  {items.slice(0,8).map(item=>{const href=item.fieldId?(scope==="advisor"?`/admin/fields/${item.fieldId}`:`/fields/${item.fieldId}`):null;return <div className="task-row" key={item.id}><div><strong>{item.title}</strong><div className="task-meta">Javasolt határidő: {item.dueAt} · {item.priority==="urgent"?"Sürgős":item.priority==="high"?"Magas":"Normál"}</div></div>{href?<Link className="ghost-btn" href={href}>Tábla →</Link>:null}</div>})}
 </div></section>;
}
