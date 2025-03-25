#!/usr/bin/env node

const path = require("path");
// Removed unused imports: execSync and fs

// Determine the actual directory where the application is installed
const appDirectory = __dirname;

// Removed unused variable: isDevMode

// Parse command line arguments
const args = process.argv.slice(2);

// Check if we're in GUI or CLI mode
const isCLIMode =
  args.length > 0 &&
  (args.includes("--input") ||
    args.includes("-i") ||
    args.includes("--output") ||
    args.includes("-o") ||
    args.includes("--help") ||
    args.includes("-h") ||
    args.includes("--cli-only"));

if (isCLIMode) {
  // Run in CLI mode - just execute index.js with the provided arguments
  const { mergePDFs } = require("./index");

  // Default paths
  let inputFolder = path.join(process.cwd(), "pdfs-to-merge");
  let outputFile = path.join(process.cwd(), "merged.pdf");
  let options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" || args[i] === "-i") {
      inputFolder = args[++i];
    } else if (args[i] === "--output" || args[i] === "-o") {
      outputFile = args[++i];
    } else if (args[i] === "--sort-by") {
      options.sortBy = args[++i];
    } else if (args[i] === "--descending") {
      options.descending = true;
    } else if (args[i] === "--pattern") {
      options.filePattern = args[++i];
    } else if (args[i] === "--no-bookmarks") {
      options.addBookmarks = false;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
PDF Merger - Combine multiple PDF files into one

Usage:
  pdf-merger [options]

Options:
  --input, -i       Input directory containing PDFs (default: ./pdfs-to-merge)
  --output, -o      Output PDF file path (default: ./merged.pdf)
  --sort-by         Sort files by: 'name', 'date', or 'size' (default: name)
  --descending      Sort in descending order
  --pattern         Regex pattern to match specific filenames
  --no-bookmarks    Disable adding bookmarks to the merged PDF
  --cli-only        Force CLI mode even without other arguments
  --help, -h        Show this help
      `);
      process.exit(0);
    }
  }

  // Set up progress callback for CLI
  options.onProgress = (progress) => {
    if (progress.status === "processing") {
      process.stdout.write(
        `\rProcessing file ${progress.current}/${progress.total}: ${progress.message}`
      );
    }
  };

  // Execute merge
  mergePDFs(inputFolder, outputFile, options).then((result) => {
    if (result.success) {
      console.log("\n\x1b[32m%s\x1b[0m", result.message); // Green success message
    } else {
      console.error("\n\x1b[31m%s\x1b[0m", result.message); // Red error message
      process.exit(1);
    }
  });
} else {
  // Run in GUI mode - start electron app
  try {
    // First check if electron is installed
    let electron;
    try {
      // Try to require electron directly
      electron = require("electron");
    } catch (error) {
      // If we're in a development environment or packaged app, electron might be in node_modules
      try {
        const electronPath = path.join(
          appDirectory,
          "node_modules",
          "electron"
        );
        electron = require(electronPath);
      } catch (innerError) {
        // If we still can't find electron, provide guidance
        console.error(
          "\x1b[31m%s\x1b[0m",
          "Error: Electron not found. This is likely because the package was installed without dependencies."
        );
        console.log(
          "\x1b[33m%s\x1b[0m",
          "To use the GUI, install electron globally:"
        );
        console.log("\x1b[36m%s\x1b[0m", "npm install -g electron");
        console.log("\x1b[33m%s\x1b[0m", "Or use the CLI functionality:");
        console.log("\x1b[36m%s\x1b[0m", "pdf-merger --cli-only");
        process.exit(1);
      }
    }

    // Make sure we're passing the correct app directory to Electron
    const appPath = appDirectory;
    const proc = require("child_process").spawn(electron, [appPath], {
      stdio: "inherit",
      cwd: appPath, // Set the working directory to the app directory
    });

    proc.on("close", (code) => process.exit(code));
    proc.on("error", (err) => {
      console.error(
        "\x1b[31m%s\x1b[0m",
        "Error launching Electron:",
        err.message
      );
      console.log("\x1b[33m%s\x1b[0m", "You can try running in CLI mode:");
      console.log("\x1b[36m%s\x1b[0m", "pdf-merger --cli-only");
      process.exit(1);
    });
  } catch (err) {
    console.error("\x1b[31m%s\x1b[0m", "Failed to start Electron app:", err);
    process.exit(1);
  }
}
