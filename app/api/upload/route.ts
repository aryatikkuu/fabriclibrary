import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError, requirePermission } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/upload — multipart upload of a fabric image (admin/editor).
 * Fields: file, mill_slug, fabric_code.
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
    if (!file.type.startsWith('image/')) throw new ValidationError('Only image uploads are accepted');

    const { storageService } = buildServices(await createClient());
    const uploaded = await storageService.uploadImage(
      millSlug, fabricCode, file.name, await file.arrayBuffer(), file.type,
    );

    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
