import Tesseract from "tesseract.js";
import { pageToImageDataUrl } from "@/utils/pdfToImage";

export async function ocrPdfPage(file: File | ArrayBuffer, pageNum: number, lang = "eng+ara"): Promise<string> {
  const dataUrl = await pageToImageDataUrl(file, pageNum, 2);
  const { data } = await Tesseract.recognize(dataUrl, lang);
  return data.text || "";
}