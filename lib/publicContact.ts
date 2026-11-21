const contactSubject="Agrár Mentor – kapcsolatfelvétel";
const contactBody=[
 "Üdvözlöm!",
 "",
 "Szeretnék érdeklődni az Agrár Mentor szolgáltatásról.",
 "",
 "Név:",
 "Gazdaság / település:",
 "Telefonszám (nem kötelező):",
 "Kérdésem:",
].join("\n");

/** A publikus kapcsolatfelvétel csak ellenőrzött, projekthez rendelt e-mail-címre nyílhat. */
export function publicContactHref(configuredEmail:string|undefined|null){
 const email=configuredEmail?.trim()??"";
 if(!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email))return null;
 return `mailto:${email}?subject=${encodeURIComponent(contactSubject)}&body=${encodeURIComponent(contactBody)}`;
}
