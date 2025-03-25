#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Required files for publishing
const requiredFiles = [
  "index.js",
  "main.js",
  "preload.js",
  "renderer.js",
  "index.html",
  "styles.css",
  "cli.js",
  "package.json",
  "README.md",
];

// Check if assets directory exists
if (!fs.existsSync(path.join(__dirname, "assets"))) {
  console.error("❌ Missing assets directory");
  process.exit(1);
}

// Check if all required files exist
const missingFiles = requiredFiles.filter(
  (file) => !fs.existsSync(path.join(__dirname, file))
);

if (missingFiles.length > 0) {
  console.error("❌ Missing required files:", missingFiles.join(", "));
  process.exit(1);
}

// Check if CLI file is executable
try {
  const cliPath = path.join(__dirname, "cli.js");
  const stats = fs.statSync(cliPath);
  const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;

  if (!isExecutable) {
    console.warn(
      "⚠️ cli.js is not executable. Setting executable permission..."
    );
    fs.chmodSync(cliPath, stats.mode | fs.constants.S_IXUSR);
  }
} catch (error) {
  console.error("❌ Error checking cli.js permissions:", error);
  process.exit(1);
}

// Verify package.json has required fields
const packageJson = require("./package.json");
const requiredFields = [
  "name",
  "version",
  "description",
  "main",
  "bin",
  "keywords",
  "author",
  "license",
  "repository",
];

const missingFields = requiredFields.filter((field) => !packageJson[field]);

if (missingFields.length > 0) {
  console.error(
    "❌ Missing required fields in package.json:",
    missingFields.join(", ")
  );
  process.exit(1);
}

// Verify author field is properly formatted
if (
  typeof packageJson.author === "string" &&
  !packageJson.author.includes("<") &&
  !packageJson.author.includes("@")
) {
  console.warn(
    '⚠️ Author field should include email address (e.g., "Your Name <email@example.com>")'
  );
}

// Check if main.js properly references required files
try {
  const mainContent = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");

  // Ensure main.js references local paths correctly
  if (mainContent.includes("path.join(__dirname") === false) {
    console.warn(
      "⚠️ main.js might have incorrect path references. Verify all paths use __dirname."
    );
  }
} catch (error) {
  console.error("❌ Error checking main.js:", error);
}

console.log("✅ All pre-publish checks passed!");
