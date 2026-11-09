import { eq } from "drizzle-orm";
import { emptyRuntime, type RuntimeState } from "../shared/behavior";
import type { AppDb } from "../db/client";
import { endpointRuntime } from "../db/schema";

export async function loadRuntime(db: AppDb, endpointId: string): Promise<RuntimeState> {
  const [row] = await db
    .select()
    .from(endpointRuntime)
    .where(eq(endpointRuntime.endpointId, endpointId))
    .limit(1);
  if (!row) return emptyRuntime();
  return {
    records: Array.isArray(row.records) ? row.records : [],
    seenIds: Array.isArray(row.seenIds) ? row.seenIds : [],
    scenarioIndex: row.scenarioIndex || 0,
    fetchCursor: row.fetchCursor || undefined,
    rateCount: row.rateCount || 0,
    rateWindowStart: row.rateWindowStart ? row.rateWindowStart.getTime() : 0,
  };
}

export async function saveRuntime(db: AppDb, endpointId: string, state: RuntimeState): Promise<void> {
  await db
    .insert(endpointRuntime)
    .values({
      endpointId,
      records: state.records,
      seenIds: state.seenIds,
      scenarioIndex: state.scenarioIndex,
      fetchCursor: state.fetchCursor,
      rateCount: state.rateCount || 0,
      rateWindowStart: state.rateWindowStart ? new Date(state.rateWindowStart) : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: endpointRuntime.endpointId,
      set: {
        records: state.records,
        seenIds: state.seenIds,
        scenarioIndex: state.scenarioIndex,
        fetchCursor: state.fetchCursor,
        rateCount: state.rateCount || 0,
        rateWindowStart: state.rateWindowStart ? new Date(state.rateWindowStart) : null,
        updatedAt: new Date(),
      },
    });
}

export async function resetRuntime(db: AppDb, endpointId: string): Promise<void> {
  await db.delete(endpointRuntime).where(eq(endpointRuntime.endpointId, endpointId));
}
