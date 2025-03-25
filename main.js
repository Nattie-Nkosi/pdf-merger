const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const { mergePDFs } = require("./index");

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  // Load the index.html file
  mainWindow.loadFile("index.html");

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed
  mainWindow.on("closed", () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS re-create a window when the dock icon is clicked and no other windows are open
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC messages from renderer process

// Select input directory
ipcMain.handle("select-input-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Folder Containing PDFs",
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

// Select output file
ipcMain.handle("select-output-file", async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Merged PDF As",
    defaultPath: path.join(app.getPath("documents"), "merged.pdf"),
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  });

  if (result.canceled) return null;
  return result.filePath;
});

// Get PDF files from directory
ipcMain.handle("get-pdf-files", async (event, directoryPath) => {
  try {
    const files = await fs.readdir(directoryPath);
    const pdfFiles = [];

    for (const file of files) {
      if (path.extname(file).toLowerCase() === ".pdf") {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);

        pdfFiles.push({
          name: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        });
      }
    }

    return pdfFiles;
  } catch (error) {
    console.error("Error getting PDF files:", error);
    return { error: error.message };
  }
});

// Merge PDFs
ipcMain.handle(
  "merge-pdfs",
  async (event, inputPath, outputPath, options, fileList) => {
    try {
      // If fileList is provided, we're using the manually ordered files from the UI
      const mergeOptions = { ...options };

      // If custom file order is provided, we'll handle the sorting ourselves
      if (fileList && fileList.length > 0) {
        // Override the sortBy option to use the custom order
        mergeOptions.customFileOrder = fileList;
      }

      const result = await mergePDFs(inputPath, outputPath, mergeOptions);
      return result;
    } catch (error) {
      console.error("Error during PDF merge:", error);
      return { success: false, message: `Error: ${error.message}` };
    }
  }
);

// Open PDF
ipcMain.handle("open-pdf", async (event, filePath) => {
  try {
    const { shell } = require("electron");
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
