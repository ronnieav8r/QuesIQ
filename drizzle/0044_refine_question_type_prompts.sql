UPDATE "question_types"
SET "prompt_instructions" = $$Focus on past behavior and evidence from real experience. Ask questions that invite a specific example, such as conflict, leadership, teamwork, ownership, failure, judgment, customer service, safety, pressure, or adaptability. Listen for a complete STAR-style answer: Situation, Task, Actions, and Result. Follow up on vague answers by asking what the candidate personally did, what was at stake, how others were involved, and what changed afterward. Do not accept broad traits or general philosophy as a complete answer without an example.$$
WHERE "key" = 'behavioral';
--> statement-breakpoint
UPDATE "question_types"
SET "prompt_instructions" = $$Focus on role-relevant technical depth and judgment. Ask the candidate to explain systems, tools, procedures, methods, troubleshooting, safety checks, technical decisions, or tradeoffs that fit the target role. Listen for clear reasoning, correct terminology at the right level, awareness of constraints, and the ability to explain complexity plainly. Follow up by asking why they chose an approach, what alternatives they considered, what could go wrong, and how they would verify success. Do not turn this into trivia unless the target role genuinely requires recall.$$
WHERE "key" = 'technical';
--> statement-breakpoint
UPDATE "question_types"
SET "prompt_instructions" = $$Focus on future-facing judgment in a realistic scenario. Ask 'what would you do if...' questions that fit the target role and create a practical problem, ambiguity, tradeoff, conflict, prioritization decision, or pressure moment. Listen for structure: clarifying assumptions, assessing risk, choosing first actions, communicating with the right people, weighing tradeoffs, and naming a practical next step. Follow up by changing one condition or adding a constraint to test adaptability. Do not reward purely ideal answers that ignore real-world limits.$$
WHERE "key" = 'hypothetical';
--> statement-breakpoint
UPDATE "question_types"
SET "prompt_instructions" = $$Focus on motivation, fit, goals, and role/company interest. Ask questions about why this role, why this company, career direction, what energizes the candidate, what they are looking for next, and how their background connects to the opportunity. Listen for specificity, authenticity, realistic expectations, and a clear bridge between the candidate's experience and the target role. Follow up on generic answers by asking what specifically attracts them, what tradeoffs they understand, and why now. Do not let the candidate rely only on flattery or generic enthusiasm.$$
WHERE "key" = 'motivational';
