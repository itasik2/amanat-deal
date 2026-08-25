import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DealRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import { buildProtectionChecklist } from './protection-checklist';

export type EvidenceUploadInput = {
  kind?: string;
  uploaderRole?: string;
  note?: string;
};

export type EvidenceFinalizeInput = EvidenceUploadInput & {
  key?: string;
  fileName?: string;
  mimeType?: string;
};

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider
  ) {}

  async list(dealId: string) {
    await this.ensureDeal(dealId);
    return this.prisma.evidenceFile.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async checklist(dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        category: true,
        protectionPlan: true,
        evidence: {
          select: {
            uploaderRole: true,
            kind: true
          }
        }
      }
    });
    if (!deal) throw new NotFoundException('Deal not found');

    return buildProtectionChecklist(deal.category, deal.protectionPlan, deal.evidence);
  }

  async prepareUpload(dealId: string, fileName?: string) {
    await this.ensureDeal(dealId);
    const normalizedName = fileName?.trim();
    if (!normalizedName) throw new BadRequestException('Original file name is required');

    if (!this.storage.prepareDirectUpload) {
      return { mode: 'server' as const };
    }

    return this.storage.prepareDirectUpload(dealId, normalizedName);
  }

  async finalizeUpload(dealId: string, input: EvidenceFinalizeInput) {
    await this.ensureDeal(dealId);
    if (!this.storage.verifyDirectUpload) {
      throw new BadRequestException('Direct upload is not configured');
    }

    const key = input.key?.trim();
    const fileName = input.fileName?.trim();
    if (!key) throw new BadRequestException('Storage key is required');
    if (!fileName) throw new BadRequestException('Original file name is required');

    const existing = await this.prisma.evidenceFile.findFirst({
      where: { dealId, storageUrl: key }
    });
    if (existing) return existing;

    const uploaderRole = this.parseRole(input.uploaderRole);
    const kind = input.kind?.trim().toUpperCase() || 'OTHER';
    const note = input.note?.trim() || undefined;
    const stored = await this.storage.verifyDirectUpload(dealId, key);

    if (stored.sizeBytes > 25 * 1024 * 1024) {
      throw new BadRequestException('Evidence file exceeds the 25 MB pilot limit');
    }

    return this.createEvidenceRecord({
      dealId,
      uploaderRole,
      kind,
      fileName,
      mimeType: input.mimeType?.trim() || 'application/octet-stream',
      note,
      stored
    });
  }

  async upload(dealId: string, file: Express.Multer.File | undefined, input: EvidenceUploadInput) {
    await this.ensureDeal(dealId);
    if (!file) throw new BadRequestException('Evidence file is required');
    if (!file.originalname) throw new BadRequestException('Original file name is required');

    const uploaderRole = this.parseRole(input.uploaderRole);
    const kind = input.kind?.trim().toUpperCase() || 'OTHER';
    const note = input.note?.trim() || undefined;
    const stored = await this.storage.save(dealId, file.originalname, file.buffer);

    return this.createEvidenceRecord({
      dealId,
      uploaderRole,
      kind,
      fileName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      note,
      stored
    });
  }

  async read(dealId: string, evidenceId: string) {
    await this.ensureDeal(dealId);
    const evidence = await this.prisma.evidenceFile.findFirst({
      where: { id: evidenceId, dealId }
    });
    if (!evidence) throw new NotFoundException('Evidence not found');

    const buffer = await this.storage.read(evidence.storageUrl);
    return { evidence, buffer };
  }

  private createEvidenceRecord(input: {
    dealId: string;
    uploaderRole: DealRole;
    kind: string;
    fileName: string;
    mimeType: string;
    note?: string;
    stored: { key: string; sha256: string; sizeBytes: number };
  }) {
    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.evidenceFile.create({
        data: {
          dealId: input.dealId,
          uploaderRole: input.uploaderRole,
          kind: input.kind,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.stored.sizeBytes,
          storageUrl: input.stored.key,
          sha256: input.stored.sha256,
          note: input.note
        }
      });

      await tx.dealEvent.create({
        data: {
          dealId: input.dealId,
          actorRole: input.uploaderRole,
          eventType: 'evidence.uploaded',
          payload: {
            evidenceId: evidence.id,
            kind: evidence.kind,
            fileName: evidence.fileName,
            sha256: evidence.sha256,
            sizeBytes: evidence.sizeBytes
          }
        }
      });

      return evidence;
    });
  }

  private async ensureDeal(dealId: string) {
    const exists = await this.prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Deal not found');
  }

  private parseRole(value?: string) {
    const role = (value || DealRole.SYSTEM) as DealRole;
    if (!Object.values(DealRole).includes(role)) {
      throw new BadRequestException('Invalid uploader role');
    }
    return role;
  }
}
