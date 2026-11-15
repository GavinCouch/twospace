export async function POST() {
  return Response.json(
    {
      error:
        "Sample spaces are no longer available. Create an account to continue.",
      code: "SAMPLE_RETIRED",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
