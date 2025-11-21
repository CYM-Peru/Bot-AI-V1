/**
 * OCR Service using Google Vision API
 * Extracts text from images and documents
 */

import vision from '@google-cloud/vision';
import fetch from 'node-fetch';

interface OCRResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
  language?: string;
}

interface OCROptions {
  googleCloudCredentials?: string; // JSON string with service account credentials
}

/**
 * Create Google Vision client with credentials from config or environment
 */
async function createVisionClient(options?: OCROptions): Promise<any> {
  // If credentials provided in config, use them
  if (options?.googleCloudCredentials) {
    try {
      const credentials = JSON.parse(options.googleCloudCredentials);
      console.log('[OCR] Using credentials from agent configuration');
      return new vision.ImageAnnotatorClient({ credentials });
    } catch (error) {
      console.error('[OCR] Failed to parse Google Cloud credentials from config:', error);
      throw new Error('Invalid Google Cloud credentials format');
    }
  }

  // Otherwise, try to read from ia-agent-config.json
  try {
    const { readConfig } = await import('../routes/ia-agent-config');
    const agentConfig = await readConfig();

    if (agentConfig?.visionAndOCR?.googleCloudCredentials) {
      const credentials = JSON.parse(agentConfig.visionAndOCR.googleCloudCredentials);
      console.log('[OCR] Using credentials from ia-agent-config.json');
      return new vision.ImageAnnotatorClient({ credentials });
    }
  } catch (error) {
    console.log('[OCR] No credentials found in agent config, falling back to environment');
  }

  // Fallback to environment variables (GOOGLE_APPLICATION_CREDENTIALS)
  console.log('[OCR] Using credentials from environment (GOOGLE_APPLICATION_CREDENTIALS)');
  return new vision.ImageAnnotatorClient();
}

/**
 * Extract text from an image using Google Vision OCR
 * @param imageUrl - URL of the image to process
 * @param options - Optional configuration (credentials, etc.)
 * @returns OCR result with extracted text
 */
export async function extractTextFromImage(imageUrl: string, options?: OCROptions): Promise<OCRResult> {
  try {
    console.log('[OCR] Processing image:', imageUrl);

    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBuffer = await response.buffer();
    console.log('[OCR] Image downloaded, size:', imageBuffer.length, 'bytes');

    // Create Vision client with credentials
    const client = await createVisionClient(options);

    // Perform text detection
    const [result] = await client.textDetection(imageBuffer);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      console.log('[OCR] No text detected in image');
      return {
        success: true,
        text: '',
        confidence: 0,
      };
    }

    // First annotation contains the full extracted text
    const fullText = detections[0]?.description || '';

    // Try to detect language (if available)
    const locale = detections[0]?.locale;

    console.log('[OCR] ✅ Text extracted successfully, length:', fullText.length);
    console.log('[OCR] Detected language:', locale || 'unknown');

    return {
      success: true,
      text: fullText,
      language: locale || undefined,
      confidence: 1.0, // Google Vision doesn't provide confidence for full text
    };

  } catch (error: any) {
    console.error('[OCR] ❌ Error processing image:', error.message);

    // Check if it's a credentials error
    if (error.message?.includes('Could not load the default credentials')) {
      return {
        success: false,
        error: 'Google Cloud credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable.',
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown error during OCR processing',
    };
  }
}

/**
 * Extract text from document (optimized for documents like PDFs, scanned images)
 * @param imageUrl - URL of the document image
 * @param options - Optional configuration (credentials, etc.)
 * @returns OCR result with extracted text
 */
export async function extractTextFromDocument(imageUrl: string, options?: OCROptions): Promise<OCRResult> {
  try {
    console.log('[OCR Document] Processing document:', imageUrl);

    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`);
    }

    const imageBuffer = await response.buffer();
    console.log('[OCR Document] Document downloaded, size:', imageBuffer.length, 'bytes');

    // Create Vision client with credentials
    const client = await createVisionClient(options);

    // Use document text detection (optimized for dense text)
    const [result] = await client.documentTextDetection(imageBuffer);
    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      console.log('[OCR Document] No text detected in document');
      return {
        success: true,
        text: '',
        confidence: 0,
      };
    }

    const extractedText = fullTextAnnotation.text;

    console.log('[OCR Document] ✅ Text extracted successfully, length:', extractedText.length);

    return {
      success: true,
      text: extractedText,
      confidence: 1.0,
    };

  } catch (error: any) {
    console.error('[OCR Document] ❌ Error processing document:', error.message);

    if (error.message?.includes('Could not load the default credentials')) {
      return {
        success: false,
        error: 'Google Cloud credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable.',
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown error during document OCR processing',
    };
  }
}
