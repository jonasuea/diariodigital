// src/ai/flows/summarize-student-performance.ts
'use server';

/**
 * @fileOverview Summarizes a student's performance based on grades, attendance, and journal entries.
 *
 * - summarizeStudentPerformance - A function that summarizes student performance.
 * - SummarizeStudentPerformanceInput - The input type for the summarizeStudentPerformance function.
 * - SummarizeStudentPerformanceOutput - The return type for the summarizeStudentPerformance function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {getGrades} from '@/services/grades';
import {getAttendance} from '@/services/attendance';
import {getJournalEntries} from '@/services/journal';

const SummarizeStudentPerformanceInputSchema = z.object({
  studentId: z.string().describe('The ID of the student to summarize.'),
  classSubject: z.string().describe('The class or subject to consider for the summary.'),
  date: z.string().optional().describe('Optional date to filter attendance records.'),
});
export type SummarizeStudentPerformanceInput = z.infer<
  typeof SummarizeStudentPerformanceInputSchema
>;

const SummarizeStudentPerformanceOutputSchema = z.object({
  summary: z.string().describe('A summary of the student\'s performance.'),
});
export type SummarizeStudentPerformanceOutput = z.infer<
  typeof SummarizeStudentPerformanceOutputSchema
>;

export async function summarizeStudentPerformance(
  input: SummarizeStudentPerformanceInput
): Promise<SummarizeStudentPerformanceOutput> {
  return summarizeStudentPerformanceFlow(input);
}

const summarizeStudentPerformancePrompt = ai.definePrompt({
  name: 'summarizeStudentPerformancePrompt',
  input: {
    schema: z.object({
      studentId: z.string().describe('The ID of the student.'),
      grades: z.string().describe('The student\'s grades.'),
      attendance: z.string().describe('The student\'s attendance record.'),
      journalEntries: z.string().describe('Journal entries for the class.'),
    }),
  },
  output: {
    schema: z.object({
      summary: z.string().describe('A summary of the student\'s performance.'),
    }),
  },
  prompt: `You are an AI assistant helping teachers understand student performance.\n\n  Based on the following information, summarize the student's overall performance in the class. Identify areas where the student is doing well and areas where they may need additional support.\n\n  Student ID: {{{studentId}}}\n  Grades: {{{grades}}}\n  Attendance: {{{attendance}}}\n  Journal Entries: {{{journalEntries}}}\n\n  Summary:`,
});

const summarizeStudentPerformanceFlow = ai.defineFlow<
  typeof SummarizeStudentPerformanceInputSchema,
  typeof SummarizeStudentPerformanceOutputSchema
>(
  {
    name: 'summarizeStudentPerformanceFlow',
    inputSchema: SummarizeStudentPerformanceInputSchema,
    outputSchema: SummarizeStudentPerformanceOutputSchema,
  },
  async input => {
    const grades = await getGrades(input.studentId);
    const attendance = await getAttendance(input.date ?? new Date().toISOString().slice(0, 10));
    const journalEntries = await getJournalEntries(input.classSubject);

    const gradesString = JSON.stringify(grades);
    const attendanceString = JSON.stringify(attendance);
    const journalEntriesString = JSON.stringify(journalEntries);

    const {output} = await summarizeStudentPerformancePrompt({
      studentId: input.studentId,
      grades: gradesString,
      attendance: attendanceString,
      journalEntries: journalEntriesString,
    });
    return output!;
  }
);
