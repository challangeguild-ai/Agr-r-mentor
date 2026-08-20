# Agrár Mentor

Első MVP: Next.js + Supabase alapú agrár-szaktanácsadói ügyfélportál.

## Funkciók az első verzióban
- publikus bemutatkozó oldal
- e-mail/jelszó alapú Supabase belépés
- védett `/dashboard`
- profil, gazdaság és teendő adatok lekérése Supabase-ből
- dashboard vizuális váz
- előkészített térképes panel

## Indítás
1. Másold `.env.example` fájlt `.env.local` néven.
2. Írd be a Supabase publishable key-t.
3. `npm install`
4. `npm run dev`

## Következő mérföldkő
Advisor adminfelület: új ügyfél + gazdaság + tábla létrehozása, majd valódi térképes poligon-kezelés.
