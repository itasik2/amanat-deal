import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DealRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';

export type EvidenceUploadInput = {
  kind?: string;
  uploaderRole?: string;
  note?: string;
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

  async upload(dealId: string, file: Express.Multer.File | undefined, input: EvidenceUploadInput) {
    await this.ensureDeal(dealId);
    if (!file) throw new BadRequestException('Evidence file is required');
    if (!file.originalname) throw new BadRequestException('Original file name is required');

    const uploaderRole = this.parseRole(input.uploaderRole);
    const kind = input.kind?.trim() || 'OTHER';
    const note = input.note?.trim() || undefined;
    const stored = await this.storage.save(dealId, file.originalname, file.buffer);

    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.evidenceFile.create({
        data: {
          dealId,
          uploaderRole,
          kind,
          fileName: file.originalname,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: stored.sizeBytes,
          storageUrl: stored.key,
          sha256: stored.sha256,
          note
        }
      });

      await tx.dealEvent.create({
        data: {
          dealId,
          actorRole: uploaderRole,
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

  async read(dealId: string, evidenceId: string) {
    await this.ensureDeal(dealId);
    const evidence = await this.prisma.evidenceFile.findFirst({
      where: { id: evidenceId, dealId }
    });
    if (!evidence) throw new NotFoundException('Evidence not found');

    const buffer = await this.storage.read(evidence.storageUrl);
    return { evidence, buffer };
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
