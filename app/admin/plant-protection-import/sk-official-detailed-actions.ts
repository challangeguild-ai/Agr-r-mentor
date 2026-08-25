"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, string>;

type SheetParseResult = {
  rows: Row[];
  headerKeys: string[];
  headerIndex: number;
  headerDepth: number;
};

export type SkOfficialDetailedSyncResult = {
  ok: boolean;
  error?: string;
  rows?: number;
  inserted_products?: number;
  inserted_uses?: number;
  updated_uses?: number;
  inserted_ingredients?: number;
  source_url?: string;
  sheets?: number;
  products?: number;
  crops?: number;
  with_dose?: number;
  with_target?: number;
};

const aliases: Record<string, string> = {
  "obchodny nazov pripravku": "name",
  "nazov pripravku": "name",
  pripravok: "name",
  "nazov por": "name",
  "cislo autorizacie": "authorization_number",
  "cislo povolenia": "authorization_number",
  "autorizacne cislo": "authorization_number",
  "typ funkcie pripravku": "function_type",
  "funkcia pripravku": "function_type",
  funkcia: "function_type",
  plodina: "crop",
  "plodina alebo oblast pouzitia": "crop",
  "oblast pouzitia": "crop",
  pouzitie: "crop",
  "skodlivy organizmus alebo iny ucel pouzitia": "target",
  "skodlivy organizmus": "target",
  "skodlivy cinitel": "target",
  "ucel pouzitia": "target",
  skodca: "target",
  davka: "dose_raw",
  "davka pripravku": "dose_raw",
  "maximalna davka": "dose_raw",
  "max davka mj": "dose_raw",
  "minimalna davka": "dose_min",
  "jednotka davky": "dose_unit",
  "merna jednotka davky": "dose_unit",
  "sposob aplikacie": "application_method",
  "metoda aplikacie": "application_method",
  "metoda pouzitia": "application_method",
  "ochranna doba": "phi_raw",
  "ochranna lehota": "phi_raw",
  phi: "phi_raw",
  "bbch od": "bbch_min",
  "bbch min": "bbch_min",
  "rastova faza od": "bbch_min",
  "stadium rastu od": "bbch_min",
  "bbch do": "bbch_max",
  "bbch max": "bbch_max",
  "rastova faza do": "bbch_max",
  "stadium rastu do": "bbch_max",
  "rastova faza": "bbch_range",
  "rastove stadium": "bbch_range",
  bbch: "bbch_range",
  "maximalny pocet aplikacii": "max_applications",
  "max pocet aplikacii": "max_applications",
  "pocet aplikacii": "max_applications",
  "max pocet pouziti": "max_applications",
  "max pocet pouziti / sezona": "max_applications_season",
  "interval medzi aplikaciami": "application_interval_days",
  "interval aplikacie": "application_interval_days",
  interval: "application_interval_days",
  "mnozstvo vody": "water_raw",
  "objem vody": "water_raw",
  "mnozstvo vody od": "water_volume_min",
  "objem vody od": "water_volume_min",
  "minimalne mnozstvo vody": "water_volume_min",
  "mnozstvo vody do": "water_volume_max",
  "objem vody do": "water_volume_max",
  "maximalne mnozstvo vody": "water_volume_max",
  "termin aplikacie": "application_timing",
  "cas aplikacie": "application_timing",
  "poznamka k aplikacii": "application_timing",
  obmedzenia: "restrictions",
  obmedzenie: "restrictions",
  "osobitne podmienky": "restrictions",
  "podmienky pouzitia": "restrictions",
  poznamka: "restrictions",
  "ucinna latka": "ingredient",
  "nazov ucinnej latky": "ingredient",
  "chemicka latka": "ingredient",
  "aktivna zlozka": "ingredient",
  "ucinna latka / aktivna zlozka": "ingredient",
  "max davka / sezona mj": "seasonal_dose_raw",
  formulacia: "formulation",
  "tank mix": "tank_mix",
  "minoritne pouzitie": "minor_use",
};

const LIST_PAGES = [
  "https://www.uksup.sk/orp-zoznamy-pripravkov-na-ochranu-rastlin",
  "https://beta.uksup.sk/orp-zoznamy-pripravkov-na-ochranu-rastlin",
];

const IMPORTANT_KEYS = new Set([
  "name",
  "authorization_number",
  "function_type",
  "crop",
  "target",
  "dose_raw",
  "dose_min",
  "dose_unit",
  "application_method",
  "phi_raw",
  "bbch_min",
  "bbch_max",
  "bbch_range",
  "max_applications",
  "application_interval_days",
  "water_raw",
  "water_volume_min",
  "water_volume_max",
  "application_timing",
  "restrictions",
  "ingredient",
]);

function norm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[._–—-]+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ");
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function headerKey(value: string) {
  const n = norm(value).replace(/^\d+[a-z]?\s*/, "");
  if (!n) return "";
  if (aliases[n]) return aliases[n];

  if (
    (n.includes("skodliv") && (n.includes("organiz") || n.includes("cinitel"))) ||
    n.includes("skodca")
  ) {
    return "target";
  }
  if (n.includes("iny") && n.includes("ucel") && n.includes("pouzitia")) {
    return "target";
  }
  if (n.includes("ucel") && n.includes("pouzitia") && !n.includes("oblast")) {
    return "target";
  }
  if (n.includes("plodin") || (n.includes("oblast") && n.includes("pouzitia"))) {
    return "crop";
  }
  if ((n.includes("ucinna") && n.includes("latka")) || (n.includes("aktivna") && n.includes("zlozka"))) {
    return "ingredient";
  }
  if (n.includes("ochrann") && (n.includes("dob") || n.includes("lehot"))) {
    return "phi_raw";
  }
  if (n.includes("bbch") || n.includes("rastov") || n.includes("stadium")) {
    if (n.includes("od") || n.includes("min")) return "bbch_min";
    if (n.includes("do") || n.includes("max")) return "bbch_max";
    return "bbch_range";
  }
  if (n.includes("pocet") && (n.includes("aplik") || n.includes("pouziti"))) {
    if (n.includes("sezona")) return "max_applications_season";
    return "max_applications";
  }
  if (n.includes("max") && n.includes("davka")) {
    if (n.includes("sezona")) return "seasonal_dose_raw";
    return "dose_raw";
  }
  if (n.includes("interval") && n.includes("aplik")) return "application_interval_days";
  if ((n.includes("mnozstvo") || n.includes("objem")) && n.includes("vod")) {
    if (n.includes("od") || n.includes("min")) return "water_volume_min";
    if (n.includes("do") || n.includes("max")) return "water_volume_max";
    return "water_raw";
  }
  if ((n.includes("termin") || n.includes("cas")) && n.includes("aplik")) {
    return "application_timing";
  }
  if (n.includes("obmedzen") || n.includes("podmien") || n.includes("poznam")) {
    return "restrictions";
  }

  return n.replace(/\s+/g, "_");
}

function numbers(value: string) {
  return (value.replace(/,/g, ".").match(/\d+(?:\.\d+)?/g) || [])
    .map(Number)
    .filter(Number.isFinite);
}

function measureUnit(value: string) {
  return (
    value.match(/(?:ml|l|kg|g)\s*\/\s*(?:ha|100\s*l)|(?:ml|l|kg|g)\b/i)?.[0]
      ?.replace(/\s+/g, "") || ""
  );
}

function appendText(a: string, b: string) {
  return [a, b].filter(Boolean).join(" · ");
}

function normalizeRow(original: Row) {
  const row = { ...original };

  const dose = String(row.dose_raw || "");
  if (dose) {
    const n = numbers(dose);
    if (n.length) {
      row.dose_min = String(n.length > 1 ? Math.min(...n) : n[0]);
      row.dose_max = String(n.length > 1 ? Math.max(...n) : n[0]);
    }
    if (!row.dose_unit) row.dose_unit = measureUnit(dose);
  }

  const water = String(row.water_raw || "");
  if (water) {
    const n = numbers(water);
    if (n.length) {
      row.water_volume_min = String(n.length > 1 ? Math.min(...n) : n[0]);
      row.water_volume_max = String(n.length > 1 ? Math.max(...n) : n[0]);
    }
    row.water_volume_unit = measureUnit(water) || "l/ha";
  }

  const bbch = String(row.bbch_range || "");
  if (bbch) {
    const n = numbers(bbch)
      .map(Math.trunc)
      .filter((x) => x >= 0 && x <= 99);
    if (n.length) {
      row.bbch_min = String(Math.min(...n));
      row.bbch_max = String(Math.max(...n));
    }
  }

  const phi = String(row.phi_raw || "").trim();
  if (phi) {
    const n = numbers(phi);
    if (n.length) row.phi_days = String(Math.trunc(n[0]));
    else row.restrictions = appendText(row.restrictions || "", `Ochranná doba: ${phi}`);
  }

  if (row.max_applications_season) {
    row.restrictions = appendText(
      row.restrictions || "",
      `Max. počet použití / sezóna: ${row.max_applications_season}`,
    );
  }
  if (row.seasonal_dose_raw) {
    row.restrictions = appendText(
      row.restrictions || "",
      `Max. dávka / sezóna: ${row.seasonal_dose_raw}`,
    );
  }
  if (row.formulation) {
    row.restrictions = appendText(row.restrictions || "", `Formulácia: ${row.formulation}`);
  }
  if (row.tank_mix) {
    row.restrictions = appendText(row.restrictions || "", `Tank-mix: ${row.tank_mix}`);
  }
  if (row.minor_use) {
    row.restrictions = appendText(row.restrictions || "", `Minoritné použitie: ${row.minor_use}`);
  }

  for (const k of ["bbch_min", "bbch_max", "max_applications", "application_interval_days"]) {
    const n = numbers(String(row[k] || ""));
    row[k] = n.length ? String(Math.trunc(n[0])) : "";
  }

  for (const k of ["dose_min", "dose_max", "water_volume_min", "water_volume_max"]) {
    const n = numbers(String(row[k] || ""));
    row[k] = n.length ? String(n[0]) : "";
  }

  if (row.bbch_min && Number(row.bbch_min) > 99) row.bbch_min = "";
  if (row.bbch_max && Number(row.bbch_max) > 99) row.bbch_max = "";
  if (row.bbch_min && row.bbch_max && Number(row.bbch_min) > Number(row.bbch_max)) {
    [row.bbch_min, row.bbch_max] = [row.bbch_max, row.bbch_min];
  }
  if (
    row.water_volume_min &&
    row.water_volume_max &&
    Number(row.water_volume_min) > Number(row.water_volume_max)
  ) {
    [row.water_volume_min, row.water_volume_max] = [
      row.water_volume_max,
      row.water_volume_min,
    ];
  }

  row.source_reference = row.source_reference || "ÚKSÚP – rozsah použitia (hivatalos XLSX)";
  return row;
}

function combineHeaderRows(
  matrix: (string | number | null)[][],
  start: number,
  depth: number,
) {
  const maxCols = Math.max(
    0,
    ...matrix.slice(start, start + depth).map((r) => r?.length || 0),
  );
  const labels: string[] = [];

  for (let col = 0; col < maxCols; col++) {
    const parts: string[] = [];
    for (let row = start; row < start + depth; row++) {
      const raw = String(matrix[row]?.[col] ?? "").trim();
      if (!raw) continue;
      const normalized = norm(raw);
      if (!normalized) continue;
      if (!parts.some((p) => norm(p) === normalized)) parts.push(raw);
    }
    labels[col] = parts.join(" ").trim();
  }

  return labels;
}

function scoreHeader(keys: string[]) {
  const unique = new Set(keys.filter(Boolean));
  if (!unique.has("name") || !unique.has("crop")) return -1;

  let score = 50;
  for (const key of unique) {
    if (IMPORTANT_KEYS.has(key)) score += 4;
  }
  if (unique.has("target")) score += 25;
  if (unique.has("dose_raw") || unique.has("dose_min")) score += 10;
  if (unique.has("phi_raw")) score += 4;
  if (unique.has("bbch_range") || unique.has("bbch_min") || unique.has("bbch_max")) score += 4;
  return score;
}

function detectHeader(matrix: (string | number | null)[][]) {
  let best:
    | {
        start: number;
        depth: number;
        labels: string[];
        keys: string[];
        score: number;
      }
    | undefined;

  const maxStart = Math.min(matrix.length, 60);
  for (let start = 0; start < maxStart; start++) {
    for (let depth = 1; depth <= 3 && start + depth <= matrix.length; depth++) {
      const labels = combineHeaderRows(matrix, start, depth);
      const keys = labels.map(headerKey);
      const score = scoreHeader(keys);
      if (score < 0) continue;
      if (!best || score > best.score || (score === best.score && depth < best.depth)) {
        best = { start, depth, labels, keys, score };
      }
    }
  }

  return best;
}

function sheetRows(sheet: XLSX.WorkSheet): SheetParseResult {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown as (string | number | null)[][];

  const detected = detectHeader(matrix);
  if (!detected) {
    return { rows: [], headerKeys: [], headerIndex: -1, headerDepth: 0 };
  }

  const header = detected.keys;
  const dataStart = detected.start + detected.depth;
  const out: Row[] = [];
  let carry: Row = {};

  for (const cells of matrix.slice(dataStart)) {
    const row: Row = {};
    header.forEach((h, i) => {
      if (h) row[h] = String(cells?.[i] ?? "").trim();
    });

    for (const key of ["name", "authorization_number", "function_type", "ingredient"]) {
      if (row[key]) carry[key] = row[key];
      else if (carry[key]) row[key] = carry[key];
    }

    if (!row.name || !row.crop) continue;
    const n = normalizeRow(row);
    if (n.name && n.crop) out.push(n);
  }

  return {
    rows: out,
    headerKeys: header.filter(Boolean),
    headerIndex: detected.start,
    headerDepth: detected.depth,
  };
}

function workbookRows(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const rows: Row[] = [];
  const diagnostics: string[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const parsed = sheetRows(sheet);
    rows.push(...parsed.rows);
    diagnostics.push(
      `${name}: fejléc ${parsed.headerIndex + 1}. sor, ${parsed.headerDepth} sor mély; mezők: ${parsed.headerKeys.join(", ") || "nincs felismerhető fejléc"}`,
    );
  }

  const dedup = new Map<string, Row>();
  for (const row of rows) {
    const key = [
      row.name,
      row.authorization_number,
      row.crop,
      row.target,
      row.dose_max,
      row.dose_unit,
      row.application_method,
      row.bbch_min,
      row.bbch_max,
    ]
      .map((v) => norm(v || ""))
      .join("|");
    if (!dedup.has(key)) dedup.set(key, row);
  }

  const unique = [...dedup.values()];
  const products = new Set(unique.map((r) => norm(r.name))).size;
  const crops = new Set(unique.map((r) => norm(r.crop))).size;
  const withDose = unique.filter((r) => r.dose_max || r.dose_min).length;
  const withTarget = unique.filter((r) => r.target).length;

  if (unique.length < 100 || products < 20 || crops < 5) {
    throw new Error(
      `A részletes XLSX szerkezete gyanús: ${unique.length} felhasználás, ${products} készítmény, ${crops} kultúra. Import megszakítva. Diagnosztika: ${diagnostics.join(" | ")}`,
    );
  }

  if (withTarget === 0) {
    throw new Error(
      `A részletes XLSX ${unique.length} felhasználást tartalmaz, de egyetlen célkárosító/célfelhasználás sem volt felismerhető. Import megszakítva. Felismert fejléc: ${diagnostics.join(" | ")}`,
    );
  }

  return {
    rows: unique,
    sheets: wb.SheetNames.length,
    products,
    crops,
    withDose,
    withTarget,
  };
}

async function fetchText(url: string, timeout = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, {
      cache: "no-store",
      signal: c.signal,
      headers: {
        "user-agent": "Agrar-Mentor/1.0 UKSUP detailed sync",
        accept: "text/html,*/*",
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchBinary(url: string, timeout = 30000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, {
      cache: "no-store",
      signal: c.signal,
      headers: {
        "user-agent": "Agrar-Mentor/1.0 UKSUP detailed sync",
        accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*",
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const b = await r.arrayBuffer();
    if (b.byteLength < 10000) throw new Error("A letöltött XLSX túl kicsi.");
    if (b.byteLength > 30 * 1024 * 1024) {
      throw new Error("A letöltött XLSX szokatlanul nagy; biztonsági okból nem dolgozom fel.");
    }
    const sig = new Uint8Array(b.slice(0, 4));
    if (!(sig[0] === 0x50 && sig[1] === 0x4b)) {
      throw new Error("A letöltött állomány nem XLSX/ZIP formátumú.");
    }
    return b;
  } finally {
    clearTimeout(t);
  }
}

async function discoverWorkbook() {
  const problems: string[] = [];

  for (const page of LIST_PAGES) {
    try {
      const html = await fetchText(page);
      const anchors = [
        ...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
      ];
      const candidates = anchors
        .map((m) => ({ href: m[1], text: stripHtml(m[2]) }))
        .map((x) => ({
          ...x,
          score:
            (norm(x.text).includes("rozsahom ich pouzitia") ? 100 : 0) +
            (norm(x.text).includes("autorizovanych a povolenych") ? 60 : 0) +
            (x.href.toLowerCase().includes("xlsx") ? 20 : 0),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      for (const candidate of candidates) {
        try {
          const url = new URL(candidate.href, page).toString();
          const buffer = await fetchBinary(url);
          const parsed = workbookRows(buffer);
          return { url, ...parsed };
        } catch (e) {
          problems.push(
            `${new URL(page).host}: ${e instanceof Error ? e.message : "XLSX hiba"}`,
          );
        }
      }

      problems.push(`${new URL(page).host}: nem találtam megfelelő részletes XLSX hivatkozást`);
    } catch (e) {
      problems.push(`${new URL(page).host}: ${e instanceof Error ? e.message : "oldalhiba"}`);
    }
  }

  throw new Error(
    `A hivatalos ÚKSÚP részletes XLSX automatikus letöltése nem sikerült. ${problems
      .slice(-6)
      .join("; ")}`,
  );
}

async function advisorContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "advisor") {
    throw new Error("Csak szaktanácsadó/admin indíthat ÚKSÚP részletes szinkront.");
  }

  return { supabase, user };
}

export async function syncUksupOfficialDetailedUses(): Promise<SkOfficialDetailedSyncResult> {
  try {
    const { supabase } = await advisorContext();
    const { url, rows, sheets, products, crops, withDose, withTarget } =
      await discoverWorkbook();

    const totals = {
      rows: 0,
      inserted_products: 0,
      inserted_uses: 0,
      updated_uses: 0,
      inserted_ingredients: 0,
    };

    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      const { data, error } = await supabase.rpc("import_plant_protection_catalog", {
        p_country_code: "SK",
        p_source_name: "ÚKSÚP – hivatalos részletes felhasználási XLSX",
        p_source_url: url,
        p_rows: chunk,
        p_notes: `Automatikus részletes ÚKSÚP XLSX szinkron; ${rows.length} rekord, ${sheets} munkalap, ${products} készítmény, ${crops} kultúra.`,
      });
      if (error) throw new Error(error.message);

      const d: any = data || {};
      totals.rows += Number(d.rows || chunk.length);
      totals.inserted_products += Number(d.inserted_products || 0);
      totals.inserted_uses += Number(d.inserted_uses || 0);
      totals.updated_uses += Number(d.updated_uses || 0);
      totals.inserted_ingredients += Number(d.inserted_ingredients || 0);
    }

    revalidatePath("/admin/plant-protection-import");
    revalidatePath("/operations");

    return {
      ok: true,
      ...totals,
      source_url: url,
      sheets,
      products,
      crops,
      with_dose: withDose,
      with_target: withTarget,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Az ÚKSÚP részletes automatikus szinkron ismeretlen hiba miatt megszakadt.",
    };
  }
}