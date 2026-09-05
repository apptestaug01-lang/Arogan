import pdf from 'pdf-parse'
import { HeadObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { StorageConfig } from '../config/storage.config.js'

export interface ConvertedDocument {
  source: {
    key: string
    contentType: string
    size: number
    checksum: string
    convertedAt: string
  }
  format: 'pdf' | 'docx' | 'xlsx' | 'image' | 'unknown'
  metadata: Record<string, unknown>
  pages: Array<Record<string, unknown>>
  rawText: string
  error?: string
}

export async function downloadFromS3(
  key: string,
  s3: S3Client,
  config: StorageConfig,
  maxBytes: number = 100 * 1024 * 1024,
): Promise<{ body: Buffer; contentType: string; size: number; checksum: string }> {
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
  )
  const size = head.ContentLength ?? 0
  if (size > maxBytes) {
    throw new Error(`File ${size} bytes exceeds converter limit ${maxBytes} bytes`)
  }
  const response = await s3.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  )
  if (!response.Body) throw new Error(`Empty body for ${key}`)
  const chunks: Buffer[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks)
  const checksum = head.ETag ? head.ETag.replace(/"/g, '') : ''
  return { body, contentType: response.ContentType ?? 'application/octet-stream', size, checksum }
}

export async function convertPdf(
  body: Buffer,
  fileName: string,
  key: string,
  config: { contentType: string; size: number; checksum: string },
): Promise<ConvertedDocument> {
  const result: ConvertedDocument = {
    source: {
      key,
      contentType: config.contentType,
      size: config.size,
      checksum: config.checksum,
      convertedAt: new Date().toISOString(),
    },
    format: 'pdf',
    metadata: {},
    pages: [],
    rawText: '',
  }

  let data: {
    text: string
    numPages: number
    info?: Record<string, unknown>
    metadata?: unknown
  }
  try {
    data = await pdf(body) as unknown as typeof data
  } catch (err) {
    result.error = `pdf-parse failed: ${err instanceof Error ? err.message : String(err)}`
    return result
  }

  result.metadata = {
    pageCount: data.numPages,
    title: data.info?.Title ?? null,
    author: data.info?.Author ?? null,
    subject: data.info?.Subject ?? null,
    creator: data.info?.Creator ?? null,
    producer: data.info?.Producer ?? null,
    creationDate: data.info?.CreationDate ?? null,
    modDate: data.info?.ModDate ?? null,
    pdfVersion: data.info?.PDFVersion ?? null,
  }

  const rawText = data.text ?? ''
  result.rawText = rawText

  const pageTexts = rawText.split(/\f/).filter((t) => t.trim().length > 0)

  if (pageTexts.length > 0 && pageTexts.length <= data.numPages) {
    pageTexts.forEach((text, idx) => {
      result.pages.push({
        pageNumber: idx + 1,
        text: text.trim(),
        textLength: text.trim().length,
      })
    })
  } else {
    if (rawText.trim().length > 0) {
      result.pages.push({
        pageNumber: 1,
        text: rawText.trim(),
        textLength: rawText.trim().length,
      })
    }
  }

  if (rawText.trim().length <= 20 && data.numPages > 0) {
    const ocrText = await tryPdfOcr(body, fileName)
    if (ocrText) {
      result.rawText = ocrText
      result.metadata = { ...result.metadata, ocrFallback: true }
      const lines = ocrText.split('\n').filter((l) => l.trim().length > 0)
      result.pages = lines.map((line, i) => ({
        pageNumber: i + 1,
        text: line.trim(),
        textLength: line.trim().length,
      }))
    }
  }

  return result
}

async function tryPdfOcr(body: Buffer, _fileName: string): Promise<string | null> {
  try {
    const { spawn } = await import('child_process')
    const { mkdtemp, writeFile, rm } = await import('fs/promises')
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const sharp = (await import('sharp')).default

    const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-ocr-'))
    const pdfPath = join(tmpDir, 'doc.pdf')
    const imgPath = join(tmpDir, 'page-1.png')

    try {
      await writeFile(pdfPath, body)
      await sharp(pdfPath).grayscale().threshold(128).png().toFile(imgPath)

      return new Promise<string | null>((resolve) => {
        const proc = spawn('tesseract', [imgPath, '-', '-l', 'eng'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
        proc.on('close', () => resolve(stdout))
        proc.on('error', () => resolve(null))
      })
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch {
    return null
  }
}

export async function convertDocx(
  body: Buffer,
  fileName: string,
  key: string,
  config: { contentType: string; size: number; checksum: string },
): Promise<ConvertedDocument> {
  const mammoth = (await import('mammoth')) as typeof import('mammoth')
  const result: ConvertedDocument = {
    source: {
      key,
      contentType: config.contentType,
      size: config.size,
      checksum: config.checksum,
      convertedAt: new Date().toISOString(),
    },
    format: 'docx',
    metadata: {},
    pages: [],
    rawText: '',
  }

  try {
    const textResult = await mammoth.extractRawText({ buffer: body })
    const htmlResult = await mammoth.convertToHtml({ buffer: body })

    result.rawText = textResult.value

    const html = htmlResult.value

    const paragraphs = html.match(/<[^>]+>/g)
    const uniqueTags = [...new Set(paragraphs ?? [])]
    result.metadata = {
      wordCount: textResult.value.trim().split(/\s+/).filter(Boolean).length,
      charCount: textResult.value.length,
      htmlLength: html.length,
      htmlElementTypes: uniqueTags,
      messages: textResult.messages.length > 0 ? textResult.messages : undefined,
    }

    result.pages = [{ pageNumber: 1, html, text: textResult.value }]
  } catch (err) {
    result.error = `docx conversion failed: ${err instanceof Error ? err.message : String(err)}`
  }

  return result
}

export async function convertSpreadsheet(
  body: Buffer,
  fileName: string,
  key: string,
  config: { contentType: string; size: number; checksum: string },
): Promise<ConvertedDocument> {
  const xlsx = (await import('xlsx')) as typeof import('xlsx')
  const result: ConvertedDocument = {
    source: {
      key,
      contentType: config.contentType,
      size: config.size,
      checksum: config.checksum,
      convertedAt: new Date().toISOString(),
    },
    format: 'xlsx',
    metadata: {},
    pages: [],
    rawText: '',
  }

  let workbook
  try {
    workbook = xlsx.read(body, {
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: true,
    })
  } catch (err) {
    result.error = `Spreadsheet parse failed: ${err instanceof Error ? err.message : String(err)}`
    return result
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    result.error = 'Workbook contains no sheets'
    return result
  }

  result.metadata = {
    sheetCount: workbook.SheetNames.length,
    sheetNames: workbook.SheetNames,
    fileName,
  }

  const allCsvParts: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets?.[sheetName]
    if (!sheet) {
      result.pages.push({
        pageNumber: result.pages.length + 1,
        name: sheetName,
        data: [],
        csv: '',
        error: 'Sheet object is undefined — may be corrupted or empty',
      })
      continue
    }

    try {
      const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false })
      const csvData = xlsx.utils.sheet_to_csv(sheet)
      allCsvParts.push(`=== Sheet: ${sheetName} ===\n${csvData}`)

      result.pages.push({
        pageNumber: result.pages.length + 1,
        name: sheetName,
        data: jsonData,
        csv: csvData,
      })
    } catch (sheetErr) {
      result.pages.push({
        pageNumber: result.pages.length + 1,
        name: sheetName,
        data: [],
        csv: '',
        error: `Sheet conversion failed: ${sheetErr instanceof Error ? sheetErr.message : String(sheetErr)}`,
      })
      allCsvParts.push(`=== Sheet: ${sheetName} ===\n[Conversion error: ${sheetErr instanceof Error ? sheetErr.message : String(sheetErr)}]`)
    }
  }

  result.rawText = allCsvParts.join('\n\n')
  return result
}

export async function convertImage(
  body: Buffer,
  contentType: string,
  fileName: string,
  key: string,
  config: { contentType: string; size: number; checksum: string },
): Promise<ConvertedDocument> {
  const result: ConvertedDocument = {
    source: {
      key,
      contentType: config.contentType,
      size: config.size,
      checksum: config.checksum,
      convertedAt: new Date().toISOString(),
    },
    format: 'image',
    metadata: {},
    pages: [],
    rawText: '',
  }

  const sharp = (await import('sharp')).default

  try {
    const metadata = await sharp(body).metadata()
    result.metadata = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      channels: metadata.channels,
      depth: metadata.depth,
      space: metadata.space,
    }
  } catch (err) {
    result.metadata = {
      error: `sharp metadata failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const ocrText = await tryTesseractOcr(body, fileName)
  if (ocrText) {
    result.rawText = ocrText.text
    result.metadata = { ...result.metadata, ocrConfidence: ocrText.confidence }
    result.pages = [{ pageNumber: 1, text: ocrText.text, confidence: ocrText.confidence }]
  } else {
    result.metadata = { ...result.metadata, ocrUnavailable: true }
  }

  return result
}

async function tryTesseractOcr(
  body: Buffer,
  fileName: string,
): Promise<{ text: string; confidence: number } | null> {
  try {
    const { spawn } = await import('child_process')
    const { mkdtemp, writeFile, rm, readFile } = await import('fs/promises')
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const sharp = (await import('sharp')).default

    const tmpDir = await mkdtemp(join(tmpdir(), 'img-ocr-'))
    const ext = fileName.includes('.png') ? '.png' : fileName.includes('.jpg') || fileName.includes('.jpeg') ? '.jpg' : '.png'
    const imgPath = join(tmpDir, `image${ext}`)
    const processedPath = join(tmpDir, 'processed.png')
    const tsvPath = join(tmpDir, 'output')

    try {
      await writeFile(imgPath, body)
      await sharp(body).grayscale().threshold(128).png().toFile(processedPath)

      await new Promise<void>((resolve, reject) => {
        const proc = spawn('tesseract', [processedPath, tsvPath, '-l', 'eng', 'tsv'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        proc.on('close', () => resolve())
        proc.on('error', reject)
      })

      const tsvContent = await readFile(`${tsvPath}.tsv`, 'utf-8')
      const lines = tsvContent.split('\n').slice(1)

      const textParts: string[] = []
      let confidenceSum = 0
      let confidenceCount = 0

      for (const line of lines) {
        const cols = line.split('\t')
        if (cols.length < 12) continue
        const text = cols[11]
        const conf = parseInt(cols[10], 10)
        if (text && text.trim() && !isNaN(conf)) {
          textParts.push(text)
          confidenceSum += conf
          confidenceCount++
        }
      }

      const text = textParts.join(' ')
      const confidence = confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) / 100 * 1000) / 1000 : 0

      return { text, confidence }
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch {
    return null
  }
}

export async function convertDocument(
  body: Buffer,
  contentType: string,
  fileName: string,
  key: string,
  sourceInfo: { size: number; checksum: string },
): Promise<ConvertedDocument> {
  const config = { contentType, size: sourceInfo.size, checksum: sourceInfo.checksum }

  switch (contentType) {
    case 'application/pdf':
      return convertPdf(body, fileName, key, config)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return convertDocx(body, fileName, key, config)
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
    case 'text/csv':
      return convertSpreadsheet(body, fileName, key, config)
    case 'image/png':
    case 'image/jpeg':
    case 'image/webp':
      return convertImage(body, contentType, fileName, key, config)
    default:
      return {
        source: {
          key,
          contentType,
          size: sourceInfo.size,
          checksum: sourceInfo.checksum,
          convertedAt: new Date().toISOString(),
        },
        format: 'unknown',
        metadata: {},
        pages: [],
        rawText: '',
        error: `Unsupported content type for lossless conversion: ${contentType}`,
      }
  }
}
