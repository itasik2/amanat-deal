import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceFinalizeInput, EvidenceService, EvidenceUploadInput } from './evidence.service';

@Controller('deals')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get(':id/evidence')
  list(@Param('id') id: string) {
    return this.evidence.list(id);
  }

  @Get(':id/protection-checklist')
  checklist(@Param('id') id: string) {
    return this.evidence.checklist(id);
  }

  @Post(':id/evidence/prepare-upload')
  prepareUpload(@Param('id') id: string, @Body() body: { fileName?: string }) {
    return this.evidence.prepareUpload(id, body.fileName);
  }

  @Post(':id/evidence/finalize-upload')
  finalizeUpload(@Param('id') id: string, @Body() body: EvidenceFinalizeInput) {
    return this.evidence.finalizeUpload(id, body);
  }

  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: EvidenceUploadInput
  ) {
    return this.evidence.upload(id, file, body);
  }

  @Get(':id/evidence/:evidenceId/file')
  async file(
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Res({ passthrough: true }) response: any
  ) {
    const { evidence, buffer } = await this.evidence.read(id, evidenceId);
    response.setHeader('Content-Type', evidence.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(evidence.fileName)}`
    );
    response.setHeader('X-Evidence-SHA256', evidence.sha256);
    return new StreamableFile(buffer);
  }
}
