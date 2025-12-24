// frontend/src/app/api/revalidate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    // Проверка секрета: поддерживаем header или query param (совместимость с backend).
    const headerSecret = request.headers.get("x-revalidation-secret") || "";
    const urlSecret = request.nextUrl.searchParams.get("secret") || "";
    const secret = headerSecret || urlSecret;

    if (!process.env.REVALIDATION_SECRET || secret !== process.env.REVALIDATION_SECRET) {
      console.warn("Invalid revalidation secret attempt", { headerSecretProvided: !!headerSecret, urlSecretProvided: !!urlSecret });
      return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    // Получаем тело
    const body = await request.json().catch(() => ({}));
    const { paths, tags } = body ?? {};

    console.log("Revalidation request received:", { paths, tags });

    // Ревалидация путей
    if (paths && Array.isArray(paths)) {
      for (const path of paths) {
        try {
          await (revalidatePath as unknown as (...args: any[]) => Promise<any>)(path);
          console.log(`Revalidated path: ${path}`);
        } catch (err) {
          console.warn(`Failed to revalidate path ${path}:`, err);
        }
      }
    }

    // Ревалидация тегов
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        try {
          await (revalidateTag as unknown as (...args: any[]) => Promise<any>)(tag);
          console.log(`Revalidated tag: ${tag}`);
        } catch (err) {
          console.warn(`Failed to revalidate tag ${tag}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      revalidated: true,
      paths: paths || [],
      tags: tags || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error during revalidation:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error during revalidation",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET for simple healthcheck (optional)
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") || request.headers.get("x-revalidation-secret") || "";
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }
  return NextResponse.json({
    status: "OK",
    message: "Revalidation endpoint is working",
    timestamp: new Date().toISOString(),
  });
}
