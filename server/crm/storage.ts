import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_ROOT = path.resolve(process.cwd(), "data/uploads");

async function ensureDir(dir: string) {
  await fsPromises.mkdir(dir, { recursive: true });
}

export interface StoredFile {
  id: string;
  filepath: string;
  url: string;
  size: number;
  filename: string;
  mime: string;
}

export class AttachmentStorage {
  async saveBuffer(options: { buffer: Buffer; filename: string; mime: string }): Promise<StoredFile> {
    const now = new Date();
    const dir = path.join(UPLOAD_ROOT, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
    await ensureDir(dir);
    const id = randomUUID();
    const ext = path.extname(options.filename);
    const safeExt = ext || this.guessExtension(options.mime);
    const basename = `${id}${safeExt}`;
    const filepath = path.join(dir, basename);
    await fsPromises.writeFile(filepath, options.buffer);
    const url = `/api/crm/attachments/${id}`;
    return { id, filepath, url, size: options.buffer.length, filename: options.filename, mime: options.mime };
  }

  async saveStream(file: Express.Multer.File): Promise<StoredFile> {
    const buffer = file.buffer;
    return this.saveBuffer({ buffer, filename: file.originalname, mime: file.mimetype });
  }

  private guessExtension(mime: string): string {
    if (mime.includes("png")) return ".png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
    if (mime.includes("gif")) return ".gif";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("pdf")) return ".pdf";
    if (mime.includes("mp4")) return ".mp4";
    if (mime.includes("mp3")) return ".mp3";
    if (mime.includes("wav")) return ".wav";
    return "";
  }

  async getStream(id: string): Promise<fs.ReadStream | null> {
    const matches = await this.findFileById(id);
    if (!matches) return null;
    return fs.createReadStream(matches.filepath);
  }

  async getMetadata(id: string): Promise<{ filepath: string; mime: string; filename: string } | null> {
    const matches = await this.findFileById(id);
    if (!matches) return null;
    return { filepath: matches.filepath, mime: matches.mime, filename: matches.filename };
  }

  private async findFileById(id: string): Promise<StoredFile | null> {
    if (!fs.existsSync(UPLOAD_ROOT)) {
      return null;
    }
    const yearDirs = await fsPromises.readdir(UPLOAD_ROOT);
    for (const year of yearDirs) {
      const yearPath = path.join(UPLOAD_ROOT, year);
      const stat = await fsPromises.stat(yearPath);
      if (!stat.isDirectory()) continue;
      const monthDirs = await fsPromises.readdir(yearPath);
      for (const month of monthDirs) {
        const monthPath = path.join(yearPath, month);
        const monthStat = await fsPromises.stat(monthPath);
        if (!monthStat.isDirectory()) continue;
        const files = await fsPromises.readdir(monthPath);
        for (const file of files) {
          if (file.startsWith(id)) {
            const filepath = path.join(monthPath, file);
            const info = await fsPromises.stat(filepath);
            return {
              id,
              filepath,
              url: `/api/crm/attachments/${id}`,
              size: info.size,
              filename: file,
              mime: this.detectMimeFromFilename(file),
            };
          }
        }
      }
    }
    return null;
  }

  private detectMimeFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".webp":
        return "image/webp";
      case ".mp4":
        return "video/mp4";
      case ".mp3":
        return "audio/mpeg";
      case ".wav":
        return "audio/wav";
      case ".pdf":
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  }
}

export const attachmentStorage = new AttachmentStorage();
