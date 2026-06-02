export type PollType = "wordcloud" | "multiple-choice";
export type DbPollType = "word_cloud" | "multiple_choice";

export interface PollWord {
  text: string;
  /** Visual weight for cloud font size */
  value: number;
  /** Actual number of submissions (shown in brackets) */
  count: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface BasePoll {
  id: string;
  question: string;
  type: PollType;
}

export interface WordCloudPoll extends BasePoll {
  type: "wordcloud";
  words: PollWord[];
}

export interface MultipleChoicePoll extends BasePoll {
  type: "multiple-choice";
  options: PollOption[];
}

export type PollQuestion = WordCloudPoll | MultipleChoicePoll;

export interface DbPoll {
  id: string;
  question_text: string;
  type: DbPollType;
  choice_options: string[] | null;
  created_at: string;
}

export interface DbPollResponse {
  id: string;
  poll_id: string;
  session_id: string;
  word_submitted: string | null;
  option_selected: string | null;
  created_at: string;
}
