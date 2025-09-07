import { Processor, Process } from '@nestjs/bull';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Candidate, CandidateDocument } from './dto/candidate.schema';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';

@Injectable()
@Processor('fileUpload')
export class FileUploadProcessor {
  constructor(
    @InjectModel(Candidate.name)
    private readonly candidateModel: Model<CandidateDocument>,
  ) {}

  @Process('processCv')
  async handleProcessCv(job: Job<{ filePath: string; fileName: string }>) {
    const { filePath, fileName } = job.data;

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(fileBuffer);
      const extractedText = pdfData.text.replace(/\s+/g, ' ').trim();

      const candidateDetails = await this.summarizeWithLlama(extractedText);
      if (!candidateDetails.email) {
        throw new Error(`Could not extract email from CV: ${fileName}`);
      }

      const textForEmbedding = this.buildEmbeddingText(candidateDetails);
      const embedding = await this.generateEmbedding(textForEmbedding);

      const candidate = new this.candidateModel({
        ...candidateDetails,
        embedding,
        cvPath: filePath,
      });

      await candidate.save();
      return candidate;
    } catch (err) {
      console.error(`Failed processing ${fileName}:`, err.message);
      throw err;
    }
  }

  private async summarizeWithLlama(text: string): Promise<Partial<Candidate>> {
    const prompt = `
    Extract the following information from this resume.
    Return ONLY a valid JSON object in this exact format:
  
    {
      "firstName": "",
      "lastName": "",
      "email": "",
      "phoneNumber": "",
      "skills": ["", ""],
      "education": [
        { "degree": "", "university": "", "year": "" }
      ],
      "workExperience": [
        { "jobTitle": "", "company": "", "duration": "" }
      ],
      "certifications": [""]
    }
  
    Resume Text:
    ${text}
    `;

    const response = await axios.post(
      'http://localhost:11434/api/generate',
      { model: 'llama3', prompt, stream: false },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const responseText = response.data.response;
    try {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(responseText.slice(jsonStart, jsonEnd + 1));
      }
      throw new Error('No JSON found in LLaMA response');
    } catch (err) {
      console.error('Failed to parse JSON from LLaMA:', err.message);
      return {};
    }
  }

  private buildEmbeddingText(details: Partial<Candidate>): string {
    const parts: string[] = [];

    if (details.workExperience) {
      parts.push(
        `Experience: ${(details.workExperience as any[])
          .map(
            (exp) =>
              `${exp.jobTitle || ''} at ${exp.company || ''} (${exp.duration || ''})`,
          )
          .join('; ')}`,
      );
    }
    if (details.skills) {
      parts.push(`Skills: ${details.skills.join(', ')}`);
    }
    if (details.education) {
      parts.push(
        `Education: ${(details.education as any[])
          .map(
            (edu) =>
              `${edu.degree || ''} from ${edu.university || ''} (${edu.year || ''})`,
          )
          .join('; ')}`,
      );
    }
    if (details.certifications) {
      parts.push(
        `Certifications: ${(details.certifications as string[]).join(', ')}`,
      );
    }

    return parts.join(' | ');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await axios.post(
      'http://localhost:11434/api/embeddings',
      { model: 'nomic-embed-text', prompt: text },
      { headers: { 'Content-Type': 'application/json' } },
    );
    return response.data.embedding;
  }
}
