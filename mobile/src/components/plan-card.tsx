import { useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import type { Plan, SpaceSnapshot } from "../domain";
import { api, patch } from "../lib/api";
import { useSpaceMutation } from "../lib/mutations";
import { Button, ErrorText, Field } from "./ui";
import { colors, styles } from "../theme";
export function PlanCard({ plan, data }: { plan: Plan; data: SpaceSnapshot }) {
  const [item, setItem] = useState("");
  const change = useSpaceMutation(data.me.id, (body: unknown) =>
    patch(`/api/plans/${plan.id}`, body),
  );
  const add = useSpaceMutation(data.me.id, async () => {
    await patch(`/api/plans/${plan.id}`, {
      checklistAction: { type: "add", text: item.trim() },
    });
    setItem("");
  });
  const remove = useSpaceMutation(data.me.id, () =>
    api(`/api/plans/${plan.id}`, { method: "DELETE" }),
  );
  const accepted = plan.acceptedBy.includes(data.me.id);
  return (
    <View style={styles.card}>
      <Text style={styles.muted}>
        {plan.kind === "visit"
          ? "Visit"
          : plan.kind === "date"
            ? "Date"
            : "Call"}{" "}
        · {plan.duration} min ·{" "}
        {plan.status === "accepted"
          ? "Both confirmed"
          : plan.status === "done"
            ? "Done"
            : "Proposed"}
      </Text>
      <Text style={styles.heading}>{plan.title}</Text>
      <View style={styles.stack}>
        {data.members.map((member) => (
          <Text key={member.id} style={styles.text}>
            {member.name}:{" "}
            {new Date(plan.startsAt).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: member.timeZone,
            })}
          </Text>
        ))}
      </View>
      {!!plan.notes && (
        <Text selectable style={styles.text}>
          {plan.notes}
        </Text>
      )}
      {!!plan.link && (
        <Button
          secondary
          onPress={() => {
            if (/^https?:\/\//i.test(plan.link))
              void Linking.openURL(plan.link);
          }}
        >
          Open plan link
        </Button>
      )}
      {plan.status !== "done" && (
        <View style={styles.wrap}>
          <Button
            secondary
            busy={change.isPending}
            onPress={() => change.mutate({ accepted: !accepted })}
          >
            {accepted ? "Withdraw confirmation" : "Confirm plan"}
          </Button>
          <Button
            secondary
            disabled={change.isPending}
            onPress={() => change.mutate({ status: "done" })}
          >
            Mark done
          </Button>
        </View>
      )}
      {plan.checklist.map((task) => (
        <Pressable
          key={task.id}
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: task.done,
            disabled: change.isPending,
          }}
          disabled={change.isPending}
          onPress={() =>
            change.mutate({ checklistAction: { type: "toggle", id: task.id } })
          }
          style={[styles.row, { minHeight: 48 }]}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: task.done ? colors.accent : colors.muted,
              backgroundColor: task.done ? colors.accent : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {task.done && <Text style={{ color: colors.ink }}>✓</Text>}
          </View>
          <Text
            style={[
              styles.text,
              {
                flex: 1,
                textDecorationLine: task.done ? "line-through" : "none",
                color: task.done ? colors.muted : colors.text,
              },
            ]}
          >
            {task.text}
          </Text>
        </Pressable>
      ))}
      {plan.status !== "done" && (
        <>
          <Field
            editable={!add.isPending}
            label="Add to the checklist"
            value={item}
            onChangeText={setItem}
            maxLength={300}
          />
          <Button
            secondary
            busy={add.isPending}
            disabled={!item.trim()}
            onPress={() => add.mutate()}
          >
            Add item
          </Button>
        </>
      )}
      {plan.proposedBy === data.me.id && (
        <Button
          secondary
          busy={remove.isPending}
          onPress={() =>
            Alert.alert(
              "Delete this plan?",
              "The shared checklist will also be removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => remove.mutate(),
                },
              ],
            )
          }
        >
          Delete plan
        </Button>
      )}
      <ErrorText error={change.error || add.error || remove.error} />
    </View>
  );
}
