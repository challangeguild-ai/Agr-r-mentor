import test from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync} from "node:zlib";
import {
 parseHungaroMetStations,parseHungaroMetDailyCsv,parseHungaroMetDailyListing,unzipOfficialCsv
} from "../lib/weather/hungarometParsing.ts";

const dailyCsv=`##Meta
#StationNumber;StartDate;EndDate;Latitude;Longitude;Elevation;StationName;EOR
#73211;20260101;20261118;47.5000;19.0000;100;Budapest;EOR
##Meta END
StationNumber;Time;rau;Q_rau;tn;Q_tn;tx;Q_tx;EOR
73211;20261116;0;;2.1;;8.6;;EOR
73211;20261117;12.4;;-999;;11.8;;EOR
73211;20261118;-999;;3.4;;-999;;EOR
`;

test("station metadata accepts a commented HungaroMet header and rejects invalid coordinates",()=>{
 const csv=`\uFEFF##Meta
#StationNumber;Latitude;Longitude;Elevation;StationName;EOR
73211;47.5000;19.0000;100;Budapest;EOR
73212;47,7200;19,5400;-999;Gödöllő;EOR
73213;999;19.0;110;Hibás koordináta;EOR
73211;47.5000;19.0000;100;Ismétlés;EOR`;
 assert.deepEqual(parseHungaroMetStations(csv),[
  {stationNumber:"73211",name:"Budapest",latitude:47.5,longitude:19,elevation:100},
  {stationNumber:"73212",name:"Gödöllő",latitude:47.72,longitude:19.54,elevation:null}
 ]);
});

test("official metadata excludes discontinued stations and selects the current station period",()=>{
 const csv=`StationNumber;StartDate;EndDate;Latitude;Longitude;Elevation;StationName;EOR
46303;19950101;20121231;46.9131;19.7483;101;Megszűnt Kecskemét;EOR
46400;19950101;20171231;46.9000;19.7000;100;Régi hely;EOR
46400;20180101;20261121;46.9122;19.7597;110;Kecskemét repülőtér;EOR
46314;20200101;20261121;46.9167;19.7486;100;Repülőtér közép;EOR`;
 assert.deepEqual(parseHungaroMetStations(csv,"20261114"),[
  {stationNumber:"46400",name:"Kecskemét repülőtér",latitude:46.9122,longitude:19.7597,elevation:110},
  {stationNumber:"46314",name:"Repülőtér közép",latitude:46.9167,longitude:19.7486,elevation:100}
 ]);
 assert.throws(()=>parseHungaroMetStations("StationNumber;Latitude;Longitude\n12345;47;19","20261114"),/EndDate/);
});

test("daily directory listing contains published archive IDs, not retired metadata IDs",()=>{
 const index=`<html><a href="HABP_1D_46314_akt.zip">station</a>
  <a href="HABP_1D_46400_akt.zip">station</a></html>`;
 assert.deepEqual([...parseHungaroMetDailyListing(index)],["46314","46400"]);
 assert.throws(()=>parseHungaroMetDailyListing("<html>No daily archives</html>"),/állományjegyzék/);
});

test("daily CSV handles official meta lines, measured zero, precipitation and missing markers",()=>{
 const rows=parseHungaroMetDailyCsv(dailyCsv,"73211");
 assert.deepEqual(rows,[
  {stationNumber:"73211",date:"2026-11-16",precipitationMm:0,temperatureMinC:2.1,temperatureMaxC:8.6},
  {stationNumber:"73211",date:"2026-11-17",precipitationMm:12.4,temperatureMinC:null,temperatureMaxC:11.8},
  {stationNumber:"73211",date:"2026-11-18",precipitationMm:null,temperatureMinC:3.4,temperatureMaxC:null}
 ]);
});

test("impossible dates and negative precipitation cannot become daily measurements",()=>{
 const csv=`StationNumber;Time;rau;EOR
73211;20260230;8;EOR
73211;20261118;-4;EOR
73211;20261117;-999.0;EOR
73211;20261116;0,5;EOR`;
 assert.deepEqual(parseHungaroMetDailyCsv(csv,"73211").map(x=>[x.date,x.precipitationMm]),[
  ["2026-11-18",null],["2026-11-17",null],["2026-11-16",0.5]
 ]);
});

test("an unexpected station or missing columns fail visibly",()=>{
 assert.throws(()=>parseHungaroMetDailyCsv("StationNumber;Time;rau\n73212;20261118;6","73211"),/állomáseltérés/);
 assert.throws(()=>parseHungaroMetDailyCsv("Time;Temperature\n20261118;10","73211"),/fejléc/);
 assert.throws(()=>parseHungaroMetStations("Station;Latitude\n73211;47.5"),/fejléc/);
});

function zipWithEntries(files){
 const locals=[],central=[];
 let offset=0;
 for(const {name,text,deflated=false} of files){
  const filename=Buffer.from(name,"utf8"),body=Buffer.from(text,"utf8");
  const packed=deflated?deflateRawSync(body):body;
  const method=deflated?8:0;
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(method,8);
  local.writeUInt32LE(packed.length,18);local.writeUInt32LE(body.length,22);
  local.writeUInt16LE(filename.length,26);
  locals.push(local,filename,packed);
  const entry=Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(method,10);
  entry.writeUInt32LE(packed.length,20);entry.writeUInt32LE(body.length,24);
  entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);
  central.push(entry,filename);
  offset+=local.length+filename.length+packed.length;
 }
 const directory=Buffer.concat(central);
 const eocd=Buffer.alloc(22);
 eocd.writeUInt32LE(0x06054b50,0);
 eocd.writeUInt16LE(files.length,8);eocd.writeUInt16LE(files.length,10);
 eocd.writeUInt32LE(directory.length,12);eocd.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,directory,eocd]);
}

test("ZIP reader selects the CSV entry even when another file comes first",()=>{
 const zip=zipWithEntries([
  {name:"README.txt",text:"metadata only"},
  {name:"HABP_1D_20260101_20261118_73211.csv",text:dailyCsv,deflated:true}
 ]);
 assert.equal(unzipOfficialCsv(zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength)),dailyCsv);
});

test("malformed ZIP or archive without a CSV fails instead of inventing observations",()=>{
 assert.throws(()=>unzipOfficialCsv(new ArrayBuffer(10)),/ZIP/);
 const zip=zipWithEntries([{name:"README.txt",text:"not a CSV"}]);
 assert.throws(()=>unzipOfficialCsv(zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength)),/CSV fájl/);
});
