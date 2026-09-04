interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // Check if the D1 database is bound correctly in your Cloudflare Pages Settings
    if (!context.env || !context.env.DB) {
      return new Response(
        `Error,Message\n"Database configuration error","The D1 Database binding named 'DB' is missing. Please go to your Cloudflare Pages project under Settings > Functions -> D1 Database bindings and add a binding with the exact name 'DB' pointing to your D1 database."`,
        {
          status: 500,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
          },
        }
      );
    }

    // Get limit and offset query params from request
    const url = new URL(context.request.url);
    const limitParam = url.searchParams.get('limit') || '25000';
    const offsetParam = url.searchParams.get('offset') || '0';

    const limit = parseInt(limitParam, 10);
    const offset = parseInt(offsetParam, 10);

    let results: any[] = [];
    
    // We add dynamic query preparation to handle potential D1 connection configurations
    try {
      const stmt = context.env.DB.prepare("SELECT * FROM sales LIMIT ? OFFSET ?").bind(limit, offset);
      const res = await stmt.all();
      results = res.results || [];
    } catch (sqlError: any) {
      return new Response(
        `Error,Message\n"SQL Execution Failure","Failed to run query on table 'sales': ${sqlError.message.replace(/"/g, '""')}"`,
        {
          status: 500,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
          },
        }
      );
    }

    if (!results || results.length === 0) {
      // Return empty response with code 204 or empty string (not headers) 
      // so the frontend knows there's no more data in the pagination chain
      return new Response("", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    // List of keys in order to build correct CSV structure (what the React app expects)
    const keys = [
      'DIVISION', 'DEPARTMENT', 'CATEGORY', 'SUBCATEGORY', 'CLASS',
      'BRAND', 'BRANCH NAME', 'BRANCH CODE', 'ITEM CODE', 'ITEM DESCRIPTION',
      'TYPE', 'TYPE Plus',
      '2024 CASH SALES', '2024 CREDIT SALES', '2024 TOTAL SALES',
      '2025 CASH SALES', '2025 CREDIT SALES', '2025 TOTAL SALES'
    ];

    // 2. Map target keys to database columns ONCE (instead of doing matches inside the loop)
    const firstRow = results[0];
    const dbKeyMap = keys.map(key => {
      // 1. Direct match
      if (firstRow[key] !== undefined) return key;

      // 2. Lowercase match
      const lowerKey = key.toLowerCase();
      if (firstRow[lowerKey] !== undefined) return lowerKey;

      // 3. Snake case match
      const snakeKey = key.replace(/\s+/g, '_').toLowerCase();
      if (firstRow[snakeKey] !== undefined) return snakeKey;

      // 4. Compact match
      const compactKey = key.replace(/[^A-Z0-9]/gi, '').toLowerCase();
      if (firstRow[compactKey] !== undefined) return compactKey;

      // 5. Cloudflare D1 CSV importing prefix check
      const prefixedSnakeKey = `_${snakeKey}`;
      if (firstRow[prefixedSnakeKey] !== undefined) return prefixedSnakeKey;

      const prefixedCompactKey = `_${compactKey}`;
      if (firstRow[prefixedCompactKey] !== undefined) return prefixedCompactKey;

      // fallback: look for dynamic keys
      const cleanTarget = key.replace(/[^A-Z0-9]/gi, '').toLowerCase();
      for (const actualKey of Object.keys(firstRow)) {
        if (actualKey.replace(/[^A-Z0-9]/gi, '').toLowerCase() === cleanTarget) {
          return actualKey;
        }
      }

      return null; // Column not found in SQL
    });

    // Helper to escape CSV values
    const escapeCsvValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // 3. Generate CSV Core Content in a single fast iteration (No internal loops, regex, or fallback runs)
    const headerRow = keys.join(',');
    
    let csvContent = headerRow + '\n';
    const rowCount = results.length;
    for (let i = 0; i < rowCount; i++) {
      const row = results[i];
      let rowStr = '';
      for (let j = 0; j < dbKeyMap.length; j++) {
        const dbKey = dbKeyMap[j];
        const val = dbKey ? row[dbKey] : '';
        rowStr += (j === 0 ? '' : ',') + escapeCsvValue(val);
      }
      csvContent += rowStr + '\n';
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });

  } catch (error: any) {
    return new Response(`Error,Message\n"Failed to fetch D1 Database structure","${error.message.replace(/"/g, '""')}"`, {
      status: 500,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }
};
