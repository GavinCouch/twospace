import { useState } from "react";
import { Text, View } from "react-native";
import type { SpaceSnapshot } from "../domain";
import { Screen, Button, Field, ErrorText, Empty, Chip } from "../components/ui";
import { SectionHeading } from "../components/section-heading";
import { EntryCard } from "../components/entry-card";
import { Invitation } from "../components/invitation";
import { post } from "../lib/api";
import { useSpaceMutation } from "../lib/mutations";
import { styles } from "../theme";
export type SpaceScreenProps = { data: SpaceSnapshot; refresh: () => void; refreshing: boolean };
export function JournalScreen({ data, refresh, refreshing }: SpaceScreenProps) {
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const create = useSpaceMutation(data.me.id, async () => { await post("/api/entries", { kind: "note", body: body.trim() }); setBody(""); setComposing(false); });
  const entries = data.entries.filter((entry) => !pinned || entry.pinned);
  return <Screen refresh={refresh} refreshing={refreshing}><SectionHeading title="Journal"/><View style={styles.stack}><Text style={styles.heading}>{data.space.name}</Text><View style={styles.wrap}>{data.members.map((member) => <Text key={member.id} style={styles.muted}>{member.name} · {new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: member.timeZone })}</Text>)}</View></View>{data.members.length === 1 && <Invitation/>}<Button secondary onPress={() => setComposing(!composing)}>{composing ? "Close composer" : "Write a note"}</Button>{composing && <View style={styles.card}><Field label="Your note" value={body} onChangeText={setBody} multiline maxLength={6000}/><Button busy={create.isPending} disabled={!body.trim()} onPress={() => create.mutate()}>Save note</Button><ErrorText error={create.error}/></View>}<View style={styles.wrap}><Chip label="All entries" selected={!pinned} onPress={() => setPinned(false)}/><Chip label="Pinned" selected={pinned} onPress={() => setPinned(true)}/></View>{entries.length ? entries.map((entry) => <EntryCard key={entry.id} entry={entry} data={data}/>) : <Empty title={pinned ? "Nothing pinned yet" : "Your journal starts here"} detail={pinned ? "Pin an entry to find it here later." : "Write a note or share a photo with your partner."}/>}</Screen>;
}
