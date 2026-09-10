export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
}

// Every future backend (S3, Supabase Storage, etc.) implements this same
// interface, so swapping storage is a config change, not a rewrite.
export interface StorageDriver {
  save(buffer: Buffer, originalName: string): Promise<StoredFile>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  urlFor(storageKey: string): string;
}
