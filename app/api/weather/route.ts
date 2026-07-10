import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = searchParams.get('lat') || '20.5937';
  const longitude = searchParams.get('lon') || '78.9629';

  const apiKey = process.env.OPENWEATHER_API_KEY || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ambient_temp: 25, humidity: 55, condition: 'Clear', error: 'API key missing' });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } }); // cache 5 min
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();

    return NextResponse.json({
      ambient_temp: data.main?.temp ?? 25,
      humidity: data.main?.humidity ?? 55,
      condition: data.weather?.[0]?.main ?? 'Clear',
    });
  } catch {
    return NextResponse.json({ ambient_temp: 25, humidity: 55, condition: 'Unknown', error: 'Could not fetch' });
  }
}