import { NextResponse } from "next/server";
import { containers } from "../../../../lib/cosmos.js";
import { buildTrendSeries, mergeDailyTotals } from "../../../../lib/analytics";

function parseRange(searchParams) {
  const value = Number(searchParams.get("range"));
  if (!Number.isFinite(value) || value <= 0) {
    return 30;
  }
  return Math.min(180, Math.max(7, Math.round(value)));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const rangeDays = parseRange(searchParams);

  try {
    const { resources } = await containers.rewards.items.query("SELECT * FROM c").fetchAll();
    const dailyTotalsMap = mergeDailyTotals(resources || []);
    const series = buildTrendSeries(dailyTotalsMap, rangeDays);

    return NextResponse.json({ rangeDays, series });
  } catch (error) {
    console.error("[API analytics org-trend]", error);
    return NextResponse.json({ error: "Failed to load org trend" }, { status: 500 });
  }
}

