// frontend/src/app/api/revalidate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    // Проверка секретного ключа для безопасности
    //const secret = request.headers.get('x-revalidation-secret') 
    
    //if (secret !== process.env.REVALIDATION_SECRET) {
    //  console.error('Invalid revalidation secret')
    //  return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
    //}

    // Получение данных из тела запроса
    const body = await request.json()
    const { paths, tags } = body

    console.log('Revalidation request received:', { paths, tags })

    // Ревалидация путей
    if (paths && Array.isArray(paths)) {
      for (const path of paths) {
        revalidatePath(path)
        console.log(`Revalidated path: ${path}`)
      }
    }

    // Ревалидация тегов
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        revalidateTag(tag)
        console.log(`Revalidated tag: ${tag}`)
      }
    }

    return NextResponse.json({ 
      success: true,
      revalidated: true,
      paths: paths || [],
      tags: tags || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error during revalidation:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Error during revalidation',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}

// Добавим GET метод для тестирования
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
  }

  return NextResponse.json({ 
    status: 'OK', 
    message: 'Revalidation endpoint is working',
    timestamp: new Date().toISOString()
  })
}