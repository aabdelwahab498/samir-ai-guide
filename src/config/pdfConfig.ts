import * as pdfjsLib from "pdfjs-dist";
// Vite static worker import — NO CDN
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export { pdfjsLib };