import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all articles
export async function GET(req: NextRequest) {
  try {
    const articles = await prisma.article.findMany({
      orderBy: {
        publishedAt: 'desc'
      }
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new article
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, author, imageUrl, category } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const article = await prisma.article.create({
      data: {
        title,
        content,
        author: author || 'Admin',
        imageUrl: imageUrl || '',
        category: category || 'umum',
        publishedAt: new Date()
      }
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error('Error creating article:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}