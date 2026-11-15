import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { SectionHeading } from "../components/section-heading";
import { Button, Chip, Empty, ErrorText, Field, Screen } from "../components/ui";
import { QuestionCard } from "../components/question-card";
import { post, patch } from "../lib/api";
import { API_URL } from "../lib/config";
import { useSpaceMutation } from "../lib/mutations";
import type { SpaceScreenProps } from "./journal";
import { styles } from "../theme";
export function ActivitiesScreen({ data, refresh, refreshing }: SpaceScreenProps) {
  const [tab, setTab] = useState<"Questions" | "Ideas">("Questions");
  const [prompt, setPrompt] = useState("");
  const [adding, setAdding] = useState(false);
  const question = useSpaceMutation(data.me.id, async () => { await post("/api/questions", { prompt: prompt.trim() }); setPrompt(""); setAdding(false); });
  const idea = useSpaceMutation(data.me.id, ({ id, saved }: { id: string; saved: boolean }) => patch(`/api/ideas/${id}`, { saved }));
  return <Screen refresh={refresh} refreshing={refreshing}><SectionHeading title="Activities"/><View style={styles.wrap}>{(["Questions", "Ideas"] as const).map((name) => <Chip key={name} label={name} selected={tab === name} onPress={() => setTab(name)}/>)}</View>{tab === "Questions" ? <>
    {data.members.length < 2 && <Text style={styles.muted}>Invite your partner to start a question together.</Text>}
    <Button secondary disabled={data.members.length < 2} onPress={() => setAdding(!adding)}>{adding ? "Cancel" : "Ask a question"}</Button>
    {adding && <View style={styles.card}><Field label="Your question" value={prompt} onChangeText={setPrompt} multiline maxLength={500}/><Button busy={question.isPending} disabled={!prompt.trim()} onPress={() => question.mutate()}>Start question</Button><ErrorText error={question.error}/></View>}
    {data.questions.length ? data.questions.map((item) => <QuestionCard key={item.id} question={item} data={data}/>) : <Empty title="What’s on your mind?" detail="Ask something, answer separately, then read each other’s replies."/>}
  </> : <><ErrorText error={idea.error}/>{data.ideas.map((item) => <View key={item.id} style={styles.card}><Text style={styles.muted}>{item.duration} min · {item.mode === "live" ? "Together" : "Anytime"}</Text><Text style={styles.heading}>{item.title}</Text><Text style={styles.text}>{item.description}</Text>{!!item.materials && <Text style={styles.muted}>{item.materials}</Text>}<Button secondary busy={idea.isPending} onPress={() => idea.mutate({ id: item.id, saved: !item.savedBy.includes(data.me.id) })}>{item.savedBy.includes(data.me.id) ? "Saved · remove" : "Save idea"}</Button></View>)}</>}
    <Button secondary onPress={() => void Linking.openURL(`${API_URL}/activities`)}>Open drawings and word clues on the website</Button>
  </Screen>;
}
