import { useEffect } from "react";
import { Text, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Button, ErrorText, Loading, Screen } from "./components/ui";
import { queryClient, useAccount, useNativeQueryEvents } from "./lib/queries";
import { Space } from "./space";
import { PairingScreen } from "./screens/pairing";
import { SignInScreen } from "./screens/sign-in";
import { styles } from "./theme";
function Gate() {
  useNativeQueryEvents();
  const account = useAccount();
  useEffect(() => {
    if (account.data === null)
      queryClient.removeQueries({ queryKey: ["space"] });
  }, [account.data]);
  if (account.isPending) return <Loading />;
  if (account.error)
    return (
      <Screen>
        <ErrorText error={account.error} />
        <Button onPress={() => void account.refetch()}>Try again</Button>
      </Screen>
    );
  if (!account.data) return <SignInScreen />;
  if (!account.data.spaceId) return <PairingScreen account={account.data} />;
  return <Space key={account.data.id} account={account.data} />;
}
export function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <Gate />
    </QueryClientProvider>
  );
}
