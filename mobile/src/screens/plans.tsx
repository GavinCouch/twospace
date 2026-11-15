import { useState } from "react";
import { Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SectionHeading } from "../components/section-heading";
import { PlanCard } from "../components/plan-card";
import {
  Button,
  Chip,
  Empty,
  ErrorText,
  Field,
  Screen,
} from "../components/ui";
import { post } from "../lib/api";
import { useSpaceMutation } from "../lib/mutations";
import type { SpaceScreenProps } from "./journal";
import { styles } from "../theme";
export function PlansScreen({ data, refresh, refreshing }: SpaceScreenProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date(Date.now() + 3600_000));
  const [duration, setDuration] = useState("30");
  const [kind, setKind] = useState<"call" | "date" | "visit">("call");
  const [past, setPast] = useState(false);
  const create = useSpaceMutation(data.me.id, async () => {
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440)
      throw new Error("Choose a duration between 5 and 1,440 minutes.");
    await post("/api/plans", {
      title: title.trim(),
      startsAt: date.toISOString(),
      timeZone: data.me.timeZone,
      duration: minutes,
      kind,
      notes: notes.trim(),
    });
    setTitle("");
    setNotes("");
    setAdding(false);
  });
  const plans = [...data.plans]
    .filter((plan) =>
      past
        ? plan.status === "done" ||
          Date.parse(plan.startsAt) + plan.duration * 60_000 < Date.now()
        : plan.status !== "done" &&
          Date.parse(plan.startsAt) + plan.duration * 60_000 >= Date.now(),
    )
    .sort(
      (a, b) =>
        (past ? -1 : 1) * (Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    );
  return (
    <Screen refresh={refresh} refreshing={refreshing}>
      <SectionHeading title="Plans" />
      <Button
        secondary
        disabled={create.isPending}
        onPress={() => setAdding(!adding)}
      >
        {adding ? "Close form" : "New plan"}
      </Button>
      {adding && (
        <View style={styles.card}>
          <Field
            editable={!create.isPending}
            label="Plan name"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <View style={styles.wrap}>
            {(["call", "date", "visit"] as const).map((value) => (
              <Chip
                key={value}
                label={
                  value === "call"
                    ? "Call"
                    : value === "date"
                      ? "Date"
                      : "Visit"
                }
                selected={kind === value}
                onPress={() => {
                  if (!create.isPending) setKind(value);
                }}
              />
            ))}
          </View>
          <Text style={styles.label}>
            When · {data.me.timeZone.replaceAll("_", " ")}
          </Text>
          <DateTimePicker
            disabled={create.isPending}
            value={date}
            mode="datetime"
            display="compact"
            timeZoneName={data.me.timeZone}
            themeVariant="dark"
            onChange={(_event, next) => {
              if (next) setDate(next);
            }}
          />
          <Field
            editable={!create.isPending}
            label="Minutes"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Field
            editable={!create.isPending}
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            maxLength={4000}
            multiline
          />
          <Button
            busy={create.isPending}
            disabled={!title.trim()}
            onPress={() => create.mutate()}
          >
            Propose plan
          </Button>
          <ErrorText error={create.error} />
        </View>
      )}
      <View style={styles.wrap}>
        <Chip
          label="Upcoming"
          selected={!past}
          onPress={() => setPast(false)}
        />
        <Chip label="Past" selected={past} onPress={() => setPast(true)} />
      </View>
      {plans.length ? (
        plans.map((plan) => <PlanCard key={plan.id} plan={plan} data={data} />)
      ) : (
        <Empty
          title={past ? "No past plans" : "No plans yet"}
          detail={
            past
              ? "Finished plans will appear here."
              : "Plan a call, a date, or a visit when that works for you."
          }
        />
      )}
    </Screen>
  );
}
