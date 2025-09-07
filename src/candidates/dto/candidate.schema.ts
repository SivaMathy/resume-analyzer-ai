import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CandidateDocument = Candidate & Document;

@Schema({ collection: 'candidateDetails' })
export class Candidate {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  phoneNumber: string;

  @Prop({ type: [String] })
  skills: string[];

  @Prop({ type: [Number] })
  embedding: number[];

  @Prop({ required: true, unique: true })
  cvPath: string;

  @Prop({ type: [{ degree: String, university: String, year: String }] })
  education: { degree: string; university: string; year: string }[];

  @Prop({ type: [{ jobTitle: String, company: String, duration: String }] })
  workExperience: { jobTitle: string; company: string; duration: string }[];

  @Prop({ type: [String] })
  certifications: string[];
}

export const CandidateSchema = SchemaFactory.createForClass(Candidate);
