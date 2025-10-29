#!/usr/bin/env node
/**
 * Script para inicializar el usuario admin en la base de datos
 * Ejecutar: node server/init-admin.js
 */

import * as fs from "fs";
import * as path from "path";
import { hashPassword } from "./auth/password.js";

const DATA_DIR = path.join(process.cwd(), "data", "admin");

async function initAdmin() {
  console.log("🔧 Inicializando usuario administrador...");

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log("✓ Directorio de datos creado");
  }

  const usersFile = path.join(DATA_DIR, "users.json");

  // Check if users.json already exists
  if (fs.existsSync(usersFile)) {
    console.log("⚠️  El archivo users.json ya existe");
    const data = fs.readFileSync(usersFile, "utf-8");
    const users = JSON.parse(data);

    const adminUser = users.find((u) => u.username === "admin");
    if (adminUser) {
      console.log("✓ Usuario admin ya existe");
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Rol: ${adminUser.role}`);
      return;
    } else {
      console.log("⚠️  No se encontró usuario admin, creando...");
    }
  }

  // Create admin user
  console.log("🔐 Hasheando contraseña...");
  const hashedPassword = await hashPassword("admin123");

  const adminUser = {
    id: "user-1",
    username: "admin",
    email: "admin@empresa.com",
    password: hashedPassword,
    name: "Administrador",
    role: "admin",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Write to file
  fs.writeFileSync(usersFile, JSON.stringify([adminUser], null, 2), "utf-8");
  console.log("✓ Usuario admin creado exitosamente");
  console.log(`   Usuario: admin`);
  console.log(`   Contraseña: admin123`);
  console.log(`   Email: admin@empresa.com`);
  console.log(`   Rol: admin`);
  console.log("\n✅ Inicialización completada");
}

initAdmin().catch((error) => {
  console.error("❌ Error al inicializar admin:", error);
  process.exit(1);
});
