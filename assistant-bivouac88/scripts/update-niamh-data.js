const fs = require("fs");

const TSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnGbWpwSh3bQG1tCT5qwNnDsqBeuIRSjRuRbPv62sh9TUwCe9x4z6Z5m58SH0V2Kez5l6Q8WoMt_Ol/pub?gid=634911152&single=true&output=tsv";
const OUTPUT_PATH = "assistant-bivouac88/data/niamh-data.json";

async function run() {
  const response = await fetch(TSV_URL);
  if (!response.ok) throw new Error(`Échec du téléchargement : ${response.status}`);

  const text = await response.text();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const data = {};
  for (const line of lines.slice(1)) {
    const [key, ...rest] = line.split("\t");
    if (!key) continue;
    data[key.trim()] = rest.join("\t").trim();
  }

  data._updatedAt = new Date().toISOString();

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`Écrit ${Object.keys(data).length} champs dans ${OUTPUT_PATH}`);
}

run().catch(err => { console.error(err); process.exit(1); });
