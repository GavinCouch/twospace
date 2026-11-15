import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import {
  adjacencyGraphs,
  dictionary as common,
} from "@zxcvbn-ts/language-common";
import { dictionary as english, translations } from "@zxcvbn-ts/language-en";

const estimator = new ZxcvbnFactory({
  translations,
  graphs: adjacencyGraphs,
  dictionary: { ...common, ...english },
  maxLength: 128,
});

export function estimatePassword(password: string, userInputs: string[]) {
  const { score, feedback } = estimator.check(password, [
    "TwoSpace",
    ...userInputs,
  ]);
  return {
    score,
    advice: feedback.warning || feedback.suggestions[0] || "",
  };
}
