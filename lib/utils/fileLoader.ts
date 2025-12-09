/**
 * File loading utilities for document processing
 */
import https from "https";
import http from "http";
import { URL } from "url";

// DOCX MIME types
const DOCX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/docx',
];

// DOC MIME type (older format)
const DOC_MIME_TYPES = [
  'application/msword',
];

/**
 * Extract text content from a file URL
 * Supports PDF, DOCX, DOC, TXT, and other text-based formats
 */
export async function loadFileText(fileUrl: string, mimeType: string): Promise<string> {
  try {
    // For text files, return as-is
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      return await response.text();
    }

    // For PDF files, use loadPDFText
    if (mimeType === 'application/pdf') {
      return await loadPDFText(fileUrl);
    }

    // For DOCX files, use loadDOCXText
    if (DOCX_MIME_TYPES.includes(mimeType)) {
      return await loadDOCXText(fileUrl);
    }

    // For DOC files (older format), use loadDOCXText (mammoth supports both)
    if (DOC_MIME_TYPES.includes(mimeType)) {
      return await loadDOCXText(fileUrl);
    }

    // For other file types, try to extract text as UTF-8
    // This is a fallback for plain text files with unknown MIME types
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(arrayBuffer);
    return text;
  } catch (error) {
    console.error('Error loading file text:', error);
    throw error;
  }
}

/**
 * Load DOCX/DOC text using mammoth
 * mammoth extracts text content from Word documents
 */
export async function loadDOCXText(fileUrl: string): Promise<string> {
  try {
    // Fetch the file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch DOCX file: ${response.statusText}`);
    }

    // Get the file as array buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamically import mammoth
    const mammoth = await import('mammoth');

    // Extract text from the DOCX file
    const result = await mammoth.extractRawText({ buffer });

    if (!result.value || result.value.trim() === '') {
      throw new Error('Failed to extract text from DOCX: No text content found');
    }

    // Log any warnings
    if (result.messages && result.messages.length > 0) {
      console.warn('DOCX parsing warnings:', result.messages);
    }

    return result.value;
  } catch (error) {
    console.error('Error loading DOCX text:', error);
    throw new Error(`Error loading DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load PDF text using pdf2json
 * pdf2json is serverless-friendly and doesn't require browser APIs
 */
export async function loadPDFText(fileUrl: string): Promise<string> {
  // Parse the URL to determine protocol and get hostname/path
  const url = new URL(fileUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  // Dynamically import pdf2json
  const pdf2jsonModule = await import('pdf2json');
  const PDFParser = pdf2jsonModule.default || pdf2jsonModule;

  return new Promise<string>((resolve, reject) => {
    try {
      // Create a new PDFParser instance for this request
      const pdfParser = new (PDFParser as any)(null, true);

      // Set up error handler
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        const errorMsg = errData?.parserError || errData?.message || 'Unknown PDF parsing error';
        reject(new Error(`PDF parsing error: ${errorMsg}`));
      });

      // Set up success handler
      pdfParser.on("pdfParser_dataReady", () => {
        try {
          const parsedText = pdfParser.getRawTextContent() || "";
          if (parsedText === "") {
            reject(new Error("Failed to parse PDF: No text content extracted"));
          } else {
            resolve(parsedText);
          }
        } catch (error) {
          reject(new Error(`Error extracting text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });

      // Create the HTTP/HTTPS request options
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'EnduroShieldHub-PDF-Parser',
        },
      };

      // Make the request and pipe the response to the PDF parser
      const req = httpModule.request(options, (res) => {
        // Check if response is successful
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirects
          return loadPDFText(res.headers.location).then(resolve).catch(reject);
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`Failed to fetch PDF: HTTP ${res.statusCode}`));
        }

        // Pipe the response stream to the PDF parser
        res.pipe(pdfParser.createParserStream());
      });

      // Handle request errors
      req.on('error', (error) => {
        reject(new Error(`Failed to fetch PDF: ${error.message}`));
      });

      // End the request
      req.end();
    } catch (error) {
      reject(new Error(`Error loading PDF: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}
