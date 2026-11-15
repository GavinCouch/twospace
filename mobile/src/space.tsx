import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Account } from "./domain";
import { Screen, Button, ErrorText, Loading } from "./components/ui";
import { ApiError } from "./lib/api";
import { refreshAccount, useSpace } from "./lib/queries";
import { JournalScreen } from "./screens/journal";
import { SettingsScreen } from "./screens/settings";
import { PlansScreen } from "./screens/plans";
import { ActivitiesScreen } from "./screens/activities";
import { colors, styles } from "./theme";
type Tab = "Journal" | "Activities" | "Plans" | "Settings";
export function Space({ account }: { account: Account }) {
  const space = useSpace(account.id);
  const [tab, setTab] = useState<Tab>("Journal");
  useEffect(() => { if (space.error instanceof ApiError && [401, 403, 404].includes(space.error.status)) void refreshAccount(); }, [space.error]);
  if (space.isPending) return <Loading/>;
  if (!space.data) return <Screen><ErrorText error={space.error}/><Button onPress={() => void space.refetch()}>Try again</Button></Screen>;
  const props = { data: space.data, refresh: () => void space.refetch(), refreshing: space.isRefetching };
  return <View style={styles.screen}>{space.error && <View style={{ paddingHorizontal: 22, paddingTop: 8 }}><Text style={styles.muted}>Updates paused. Pull down to try again.</Text></View>}{tab === "Journal" ? <JournalScreen {...props}/> : tab === "Activities" ? <ActivitiesScreen {...props}/> : tab === "Plans" ? <PlansScreen {...props}/> : <SettingsScreen {...props}/>}<View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, paddingHorizontal: 12, paddingBottom: 5 }}>{(["Journal", "Activities", "Plans", "Settings"] as const).map((name) => <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: tab === name }} onPress={() => setTab(name)} style={{ flex: 1, minHeight: 54, justifyContent: "center", alignItems: "center", borderRadius: 16, backgroundColor: tab === name ? colors.surface : "transparent" }}><Text style={{ color: tab === name ? colors.accent : colors.muted, fontWeight: "600", fontSize: 14 }}>{name}</Text></Pressable>)}</View></View>;
}
