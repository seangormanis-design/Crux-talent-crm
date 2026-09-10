import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { StorageDriver, StoredFile } from "./StorageDriver";

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly rootDir: string) {}

  private async ensureRoot() {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  async save(buffer: Buffer, originalName: string): Promise<StoredFile> {
    await this.ensureRoot();
    const ext = path.extname(originalName);
    const storageKey = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(this.rootDir, storageKey), buffer);
    return { storageKey, sizeBytes: buffer.length };
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(path.join(this.rootDir, storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await fs.rm(path.join(this.rootDir, storageKey), { force: true });
  }

  urlFor(storageKey: string): string {
    return `/files/${storageKey}`;
  }
}
