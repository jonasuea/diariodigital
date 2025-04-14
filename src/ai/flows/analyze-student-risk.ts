'use server';
/**
 * @fileOverview This file defines a Genkit flow for analyzing student risk based on journal entries and attendance data.
 *
 * - analyzeStudentRisk - A function that triggers the analysis flow.
 * - AnalyzeStudentRiskInput - The input type for the analyzeStudentRisk function.
 * - AnalyzeStudentRiskOutput - The return type for the analyzeStudentRisk function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {getJournalEntries} from '@/services/journal';
import {getAttendance} from '@/services/attendance';

const AnalyzeStudentRiskInputSchema = z.object({
  studentId: z.string().describe('The ID of the student to analyze.'),
  classSubject: z.string().describe('The class or subject to analyze.'),
});
export type AnalyzeStudentRiskInput = z.infer<typeof AnalyzeStudentRiskInputSchema>;

const AnalyzeStudentRiskOutputSchema = z.object({
  riskAssessment: z.string().describe('A comprehensive assessment of the student risk level, factors, and recommendations.'),
});
export type AnalyzeStudentRiskOutput = z.infer<typeof AnalyzeStudentRiskOutputSchema>;

export async function analyzeStudentRisk(input: AnalyzeStudentRiskInput): Promise<AnalyzeStudentRiskOutput> {
  return analyzeStudentRiskFlow(input);
}

const analyzeStudentRiskPrompt = ai.definePrompt({
  name: 'analyzeStudentRiskPrompt',
  input: {
    schema: z.object({
      studentId: z.string().describe('The ID of the student to analyze.'),
      journalEntries: z.string().describe('The journal entries for the class.'),
      attendanceRecords: z.string().describe('The attendance records for the student.'),
      classSubject: z.string().describe('The class or subject to analyze.'),
    }),
  },
  output: {
    schema: z.object({
      riskAssessment: z.string().describe('A comprehensive assessment of the student risk level, factors, and recommendations.'),
    }),
  },
  prompt: `You are an AI assistant that analyzes student data to identify potential risks.

  Analyze the following journal entries and attendance records for student {{studentId}} in class {{classSubject}} to assess their risk of falling behind or dropping out.

  Journal Entries:
  {{journalEntries}}

  Attendance Records:
  {{attendanceRecords}}

  Provide a comprehensive assessment of the student risk level, factors contributing to the risk, and specific recommendations for interventions and support.
  Be concise.
  `,
});

const analyzeStudentRiskFlow = ai.defineFlow<
  typeof AnalyzeStudentRiskInputSchema,
  typeof AnalyzeStudentRiskOutputSchema
>({
  name: 'analyzeStudentRiskFlow',
  inputSchema: AnalyzeStudentRiskInputSchema,
  outputSchema: AnalyzeStudentRiskOutputSchema,
}, async (input) => {
  const journalEntries = await getJournalEntries(input.classSubject);
  const attendanceRecords = await getAttendance(input.classSubject);

  const journalEntriesString = JSON.stringify(journalEntries);
  const attendanceRecordsString = JSON.stringify(attendanceRecords);

  const {output} = await analyzeStudentRiskPrompt({
    studentId: input.studentId,
    journalEntries: journalEntriesString,
    attendanceRecords: attendanceRecordsString,
    classSubject: input.classSubject,
  });
  return output!;
});
