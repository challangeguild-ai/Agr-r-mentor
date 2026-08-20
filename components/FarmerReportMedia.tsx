"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Media = { id: string; storage_path: string; file_name: string; media_type: "image" | "video" };

export function FarmerReportMedia({ items }: { items: Media[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const next: Record<string, string> = {};
      for (const item of items) {
        const { data } = await supabase.storage.from("farmer-report-media").createSignedUrl(item.storage_path, 3600);
        if (data?.signedUrl) next[item.id] = data.signedUrl;
      }
      if (alive) setUrls(next);
    })();
    return () => { alive = false; };
  }, [items]);
  if (!items.length) return null;
  return <div className="inspection-media-grid">{items.map(item => urls[item.id] ? (item.media_type === "image" ? <a key={item.id} href={urls[item.id]} target="_blank" rel="noreferrer"><img src={urls[item.id]} alt={item.file_name} /></a> : <video key={item.id} controls preload="metadata" src={urls[item.id]} />) : <div key={item.id} className="media-loading">Betöltés…</div>)}</div>;
}
