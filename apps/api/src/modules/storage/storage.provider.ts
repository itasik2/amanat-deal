export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export type StoredObject = {
  key: string;
  sha256: string;
  sizeBytes: number;
};

export type DirectUploadPlan =
  | { mode: 'server' }
  | {
      mode: 'direct';
      key: string;
      uploadUrl: string;
      fields: Record<string, string>;
    };

export interface StorageProvider {
  save(dealId: string, originalName: string, buffer: Buffer): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
  prepareDirectUpload?(dealId: string, originalName: string): Promise<DirectUploadPlan>;
  verifyDirectUpload?(dealId: string, key: string): Promise<StoredObject>;
  temporaryReadUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}
