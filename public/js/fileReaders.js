const textDecoder = new TextDecoder("utf-8");
const latinDecoder = new TextDecoder("latin1");

export async function extractFileContent(file, onProgress = () => {}, options = {}) {
  const result = await extractTextFromFile(file, onProgress, options);
  if (typeof result === "string") {
    return { text: result, rows: [] };
  }
  return {
    text: result.text || "",
    rows: Array.isArray(result.rows) ? result.rows : [],
    media: result.media || null
  };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parts = reader.result.split(",");
      resolve(parts[1] || "");
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

export async function extractTextFromFile(file, onProgress = () => {}, options = {}) {
  const extension = file.name.split(".").pop().toLowerCase();
  onProgress(`Reading ${file.name}`);

  if (["png", "jpg", "jpeg", "webp"].includes(extension) || file.type.startsWith("image/")) {
    onProgress("Image file loaded. Preparing for AI multimodal OCR...");
    const base64 = await fileToBase64(file);
    return {
      text: "",
      rows: [],
      media: {
        mimeType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
        data: base64
      }
    };
  }

  if (extension === "txt" || file.type.startsWith("text/")) {
    const text = await file.text();
    onProgress("Plain text loaded.");
    return { text, rows: parseTextRows(text) };
  }

  if (extension === "docx") {
    onProgress("Extracting DOCX tables and paragraphs.");
    const buffer = await file.arrayBuffer();
    return extractDocxContent(buffer);
  }

  if (extension === "pdf") {
    if (options.extractPdfFile) {
      try {
        onProgress("Uploading PDF to the local extractor.");
        const base64 = await fileToBase64(file);
        const result = await options.extractPdfFile({
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          data: base64,
          ocr: true
        });

        if (result.text?.trim()) {
          const method = result.method === "ocr" ? "OCR text" : "selectable text";
          const warnings = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
          onProgress(`Extracted PDF ${method} from ${result.pageCount || "unknown"} page(s).${warnings}`);
          return { text: result.text, rows: [] };
        }

        onProgress("No selectable text was found in this PDF. Ready for AI multimodal OCR.");
        return { text: "", rows: [], media: { mimeType: file.type || "application/pdf", data: base64 } };
      } catch (error) {
        onProgress("Local PDF extractor failed; trying browser fallback.");
        try {
          const buffer = await file.arrayBuffer();
          return { text: await extractPdfText(buffer), rows: [] };
        } catch {
          throw error;
        }
      }
    }

    onProgress("Extracting selectable PDF text.");
    const buffer = await file.arrayBuffer();
    return { text: await extractPdfText(buffer), rows: [] };
  }

  throw new Error("Supported files are TXT, PDF, DOCX, and PNG/JPG images.");
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function extractDocxContent(buffer) {
  const entries = readZipEntries(buffer);
  const documentEntries = entries.filter(entry =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(entry.name)
  );

  if (!documentEntries.length) {
    throw new Error("This DOCX file does not contain readable document XML.");
  }

  const chunks = [];
  const rows = [];
  for (const entry of documentEntries) {
    const bytes = await inflateZipEntry(buffer, entry);
    const xml = textDecoder.decode(bytes);
    rows.push(...extractDocxTableRows(xml));
    chunks.push(xmlToText(xml));
  }

  return {
    text: chunks.join("\n\n").trim(),
    rows: normalizeTableRows(rows)
  };
}

function isListMarker(cell) {
  const clean = cell.trim();
  if (!clean) return false;
  
  // 1. Numbers (Western or Arabic) with optional prefix (No.) and optional suffix punctuation (., ), -, ])
  if (/^(?:No\.?\s*)?\(?[\d\u0660-\u0669\u06f0-\u06f9]+\)?[\s.)\]-]*$/i.test(clean)) {
    return true;
  }
  
  // 2. Roman numerals with suffix punctuation, e.g., "I.", "ii)", "iv-"
  if (/^[ivxldmIVXLDM]+[\s.)\]-]+$/.test(clean)) {
    return true;
  }
  
  // 3. Single-character bullets or checkbox symbols
  if (/^[\u2022\u00b7\u2013\u2014\-*+☐☑☒\u25cf\u25cb\u25aa\u25ab\u25a0\u25a1]$/.test(clean)) {
    return true;
  }
  
  // 4. Empty or checkbox brackets, e.g., "[]", "[ ]", "[x]", "[X]"
  if (/^\[[\s_xX]?\]$/.test(clean)) {
    return true;
  }
  
  return false;
}

function getDomCellText(node) {
  let text = "";
  for (const child of node.childNodes) {
    if (child.nodeType === 3) { // Text node
      text += child.nodeValue;
    } else if (child.nodeType === 1) { // Element node
      const localName = child.localName;
      if (localName === "tab") {
        text += "\t";
      }
      text += getDomCellText(child);
      if (localName === "p" || localName === "tr" || localName === "br") {
        text += "\n";
      }
    }
  }
  return text;
}

function extractTagsWithStack(xml, tagName) {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  const results = [];
  let pos = 0;

  while (true) {
    const startIdx = xml.indexOf(openTag, pos);
    if (startIdx === -1) break;

    const openTagEnd = xml.indexOf('>', startIdx);
    if (openTagEnd === -1) break;

    let depth = 1;
    let cursor = openTagEnd + 1;
    let matchEnd = -1;

    while (cursor < xml.length) {
      const nextOpen = xml.indexOf(openTag, cursor);
      const nextClose = xml.indexOf(closeTag, cursor);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        cursor = nextOpen + openTag.length;
      } else {
        depth--;
        if (depth === 0) {
          matchEnd = nextClose + closeTag.length;
          break;
        }
        cursor = nextClose + closeTag.length;
      }
    }

    if (matchEnd !== -1) {
      results.push(xml.substring(startIdx, matchEnd));
      pos = matchEnd;
    } else {
      pos = openTagEnd + 1;
    }
  }

  return results;
}

function extractDocxTableRowsStack(xml) {
  const tables = extractTagsWithStack(xml, "w:tbl");
  const rows = [];
  
  for (const table of tables) {
    const tableRows = extractTagsWithStack(table, "w:tr");
    for (const rowXml of tableRows) {
      let cells = extractTagsWithStack(rowXml, "w:tc")
        .map(cellXml => xmlToText(cellXml))
        .map(cleanCell);
        
      while (cells.length > 1 && isListMarker(cells[0])) {
        cells.shift();
      }
      
      cells = cells.filter(Boolean);
      if (cells.length >= 1) {
        rows.push(cells);
      }
    }
  }
  return rows;
}

function extractDocxTableRows(xml) {
  try {
    if (typeof window === "undefined" || !window.DOMParser) {
      return extractDocxTableRowsStack(xml);
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      console.warn("DOMParser error, fallback to stack parser:", parserError.textContent);
      return extractDocxTableRowsStack(xml);
    }
    
    const trElements = doc.getElementsByTagNameNS("*", "tr");
    const rows = [];
    
    for (const tr of trElements) {
      // Find cells directly belonging to this row (filter out nested row cells)
      const tcElements = Array.from(tr.getElementsByTagNameNS("*", "tc"))
        .filter(tc => {
          let parent = tc.parentNode;
          while (parent && parent !== tr) {
            if (parent.localName === "tr") return false;
            parent = parent.parentNode;
          }
          return parent === tr;
        });
        
      let cells = tcElements.map(tc => getDomCellText(tc)).map(cleanCell);
      
      while (cells.length > 1 && isListMarker(cells[0])) {
        cells.shift();
      }
      
      cells = cells.filter(Boolean);
      if (cells.length >= 1) {
        rows.push(cells);
      }
    }
    return rows;
  } catch (e) {
    console.error("DOMParser failed, using stack parser fallback:", e);
    return extractDocxTableRowsStack(xml);
  }
}

function normalizeTableRows(rows) {
  const seen = new Set();

  // Detect if the first column is a repeating classifier (e.g. German articles Der/Das/Die)
  // by checking if a small set of values dominates column 0
  const col0Values = rows.map(cells => cleanCell(cells[0]).toLowerCase()).filter(Boolean);
  const col0Freq = {};
  for (const v of col0Values) {
    col0Freq[v] = (col0Freq[v] || 0) + 1;
  }
  const uniqueCol0 = Object.keys(col0Freq).length;
  const totalRows = col0Values.length;
  
  // If very few unique values in column 0 compared to total rows,
  // and each value repeats heavily, column 0 is a classifier not a target word
  // e.g. 3 unique values for 100 rows → ratio = 0.03 → definitely a classifier
  const isCol0Classifier = totalRows >= 6 && uniqueCol0 >= 1 && (uniqueCol0 / totalRows) < 0.3;
  


  return rows
    .map(cells => {
      let target, english, arabic, article = "";
      
      if (isCol0Classifier && cells.length >= 3) {
        article = cleanCell(cells[0]);
        target = cleanCell(cells[1]);
        english = cleanCell(cells[2]);
        arabic = cleanCell(cells.slice(3).join(" "));
      } else {
        target = cleanCell(cells[0]);
        english = cleanCell(cells[1]);
        arabic = cleanCell(cells.slice(2).join(" "));
      }

      if (!arabic && hasArabic(english)) {
        const split = splitArabic(english);
        english = split.english;
        arabic = split.arabic;
      }

      return { target, english, arabic, article };
    })
    .filter(row => row.target)
    .filter(row => !looksLikeHeader(row))
    .filter(row => {
      const key = row.target.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function readZipEntries(buffer) {
  const view = new DataView(buffer);
  const endOffset = findEndOfCentralDirectory(view);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  const totalEntries = view.getUint16(endOffset + 10, true);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = new Uint8Array(buffer, offset + 46, fileNameLength);
    const name = textDecoder.decode(nameBytes);

    entries.push({
      name,
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("This DOCX file is not a valid ZIP archive.");
}

async function inflateZipEntry(buffer, entry) {
  const view = new DataView(buffer);
  const localOffset = entry.localHeaderOffset;

  if (view.getUint32(localOffset, true) !== 0x04034b50) {
    throw new Error(`Cannot read ${entry.name} from the DOCX archive.`);
  }

  const fileNameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.compression === 0) {
    return new Uint8Array(compressed);
  }

  if (entry.compression !== 8) {
    throw new Error(`Unsupported DOCX compression method: ${entry.compression}.`);
  }

  return inflateBytes(compressed, "deflate-raw");
}

async function extractPdfText(buffer) {
  const chunks = [];
  const raw = latinDecoder.decode(buffer);
  chunks.push(extractPdfTextOperators(raw));

  const streamRanges = findPdfStreams(raw);
  for (const range of streamRanges) {
    const streamBytes = buffer.slice(range.start, range.end);
    const decoded = await tryInflatePdfStream(streamBytes);
    if (decoded) {
      chunks.push(extractPdfTextOperators(latinDecoder.decode(decoded)));
    }
  }

  const text = chunks
    .join("\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 20) {
    throw new Error("No selectable text was found. Scanned PDFs need OCR before this app can read them.");
  }

  return text;
}

function findPdfStreams(raw) {
  const ranges = [];
  let cursor = 0;

  while (cursor < raw.length) {
    const streamIndex = raw.indexOf("stream", cursor);
    if (streamIndex === -1) break;

    let start = streamIndex + "stream".length;
    if (raw[start] === "\r" && raw[start + 1] === "\n") start += 2;
    else if (raw[start] === "\n") start += 1;

    const end = raw.indexOf("endstream", start);
    if (end === -1) break;

    ranges.push({ start, end });
    cursor = end + "endstream".length;
  }

  return ranges.slice(0, 250);
}

async function tryInflatePdfStream(bytes) {
  try {
    return await inflateBytes(bytes, "deflate");
  } catch {
    try {
      return await inflateBytes(bytes, "deflate-raw");
    } catch {
      return null;
    }
  }
}

async function inflateBytes(buffer, format) {
  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot decompress DOCX/PDF streams.");
  }

  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function extractPdfTextOperators(pdfText) {
  const values = [];
  const literalString = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayString = /\[(?:.|\n|\r)*?\]\s*TJ/g;
  const hexString = /<([0-9A-Fa-f\s]+)>\s*Tj/g;

  for (const match of pdfText.matchAll(literalString)) {
    values.push(decodePdfLiteral(match[0]));
  }

  for (const match of pdfText.matchAll(arrayString)) {
    const inner = match[0].replace(/\]\s*TJ$/, "");
    const pieces = [...inner.matchAll(/\((?:\\.|[^\\)])*\)/g)].map(piece => decodePdfLiteral(piece[0]));
    if (pieces.length) values.push(pieces.join(""));
  }

  for (const match of pdfText.matchAll(hexString)) {
    values.push(decodePdfHex(match[1]));
  }

  return values
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/([.!?])\s+/g, "$1\n")
    .trim();
}

function decodePdfLiteral(value) {
  return value
    .replace(/^\(/, "")
    .replace(/\)\s*Tj$/, "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\\d{1,3}/g, " ")
    .trim();
}

function decodePdfHex(value) {
  const clean = value.replace(/\s+/g, "");
  const bytes = [];
  for (let index = 0; index < clean.length; index += 2) {
    bytes.push(Number.parseInt(clean.slice(index, index + 2), 16));
  }
  return latinDecoder.decode(new Uint8Array(bytes)).trim();
}

function parseTextRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (line.includes("\t")) return line.split("\t").map(cleanCell);
      if (line.includes("|")) return line.split("|").map(cleanCell);
      return [];
    })
    .filter(cells => cells.length >= 2)
    .map(cells => ({ target: cells[0], english: cells[1], arabic: cells.slice(2).join(" ") }));
}

function looksLikeHeader(row) {
  const joined = `${row.target} ${row.english} ${row.arabic}`.toLowerCase();
  const targetLower = row.target.toLowerCase();
  
  // Classic header patterns
  if (/^(word|sentence|term|vocabulary)\b/.test(targetLower) && /meaning|definition|explanation/.test(joined)) {
    return true;
  }
  
  // Multilingual table headers (e.g. "Article German Word" with "Arabic Translation")
  if (/\b(article|word|translation|definition|meaning|term)\b/.test(targetLower) &&
      /\b(translation|word|definition|meaning|article)\b/.test(joined)) {
    // Count how many "header-like" keywords appear across all columns
    const headerWords = joined.match(/\b(article|word|sentence|term|vocabulary|translation|definition|meaning|explanation|arabic|english|german|french|spanish)\b/g) || [];
    if (headerWords.length >= 3) return true;
  }
  
  return false;
}

function splitArabic(value) {
  if (!value) return { english: "", arabic: "" };
  const arabicBlocks = String(value).match(/[\u0600-\u06ff]+(?:\s+[\u0600-\u06ff]+)*/g) || [];
  const arabic = arabicBlocks.join(" ").trim();
  let english = String(value);
  for (const block of arabicBlocks) {
    english = english.replace(block, "");
  }
  english = english.replace(/\s+/g, " ").trim();
  return { english, arabic };
}

function hasArabic(value) {
  return /[\u0600-\u06ff]/.test(String(value || ""));
}

function cleanCell(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function xmlToText(xml) {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
