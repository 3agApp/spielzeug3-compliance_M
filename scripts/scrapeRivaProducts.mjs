/**
 * scripts/scrapeRivaProducts.mjs
 * Scrapes RIVA Filter product catalog from riva-filter.de and imports into DB
 */
import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL missing"); process.exit(1); }

const SUPPLIER_ID = 90001;
const BASE_URL = "https://www.riva-filter.de";

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceBot/1.0)",
      Accept: "text/html,*/*",
    },
    signal: AbortSignal.timeout(15_000),
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

function extractMeta(html, property) {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'));
  return m ? m[1] : null;
}

function extractPrice(text) {
  const m = text.match(/(\d+[,\.]\d{2})\s*€/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

// Known RIVA product pages from sitemap/navigation
const PRODUCT_PAGES = [
  // Trinkwasserfilter
  { url: "/produkte/rivaalva-s/", category: "Trinkwasserfilter", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-m/", category: "Trinkwasserfilter", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-l/", category: "Trinkwasserfilter", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-xl/", category: "Trinkwasserfilter", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-mex/", category: "Trinkwasserfilter PFAS/Nano", brand: "rivaALVA" },
  // Duschfilter
  { url: "/produkte/rivaalva-kalk-slim/", category: "Duschfilter", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-duschfilter/", category: "Duschfilter", brand: "rivaALVA" },
  // Wasserhahnfilter
  { url: "/produkte/rivaalva-wh/", category: "Wasserhahnfilter", brand: "rivaALVA" },
  // Outdoor
  { url: "/produkte/rivaalva-outdoor/", category: "Outdoor-Filter", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-life-safepro/", category: "Outdoor-Filter", brand: "rivaALVA" },
  // Ersatzkartuschen
  { url: "/produkte/rivaalva-s-ersatzkartusche/", category: "Ersatzkartusche", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-m-ersatzkartusche/", category: "Ersatzkartusche", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-l-ersatzkartusche/", category: "Ersatzkartusche", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-xl-ersatzkartusche/", category: "Ersatzkartusche", brand: "rivaALVA" },
  { url: "/produkte/rivaalva-mex-ersatzkartusche/", category: "Ersatzkartusche PFAS/Nano", brand: "rivaALVA" },
  // Jova EM
  { url: "/produkte/jova-em-trinkwasserfilter/", category: "Trinkwasserfilter EM", brand: "Jova EM" },
  { url: "/produkte/jova-em-ersatzkartusche/", category: "Ersatzkartusche EM", brand: "Jova EM" },
];

// Also try to discover products from the main products page
async function discoverProducts() {
  try {
    const html = await fetchPage(`${BASE_URL}/produkte/`);
    const links = [];
    const re = /href=["'](\/produkte\/[^"'\/]+\/?)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const path = m[1];
      if (!links.includes(path) && path !== "/produkte/") {
        links.push(path);
      }
    }
    console.log(`Discovered ${links.length} product links from /produkte/`);
    return links;
  } catch (e) {
    console.log("Could not discover products:", e.message);
    return [];
  }
}

async function scrapeProduct(urlPath, meta = {}) {
  const fullUrl = `${BASE_URL}${urlPath}`;
  try {
    const html = await fetchPage(fullUrl);
    const text = extractText(html);

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      || html.match(/<title>([^<|]+)/i);
    let productName = titleMatch ? titleMatch[1].trim() : null;
    if (!productName) return null;
    // Clean up title
    productName = productName.replace(/\s*[-–|].*$/, '').trim();
    if (productName.length < 3) return null;

    // Extract description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : text.slice(0, 500);

    // Extract price
    const price = extractPrice(text);

    // Extract image
    const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    // Extract key claims from text (first 2000 chars)
    const shortText = text.slice(0, 2000);

    return {
      productName,
      description: description.slice(0, 1000),
      price,
      imageUrl,
      sourceUrl: fullUrl,
      rawText: shortText,
      category: meta.category || "Wasserfilter",
      brand: meta.brand || "rivaALVA",
      supplierArticleNumber: urlPath.replace('/produkte/', '').replace(/\//g, ''),
    };
  } catch (e) {
    console.log(`  ✗ ${urlPath}: ${e.message}`);
    return null;
  }
}

const db = await createConnection(DATABASE_URL);

try {
  // Discover additional products
  const discovered = await discoverProducts();
  
  // Merge known + discovered
  const allPaths = new Set(PRODUCT_PAGES.map(p => p.url));
  for (const d of discovered) {
    allPaths.add(d);
  }

  console.log(`Total product pages to scrape: ${allPaths.size}`);

  const products = [];
  for (const path of allPaths) {
    const meta = PRODUCT_PAGES.find(p => p.url === path) || {};
    const product = await scrapeProduct(path, meta);
    if (product) {
      products.push(product);
      console.log(`  ✓ ${product.productName} (${product.category})`);
    }
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nScraped ${products.length} products. Importing...`);

  // Check existing products for this supplier
  const [existing] = await db.execute(
    "SELECT supplierArticleNumber FROM products WHERE supplierId = ?",
    [SUPPLIER_ID]
  );
  const existingNums = new Set(existing.map(r => r.supplierArticleNumber));

  let imported = 0;
  let skipped = 0;

  for (const p of products) {
    if (existingNums.has(p.supplierArticleNumber)) {
      skipped++;
      continue;
    }
    
    await db.execute(
      `INSERT INTO products 
       (supplierId, productName, supplierArticleNumber, brand, imageUrl, status, tenantId, description)
       VALUES (?, ?, ?, ?, ?, 'open', 1, ?)`,
      [
        SUPPLIER_ID,
        p.productName,
        p.supplierArticleNumber,
        p.brand,
        p.imageUrl,
        p.description,
      ]
    );
    imported++;
  }

  console.log(`\n✅ Import complete: ${imported} new, ${skipped} already existed`);
  
  // Save scraped data for compliance analysis
  const fs = await import("fs");
  fs.writeFileSync("/home/ubuntu/riva_docs/scraped_products.json", JSON.stringify(products, null, 2));
  console.log("Saved scraped_products.json for compliance analysis");

} finally {
  await db.end();
}
