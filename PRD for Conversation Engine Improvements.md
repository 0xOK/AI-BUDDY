✅ 1. Interrupt-Aware Response Handling
If input.interrupted === true, the assistant must:

Cancel its last reply if it was mid-sentence

Merge the new user input with the previous unfinished question

E.g. lastUserMessage + " " + input.text

Replace the last user message in history with this merged one

Remove the last assistant message (if it hasn’t been spoken yet or was cut off)

Continue normally with this new message (send to LLM)

✅ 2. Smarter Conversation Stage Control
Sessions should track:
ts
Copy
Edit
{
  sessionId: string;
  turnCount: number;
  stage: "onboarding" | "free";
  history: { role: "user" | "assistant", content: string }[];
  lastUserMessage?: string;
  lastAssistantMessage?: string;
}
Onboarding should use fetchScriptFromSupabase(turnCount)

After 3 turns, automatically switch to "free" mode

✅ 3. Inline Intent Detection (for Registration Prompt)
Add helper detectRegistrationIntent(text: string): boolean using regex

ts
Copy
Edit
/register|sign up|create account|yes|sure|okay/i
If user expresses intent to register, return:

ts
Copy
Edit
{
  response: "Great! Redirecting you to registration...",
  action: "redirect",
  to: "/register",
  stage
}
✅ 4. Graceful Fallbacks
If LLM fails → return "Sorry, I didn’t catch that. Can you repeat?"

If input is blank → same fallback

If onboarding script is missing → default to "Welcome! Let's get started."

✅ 5. Update History Safely
Only add to history if LLM call was successful

Track and store lastUserMessage and lastAssistantMessage for merging later

👇 Final Requirements:
Keep the function named handleUserMessage(input: UserMessageInput): Promise<AssistantResponse>

Add all logic inline with comments where necessary

Return format:

ts
Copy
Edit
type AssistantResponse = {
  response: string;
  action?: "redirect";
  to?: string;
  stage: "onboarding" | "free";
}