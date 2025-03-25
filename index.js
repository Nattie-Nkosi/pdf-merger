const fs = require("fs").promises;
const path = require("path");
const { PDFDocument } = require("pdf-lib");

/**
 * Merges all PDF files from inputPath directory into a single PDF file
 * @param {string} inputPath - Directory containing PDF files to merge
 * @param {string} outputPath - Path where the merged PDF will be saved
 * @param {Object} options - Additional options
 * @param {string} options.sortBy - Sort method ('name', 'date', 'size') - defaults to 'name'
 * @param {boolean} options.descending - Whether to sort in descending order - defaults to false
 * @param {string} options.filePattern - Optional regex pattern to match specific files
 * @returns {Promise<{success: boolean, message: string, fileCount?: number}>} Result object
 */
async function mergePDFs(inputPath, outputPath, options = {}) {
  // Default options
  const { sortBy = "name", descending = false, filePattern = null } = options;

  try {
    console.log(`Starting PDF merge process...`);

    // Validate input path
    try {
      const inputStats = await fs.stat(inputPath);
      if (!inputStats.isDirectory()) {
        return {
          success: false,
          message: `Input path is not a directory: ${inputPath}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Input directory doesn't exist: ${inputPath}`,
      };
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Get all files from the input directory
    let files = await fs.readdir(inputPath);

    // Filter PDF files
    let pdfFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      const isValidExt = ext === ".pdf";

      // Apply custom pattern filter if provided
      if (filePattern && isValidExt) {
        const regex = new RegExp(filePattern);
        return regex.test(file);
      }

      return isValidExt;
    });

    if (pdfFiles.length === 0) {
      return { success: false, message: `No PDF files found in ${inputPath}` };
    }

    // Get file stats for sorting
    const fileStats = await Promise.all(
      pdfFiles.map(async (file) => {
        const filePath = path.join(inputPath, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime,
        };
      })
    );

    // Sort files based on options
    fileStats.sort((a, b) => {
      let comparison;

      switch (sortBy) {
        case "date":
          comparison = a.mtime - b.mtime;
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "name":
        default:
          comparison = a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });
      }

      return descending ? -comparison : comparison;
    });

    console.log(`Found ${pdfFiles.length} PDF files to merge.`);

    // Loop through each PDF and add it to the merged document
    let pageCount = 0;
    for (const [index, file] of fileStats.entries()) {
      try {
        const pdfBytes = await fs.readFile(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const pageIndices = pdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
          pageCount++;
        });

        console.log(
          `[${index + 1}/${fileStats.length}] Added "${file.name}" (${
            pageIndices.length
          } pages)`
        );
      } catch (error) {
        console.error(`Error processing file "${file.name}": ${error.message}`);
        // Continue with other files
      }
    }

    if (pageCount === 0) {
      return {
        success: false,
        message: "No valid PDF content could be processed.",
      };
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Save the merged PDF
    const pdfBytes = await mergedPdf.save();
    await fs.writeFile(outputPath, pdfBytes);

    return {
      success: true,
      message: `Successfully merged ${fileStats.length} PDFs with ${pageCount} total pages into "${outputPath}"`,
      fileCount: fileStats.length,
      pageCount,
    };
  } catch (error) {
    return { success: false, message: `Error merging PDFs: ${error.message}` };
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);

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
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
PDF Merger - Combine multiple PDF files into one

Usage:
  node ${path.basename(__filename)} [options]

Options:
  --input, -i       Input directory containing PDFs (default: ./pdfs-to-merge)
  --output, -o      Output PDF file path (default: ./merged.pdf)
  --sort-by         Sort files by: 'name', 'date', or 'size' (default: name)
  --descending      Sort in descending order
  --pattern         Regex pattern to match specific filenames
  --help, -h        Show this help
      `);
      process.exit(0);
    }
  }

  // Execute merge
  mergePDFs(inputFolder, outputFile, options).then((result) => {
    if (result.success) {
      console.log("\x1b[32m%s\x1b[0m", result.message); // Green success message
    } else {
      console.error("\x1b[31m%s\x1b[0m", result.message); // Red error message
      process.exit(1);
    }
  });
}

// Export for use as a module
module.exports = { mergePDFs };
