/** Escape untrusted labels before composing Leaflet's HTML-string popups. */
export function escapeHtml(value:string|number|null|undefined):string{
  return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
}
