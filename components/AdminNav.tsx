import Link from "next/link";

const items=[
  {href:"/admin",key:"overview",label:"Áttekintés"},
  {href:"/admin/priorities",key:"priorities",label:"Mai prioritások"},
  {href:"/admin/supervision",key:"supervision",label:"Szemlézési szezonok"},
  {href:"/admin/clients",key:"clients",label:"Ügyfelek"},
  {href:"/admin/team",key:"team",label:"Munkatársak"},
  {href:"/admin/map",key:"map",label:"Térkép"},
  {href:"/admin/operations",key:"operations",label:"Műveleti napló"},
  {href:"/admin/reports",key:"reports",label:"Bejelentések"},
  {href:"/admin/inspections",key:"inspections",label:"Szemlék"},
  {href:"/admin/tasks",key:"tasks",label:"Teendők"},
  {href:"/admin/documents",key:"documents",label:"Dokumentumok"},
  {href:"/admin/timeline",key:"timeline",label:"Idővonal"},
  {href:"/notifications",key:"notifications",label:"Értesítések"},
];

export function AdminNav({active="overview"}:{active?:string}){
  return <><style>{`.admin-subnav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px;padding:8px;background:#fff;border:1px solid #dfe5df;border-radius:16px}.admin-subnav a{padding:10px 14px;border-radius:11px;font-size:13px;font-weight:800;color:#5f6f65}.admin-subnav a.active{background:#174a32;color:#fff}.admin-overview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}.admin-overview-card{display:block;background:#fff;border:1px solid #dfe5df;border-radius:18px;padding:20px;transition:.15s}.admin-overview-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(23,74,50,.08)}.admin-overview-card span{font-size:13px;color:#6f7c74}.admin-overview-card strong{display:block;font-size:34px;color:#174a32;margin:8px 0}.admin-overview-card small{color:#8a958f}.admin-row.compact{grid-template-columns:1fr auto auto}.report-workflow-card{padding:18px 0;border-top:1px solid #dfe5df}.report-workflow-card:first-child{border-top:0}.report-workflow-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.report-workflow-head small{display:block;color:#6f7c74;margin-top:4px}.report-actions{margin-top:14px}.report-reply-form{display:grid;gap:12px;margin-top:12px}.report-reply-form label{font-size:13px;font-weight:800}.report-reply-form textarea,.report-reply-form input,.report-reply-form select{width:100%;margin-top:6px;padding:11px 12px;border:1px solid #dfe5df;border-radius:10px;background:#fff;font:inherit}.report-task-options{display:grid;grid-template-columns:1.4fr .8fr .7fr;gap:10px}.report-buttons{display:flex;gap:8px;flex-wrap:wrap}.operation-form{grid-template-columns:repeat(3,minmax(0,1fr))}.operation-wide{grid-column:1/-1}@media(max-width:900px){.admin-overview-grid{grid-template-columns:repeat(2,1fr)}.operation-form{grid-template-columns:1fr 1fr}}@media(max-width:650px){.admin-subnav{display:grid;grid-template-columns:1fr 1fr}.admin-overview-grid{grid-template-columns:1fr 1fr}.admin-overview-card{padding:16px}.admin-overview-card strong{font-size:28px}.admin-row.compact{grid-template-columns:1fr}.report-task-options,.operation-form{grid-template-columns:1fr}.report-workflow-head{display:block}.report-status{display:inline-flex;margin-top:8px}}`}</style><nav className="admin-subnav">{items.map(item=><Link key={item.key} className={active===item.key?"active":""} href={item.href}>{item.label}</Link>)}</nav></>;
}
