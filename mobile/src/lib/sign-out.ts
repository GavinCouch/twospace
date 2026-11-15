import { auth, clearLocalSession } from "./auth";
import { accountKey, queryClient } from "./queries";
export async function signOut() {
  await queryClient.cancelQueries();
  let revoked = false;
  try { const result = await auth.signOut(); revoked = !result.error; }
  finally {
    await clearLocalSession();
    queryClient.removeQueries({ queryKey: ["space"] });
    queryClient.setQueryData(accountKey, null);
  }
  return revoked;
}
