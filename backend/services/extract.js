const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

class ExtractError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Vrne { text } za dokumente ali { image } za fotografije, ki jih Claude prebere neposredno
async function extractFromFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (IMAGE_TYPES[ext]) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ExtractError('Fotografija je prevelika (največ 5 MB).');
    }
    return { image: { media_type: IMAGE_TYPES[ext], data: file.buffer.toString('base64') } };
  }

  if (ext === '.pdf') {
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    try {
      return { text: (await parser.getText()).text };
    } catch {
      throw new ExtractError('PDF datoteke ni bilo mogoče prebrati.');
    } finally {
      await parser.destroy();
    }
  }

  if (ext === '.docx') {
    try {
      return { text: (await mammoth.extractRawText({ buffer: file.buffer })).value };
    } catch {
      throw new ExtractError('Word datoteke ni bilo mogoče prebrati.');
    }
  }

  if (ext === '.txt') {
    return { text: file.buffer.toString('utf8') };
  }

  throw new ExtractError('Podprte so datoteke PDF, DOCX, JPG, PNG in TXT.');
}

module.exports = { extractFromFile, ExtractError };
