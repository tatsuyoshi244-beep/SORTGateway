import { NextResponse } from 'next/server';
import { getBuildInfo } from '@/lib/build-info';
import {
  evaluateDemoReadiness,
  evaluateDevelopmentReadiness,
  evaluateProductionReadiness,
  EXPECTED_SCHEMA_VERSION,
  readinessMode,
} from '@/lib/observability/readiness';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function dataStoreWritable(): Promise<boolean> {
  try {
    const dir = path.join(process.cwd(), '.data');
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, '.ready-probe');
    await fs.writeFile(probe, 'ok', 'utf-8');
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const info = getBuildInfo();
  const mode = readinessMode();

  if (mode === 'production') {
    const result = await evaluateProductionReadiness();
    return NextResponse.json(
      {
        ready: result.ready,
        ...info,
        mode,
        checks: result.checks,
        warnings: result.warnings,
        schema_version: result.schema_version,
        expected_schema_version: EXPECTED_SCHEMA_VERSION,
      },
      { status: result.ready ? 200 : 503 }
    );
  }

  if (mode === 'demo') {
    const result = evaluateDemoReadiness();
    return NextResponse.json(
      {
        ready: result.ready,
        ...info,
        mode,
        checks: result.checks,
        warnings: result.warnings,
        schema_version: result.schema_version,
      },
      { status: result.ready ? 200 : 503 }
    );
  }

  const dataWritable = await dataStoreWritable();
  const result = evaluateDevelopmentReadiness(dataWritable);

  return NextResponse.json(
    {
      ready: result.ready,
      ...info,
      mode,
      checks: result.checks,
      warnings: result.warnings,
      schema_version: result.schema_version,
    },
    { status: result.ready ? 200 : 503 }
  );
}
