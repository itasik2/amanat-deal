export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export type StoredObject = {
  key: string;
  sha256: string;
  sizeBytes: number;
};

export interface StorageProvider {
  save(dealId: string, originalName: string, buffer: Buffer): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
}
