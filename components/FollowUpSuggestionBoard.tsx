import Link from "next/link";
import type {FollowUpSuggestion} from "@/lib/dailyWorkFollowUpView";

export function FollowUpSuggestionBoard({items,title="Javasolt utánkövetések"}:{items:FollowUpSuggestion[];title?:string}){
 if(!items.length)return null;
 return <section className="panel" data-help-block="daily-follow-up"><div className="panel-heading"><div><span className="eyebrow">UTÁNKÖVETÉS</span><h2>{title}</h2><p>A lezárt szakmai eseményekből számított ellenőrzési javaslatok. A rendszer ezeket nem hozza létre automatikusan teendőként.</p></div></div><div className="task-list">
  {items.slice(0,8).map(item=><div className="task-row" key={item.id}><div><strong>{item.title}</strong><div className="task-meta">Javasolt határidő: {item.dueAt} · {item.priority==="urgent"?"Sürgős":item.priority==="high"?"Magas":"Normál"}</div></div>{item.fieldId?<Link className="ghost-btn" href={`/fields/${item.fieldId}`}>Tábla →</Link>:null}</div>)}
 </div></section>;
}
