import { Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Candidate, CandidateSchema } from './dto/candidate.schema';
import { BullModule } from '@nestjs/bull';
import { FileUploadProcessor } from './file-upload.processor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Candidate.name, schema: CandidateSchema },
    ]),
    BullModule.registerQueue({ name: 'fileUpload' }),
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService,FileUploadProcessor],
})
export class CandidatesModule {}
