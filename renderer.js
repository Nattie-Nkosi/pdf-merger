// DOM Elements
const inputDirectoryEl = document.getElementById("input-directory");
const outputFileEl = document.getElementById("output-file");
const browseInputBtn = document.getElementById("browse-input");
const browseOutputBtn = document.getElementById("browse-output");
const sortByEl = document.getElementById("sort-by");
const filePatternEl = document.getElementById("file-pattern");
const addBookmarksEl = document.getElementById("add-bookmarks");
const fileListEl = document.getElementById("file-list");
const filesSection = document.getElementById("files-section");
const mergeButton = document.getElementById("merge-button");
const progressSection = document.getElementById("progress-section");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const resultSection = document.getElementById("result-section");
const successMessage = document.getElementById("success-message");
const errorMessage = document.getElementById("error-message");
const resultDetails = document.getElementById("result-details");
const errorDetails = document.getElementById("error-details");
const openPdfButton = document.getElementById("open-pdf-button");
const newMergeButton = document.getElementById("new-merge-button");
const tryAgainButton = document.getElementById("try-again-button");

// State variables
let pdfFiles = [];
let inputPath = "";
let outputPath = "";
let currentMergeOperation = null;

// Initialize the application
function init() {
  attachEventListeners();
  updateMergeButtonState();
}

// Event Listeners
function attachEventListeners() {
  // Browse input directory
  browseInputBtn.addEventListener("click", async () => {
    const selectedPath = await window.electron.selectInputDirectory();
    if (selectedPath) {
      inputPath = selectedPath;
      inputDirectoryEl.value = selectedPath;
      await loadPdfFiles(selectedPath);
      updateMergeButtonState();
    }
  });

  // Browse output file
  browseOutputBtn.addEventListener("click", async () => {
    const selectedPath = await window.electron.selectOutputFile();
    if (selectedPath) {
      outputPath = selectedPath;
      outputFileEl.value = selectedPath;
      updateMergeButtonState();
    }
  });

  // Sort options change
  sortByEl.addEventListener("change", () => {
    const isCustom = sortByEl.value === "custom";
    document
      .querySelectorAll('input[name="sort-direction"]')
      .forEach((radio) => {
        radio.disabled = isCustom;
      });

    if (isCustom && pdfFiles.length > 0) {
      // Enable drag and drop reordering
      setupDragAndDrop();
    }

    refreshFileList();
  });

  // Merge button
  mergeButton.addEventListener("click", () => {
    mergePdfs();
  });

  // Result section buttons
  openPdfButton.addEventListener("click", () => {
    window.electron.openPdf(outputPath);
  });

  newMergeButton.addEventListener("click", () => {
    resetApplication();
  });

  tryAgainButton.addEventListener("click", () => {
    resetMergeState();
  });
}

// Load PDF files from selected directory
async function loadPdfFiles(directoryPath) {
  try {
    const files = await window.electron.getPdfFiles(directoryPath);

    if (files.error) {
      console.error("Error loading PDF files:", files.error);
      return;
    }

    pdfFiles = files;
    refreshFileList();
    filesSection.style.display = pdfFiles.length > 0 ? "block" : "none";
  } catch (error) {
    console.error("Error loading PDF files:", error);
  }
}

// Refresh the file list display
function refreshFileList() {
  fileListEl.innerHTML = "";

  // Sort files if not custom order
  let filesToDisplay = [...pdfFiles];

  if (sortByEl.value !== "custom") {
    const descending =
      document.querySelector('input[name="sort-direction"]:checked').value ===
      "descending";

    filesToDisplay.sort((a, b) => {
      let comparison;

      switch (sortByEl.value) {
        case "date":
          comparison = new Date(a.mtime) - new Date(b.mtime);
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

  // Display files
  filesToDisplay.forEach((file, index) => {
    const fileItem = document.createElement("li");
    fileItem.className = "file-item";
    fileItem.draggable = sortByEl.value === "custom";
    fileItem.dataset.index = index;

    // Format file size
    const sizeInKB = file.size / 1024;
    let formattedSize;

    if (sizeInKB < 1024) {
      formattedSize = `${sizeInKB.toFixed(1)} KB`;
    } else {
      formattedSize = `${(sizeInKB / 1024).toFixed(1)} MB`;
    }

    fileItem.innerHTML = `
      <div class="file-icon">📄</div>
      <div class="file-name">${file.name}</div>
      <div class="file-size">${formattedSize}</div>
      <div class="file-actions">
        ${
          sortByEl.value === "custom"
            ? '<button class="move-up">↑</button><button class="move-down">↓</button>'
            : ""
        }
      </div>
    `;

    // Add event listeners for file action buttons
    if (sortByEl.value === "custom") {
      fileItem.querySelector(".move-up").addEventListener("click", () => {
        if (index > 0) {
          // Swap with previous item
          [pdfFiles[index], pdfFiles[index - 1]] = [
            pdfFiles[index - 1],
            pdfFiles[index],
          ];
          refreshFileList();
        }
      });

      fileItem.querySelector(".move-down").addEventListener("click", () => {
        if (index < pdfFiles.length - 1) {
          // Swap with next item
          [pdfFiles[index], pdfFiles[index + 1]] = [
            pdfFiles[index + 1],
            pdfFiles[index],
          ];
          refreshFileList();
        }
      });
    }

    fileListEl.appendChild(fileItem);
  });

  if (sortByEl.value === "custom") {
    setupDragAndDrop();
  }
}

// Set up drag and drop functionality for reordering files
function setupDragAndDrop() {
  const fileItems = document.querySelectorAll(".file-item");

  fileItems.forEach((item) => {
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", item.dataset.index);
      item.classList.add("dragging");

      // For Firefox compatibility
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"));
      const targetIndex = parseInt(item.dataset.index);

      if (sourceIndex !== targetIndex) {
        // Reorder the array
        const temp = pdfFiles[sourceIndex];
        pdfFiles.splice(sourceIndex, 1);
        pdfFiles.splice(targetIndex, 0, temp);
        refreshFileList();
      }
    });
  });
}

// Update the state of the merge button
function updateMergeButtonState() {
  const canMerge = inputPath && outputPath && pdfFiles.length > 0;
  mergeButton.disabled = !canMerge;
}

// Merge PDFs
async function mergePdfs() {
  try {
    // Show progress section
    progressSection.style.display = "block";
    // Hide result section
    resultSection.style.display = "none";
    // Disable merge button
    mergeButton.disabled = true;

    // Get options
    const options = {
      sortBy: sortByEl.value,
      descending:
        document.querySelector('input[name="sort-direction"]:checked').value ===
        "descending",
      filePattern: filePatternEl.value || null,
      addBookmarks: addBookmarksEl.checked,
    };

    // Set progress handler
    let lastProgress = 0;

    // Start merge operation
    const result = await window.electron.mergePdfs(
      inputPath,
      outputPath,
      options,
      sortByEl.value === "custom" ? pdfFiles : null
    );

    // Show appropriate result
    showResult(result);
  } catch (error) {
    showResult({
      success: false,
      message: `Unexpected error: ${error.message}`,
    });
  }
}

// Handle progress updates
function handleProgress(progress) {
  if (progress.status === "processing") {
    // Update progress bar
    const percentage = Math.min(
      Math.round((progress.current / progress.total) * 100),
      100
    );
    progressBar.style.width = `${percentage}%`;

    // Update progress text
    progressText.textContent = progress.message;
  } else if (progress.status === "starting" || progress.status === "saving") {
    // Just update the text
    progressText.textContent = progress.message;
  }
}

// Show the result of the merge operation
function showResult(result) {
  progressSection.style.display = "none";
  resultSection.style.display = "block";

  if (result.success) {
    // Show success message
    successMessage.style.display = "block";
    errorMessage.style.display = "none";
    resultDetails.textContent = result.message;
  } else {
    // Show error message
    successMessage.style.display = "none";
    errorMessage.style.display = "block";
    errorDetails.textContent = result.message;
  }
}

// Reset the application state
function resetApplication() {
  // Clear input paths
  inputPath = "";
  outputPath = "";
  inputDirectoryEl.value = "";
  outputFileEl.value = "";

  // Clear PDF files
  pdfFiles = [];
  fileListEl.innerHTML = "";
  filesSection.style.display = "none";

  // Reset options
  sortByEl.value = "name";
  document.querySelector(
    'input[name="sort-direction"][value="ascending"]'
  ).checked = true;
  filePatternEl.value = "";
  addBookmarksEl.checked = true;

  // Hide result section
  resultSection.style.display = "none";

  // Reset merge button
  updateMergeButtonState();
}

// Reset just the merge state (for retry)
function resetMergeState() {
  progressSection.style.display = "none";
  resultSection.style.display = "none";
  updateMergeButtonState();
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
