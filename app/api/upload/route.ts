import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { validateImage } from '@/lib/images';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload — multipart upload of a fabric image (admin/editor).
 * Fields: file, mill_slug (must be a known mill), fabric_code.
 * The stored type comes from the file's bytes, not the client's claim.
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission('fabrics.create');

    const form = await request.formData();
    const file = form.get('file');
    const millSlug = String(form.get('mill_slug') ?? '');
    const fabricCode = String(form.get('fabric_code') ?? '');

    if (!(file instanceof File)) throw new ValidationError('file is required');
    if (!millSlug || !fabricCode) throw new ValidationError('mill_slug and fabric_code are required');
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = validateImage(bytes);

    const { storageService, millService } = buildServices(await createClient());
    const mill = await millService.getBySlug(millSlug); // 404 for unknown mills
    const uploaded = await storageService.uploadImage(mill.slug, fabricCode, file.name, bytes, type);

    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
