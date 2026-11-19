
const fs = require("fs");
const path = require("path");

const TSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnGbWpwSh3bQG1tCT5qwNnDsqBeuIRSjRuRbPv62sh9TUwCe9x4z6Z5m58SH0V2Kez5l6Q8WoMt_Ol/pub?gid=634911152&single=true&output=tsv";

const OUTPUT_PATH = "assistant-bivouac88/data/niamh-data.json";

async function run() {
  const response = await fetch(TSV_URL);

  if (!response.ok) {
    throw new Error(`Échec du téléchargement : ${response.status}`);
  }

  const content = await response.text();
  const lines = content
    .replace(/\r/g, "")
    .split("\n")
    .filter(line => line.trim());

  const data = {};
  const questions = {};

  // Première ligne = en-têtes du tableau
  for (const line of lines.slice(1)) {
    const [rawKey, rawValue = "", rawQuestions = ""] = line.split("\t");

    const key = rawKey?.trim();
    const value = rawValue.trim();

    if (!key) continue;

    data[key] = value;

    // Les formulations sont séparées par des points-virgules
    const formulations = rawQuestions
      .split(";")
      .map(item => item.trim())
      .filter(Boolean);

    if (formulations.length) {
      questions[key] = formulations;
    }
  }

  // Catalogue des formulations reconnues par Niamh
  data._questions = questions;

  data._updatedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), {
    recursive: true
  });

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(data, null, 2)
  );

  console.log(
    `Écrit ${Object.keys(data).length} champs dans ${OUTPUT_PATH}`
  );
  console.log(
    `${Object.keys(questions).length} champs disposent de formulations.`
  );
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
