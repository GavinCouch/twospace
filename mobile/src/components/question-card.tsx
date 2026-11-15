import { useState } from "react";
import { Text, View } from "react-native";
import type { QuestionRound, SpaceSnapshot } from "../domain";
import { Button, ErrorText, Field } from "./ui";
import { post } from "../lib/api";
import { useSpaceMutation } from "../lib/mutations";
import { styles } from "../theme";
export function QuestionCard({ question, data }: { question: QuestionRound; data: SpaceSnapshot }) {
  const [answer, setAnswer] = useState("");
  const mutation = useSpaceMutation(data.me.id, async () => { await post(`/api/questions/${question.id}/answers`, { body: answer.trim() }); setAnswer(""); });
  const answered = question.answers.some((item) => item.userId === data.me.id);
  return <View style={styles.card}><Text style={styles.muted}>{question.category}</Text><Text style={styles.heading}>{question.prompt}</Text>{question.answers.map((item) => <View key={item.userId} style={styles.stack}><Text style={styles.label}>{data.members.find((person) => person.id === item.userId)?.name || "Partner"}</Text><Text selectable style={item.body === null ? styles.muted : styles.text}>{item.body === null ? "Their answer opens after you both reply." : item.body}</Text></View>)}{!answered ? <><Field label="Your answer" value={answer} onChangeText={setAnswer} multiline maxLength={2000}/><Button busy={mutation.isPending} disabled={!answer.trim()} onPress={() => mutation.mutate()}>Share answer</Button></> : !question.complete && <Text style={styles.muted}>Waiting for your partner’s answer.</Text>}<ErrorText error={mutation.error}/></View>;
}
