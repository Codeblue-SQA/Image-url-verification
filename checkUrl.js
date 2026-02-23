require('dotenv').config();

const Airtable = require('airtable');
const fetch = require('node-fetch').default;
const fs = require('fs');

const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_TABLE_NAME;

const base = new Airtable({ apiKey: token }).base(baseId);

async function checkUrls() {
  let markdownReport = `# Daily Lead Image Verification Report\n\n`;

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const filename = `verification_report_${dateStr}.md`;
  await new Promise((resolve, reject) => {
    base(tableName).select({
    filterByFormula: `IS_SAME({Created_at_Auto_AT}, '2026-02-19', 'day')`
    }).eachPage(async (records, fetchNextPage) => {
      for (const record of records) {
        const imagesField = record.get('Image');
        if (!imagesField) continue;

        const urlList = typeof imagesField === "string"
          ? imagesField
              .split(/[,;\n]+/)
              .map(u => u.trim().replace(/^[-]+/, "")) 
              .filter(Boolean)
          : Array.isArray(imagesField)
            ? imagesField.map(att => att.url)
            : [];

        const results = [];
        let hasIssues = false;

        for (let i = 0; i < urlList.length; i++) {
          const url = urlList[i];
          try {
            const res = await fetch(url, { method: 'GET' });
            if (!res.ok) {
              results.push(`- URL ${i + 1}:  Broken (${res.status}) → ${url}`);
              hasIssues = true;
            }
          } catch (err) {
            results.push(`- URL ${i + 1}:  Error → ${url}`);
            hasIssues = true;
          }
        }

        if (hasIssues) {
          const leadName = record.get('Name') || record.get('Lead Number') || "Unknown Lead";
          markdownReport += `## Lead: ${leadName}\n`;
          markdownReport += results.join('\n') + `\n\n`;
        }
      }

      fetchNextPage();
    }, err => {
      if (err) reject(err);
      else resolve();
    });
  });

  fs.writeFileSync(filename, markdownReport, "utf8");
  console.log(` Markdown report generated: ${filename}`);
}
checkUrls();

