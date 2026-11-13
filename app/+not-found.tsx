import { router } from "expo-router";
import { Page, Empty, Button } from "../src/components/ui";
export default function NotFound() {
  return (
    <Page>
      <Empty
        title="This page could not be found"
        description="Return to your medicine overview to continue."
        action={
          <Button title="Go to overview" onPress={() => router.replace("/")} />
        }
      />
    </Page>
  );
}
