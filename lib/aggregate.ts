import type {
  DbPoll,
  DbPollResponse,
  MultipleChoicePoll,
  PollQuestion,
  WordCloudPoll,
} from "@/lib/types/polls";

const WORD_BASE = 15;
const WORD_INCREMENT = 5;

function dbTypeToUi(type: DbPoll["type"]): PollQuestion["type"] {
  return type === "word_cloud" ? "wordcloud" : "multiple-choice";
}

function wordValueFromCount(count: number): number {
  if (count <= 0) return 0;
  return WORD_BASE + (count - 1) * WORD_INCREMENT;
}

export function buildPollQuestions(
  polls: DbPoll[],
  responses: DbPollResponse[],
): PollQuestion[] {
  const responsesByPoll = new Map<string, DbPollResponse[]>();

  for (const response of responses) {
    const list = responsesByPoll.get(response.poll_id) ?? [];
    list.push(response);
    responsesByPoll.set(response.poll_id, list);
  }

  return polls.map((poll) => {
    const pollResponses = responsesByPoll.get(poll.id) ?? [];
    const uiType = dbTypeToUi(poll.type);

    if (uiType === "wordcloud") {
      const counts = new Map<string, number>();
      for (const row of pollResponses) {
        const word = row.word_submitted?.trim().toLowerCase();
        if (!word) continue;
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }

      const words = [...counts.entries()]
        .map(([text, count]) => ({
          text,
          count,
          value: wordValueFromCount(count),
        }))
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));

      return {
        id: poll.id,
        question: poll.question_text,
        type: "wordcloud",
        words,
      } satisfies WordCloudPoll;
    }

    const optionLabels = poll.choice_options ?? [];
    const voteCounts = new Map<string, number>();
    for (const label of optionLabels) {
      voteCounts.set(label, 0);
    }
    for (const row of pollResponses) {
      const selected = row.option_selected;
      if (!selected) continue;
      voteCounts.set(selected, (voteCounts.get(selected) ?? 0) + 1);
    }

    const options = optionLabels.map((text, index) => ({
      id: `${poll.id}-opt-${index}`,
      text,
      votes: voteCounts.get(text) ?? 0,
    }));

    return {
      id: poll.id,
      question: poll.question_text,
      type: "multiple-choice",
      options,
    } satisfies MultipleChoicePoll;
  });
}

export function getVotedPollIdsForSession(
  responses: DbPollResponse[],
  sessionId: string,
): Set<string> {
  const voted = new Set<string>();
  for (const row of responses) {
    if (row.session_id === sessionId) {
      voted.add(row.poll_id);
    }
  }
  return voted;
}
