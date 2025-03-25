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
 * @param {Array} options.customFileOrder - Optional array of file paths to use a custom order
 * @param {boolean} options.addBookmarks - Whether to add bookmarks for each file - defaults to true
 * @param {function} options.onProgress - Optional callback for progress updates
 * @returns {Promise<{success: boolean, message: string, fileCount?: number, pageCount?: number}>} Result object
 */
async function mergePDFs(inputPath, outputPath, options = {}) {
  // Default options
  const {
    sortBy = "name",
    descending = false,
    filePattern = null,
    customFileOrder = null,
    addBookmarks = true,
    onProgress = null,
  } = options;

  try {
    if (onProgress)
      onProgress({
        status: "starting",
        message: "Starting PDF merge process...",
      });

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

    // If we have a custom file order, use that instead of sorting
    let filesToProcess;

    if (customFileOrder && customFileOrder.length > 0) {
      // Create a map of custom order files by name for quick lookup
      const customOrderMap = new Map();
      customFileOrder.forEach((file) => {
        const fileName = path.basename(file.path || file);
        customOrderMap.set(fileName, true);
      });

      // Filter fileStats to only include files specified in the custom order
      const customOrderedFiles = customFileOrder
        .map((file) => {
          const fileName = path.basename(file.path || file);
          return fileStats.find((stat) => stat.name === fileName);
        })
        .filter(Boolean);

      // Add any files that were not in the custom order at the end
      const remainingFiles = fileStats.filter(
        (stat) => !customOrderMap.has(stat.name)
      );

      filesToProcess = [...customOrderedFiles, ...remainingFiles];
    } else {
      // Sort files based on options
      filesToProcess = [...fileStats].sort((a, b) => {
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
    }

    if (onProgress)
      onProgress({
        status: "processing",
        message: `Found ${filesToProcess.length} PDF files to merge.`,
        total: filesToProcess.length,
        current: 0,
      });

    // Loop through each PDF and add it to the merged document
    let pageCount = 0;
    const bookmarks = [];

    for (const [index, file] of filesToProcess.entries()) {
      try {
        if (onProgress)
          onProgress({
            status: "processing",
            message: `Processing file ${index + 1} of ${
              filesToProcess.length
            }: ${file.name}`,
            total: filesToProcess.length,
            current: index,
          });

        const pdfBytes = await fs.readFile(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const pageIndices = pdf.getPageIndices();

        // Store the starting page number for bookmark
        const bookmarkPageNumber = pageCount;

        // Copy pages
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
          pageCount++;
        });

        // Add to bookmarks list if enabled
        if (addBookmarks) {
          bookmarks.push({
            title: file.name.replace(".pdf", ""),
            pageNumber: bookmarkPageNumber,
          });
        }

        if (onProgress)
          onProgress({
            status: "fileComplete",
            message: `Added "${file.name}" (${pageIndices.length} pages)`,
            total: filesToProcess.length,
            current: index + 1,
            pageCount,
          });
      } catch (error) {
        console.error(`Error processing file "${file.name}": ${error.message}`);
        if (onProgress)
          onProgress({
            status: "fileError",
            message: `Error processing file "${file.name}": ${error.message}`,
            fileName: file.name,
            error: error.message,
          });
        // Continue with other files
      }
    }

    if (pageCount === 0) {
      return {
        success: false,
        message: "No valid PDF content could be processed.",
      };
    }

    if (onProgress)
      onProgress({
        status: "saving",
        message: "Saving merged PDF...",
      });

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Save the merged PDF
    const pdfBytes = await mergedPdf.save();
    await fs.writeFile(outputPath, pdfBytes);

    const result = {
      success: true,
      message: `Successfully merged ${filesToProcess.length} PDFs with ${pageCount} total pages into "${outputPath}"`,
      fileCount: filesToProcess.length,
      pageCount,
    };

    if (onProgress)
      onProgress({
        status: "complete",
        message: result.message,
        pageCount,
      });

    return result;
  } catch (error) {
    if (onProgress)
      onProgress({
        status: "error",
        message: `Error merging PDFs: ${error.message}`,
      });
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
    } else if (args[i] === "--no-bookmarks") {
      options.addBookmarks = false;
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
  --no-bookmarks    Disable adding bookmarks to the merged PDF
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
}

// Export for use as a module
module.exports = { mergePDFs };
