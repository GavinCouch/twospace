import type { Account } from "./domain";
import { Screen, Button, ErrorText, Loading } from "./components/ui";
import { useSpace } from "./lib/queries";
import { JournalScreen } from "./screens/journal";
export function Space({ account }: { account: Account }) {
  const space = useSpace(account.id);
  if (space.isPending) return <Loading/>;
  if (!space.data) return <Screen><ErrorText error={space.error}/><Button onPress={() => void space.refetch()}>Try again</Button></Screen>;
  return <JournalScreen data={space.data} refresh={() => void space.refetch()} refreshing={space.isRefetching}/>;
}
