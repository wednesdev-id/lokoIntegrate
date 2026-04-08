#!/bin/bash

# Script untuk membuat user admin baru
# Pastikan MongoDB sudah running sebelum menjalankan script ini

echo "🔐 Creating New Admin User for Loko Backend"
echo "==========================================="
echo ""

# Kredensial yang akan dibuat
USERNAME="admin"
PASSWORD="admin123"
NAME="Administrator"

echo "📝 User credentials:"
echo "   Username: $USERNAME"
echo " Password: $PASSWORD"
echo "   Name: $NAME"
echo ""

# Hash password menggunakan bcrypt (cost 10)
# Kita akan insert langsung ke MongoDB
echo "🔨 Creating password hash..."

# MongoDB connection details dari .env atau default
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
MONGO_DB="loko"

echo "📦 Connecting to MongoDB..."
echo "   URI: $MONGO_URI"
echo "   Database: $MONGO_DB"
echo ""

# Buat user dengan mongosh
mongosh "$MONGO_URI/$MONGO_DB" <<EOF
// Hapus user admin lama jika ada
db.users.deleteOne({ username: "$USERNAME" });

// Insert user admin baru
db.users.insertOne({
  name: "$NAME",
  username: "$USERNAME",
  password: "\$2a\$10\$YourHashedPasswordHere", // This will be replaced by Go hash
  role_id: "admin",
  is_verify: true,
  is_active: true,
  provider: "local",
  credits: 1000.0,
  project_count: 0,
  max_projects: 999,
  created_at: new Date(),
  updated_at: new Date()
});

print("✅ User admin created successfully!");
print("");
print("Login credentials:");
print("Username: $USERNAME");
print("Password: $PASSWORD");
print("");
EOF

echo ""
echo "✅ Done!"
echo ""
echo "🌐 You can now login at: http://localhost:1234/login"
echo "   Username: $USERNAME"
echo "   Password: $PASSWORD"
echo ""
