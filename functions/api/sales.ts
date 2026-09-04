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

    // Get limit and pagination parameters from request
    const url = new URL(context.request.url);
    const limitParam = url.searchParams.get('limit') || '25000';
    const offsetParam = url.searchParams.get('offset') || '0';
    const lastIdParam = url.searchParams.get('lastId');
    const debugParam = url.searchParams.get('debug');

    const limit = parseInt(limitParam, 10);
    const offset = parseInt(offsetParam, 10);

    let results: any[] = [];
    
    // We utilize auto-incrementing ID keyset pagination if provided (O(log N) speed)
    // and fall back to standard OFFSET pagination if not. This completely avoids 
    // SQLite full table scans and stays well under Cloudflare's 50ms CPU limit!
    try {
      if (lastIdParam !== null) {
        const lastId = parseInt(lastIdParam, 10);
        const stmt = context.env.DB.prepare("SELECT * FROM sales WHERE id > ? LIMIT ?").bind(lastId, limit);
        const res = await stmt.all();
        results = res.results || [];
      } else {
        // Fallback or page 1 fallback using OFFSET
        const stmt = context.env.DB.prepare("SELECT * FROM sales LIMIT ? OFFSET ?").bind(limit, offset);
        const res = await stmt.all();
        results = res.results || [];
      }
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

    // Direct JSON output for debugging: If query param debug=true exists, output the raw row keys
    if (debugParam === 'true') {
      return new Response(JSON.stringify({
        rowCount: results.length,
        firstRowKeys: Object.keys(results[0]),
        firstRowValues: results[0]
      }, null, 2), {
        headers: {
          "Content-Type": "application/json"
        }
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
      
      // We perform standard word-fragment checks for complex column alignments
      // (e.g. aligning "2025 TOTAL SALES" with "sales_2025_total" or "total_sales_2025")
      const wordsInKey = key.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);

      for (const actualKey of Object.keys(firstRow)) {
        const lowerActual = actualKey.toLowerCase();
        if (lowerActual === 'id') continue; // Always ignore auto-generated ID columns so they don't hijack matches
        
        const cleanActual = lowerActual.replace(/[^A-Z0-9]/gi, '');
        if (cleanActual === cleanTarget) {
          return actualKey;
        }

        // Check if all letters and numbers in our target are inside the DB column in some order
        // E.g. "2025", "total", and "sales" must ALL match in the actual column "sales_2025_total"
        const isMatch = wordsInKey.every(word => lowerActual.includes(word));
        if (isMatch) {
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

    // Determine the last processed ID in this result slice to send back in headers
    let lastId = 0;
    const dbIdKey = Object.keys(firstRow).find(key => key.toLowerCase() === 'id');
    if (dbIdKey && results.length > 0) {
      lastId = results[results.length - 1][dbIdKey] || 0;
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "X-Last-ID": String(lastId),             // Pass fast keyset pointer to client
        "Access-Control-Expose-Headers": "X-Last-ID" // Permit browser reading of custom ID header
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
