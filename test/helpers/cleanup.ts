export async function settleCleanup(
  actions: Array<() => Promise<void>>,
  label: string,
): Promise<void> {
  const results = await Promise.allSettled(
    actions.map((action) => Promise.resolve().then(action)),
  );
  const failures = results
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    )
    .map((result) => result.reason);

  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, `${label} cleanup failed`);
  }
}
