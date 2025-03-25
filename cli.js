#!/usr/bin/env node

const path = require("path");
const { execSync } = require("child_process");

// Check if electron is being run with app or in development
const isPackaged = process.env.NODE_ENV === "production";

if (isPackaged) {
  // When installed globally, the app will already be packaged into an executable
  // This command just needs to launch it with any provided args
  execSync(`${process.execPath} ${process.argv.slice(2).join(" ")}`, {
    stdio: "inherit",
  });
} else {
  // In development, we'll run the app with Electron
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
        electron = require("electron");
      } catch (error) {
        console.error(
          "\x1b[31m%s\x1b[0m",
          "Error: Electron not found. This is likely because the package was installed without dependencies."
        );
        console.log(
          "\x1b[33m%s\x1b[0m",
          "Please install the application with dependencies using:"
        );
        console.log(
          "\x1b[36m%s\x1b[0m",
          "npm install -g pdf-merger-tool --include=dev"
        );
        console.log("\x1b[33m%s\x1b[0m", "Or reinstall with:");
        console.log(
          "\x1b[36m%s\x1b[0m",
          "npm install -g pdf-merger-tool@latest"
        );
        console.log(
          "\x1b[33m%s\x1b[0m",
          "In the meantime, you can still use the CLI functionality:"
        );
        console.log("\x1b[36m%s\x1b[0m", "pdf-merger --help");
        process.exit(1);
      }

      const proc = require("child_process").spawn(electron, ["."], {
        stdio: "inherit",
      });
      proc.on("close", (code) => process.exit(code));
    } catch (err) {
      console.error("\x1b[31m%s\x1b[0m", "Failed to start Electron app:", err);
      process.exit(1);
    }
  }
}
