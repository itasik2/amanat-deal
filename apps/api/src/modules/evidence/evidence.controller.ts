import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user';
import type { PublicUser } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DealAccessService } from '../deals/deal-access.service';
import { EvidenceFinalizeInput, EvidenceService, EvidenceUploadInput } from './evidence.service';

@Controller('deals')
@UseGuards(SessionAuthGuard)
export class EvidenceController {
  constructor(
    private readonly evidence: EvidenceService,
    private readonly access: DealAccessService
  ) {}

  @Get(':id/evidence')
  async list(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    await this.access.roleForUser(id, user.id);
    return this.evidence.list(id);
  }

  @Get(':id/protection-checklist')
  async checklist(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    await this.access.roleForUser(id, user.id);
    return this.evidence.checklist(id);
  }

  @Post(':id/evidence/prepare-upload')
  async prepareUpload(
    @Param('id') id: string,
    @Body() body: { fileName?: string },
    @CurrentUser() user: PublicUser
  ) {
    await this.access.roleForUser(id, user.id);
    return this.evidence.prepareUpload(id, body.fileName);
  }

  @Post(':id/evidence/finalize-upload')
  async finalizeUpload(
    @Param('id') id: string,
    @Body() body: EvidenceFinalizeInput,
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.roleForUser(id, user.id);
    return this.evidence.finalizeUpload(id, { ...body, uploaderRole: role });
  }

  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: EvidenceUploadInput,
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.roleForUser(id, user.id);
    return this.evidence.upload(id, file, { ...body, uploaderRole: role });
  }

  @Get(':id/evidence/:evidenceId/file')
  async file(
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: PublicUser,
    @Res() response: any
  ) {
    await this.access.roleForUser(id, user.id);
    const access = await this.evidence.read(id, evidenceId);

    if ('url' in access) {
      return response.redirect(302, access.url);
    }

    response.setHeader('Content-Type', access.evidence.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(access.evidence.fileName)}`
    );
    response.setHeader('X-Evidence-SHA256', access.evidence.sha256);
    return response.send(access.buffer);
  }
}
