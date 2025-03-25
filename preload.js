const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  selectInputDirectory: () => ipcRenderer.invoke("select-input-directory"),

  selectOutputFile: () => ipcRenderer.invoke("select-output-file"),

  getPdfFiles: (directoryPath) =>
    ipcRenderer.invoke("get-pdf-files", directoryPath),

  mergePdfs: (inputPath, outputPath, options, fileList) =>
    ipcRenderer.invoke("merge-pdfs", inputPath, outputPath, options, fileList),

  openPdf: (filePath) => ipcRenderer.invoke("open-pdf", filePath),
});
