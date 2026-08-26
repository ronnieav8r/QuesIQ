import InterviewApp from "@/features/interview/interview-app";
import { isLocalInterviewAutoEntryEnabled } from "@/server/auth/dev-bypass";

export default function InterviewPage() {
  return <InterviewApp autoDevAuthEnabled={isLocalInterviewAutoEntryEnabled()} />;
}
