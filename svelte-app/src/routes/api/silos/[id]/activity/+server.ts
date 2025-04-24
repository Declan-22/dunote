// src/routes/api/silos/[id]/activity/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  try {
    // Validate UUID
    if (!/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(params.id)) {
      return new Response(JSON.stringify({ error: 'Invalid silo ID' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate mock data for the last 180 days
    const mockData = [];
    const now = new Date();
    
    for (let i = 0; i < 180; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      
      // Create random activity count (more likely on weekdays)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const randomFactor = isWeekend ? 0.3 : 1;
      const count = Math.random() > 0.6 ? Math.floor(Math.random() * 8 * randomFactor) : 0;
      
      mockData.push({
        date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        count: count
      });
    }

    return new Response(JSON.stringify(mockData), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in activity API:', error);
    return new Response(JSON.stringify({ error: 'Server error processing activity data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};