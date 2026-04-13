import mysql from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

// Search for sourov
const [rows] = await conn.execute(
  "SELECT id, name, email, open_id, role FROM users WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? LIMIT 10",
  ["%sourov%", "%sourov%"]
);

console.log("Found users:", JSON.stringify(rows, null, 2));

if (rows.length === 0) {
  console.log("No user found with name/email containing 'sourov'");
  // Show all users for reference
  const [all] = await conn.execute("SELECT id, name, email, role FROM users LIMIT 20");
  console.log("All users:", JSON.stringify(all, null, 2));
} else if (rows.length === 1) {
  const user = rows[0];
  if (user.role === "admin") {
    console.log(`User ${user.name} is already an admin.`);
  } else {
    await conn.execute("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
    console.log(`✓ User ${user.name} (id=${user.id}) promoted to admin.`);
  }
} else {
  console.log("Multiple users found – please specify which one to promote.");
}

await conn.end();
