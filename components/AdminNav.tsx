import Link from "next/link";

const items=[
  {href:"/admin",key:"overview",label:"Áttekintés"},
  {href:"/admin/clients",key:"clients",label:"Ügyfelek"},
  {href:"/admin/reports",key:"reports",label:"Bejelentések"},
  {href:"/admin/inspections",key:"inspections",label:"Szemlék"},
  {href:"/admin/tasks",key:"tasks",label:"Teendők"},
];

export function AdminNav({active="overview"}:{active?:string}){
  return <nav className="admin-subnav">{items.map(item=><Link key={item.key} className={active===item.key?"active":""} href={item.href}>{item.label}</Link>)}</nav>;
}
