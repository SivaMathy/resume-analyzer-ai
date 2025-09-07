import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  Query,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CandidatesService } from './candidates.service';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { memoryStorage } from 'multer';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.includes('pdf')) {
          return cb(new Error('Only PDF files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file)
      throw new BadRequestException('No file uploaded or file is empty');

    const candidate = await this.candidatesService.uploadCv(file);
    return candidate;
  }
  @Post('upload-multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.includes('pdf')) {
          return cb(new Error('Only PDF files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    return this.candidatesService.uploadMultipleCvs(files);
  }

  @Get('search')
  async search(@Query('q') q: string) {
    return this.candidatesService.searchCandidates(q);
  }

  @Get()
  findAll() {
    return this.candidatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCandidateDto: UpdateCandidateDto,
  ) {
    return this.candidatesService.update(id, updateCandidateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.candidatesService.remove(id);
  }
}
