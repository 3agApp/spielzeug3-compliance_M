/**
 * scripts/scrapeRivaProducts2.mjs
 * Scrapes RIVA Filter product catalog using sitemap URLs
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL missing"); process.exit(1); }

const SUPPLIER_ID = 90001;

// Category detection
function detectCategory(name, url) {
  const n = (name + " " + url).toLowerCase();
  if (n.includes("duschfilter") || n.includes("duschanschluss") || n.includes("skin") || n.includes("hair")) return "Duschfilter";
  if (n.includes("outdoor") || n.includes("camping") || n.includes("explorer") || n.includes("safepro") || n.includes("overland")) return "Outdoor-/Campingfilter";
  if (n.includes("ersatzkartusche") || n.includes("kartusche")) return "Ersatzkartusche";
  if (n.includes("adapter") || n.includes("anschluss") || n.includes("schlauchanschluss") || n.includes("eckventil") || n.includes("schnellkupplung") || n.includes("wandabstand") || n.includes("tool") || n.includes("schluessel") || n.includes("mikrofasertuch")) return "Zubehör";
  if (n.includes("vorfilter") || n.includes("sediment")) return "Vorfilter";
  if (n.includes("mex") || n.includes("pfas") || n.includes("nano")) return "PFAS/Nanoplastik-Filter";
  if (n.includes("kalk")) return "Kalkfilter";
  if (n.includes("jova") || n.includes("viva") || n.includes("wasserhahn")) return "Wasserhahnfilter";
  if (n.includes("life") || n.includes("pura")) return "Trinkwasserfilter (Life-Serie)";
  if (n.includes("multi")) return "Trinkwasserfilter (Multi)";
  return "Trinkwasserfilter";
}

function detectBrand(name, url) {
  const n = (name + " " + url).toLowerCase();
  if (n.includes("jova")) return "Jova EM";
  if (n.includes("viva")) return "Viva";
  if (n.includes("rivaalva") || n.includes("riva alva")) return "rivaALVA";
  return "RIVA Filter";
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceBot/1.0)",
      Accept: "text/html,*/*",
    },
    signal: AbortSignal.timeout(12_000),
  });
  return res.text();
}

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPrice(text) {
  // Match patterns like "39,99 €" or "€39.99"
  const m = text.match(/(\d{1,3}[,\.]\d{2})\s*€/) || text.match(/€\s*(\d{1,3}[,\.]\d{2})/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

async function scrapeProduct(url) {
  try {
    const html = await fetchPage(url);
    const text = extractText(html);

    // Extract title from og:title or h1
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    const h1 = html.match(/<h1[^>]*class=["'][^"']*product[^"']*["'][^>]*>([^<]+)<\/h1>/i)?.[1]
      || html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
    
    let productName = (ogTitle || h1 || "").trim();
    productName = productName.replace(/\s*[-–|].*$/, '').replace(/\s+/g, ' ').trim();
    if (!productName || productName.length < 3 || productName.toLowerCase().includes("hoppla") || productName.toLowerCase().includes("404")) return null;

    // Extract description
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1]
      || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];

    // Extract price
    const price = extractPrice(text);

    // Extract image
    const imageUrl = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];

    // Extract SKU/article number
    const sku = html.match(/["']sku["']\s*:\s*["']([^"']+)["']/i)?.[1]
      || html.match(/data-product_sku=["']([^"']+)["']/i)?.[1]
      || url.split('/produkt/')[1]?.replace(/\//g, '').slice(0, 64);

    // Extract key product claims (first 3000 chars of visible text)
    const shortText = text.slice(0, 3000);

    const category = detectCategory(productName, url);
    const brand = detectBrand(productName, url);

    return {
      productName,
      description: (ogDesc || shortText.slice(0, 500)).slice(0, 1000),
      price,
      imageUrl: imageUrl || null,
      sourceUrl: url,
      rawText: shortText,
      category,
      brand,
      supplierArticleNumber: sku?.slice(0, 64) || url.split('/produkt/')[1]?.replace(/\//g, '').slice(0, 64),
    };
  } catch (e) {
    console.log(`  ✗ ${url}: ${e.message}`);
    return null;
  }
}

// Read URLs from file
const urls = readFileSync("/home/ubuntu/riva_docs/product_urls.txt", "utf8")
  .split("\n")
  .map(l => l.trim())
  .filter(l => l.startsWith("http"));

console.log(`Scraping ${urls.length} products from sitemap...`);

const db = await createConnection(DATABASE_URL);

try {
  // Check existing
  const [existing] = await db.execute(
    "SELECT supplierArticleNumber, productName FROM products WHERE supplierId = ?",
    [SUPPLIER_ID]
  );
  const existingNums = new Set(existing.map(r => r.supplierArticleNumber));
  console.log(`Already in DB: ${existingNums.size} products`);

  const products = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const url of urls) {
    const product = await scrapeProduct(url);
    if (!product) { failed++; continue; }
    
    products.push(product);

    if (existingNums.has(product.supplierArticleNumber)) {
      console.log(`  ~ SKIP: ${product.productName}`);
      skipped++;
      continue;
    }

    await db.execute(
      `INSERT INTO products 
       (supplierId, productName, supplierArticleNumber, brand, imageUrl, status, tenantId)
       VALUES (?, ?, ?, ?, ?, 'open', 1)
       ON DUPLICATE KEY UPDATE productName = VALUES(productName)`,
      [
        SUPPLIER_ID,
        product.productName,
        product.supplierArticleNumber,
        product.brand,
        product.imageUrl,
      ]
    );
    console.log(`  ✓ IMPORT: ${product.productName} [${product.category}]`);
    imported++;

    // Small delay
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Done: ${imported} imported, ${skipped} skipped, ${failed} failed`);

  // Save for analysis
  const { writeFileSync } = await import("fs");
  writeFileSync("/home/ubuntu/riva_docs/scraped_products.json", JSON.stringify(products, null, 2));
  console.log(`Saved ${products.length} products to scraped_products.json`);

} finally {
  await db.end();
}
