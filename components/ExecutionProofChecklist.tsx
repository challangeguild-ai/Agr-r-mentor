import {validateExecutionProof,type ExecutionProof} from "@/lib/dailyWorkFlow";

export function ExecutionProofChecklist({proof}:{proof:ExecutionProof}){
 const result=validateExecutionProof(proof);
 return <section className="panel" data-help-block="execution-proof-checklist"><div className="panel-heading"><div><span className="eyebrow">VÉGREHAJTÁSI BIZONYÍTÉK</span><h2>{result.valid?"Ellenőrzésre kész":"Hiányzó adatok"}</h2></div><span className="user-pill">{result.valid?"Rendben":`${result.missing.length} hiány`}</span></div><div style={{padding:14}}>{result.valid?<p style={{margin:0}}>A minimális végrehajtási bizonyíték rendelkezésre áll: tényleges időpont, megjegyzés és fénykép.</p>:<ul style={{margin:0,paddingLeft:20}}>{result.missing.map(item=><li key={item}>{item}</li>)}</ul>}</div></section>;
}
