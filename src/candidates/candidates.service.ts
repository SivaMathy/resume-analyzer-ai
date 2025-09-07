import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Candidate, CandidateDocument } from './dto/candidate.schema';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class CandidatesService {
  constructor(
    @InjectModel(Candidate.name)
    private readonly candidateModel: Model<CandidateDocument>,
    @InjectQueue('fileUpload')
    private readonly fileUploadQueue: Queue,
  ) {}

  async uploadCv(file: Express.Multer.File): Promise<{ jobId: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, file.originalname);
    fs.writeFileSync(filePath, file.buffer);

    const job = await this.fileUploadQueue.add(
      'processCv',
      { filePath, fileName: file.originalname },
      { delay: 3000, lifo: true },
    );

    return { jobId: job.id as string };
  }

  async uploadMultipleCvs(
    files: Express.Multer.File[],
  ): Promise<{ jobIds: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const jobs = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(uploadDir, file.originalname);
        fs.writeFileSync(filePath, file.buffer);

        const job = await this.fileUploadQueue.add(
          'processCv',
          { filePath, fileName: file.originalname },
          { delay: 3000, lifo: true },
        );

        return job.id as string;
      }),
    );

    return { jobIds: jobs };
  }

  findAll() {
    return this.candidateModel.find().exec();
  }

  findOne(id: string) {
    return this.candidateModel.findById(id).exec();
  }

  update(id: string, updateData: Partial<Candidate>) {
    return this.candidateModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  remove(id: string) {
    return this.candidateModel.findByIdAndDelete(id).exec();
  }

  async searchCandidates(prompt: string) {
    const response = await this.generateEmbedding(prompt);

    const results = await this.candidateModel.aggregate([
      {
        $vectorSearch: {
          queryVector: response,
          path: 'embedding',
          numCandidates: 6,
          limit: 5,
          index: 'vector_index',
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          skills: 1,
          workExperience: 1,
          education: 1,
          certifications: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: { score: { $gte: 0.8 } },
      },
    ]);

    return results;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const axios = (await import('axios')).default;
    const response = await axios.post(
      'http://localhost:11434/api/embeddings',
      { model: 'nomic-embed-text', prompt: text },
      { headers: { 'Content-Type': 'application/json' } },
    );
    return response.data.embedding;
  }
}
